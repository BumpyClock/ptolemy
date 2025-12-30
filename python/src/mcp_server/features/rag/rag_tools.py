"""
RAG Module for Ptolemy MCP Server (HTTP-based version)

This module provides tools for:
- RAG query and search
- Source management
- Code example extraction and search

This version uses HTTP calls to the server service instead of importing
service modules directly, enabling true microservices architecture.
"""

import json
import logging
import os
from typing import Annotated, Literal
from urllib.parse import urljoin

import httpx
from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

# Import service discovery for HTTP communication
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)


def get_setting(key: str, default: str = "false") -> str:
    """Get a setting from environment variable."""
    return os.getenv(key, default)


def get_bool_setting(key: str, default: bool = False) -> bool:
    """Get a boolean setting from environment variable."""
    value = get_setting(key, "false" if not default else "true")
    return value.lower() in ("true", "1", "yes", "on")


def register_rag_tools(mcp: FastMCP):
    """Register all RAG tools with the MCP server."""

    @mcp.tool()
    async def rag_get_available_sources(ctx: Context) -> str:
        """
        List available sources in the knowledge base.
        """
        try:
            api_url = get_api_url()
            timeout = httpx.Timeout(30.0, connect=5.0)

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(urljoin(api_url, "/api/rag/sources"))

                if response.status_code == 200:
                    result = response.json()
                    sources = result.get("sources", [])

                    return json.dumps(
                        {"success": True, "sources": sources, "count": len(sources)}, indent=2
                    )
                else:
                    error_detail = response.text
                    return json.dumps(
                        {"success": False, "error": f"HTTP {response.status_code}: {error_detail}"},
                        indent=2,
                    )

        except Exception as e:
            logger.error(f"Error getting sources: {e}")
            return json.dumps({"success": False, "error": str(e)}, indent=2)

    @mcp.tool()
    async def rag_search_knowledge_base(
        ctx: Context,
        query: str,
        source_id: str | None = None,
        match_count: Annotated[int, Field(ge=1, description="Max results")] = 5,
        return_mode: Annotated[Literal["pages", "chunks"], Field(description="Return mode")] = "pages",
    ) -> str:
        """
        Search knowledge base for relevant content using RAG.
        """
        try:
            api_url = get_api_url()
            timeout = httpx.Timeout(30.0, connect=5.0)

            async with httpx.AsyncClient(timeout=timeout) as client:
                request_data = {
                    "query": query,
                    "match_count": match_count,
                    "return_mode": return_mode
                }
                if source_id:
                    request_data["source"] = source_id

                response = await client.post(urljoin(api_url, "/api/rag/query"), json=request_data)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(
                        {
                            "success": True,
                            "results": result.get("results", []),
                            "return_mode": result.get("return_mode", return_mode),
                            "reranked": result.get("reranked", False),
                            "error": None,
                        },
                        indent=2,
                    )
                else:
                    error_detail = response.text
                    return json.dumps(
                        {
                            "success": False,
                            "results": [],
                            "error": f"HTTP {response.status_code}: {error_detail}",
                        },
                        indent=2,
                    )

        except Exception as e:
            logger.error(f"Error performing RAG query: {e}")
            return json.dumps({"success": False, "results": [], "error": str(e)}, indent=2)

    @mcp.tool()
    async def rag_search_code_examples(
        ctx: Context,
        query: str,
        source_id: str | None = None,
        match_count: Annotated[int, Field(ge=1, description="Max results")] = 5,
    ) -> str:
        """
        Search for relevant code examples in the knowledge base.
        """
        try:
            api_url = get_api_url()
            timeout = httpx.Timeout(30.0, connect=5.0)

            async with httpx.AsyncClient(timeout=timeout) as client:
                request_data = {"query": query, "match_count": match_count}
                if source_id:
                    request_data["source"] = source_id

                # Call the dedicated code examples endpoint
                response = await client.post(
                    urljoin(api_url, "/api/rag/code-examples"), json=request_data
                )

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(
                        {
                            "success": True,
                            "results": result.get("results", []),
                            "reranked": result.get("reranked", False),
                            "error": None,
                        },
                        indent=2,
                    )
                else:
                    error_detail = response.text
                    return json.dumps(
                        {
                            "success": False,
                            "results": [],
                            "error": f"HTTP {response.status_code}: {error_detail}",
                        },
                        indent=2,
                    )

        except Exception as e:
            logger.error(f"Error searching code examples: {e}")
            return json.dumps({"success": False, "results": [], "error": str(e)}, indent=2)

    @mcp.tool()
    async def rag_list_pages_for_source(
        ctx: Context, source_id: str, section: str | None = None
    ) -> str:
        """
        List all pages for a given knowledge source.
        """
        try:
            api_url = get_api_url()
            timeout = httpx.Timeout(30.0, connect=5.0)

            async with httpx.AsyncClient(timeout=timeout) as client:
                params = {"source_id": source_id}
                if section:
                    params["section"] = section

                response = await client.get(
                    urljoin(api_url, "/api/pages"),
                    params=params
                )

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(
                        {
                            "success": True,
                            "pages": result.get("pages", []),
                            "total": result.get("total", 0),
                            "source_id": result.get("source_id", source_id),
                            "error": None,
                        },
                        indent=2,
                    )
                else:
                    error_detail = response.text
                    return json.dumps(
                        {
                            "success": False,
                            "pages": [],
                            "total": 0,
                            "source_id": source_id,
                            "error": f"HTTP {response.status_code}: {error_detail}",
                        },
                        indent=2,
                    )

        except Exception as e:
            logger.error(f"Error listing pages for source {source_id}: {e}")
            return json.dumps(
                {
                    "success": False,
                    "pages": [],
                    "total": 0,
                    "source_id": source_id,
                    "error": str(e)
                },
                indent=2
            )

    @mcp.tool()
    async def rag_read_full_page(
        ctx: Context, page_id: str | None = None, url: str | None = None
    ) -> str:
        """
        Retrieve full page content from knowledge base.

        Provide EITHER page_id OR url, not both.
        """
        try:
            if not page_id and not url:
                return json.dumps(
                    {"success": False, "error": "Must provide either page_id or url"},
                    indent=2
                )

            api_url = get_api_url()
            timeout = httpx.Timeout(30.0, connect=5.0)

            async with httpx.AsyncClient(timeout=timeout) as client:
                if page_id:
                    response = await client.get(urljoin(api_url, f"/api/pages/{page_id}"))
                else:
                    response = await client.get(
                        urljoin(api_url, "/api/pages/by-url"),
                        params={"url": url}
                    )

                if response.status_code == 200:
                    page_data = response.json()
                    return json.dumps(
                        {
                            "success": True,
                            "page": page_data,
                            "error": None,
                        },
                        indent=2,
                    )
                else:
                    error_detail = response.text
                    return json.dumps(
                        {
                            "success": False,
                            "page": None,
                            "error": f"HTTP {response.status_code}: {error_detail}",
                        },
                        indent=2,
                    )

        except Exception as e:
            logger.error(f"Error reading page: {e}")
            return json.dumps({"success": False, "page": None, "error": str(e)}, indent=2)

    # Log successful registration
    logger.info("✓ RAG tools registered (HTTP-based version)")
