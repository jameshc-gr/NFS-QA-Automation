#!/usr/bin/env python3
"""
FastAPI wrapper for Modular MCP Server
Provides better performance, automatic API documentation, and easier deployment
"""

import asyncio
import json
import logging
import os
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Depends, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
try:
    from ddtrace import tracer as dd_tracer
except ImportError:
    dd_tracer = None
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from src.server import MCPServerFactory, ServerConfig
from src.tools import ToolRegistry
from src.security import AuthManager, RequestValidator, redact_pii, redact_headers
from src.cache import RedisBackend, ToolCacheManager
from src.secrets_manager import load_secrets

# Configure structured JSON logging for Datadog
class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log: Dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Promote extra keys (e.g. request_id, tool_name) to top-level JSON fields
        for key, val in record.__dict__.items():
            if key not in {"levelname", "name", "msg", "args", "message",
                           "pathname", "filename", "module", "funcName",
                           "lineno", "created", "msecs", "relativeCreated",
                           "thread", "threadName", "processName", "process",
                           "exc_info", "exc_text", "stack_info", "levelno"}:
                log[key] = val
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log)

_json_handler = logging.StreamHandler()
_json_handler.setFormatter(_JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_json_handler])
logger = logging.getLogger(__name__)

# Initialize rate limiter
def _rate_limit_key(request: Request) -> str:
    """Rate-limit key that works behind the internal ALB.

    The server sits behind a load balancer, so the socket peer is almost always
    the same ALB IP — keying on it would lump all callers into one bucket. We
    instead use the original client IP from X-Forwarded-For. NOTE: client_id is
    intentionally NOT used because the same Okta client_id/secret is shared
    across multiple consuming applications, so it cannot distinguish callers.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # First entry is the original client; the rest are proxy hops.
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)

# Lifespan event handler
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the MCP server factory on startup"""
    global server_factory, tool_registry, auth_manager, request_validator, tool_cache
    
    logger.info("🚀 Starting FastAPI MCP Server...")
    
    try:
        # Load secrets from Vault / AWS Secrets Manager into environment variables
        load_secrets()

        # Create configuration
        config = ServerConfig()
        
        # Create server factory
        server_factory = MCPServerFactory(config)
        tool_registry = server_factory.tool_registry
        
        # Initialize security components
        auth_manager = AuthManager()
        request_validator = RequestValidator()

        # Initialize tool result cache
        # Add tool names to CACHE_TOOLS env var and redeploy to enable caching.
        redis_backend = RedisBackend(redis_url=config.redis_url)
        try:
            await redis_backend.connect()
            tool_cache = ToolCacheManager(
                tool_names=config.cache_tools,
                ttl=config.cache_ttl,
                backend=redis_backend,
            )
            if config.cache_tools:
                logger.info("🗄️  Redis cache enabled | tools=%s ttl=%ds", config.cache_tools, config.cache_ttl)
            else:
                logger.info("🗄️  Redis cache connected but CACHE_TOOLS is empty — nothing will be cached")
        except Exception as e:
            logger.warning("🗄️  Redis unavailable (%s) — caching disabled", e)
            tool_cache = ToolCacheManager(tool_names=[], backend=None)
        
        logger.info(f"✅ Server initialized with {len(tool_registry.get_all_tools())} tools")
        logger.info(f"🔧 Available tools: {', '.join(tool_registry.list_tool_names())}")
        logger.info("🔒 Security: Token-based authentication enabled")
        logger.info(f"🌐 Public access: {'Enabled' if config.public_access_enabled else 'Disabled'}")
    except ValueError as e:
        logger.error(f"❌ Configuration error: {e}")
        logger.error("Server cannot start due to configuration issue. Please check environment variables.")
        raise  # Re-raise to prevent server from starting with invalid config
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        logger.exception("Full error details:")
        raise  # Re-raise to prevent server from starting
    
    yield

    logger.info("🛑 Shutting down FastAPI MCP Server...")
    if tool_cache:
        await tool_cache.close()

