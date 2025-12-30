"""
Consolidated version management tools for Ptolemy MCP Server.

Reduces the number of individual CRUD operations while maintaining full functionality.
"""

import json
import logging
from typing import Annotated, Any, Literal
from urllib.parse import urljoin

import httpx

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field
from src.mcp_server.utils.error_handling import MCPErrorFormatter
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)

# Optimization constants
DEFAULT_PAGE_SIZE = 10

def optimize_version_response(version: dict) -> dict:
    """Optimize version object for MCP response."""
    version = version.copy()  # Don't modify original
    
    # Remove content in list views - it's too large
    if "content" in version:
        del version["content"]
    
    return version


def register_version_tools(mcp: FastMCP):
    """Register consolidated version management tools with the MCP server."""

    @mcp.tool()
    async def find_versions(
        ctx: Context,
        project_id: str,
        field_name: Annotated[Literal["docs", "features", "data", "prd"] | None, Field(description="Field name")] = None,
        version_number: int | None = None,
        page: Annotated[int, Field(ge=1, description="Page number")] = 1,
        per_page: Annotated[int, Field(ge=1, description="Items per page")] = DEFAULT_PAGE_SIZE,
    ) -> str:
        """
        Find version history (consolidated: list + get).
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()
            
            # Single version get mode
            if field_name and version_number is not None:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(
                        urljoin(api_url, f"/api/projects/{project_id}/versions/{field_name}/{version_number}")
                    )
                    
                    if response.status_code == 200:
                        version = response.json()
                        # Don't optimize single version - return full details
                        return json.dumps({"success": True, "version": version})
                    elif response.status_code == 404:
                        return MCPErrorFormatter.format_error(
                            error_type="not_found",
                            message=f"Version {version_number} not found for field {field_name}",
                            suggestion="Verify the version number and field name",
                            http_status=404,
                        )
                    else:
                        return MCPErrorFormatter.from_http_error(response, "get version")
            
            # List mode
            params = {}
            if field_name:
                params["field_name"] = field_name
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    urljoin(api_url, f"/api/projects/{project_id}/versions"),
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    versions = data.get("versions", [])
                    
                    # Apply pagination
                    start_idx = (page - 1) * per_page
                    end_idx = start_idx + per_page
                    paginated = versions[start_idx:end_idx]
                    
                    # Optimize version responses
                    optimized = [optimize_version_response(v) for v in paginated]
                    
                    return json.dumps({
                        "success": True,
                        "versions": optimized,
                        "count": len(optimized),
                        "total": len(versions),
                        "project_id": project_id,
                        "field_name": field_name
                    })
                else:
                    return MCPErrorFormatter.from_http_error(response, "list versions")
                    
        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(e, "list versions")
        except Exception as e:
            logger.error(f"Error listing versions: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "list versions")

    @mcp.tool()
    async def manage_version(
        ctx: Context,
        action: Annotated[Literal["create", "restore"], Field(description="CRUD action")] = "create",
        project_id: str = "",
        field_name: Annotated[Literal["docs", "features", "data", "prd"], Field(description="Field name")] = "docs",
        version_number: int | None = None,
        content: dict[str, Any] | list[dict[str, Any]] | None = None,
        change_summary: str | None = None,
        document_id: str | None = None,
        created_by: str = "system",
    ) -> str:
        """
        Manage versions (consolidated: create/restore).
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                if action == "create":
                    if not content:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "content required for create"
                        )
                    
                    response = await client.post(
                        urljoin(api_url, f"/api/projects/{project_id}/versions"),
                        json={
                            "field_name": field_name,
                            "content": content,
                            "change_summary": change_summary or "No summary provided",
                            "document_id": document_id,
                            "created_by": created_by,
                        }
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        version = result.get("version")
                        
                        # Don't optimize for create - return full version
                        
                        return json.dumps({
                            "success": True,
                            "version": version,
                            "message": result.get("message", "Version created successfully")
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "create version")
                        
                elif action == "restore":
                    if version_number is None:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "version_number required for restore"
                        )
                    
                    response = await client.post(
                        urljoin(api_url, f"/api/projects/{project_id}/versions/{field_name}/{version_number}/restore"),
                        json={}
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return json.dumps({
                            "success": True,
                            "message": result.get("message", "Version restored successfully"),
                            "field_name": field_name,
                            "version_number": version_number
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "restore version")
                        
                else:
                    return MCPErrorFormatter.format_error(
                        "invalid_action",
                        f"Unknown action: {action}. Use 'create' or 'restore'"
                    )
                    
        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(e, f"{action} version")
        except Exception as e:
            logger.error(f"Error managing version ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} version")
