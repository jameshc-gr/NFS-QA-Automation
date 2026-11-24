"""
MCP Server Factory for creating and configuring servers
"""

import logging
from typing import Dict, Any, List
from ..tools import ToolRegistry
from .config import ServerConfig

logger = logging.getLogger(__name__)


class MCPServerFactory:
    """Factory for creating MCP servers with modular tool support"""
    
    def __init__(self, config: ServerConfig = None):
        self.config = config or ServerConfig()
        self.tool_registry = ToolRegistry()
        self._register_default_tools()
    
    def _register_default_tools(self):
        """Register all tools automatically using auto-discovery"""
        from ..tools.auto_discovery import discover_tools, get_tool_config_key, create_tool_instance
        
        # Discover all tools automatically
        tool_classes = discover_tools()
        
        for tool_class in tool_classes:
            # Generate config key from tool class name
            config_key = get_tool_config_key(tool_class)
            
            # Check if tool is enabled in config
            if self.config.is_tool_enabled(config_key.lower().replace('tool_', '').replace('_enabled', '')):
                try:
                    tool_instance = create_tool_instance(tool_class)
                    self.tool_registry.register(tool_instance)
                    logger.info("Registered tool: %s", tool_instance.name)
                except Exception as e:
                    logger.error("Failed to register %s: %s", tool_class.__name__, e)
    
    def register_tool(self, tool):
        """Register a custom tool"""
        self.tool_registry.register(tool)
    
    def get_tool_info(self):
        """Get information about registered tools"""
        return {
            "total_tools": len(self.tool_registry.get_all_tools()),
            "tool_names": self.tool_registry.list_tool_names(),
            "enabled_tools": [name for name, enabled in self.config.tools_enabled.items() if enabled]
        }
