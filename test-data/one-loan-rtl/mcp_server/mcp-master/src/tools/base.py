"""
Base tool classes and registry for MCP server
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import functools
import json
import logging
import os
import time
from datetime import datetime

_base_logger = logging.getLogger("mcp.tools")

# CloudWatch namespace/metric for per-tool call counts emitted from Lambdas
TOOL_METRICS_NAMESPACE = "MCP/Lambda"
TOOL_CALLS_METRIC = "ToolCalls"

def _emit_tool_call_metric(tool_name: str) -> None:
    """Print an EMF line that CloudWatch turns into a ToolCalls metric (Lambda only; no-op on the server).
    Uses print() since the Lambda log formatter breaks EMF, and never raises so it can't break a tool call."""
    function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    if not function_name:
        return
    try:
        print(json.dumps({
            "_aws": {
                "Timestamp": int(time.time() * 1000),
                "CloudWatchMetrics": [{
                    "Namespace": TOOL_METRICS_NAMESPACE,
                    "Dimensions": [["FunctionName", "ToolName"]],
                    "Metrics": [{"Name": TOOL_CALLS_METRIC, "Unit": "Count"}],
                }],
            },
            "FunctionName": function_name,
            "ToolName": tool_name,
            TOOL_CALLS_METRIC: 1,
        }), flush=True)
    except Exception:
        _base_logger.warning("Failed to emit tool call metric for %s", tool_name, exc_info=True)


def _extract_response_body(exc: Optional[BaseException]) -> Any:
    """Best-effort extraction of a downstream HTTP response body from an exception."""
    response = getattr(exc, "response", None)
    if response is None:
        return None
    try:
        return response.json()
    except Exception:
        try:
            return response.text
        except Exception:
            return None


def sanitized_error(
    user_message: str,
    exc: Optional[BaseException] = None,
    *,
    logger: Optional[logging.Logger] = None,
    success: bool = False,
    indent: int = 2,
    **log_context: Any,
) -> str:
    """Return a minimal, caller-safe JSON error while logging full internals.

    The caller only receives ``user_message`` (a generic business-level
    description). The raw exception text, any downstream HTTP response body,
    and a stack trace are logged server-side only — never returned over the
    wire — to avoid leaking internal URLs, hostnames, tech stack, or
    implementation details (CWE-209 / OWASP A05).
    """
    log = logger or _base_logger
    downstream_body = _extract_response_body(exc)
    log.error(
        "%s | detail=%s | downstream=%s%s",
        user_message,
        str(exc) if exc is not None else "",
        downstream_body,
        f" | context={log_context}" if log_context else "",
        exc_info=exc if exc is not None else False,
    )
    return json.dumps({"success": success, "error": user_message}, indent=indent)


class BaseTool(ABC):
    """Base class for all MCP tools"""

    def __init_subclass__(cls, **kwargs):
        """Wrap each tool subclass's own execute() so every call emits a ToolCalls metric.
        Skips inherited or already-wrapped execute() methods so no call is counted twice."""
        super().__init_subclass__(**kwargs)
        original = cls.__dict__.get("execute")
        if original is None or getattr(original, "_tool_metrics_wrapped", False):
            return

        @functools.wraps(original)
        async def execute_with_metrics(self, arguments: Dict[str, Any]) -> str:
            try:
                return await original(self, arguments)
            finally:
                # Count the call whether it succeeded, returned an error, or raised.
                _emit_tool_call_metric(getattr(self, "name", cls.__name__))

        execute_with_metrics._tool_metrics_wrapped = True
        cls.execute = execute_with_metrics
    
    def __init__(self, name: str, description: str, input_schema: Dict[str, Any]):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.created_at = datetime.now()
    
    @abstractmethod
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """Execute the tool with given arguments"""
        pass
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the tool's input schema for MCP protocol"""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema
        }
    
    def validate_arguments(self, arguments: Dict[str, Any]) -> bool:
        """Validate arguments against the input schema"""
        required_fields = self.input_schema.get("required", [])
        
        for field in required_fields:
            if field not in arguments:
                return False
        
        return True


class ToolRegistry:
    """Registry for managing MCP tools"""
    
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
    
    def register(self, tool: BaseTool) -> None:
        """Register a tool"""
        self._tools[tool.name] = tool
    
    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Get a tool by name"""
        return self._tools.get(name)
    
    def get_all_tools(self) -> List[BaseTool]:
        """Get all registered tools"""
        return list(self._tools.values())
    
    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """Get schemas for all tools"""
        return [tool.get_schema() for tool in self._tools.values()]
    
    def list_tool_names(self) -> List[str]:
        """Get list of all tool names"""
        return list(self._tools.keys())
    
    def unregister(self, name: str) -> bool:
        """Unregister a tool"""
        if name in self._tools:
            del self._tools[name]
            return True
        return False