# Create FastAPI app
# ROOT_PATH must match the reverse-proxy path prefix (e.g. /mcp/digital-mortgage-systems)
# so that the Swagger UI loads /openapi.json from the correct absolute URL.
root_path = os.getenv("ROOT_PATH", "")

# Security: the interactive docs and the OpenAPI schema expose the full tool
# catalog and their input schemas. Keep them OFF by default and only enable
# them in non-prod by setting ENABLE_DOCS=true.
docs_enabled = os.getenv("ENABLE_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Modular MCP Server",
    description="A modular MCP (Model Context Protocol) server with FastAPI",
    version="2.0.0",
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
    root_path=root_path,
    lifespan=lifespan
)

# Attach rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware with restricted origins
# Security: Restrict CORS to specific origins instead of allowing all
cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]
# If no origins specified, default to empty list (no CORS)
# For development, you can set CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Security: the CORS spec forbids combining a wildcard "*" origin with
# credentials, and doing so is unsafe. If "*" is ever configured, disable
# credentialed CORS so we fail safe instead of exposing authenticated responses.
cors_allow_credentials = "*" not in cors_origins
if not cors_allow_credentials:
    logger.warning("CORS configured with '*' origin; disabling allow_credentials for safety.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else [],  # Specific domains only
    allow_credentials=cors_allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],  # Only needed methods
    allow_headers=["Content-Type", "Authorization"],  # Only needed headers
)

# Global server factory
server_factory: Optional[MCPServerFactory] = None
tool_registry: Optional[ToolRegistry] = None
tool_cache: Optional[ToolCacheManager] = None

# Pydantic models for request/response
class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: str
    method: str
    params: Optional[Dict[str, Any]] = None

class MCPResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None

class ToolCallRequest(BaseModel):
    name: str
    arguments: Dict[str, Any]

class ToolCallResponse(BaseModel):
    content: List[Dict[str, str]]

