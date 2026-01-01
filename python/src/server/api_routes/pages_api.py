"""
Pages API Module

This module handles page retrieval operations for RAG:
- List pages for a source
- Get page by ID
- Get page by URL
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..config.logfire_config import get_logger, safe_logfire_error
from ..utils import get_supabase_client

# Get logger for this module
logger = get_logger(__name__)

# Create router
router = APIRouter(prefix="/api", tags=["pages"])

# Maximum character count for returning full page content
MAX_PAGE_CHARS = 20_000


class PageSummary(BaseModel):
    """Summary model for page listings (no content)"""

    id: str
    url: str
    section_title: str | None = None
    section_order: int = 0
    word_count: int
    char_count: int
    chunk_count: int


class PageResponse(BaseModel):
    """Response model for a single page (with content)"""

    id: str
    source_id: str
    url: str
    full_content: str
    content_offset: int | None = None
    content_limit: int | None = None
    content_total: int | None = None
    has_more: bool | None = None
    next_offset: int | None = None
    section_title: str | None = None
    section_order: int = 0
    word_count: int
    char_count: int
    chunk_count: int
    metadata: dict
    created_at: str
    updated_at: str


class PageListResponse(BaseModel):
    """Response model for page listing"""

    pages: list[PageSummary]
    total: int
    source_id: str


def _prepare_page_content(page_data: dict, offset: int | None, limit: int | None) -> dict:
    """
    Prepare page content for retrieval, optionally slicing large pages.

    Args:
        page_data: Page data from database
        offset: Optional slice offset
        limit: Optional slice limit

    Returns:
        Page data with full_content prepared for response
    """
    content = page_data.get("full_content", "")
    content_length = len(content)
    char_count = page_data.get("char_count", 0)

    if offset is not None or limit is not None:
        offset_value = max(offset or 0, 0)
        limit_value = max(limit or MAX_PAGE_CHARS, 1)
        end_value = min(offset_value + limit_value, content_length)
        page_data["full_content"] = content[offset_value:end_value]
        page_data["content_offset"] = offset_value
        page_data["content_limit"] = limit_value
        page_data["content_total"] = content_length
        page_data["has_more"] = end_value < content_length
        page_data["next_offset"] = end_value if end_value < content_length else None
        return page_data

    if char_count > MAX_PAGE_CHARS:
        page_data["full_content"] = (
            f"[Page too large for context - {char_count:,} characters]\n\n"
            f"This page exceeds the {MAX_PAGE_CHARS:,} character limit for retrieval.\n\n"
            f"To access content from this page, use a RAG search with return_mode='chunks' instead of 'pages'.\n"
            f"This will retrieve specific relevant sections rather than the entire page.\n\n"
            f"Page details:\n"
            f"- URL: {page_data.get('url', 'N/A')}\n"
            f"- Section: {page_data.get('section_title', 'N/A')}\n"
            f"- Word count: {page_data.get('word_count', 0):,}\n"
            f"- Character count: {char_count:,}\n"
            f"- Available chunks: {page_data.get('chunk_count', 0)}"
        )

    return page_data


@router.get("/pages")
async def list_pages(
    source_id: str = Query(..., description="Source ID to filter pages"),
    section: str | None = Query(None, description="Filter by section title (for llms-full.txt)"),
):
    """
    List all pages for a given source.

    Args:
        source_id: The source ID to filter pages
        section: Optional H1 section title for llms-full.txt sources

    Returns:
        PageListResponse with list of pages and metadata
    """
    try:
        client = get_supabase_client()

        # Build query - select only summary fields (no full_content)
        query = client.table("ptolemy_page_metadata").select(
            "id, url, section_title, section_order, word_count, char_count, chunk_count"
        ).eq("source_id", source_id)

        # Add section filter if provided
        if section:
            query = query.eq("section_title", section)

        # Order by section_order and created_at
        query = query.order("section_order").order("created_at")

        # Execute query
        result = query.execute()

        # Use PageSummary (no content handling needed)
        pages = [PageSummary(**page) for page in result.data]

        return PageListResponse(pages=pages, total=len(pages), source_id=source_id)

    except Exception as e:
        logger.error(f"Error listing pages for source {source_id}: {e}", exc_info=True)
        safe_logfire_error(f"Failed to list pages | source_id={source_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list pages: {str(e)}") from e


@router.get("/pages/by-url")
async def get_page_by_url(
    url: str = Query(..., description="The URL of the page to retrieve"),
    offset: int | None = Query(None, ge=0, description="Content slice offset"),
    limit: int | None = Query(None, ge=1, le=MAX_PAGE_CHARS, description="Content slice length"),
):
    """
    Get a single page by its URL.

    This is useful for retrieving pages from RAG search results which return URLs.

    Args:
        url: The complete URL of the page (including anchors for llms-full.txt sections)

    Returns:
        PageResponse with complete page data
    """
    try:
        client = get_supabase_client()

        # Query by URL
        result = client.table("ptolemy_page_metadata").select("*").eq("url", url).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Page not found for URL: {url}")

        page_data = _prepare_page_content(result.data.copy(), offset, limit)
        return PageResponse(**page_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting page by URL {url}: {e}", exc_info=True)
        safe_logfire_error(f"Failed to get page by URL | url={url} | error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get page: {str(e)}") from e


@router.get("/pages/{page_id}")
async def get_page_by_id(
    page_id: str,
    offset: int | None = Query(None, ge=0, description="Content slice offset"),
    limit: int | None = Query(None, ge=1, le=MAX_PAGE_CHARS, description="Content slice length"),
):
    """
    Get a single page by its ID.

    Args:
        page_id: The UUID of the page

    Returns:
        PageResponse with complete page data
    """
    try:
        client = get_supabase_client()

        # Query by ID
        result = client.table("ptolemy_page_metadata").select("*").eq("id", page_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Page not found: {page_id}")

        page_data = _prepare_page_content(result.data.copy(), offset, limit)
        return PageResponse(**page_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting page {page_id}: {e}", exc_info=True)
        safe_logfire_error(f"Failed to get page | page_id={page_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get page: {str(e)}") from e
