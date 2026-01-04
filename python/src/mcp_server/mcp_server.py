"""
MCP Server for Ptolemy (Microservices Version)

This MCP server uses HTTP calls to the API service instead of importing
heavy dependencies directly.

Modules:
- Docs Module: RAG queries, search, and source management via HTTP
- Health & Session: Local operations

Note: Crawling and document upload operations are handled by the API service
and frontend, not through MCP tools.
"""

import json
import logging
import os
import sys
import threading
import time
import traceback
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from mcp.server.fastmcp import Context, FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

# Add the project root to Python path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Load environment variables from the project root .env file
project_root = Path(__file__).resolve().parent.parent
dotenv_path = project_root / ".env"
load_dotenv(dotenv_path, override=True)

# Configure logging FIRST before any imports that might use it
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/tmp/mcp_server.log", mode="a")
        if os.path.exists("/tmp")
        else logging.NullHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Import Logfire configuration
from src.server.config.logfire_config import mcp_logger, setup_logfire

# Import service client for HTTP calls
from src.server.services.mcp_service_client import get_mcp_service_client

# Import session management
from src.server.services.mcp_session_manager import get_session_manager

# Tool schema pruning to reduce token usage for specific tools.
def _strip_schema_keys(schema: dict[str, Any], keys: set[str]) -> dict[str, Any]:
    if not isinstance(schema, dict):
        return schema
    cleaned: dict[str, Any] = {}
    for key, value in schema.items():
        if key in keys:
            continue
        if isinstance(value, dict):
            cleaned[key] = _strip_schema_keys(value, keys)
        elif isinstance(value, list):
            cleaned[key] = [
                _strip_schema_keys(item, keys) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            cleaned[key] = value
    return cleaned


class PtolemyMCP(FastMCP):
    async def list_tools(self):
        tools = await super().list_tools()
        for tool in tools:
            if tool.name not in {"docs_answer", "docs_fetch"}:
                continue
            if tool.name == "docs_answer":
                tool.description = (
                    "Search docs/code. Use query; optional source_id filter; kind: doc|code_example; "
                    "return_mode: chunks|pages (default chunks)."
                )
            elif tool.name == "docs_fetch":
                tool.description = (
                    "Fetch docs data. kind: sources|pages|page|code_examples|chunks; "
                    "source_id required for pages/code_examples/chunks; use page_id or url for page."
                )
            tool.inputSchema = _strip_schema_keys(
                tool.inputSchema,
                {"title", "default", "minimum", "maximum"},
            )
            properties = tool.inputSchema.get("properties") if isinstance(tool.inputSchema, dict) else None
            if isinstance(properties, dict):
                keep_descriptions = {"source_id", "kind", "return_mode", "page_id", "url", "match_count"}
                for key, prop in properties.items():
                    if key in keep_descriptions:
                        continue
                    if isinstance(prop, dict):
                        prop.pop("description", None)
            tool.outputSchema = None
        return tools

# Global initialization lock and flag
_initialization_lock = threading.Lock()
_initialization_complete = False
_shared_context = None

server_host = "0.0.0.0"  # Listen on all interfaces

# Require PTOLEMY_MCP_PORT to be set
mcp_port = os.getenv("PTOLEMY_MCP_PORT")
if not mcp_port:
    raise ValueError(
        "PTOLEMY_MCP_PORT environment variable is required. "
        "Please set it in your .env file or environment. "
        "Default value: 8051"
    )
server_port = int(mcp_port)


@dataclass
class PtolemyContext:
    """
    Context for MCP server.
    No heavy dependencies - just service client for HTTP calls.
    """

    service_client: Any
    health_status: dict = None
    startup_time: float = None

    def __post_init__(self):
        if self.health_status is None:
            self.health_status = {
                "status": "healthy",
                "api_service": False,
                "agents_service": False,
                "last_health_check": None,
            }
        if self.startup_time is None:
            self.startup_time = time.time()


async def perform_health_checks(context: PtolemyContext):
    """Perform health checks on dependent services via HTTP."""
    try:
        # Check dependent services
        service_health = await context.service_client.health_check()

        context.health_status["api_service"] = service_health.get("api_service", False)
        context.health_status["agents_service"] = service_health.get("agents_service", False)

        # Overall status
        all_critical_ready = context.health_status["api_service"]

        context.health_status["status"] = "healthy" if all_critical_ready else "degraded"
        context.health_status["last_health_check"] = datetime.now().isoformat()

        if not all_critical_ready:
            logger.warning(f"Health check failed: {context.health_status}")
        else:
            logger.info("Health check passed - dependent services healthy")

    except Exception as e:
        logger.error(f"Health check error: {e}")
        context.health_status["status"] = "unhealthy"
        context.health_status["last_health_check"] = datetime.now().isoformat()


@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[PtolemyContext]:
    """
    Lifecycle manager - no heavy dependencies.
    """
    global _initialization_complete, _shared_context

    # Quick check without lock
    if _initialization_complete and _shared_context:
        logger.info("♻️ Reusing existing context for new SSE connection")
        yield _shared_context
        return

    # Acquire lock for initialization
    with _initialization_lock:
        # Double-check pattern
        if _initialization_complete and _shared_context:
            logger.info("♻️ Reusing existing context for new SSE connection")
            yield _shared_context
            return

        logger.info("🚀 Starting MCP server...")

        try:
            # Initialize session manager
            logger.info("🔐 Initializing session manager...")
            session_manager = get_session_manager()
            logger.info("✓ Session manager initialized")

            # Initialize service client for HTTP calls
            logger.info("🌐 Initializing service client...")
            service_client = get_mcp_service_client()
            logger.info("✓ Service client initialized")

            # Create context
            context = PtolemyContext(service_client=service_client)

            # Perform initial health check
            await perform_health_checks(context)

            logger.info("✓ MCP server ready")

            # Store context globally
            _shared_context = context
            _initialization_complete = True

            yield context

        except Exception as e:
            logger.error(f"💥 Critical error in lifespan setup: {e}")
            logger.error(traceback.format_exc())
            raise
        finally:
            # Clean up resources
            logger.info("🧹 Cleaning up MCP server...")
            logger.info("✅ MCP server shutdown complete")


# Define MCP instructions for Claude Code and other clients
MCP_INSTRUCTIONS = """
# Ptolemy MCP Server Instructions

## Targeted Documentation Search

When searching specific documentation:
1. Get available sources: docs_fetch(kind="sources")
2. Find source ID: match the user request to a source title
3. Run search: docs_answer(query="...", source_id="src_xxx", match_count=5, return_mode="chunks")

Examples:
- User: "Search the Supabase docs for vector functions"
  1. Call docs_fetch(kind="sources")
  2. Find Supabase source ID from results (e.g., "src_abc123")
  3. Call docs_answer(query="vector functions", source_id="src_abc123", return_mode="chunks")

- User: "Find authentication examples in the MCP documentation"
  1. Call docs_fetch(kind="sources")
  2. Find MCP docs source ID
  3. Call docs_answer(query="authentication", kind=["code_example"], source_id="src_def456")

Notes:
- docs_answer return_mode accepts only "chunks" or "pages"
- docs_fetch kind accepts only "sources", "pages", "page", "code_examples", or "chunks"

IMPORTANT: Always use source_id for filtering
"""


# Initialize the main FastMCP server with fixed configuration
try:
    logger.info("🏗️ MCP SERVER INITIALIZATION:")
    logger.info("   Server Name: ptolemy-mcp-server")
    logger.info("   Description: MCP server using HTTP calls")

    mcp = PtolemyMCP(
        "ptolemy-mcp-server",
        description="MCP server for Ptolemy - uses HTTP calls to other services",
        instructions=MCP_INSTRUCTIONS,
        lifespan=lifespan,
        host=server_host,
        port=server_port,
    )
    logger.info("✓ FastMCP server instance created successfully")

except Exception as e:
    logger.error(f"✗ Failed to create FastMCP server: {e}")
    logger.error(traceback.format_exc())
    raise


# Health check endpoint (hard-disabled - not exposed as MCP tool)
async def health_check(ctx: Context) -> str:
    """
    Check health status of MCP server and dependencies.

    Returns:
        JSON with health status, uptime, and service availability
    """
    try:
        # Try to get the lifespan context
        context = getattr(ctx.request_context, "lifespan_context", None)

        if context is None:
            # Server starting up
            return json.dumps({
                "success": True,
                "status": "starting",
                "message": "MCP server is initializing...",
                "timestamp": datetime.now().isoformat(),
            })

        # Server is ready - perform health checks
        if hasattr(context, "health_status") and context.health_status:
            await perform_health_checks(context)

            return json.dumps({
                "success": True,
                "health": context.health_status,
                "uptime_seconds": time.time() - context.startup_time,
                "timestamp": datetime.now().isoformat(),
            })
        else:
            return json.dumps({
                "success": True,
                "status": "ready",
                "message": "MCP server is running",
                "timestamp": datetime.now().isoformat(),
            })

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return json.dumps({
            "success": False,
            "error": f"Health check failed: {str(e)}",
            "timestamp": datetime.now().isoformat(),
        })


# Session management endpoint (hard-disabled - not exposed as MCP tool)
async def session_info(ctx: Context) -> str:
    """
    Get current and active session information.

    Returns:
        JSON with active sessions count and server uptime
    """
    try:
        session_manager = get_session_manager()

        # Build session info
        session_info_data = {
            "active_sessions": session_manager.get_active_session_count(),
            "session_timeout": session_manager.timeout,
        }

        # Add server uptime
        context = getattr(ctx.request_context, "lifespan_context", None)
        if context and hasattr(context, "startup_time"):
            session_info_data["server_uptime_seconds"] = time.time() - context.startup_time

        return json.dumps({
            "success": True,
            "session_management": session_info_data,
            "timestamp": datetime.now().isoformat(),
        })

    except Exception as e:
        logger.error(f"Session info failed: {e}")
        return json.dumps({
            "success": False,
            "error": f"Failed to get session info: {str(e)}",
            "timestamp": datetime.now().isoformat(),
        })


# Import and register modules
def register_modules():
    """Register all MCP tool modules."""
    logger.info("🔧 Registering MCP tool modules...")

    modules_registered = 0

    # Import and register docs module (HTTP-based version)
    try:
        from src.mcp_server.features.docs import register_docs_tools

        register_docs_tools(mcp)
        modules_registered += 1
        logger.info("✓ Docs module registered (HTTP-based)")
    except ImportError as e:
        logger.warning(f"⚠ Docs module not available: {e}")
    except Exception as e:
        logger.error(f"✗ Error registering Docs module: {e}")
        logger.error(traceback.format_exc())

    logger.info(f"📦 Total modules registered: {modules_registered}")

    if modules_registered == 0:
        logger.error("💥 No modules were successfully registered!")
        raise RuntimeError("No MCP modules available")


# Register all modules when this file is imported
try:
    register_modules()
except Exception as e:
    logger.error(f"💥 Critical error during module registration: {e}")
    logger.error(traceback.format_exc())
    raise


# Track server start time at module level for health checks
_server_start_time = time.time()


# Define health endpoint function at module level
async def http_health_endpoint(request: Request):
    """HTTP health check endpoint for monitoring systems."""
    logger.info("Health endpoint called via HTTP")
    try:
        # Try to get the shared context for detailed health info
        if _shared_context and hasattr(_shared_context, "health_status"):
            # Use actual server startup time for consistency with MCP health_check tool
            uptime = time.time() - _shared_context.startup_time
            await perform_health_checks(_shared_context)

            return JSONResponse({
                "success": True,
                "health": _shared_context.health_status,
                "uptime_seconds": uptime,
                "timestamp": datetime.now().isoformat(),
            })
        else:
            # Server starting up or no MCP connections yet - use module load time as fallback
            uptime = time.time() - _server_start_time
            return JSONResponse({
                "success": True,
                "status": "ready",
                "uptime_seconds": uptime,
                "message": "MCP server is running (no active connections yet)",
                "timestamp": datetime.now().isoformat(),
            })
    except Exception as e:
        logger.error(f"HTTP health check failed: {e}", exc_info=True)
        return JSONResponse({
            "success": False,
            "error": f"Health check failed: {str(e)}",
            "uptime_seconds": time.time() - _server_start_time,
            "timestamp": datetime.now().isoformat(),
        }, status_code=500)


# Register health endpoint using FastMCP's custom_route decorator
try:
    mcp.custom_route("/health", methods=["GET"])(http_health_endpoint)
    logger.info("✓ HTTP /health endpoint registered successfully")
except Exception as e:
    logger.error(f"✗ Failed to register /health endpoint: {e}")
    logger.error(traceback.format_exc())


def main():
    """Main entry point for the MCP server."""
    try:
        # Initialize Logfire first
        setup_logfire(service_name="ptolemy-mcp-server")

        logger.info("🚀 Starting Ptolemy MCP Server")
        logger.info("   Mode: Streamable HTTP")
        logger.info(f"   URL: http://{server_host}:{server_port}/mcp")

        mcp_logger.info("🔥 Logfire initialized for MCP server")
        mcp_logger.info(f"🌟 Starting MCP server - host={server_host}, port={server_port}")

        mcp.run(transport="streamable-http")

    except Exception as e:
        mcp_logger.error(f"💥 Fatal error in main - error={str(e)}, error_type={type(e).__name__}")
        logger.error(f"💥 Fatal error in main: {e}")
        logger.error(traceback.format_exc())
        raise


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("👋 MCP server stopped by user")
    except Exception as e:
        logger.error(f"💥 Unhandled exception: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)