# Authentication dependency
async def verify_auth(request: Request):
    """Verify authentication if enabled and record the calling application."""
    if not server_factory or not server_factory.config.auth_enabled:
        return True
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=401, 
            detail="Authentication required. Please provide a valid Bearer token in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    client_ip = request.client.host if request.client else "unknown"

    # Introspect once so we can both validate AND identify the calling app
    token_info = auth_manager.introspect_bearer_token(token)
    if not token_info:
        # Log failed auth attempt
        auth_manager.log_auth_attempt(token, False, str(request.url), client_ip)
        raise HTTPException(
            status_code=401, 
            detail="Invalid token. Please check your authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Identify the calling application from the introspection payload
    caller = auth_manager.extract_caller_identity(token_info)
    request.state.caller = caller

    # Log successful auth attempt with caller identity
    auth_manager.log_auth_attempt(token, True, str(request.url), client_ip, caller=caller)

    # Tag the Datadog trace so the calling app is visible/searchable in APM
    if dd_tracer:
        span = dd_tracer.current_root_span()
        if span:
            if caller.get("client_id"):
                span.set_tag("caller.client_id", caller["client_id"])
            if caller.get("subject"):
                span.set_tag("caller.subject", caller["subject"])
            if caller.get("username"):
                span.set_tag("caller.username", caller["username"])
            span.set_tag("caller.ip", client_ip)

    return True

# Maximum allowed size (bytes) for non-upload request bodies (JSON payloads).
# File uploads (multipart/form-data) are intentionally exempt and uncapped.
MAX_JSON_BODY_BYTES = int(os.getenv("MAX_JSON_BODY_BYTES", str(1 * 1024 * 1024)))  # 1 MB default


# Request body size limit middleware (JSON payloads only; uploads exempt)
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject oversized JSON payloads to protect against memory-exhaustion DoS.

    Multipart uploads (file transfers) are exempt so large document uploads keep
    working; only non-upload bodies are capped at MAX_JSON_BODY_BYTES.
    """
    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("multipart/form-data"):
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_JSON_BODY_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request payload too large"},
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header"},
                )
        else:
            # No Content-Length (e.g. chunked transfer) — buffer the body with a
            # cap so a streamed payload cannot bypass the size limit. Starlette
            # caches the body, so downstream handlers can still read it.
            body = await request.body()
            if len(body) > MAX_JSON_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request payload too large"},
                )
    return await call_next(request)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Swagger UI (/docs, /redoc) and the OpenAPI schema need relaxed frame/CSP
    # rules because the UI embeds an oauth2-redirect iframe and loads inline scripts.
    # Check both the bare path and the root_path-prefixed path because the
    # partner-gateway may or may not strip the path prefix before forwarding.
    _docs_segments = ("/docs", "/redoc", "/openapi.json")
    _path = request.url.path
    is_docs_path = _path.startswith(_docs_segments) or (
        root_path and _path.startswith(tuple(f"{root_path}{s}" for s in _docs_segments))
    )
    if is_docs_path:
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net"
        )
    else:
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "tools_count": len(tool_registry.get_all_tools()) if tool_registry else 0,
        "server": "FastAPI MCP Server v2.0.0"
    }


# MCP protocol endpoints
@app.get("/mcp/")
async def mcp_info():
    """MCP server information"""
    logger.info("🟢 GET /mcp/ called")
    return {
        "jsonrpc": "2.0",
        "id": "server-info",
        "result": {
            "name": "fastapi_mcp_server",
            "version": "2.0.0",
            "tools_count": len(tool_registry.get_all_tools()) if tool_registry else 0
        }
    }

@app.get("/mcp/tools")
@limiter.limit("30/minute")  # Rate limit: 30 requests per minute
async def list_tools(request: Request, auth: bool = Depends(verify_auth)):
    """List all available tools"""
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    return {
        "jsonrpc": "2.0",
        "id": "tools-list",
        "result": {
            "tools": tool_registry.get_tool_schemas()
        }
    }

@app.post("/mcp/")
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def mcp_request(request: Request, mcp_req: MCPRequest, auth: bool = Depends(verify_auth)):
    """Handle MCP protocol requests"""
    # Log the incoming request (method/id only — params may contain PII)
    logger.info(f"🔵 POST /mcp/ called: method={mcp_req.method}, id={mcp_req.id}")
    
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    # Use mcp_req for the actual request data
    request_data = mcp_req
    
    method = request_data.method
    params = request_data.params or {}
    
    logger.info(f"   Processing method: {method}")
    
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_data.id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "fastapi_mcp_server",
                    "version": "2.0.0"
                }
            }
        }
    
    elif method == "tools/list":
        logger.info(f"   ✅ Handling tools/list, returning tools")
        tools = tool_registry.get_tool_schemas()
        response = {
            "jsonrpc": "2.0",
            "id": request_data.id,
            "result": {
                "tools": tools
            }
        }
        logger.info(f"   📦 Returning {len(tools)} tools with id={request_data.id}")
        return response
    
    elif method == "tools/call":
        tool_name = params.get('name', '')
        arguments = params.get('arguments', {})
        
        tool = tool_registry.get_tool(tool_name)
        if not tool:
            return {
                "jsonrpc": "2.0",
                "id": request_data.id,
                "error": {
                    "code": -32601,
                    "message": f"Tool not found: {tool_name}"
                }
            }
        
        try:
            # Validate and sanitize arguments before execution (same path as /tools/{tool_name})
            validated_request = request_validator.validate_tool_request(tool_name, arguments)
            sanitized_args = validated_request['arguments']

            # Cache check
            if tool_cache:
                cached = await tool_cache.get(tool_name, sanitized_args)
                if cached is not None:
                    logger.info(
                        f"POST /mcp/ tools/call | tool={tool_name} | id={request_data.id} | status: 200 (cache HIT)",
                        extra={"tool_name": tool_name, "cache": "hit"},
                    )
                    return {
                        "jsonrpc": "2.0",
                        "id": request_data.id,
                        "result": {"content": [{"type": "text", "text": cached}], "cached": True},
                    }

            # Execute the tool
            result = await tool.execute(sanitized_args)

            # Store in cache
            if tool_cache:
                await tool_cache.set(tool_name, sanitized_args, result)

            return {
                "jsonrpc": "2.0",
                "id": request_data.id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": result
                        }
                    ]
                }
            }
        except ValueError as e:
            logger.warning(f"Validation error for tool {tool_name}: {e}")
            return {
                "jsonrpc": "2.0",
                "id": request_data.id,
                "error": {
                    "code": -32602,
                    "message": "Invalid params"
                }
            }
        except Exception:
            logger.exception(f"Tool execution error for {tool_name}")
            return {
                "jsonrpc": "2.0",
                "id": request_data.id,
                "error": {
                    "code": -32603,
                    "message": "Internal error executing tool"
                }
            }
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request_data.id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }
    
# Dedicated file upload endpoint for upload_document tool
@app.post("/tools/upload_document")
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def upload_document_tool(
    request: Request,
    file: UploadFile = File(...),
    document_id: str = Form(...),
    encompass_loan_guid: str = Form(...),
    company_name: str = Form(...),
    auth: bool = Depends(verify_auth)
):
    """Upload a document with multipart form data - calls the upload_document tool"""
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    tool = tool_registry.get_tool("upload_document")
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found: upload_document")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Prepare arguments for the tool
        arguments = {
            "document-id": document_id,
            "encompass-loan-guid": encompass_loan_guid,
            "company-name": company_name,
            "file": file_content,  # Pass as bytes directly
            "filename": file.filename  # Pass original filename with extension
        }
        
        # Validate and execute tool
        validated_request = request_validator.validate_tool_request("upload_document", arguments)
        sanitized_args = validated_request['arguments']
        
        result = await tool.execute(sanitized_args)
        return {
            "tool": "upload_document",
            "result": result,
            "success": True
        }
    except ValueError as e:
        logger.warning(f"Validation error for upload_document: {e}")
        raise HTTPException(status_code=400, detail="Invalid request")
    except Exception:
        logger.exception("Tool execution error for upload_document")
        raise HTTPException(status_code=500, detail="Internal error executing tool")

# Direct tool execution endpoint
@app.post("/tools/{tool_name}")
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def execute_tool(request: Request, tool_name: str, arguments: Dict[str, Any], auth: bool = Depends(verify_auth)):
    """Execute a tool directly by name"""
    request_id = str(uuid.uuid4())
    if dd_tracer:
        span = dd_tracer.current_root_span()
        if span:
            span.resource = f"/tools/{tool_name}"
            span.set_tag("http.method", "POST")
            span.set_tag("request.id", request_id)
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")
    
    try:
        # Validate and sanitize request
        validated_request = request_validator.validate_tool_request(tool_name, arguments)
        sanitized_args = validated_request['arguments']

        # Cache check — return early on a HIT
        if tool_cache:
            cached = await tool_cache.get(tool_name, sanitized_args)
            if cached is not None:
                logger.info(
                    f"POST /tools/{tool_name} | request_id: {request_id} | status: 200 (cache HIT)",
                    extra={"request_id": request_id, "tool_name": tool_name, "cache": "hit"},
                )
                return {"tool": tool_name, "result": cached, "success": True, "request_id": request_id, "cached": True}

        result = await tool.execute(sanitized_args)

        # Store successful result in cache
        if tool_cache:
            await tool_cache.set(tool_name, sanitized_args, result)

        # Parse result for structured logging
        try:
            result_json = json.loads(result)
        except Exception:
            result_json = result

        # Derive status code from result
        if isinstance(result_json, dict):
            status_code = result_json.get("details", {}).get("status") if isinstance(result_json.get("details"), dict) else None
            if not status_code:
                status_code = 200 if result_json.get("success", True) else 500
        else:
            status_code = 200

        # Sanitize request headers — strip Authorization and other sensitive headers
        request_headers = redact_headers(request.headers)

        # Identity of the calling application (populated by verify_auth)
        caller = getattr(request.state, "caller", None) or {}

        # Redact PII (SSN, DOB, email, credit data, etc.) before it reaches
        # the log/trace sink — mortgage data must never be logged in clear text.
        safe_arguments = redact_pii(sanitized_args)
        safe_response = redact_pii(result_json)

        logger.info(
            f"POST /tools/{tool_name} | request_id: {request_id} | status: {status_code}",
            extra={
                "request_id": request_id,
                "tool_name": tool_name,
                "arguments": safe_arguments,
                "response_body": safe_response,
                "status_code": status_code,
                "request_headers": request_headers,
                "caller_client_id": caller.get("client_id"),
                "caller_subject": caller.get("subject"),
                "caller_username": caller.get("username"),
            }
        )
        if dd_tracer:
            span = dd_tracer.current_root_span()
            if span:
                span.set_tag("tool.status_code", status_code)

        return {
            "tool": tool_name,
            "result": result,
            "success": True,
            "request_id": request_id
        }
    except ValueError as e:
        logger.warning(f"Validation error for tool {tool_name}: {e}")
        raise HTTPException(status_code=400, detail="Invalid request")
    except Exception:
        logger.exception(f"Tool execution error for {tool_name} | request_id: {request_id}")
        raise HTTPException(
            status_code=500,
            detail={"message": "Internal error executing tool", "request_id": request_id},
        )

# Tool information endpoint
@app.get("/tools/{tool_name}")
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def get_tool_info(request: Request, tool_name: str, auth: bool = Depends(verify_auth)):
    """Get information about a specific tool"""
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")
    
    return {
        "name": tool.name,
        "description": tool.description,
        "schema": tool.get_schema()
    }

# List all tools endpoint
@app.get("/tools/")
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def list_all_tools(request: Request, auth: bool = Depends(verify_auth)):
    """List all available tools with their information"""
    if not tool_registry:
        raise HTTPException(status_code=500, detail="Server not initialized")
    
    tools = []
    for tool in tool_registry.get_all_tools():
        tools.append({
            "name": tool.name,
            "description": tool.description,
            "schema": tool.get_schema()
        })
    
    return {
        "tools": tools,
        "count": len(tools)
    }


@app.get("/")
async def root():
    """Root endpoint with server information"""
    auth_info = {
        "authentication_required": server_factory.config.auth_enabled if server_factory else True,
        "authentication_type": "Bearer Token",
        "header_format": "Authorization: Bearer <your-token>"
    } if server_factory and server_factory.config.auth_enabled else {
        "authentication_required": False
    }
    
    return {
        "message": "FastAPI MCP Server",
        "version": "2.0.0",
        "authentication": auth_info,
        "endpoints": {
            **({"docs": "/docs"} if docs_enabled else {}),
            "health": "/health",
            "tools": "/tools/",
            "mcp": "/mcp/"
        },
        "usage": "Use Bearer token authentication for API access. Example: curl -H 'Authorization: Bearer your-token' http://your-server/tools/"
    }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="FastAPI MCP Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes")
    
    args = parser.parse_args()
    
    print("🚀 Starting FastAPI MCP Server...")
    print(f"📡 URL: http://{args.host}:{args.port}")
    print(f"📚 Docs: http://{args.host}:{args.port}/docs")
    print(f"🔧 Tools: http://{args.host}:{args.port}/tools/")
    print(f"🏥 Health: http://{args.host}:{args.port}/health")
    
    uvicorn.run(
        "fastapi_mcp_server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1
    )
