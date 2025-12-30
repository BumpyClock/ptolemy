"""
Simple feature management tools for Ptolemy MCP Server.

Provides tools to retrieve and manage project features.
"""

import json
import logging
from urllib.parse import urljoin

import httpx

from mcp.server.fastmcp import Context, FastMCP
from src.mcp_server.utils.error_handling import MCPErrorFormatter
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)


def register_feature_tools(mcp: FastMCP):
    """Register feature management tools with the MCP server."""

    @mcp.tool()
    async def get_project_features(ctx: Context, project_id: str) -> str:
        """
        Get project features for a project ID.
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    urljoin(api_url, f"/api/projects/{project_id}/features")
                )

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps({
                        "success": True,
                        "features": result.get("features", []),
                        "count": len(result.get("features", [])),
                    })
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Project {project_id} not found",
                        suggestion="Verify the project ID is correct",
                        http_status=404,
                    )
                else:
                    return MCPErrorFormatter.from_http_error(response, "get project features")

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "get project features", {"project_id": project_id}
            )
        except Exception as e:
            logger.error(f"Error getting project features: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "get project features")
