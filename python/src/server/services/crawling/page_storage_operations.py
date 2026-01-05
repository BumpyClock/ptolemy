"""
Page Storage Operations

Handles the storage of complete documentation pages in the ptolemy_page_metadata table.
Pages are stored BEFORE chunking to maintain full context for agent retrieval.
"""

from typing import Any

from postgrest.exceptions import APIError

from ...config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info
from .helpers.llms_full_parser import parse_llms_full_sections
from .helpers.url_handler import URLHandler

logger = get_logger(__name__)


class PageStorageOperations:
    """
    Handles page storage operations for crawled content.

    Pages are stored in the ptolemy_page_metadata table with full content and metadata.
    This enables agents to retrieve complete documentation pages instead of just chunks.
    """

    def __init__(self, supabase_client):
        """
        Initialize page storage operations.

        Args:
            supabase_client: The Supabase client for database operations
        """
        self.supabase_client = supabase_client

    async def store_pages(
        self,
        crawl_results: list[dict],
        source_id: str,
        request: dict[str, Any],
        crawl_type: str,
    ) -> dict[str, str]:
        """
        Store pages in ptolemy_page_metadata table from regular crawl results.

        Pages are deduplicated by canonical_url, allowing the same content to be
        referenced by multiple sources. The ptolemy_page_sources join table tracks
        which sources reference each page.

        Args:
            crawl_results: List of crawled documents with url, markdown, title, etc.
            source_id: The source ID these pages belong to
            request: The original crawl request with knowledge_type, tags, etc.
            crawl_type: Type of crawl performed (sitemap, url, link_collection, etc.)

        Returns:
            {url: page_id} mapping for FK references in chunks
        """
        safe_logfire_info(
            f"store_pages called | source_id={source_id} | crawl_type={crawl_type} | num_results={len(crawl_results)}"
        )

        url_to_page_id: dict[str, str] = {}
        pages_to_insert: list[dict[str, Any]] = []
        canonical_to_url: dict[str, str] = {}  # Track canonical → raw url mapping

        for doc in crawl_results:
            url = doc.get("url", "").strip()
            markdown = doc.get("markdown", "").strip()

            # Skip documents with empty content or missing URLs
            if not url or not markdown:
                continue

            # Compute canonical URL for deduplication
            canonical_url = URLHandler.canonicalize_page_url(url)

            # Prepare page record
            word_count = len(markdown.split())
            char_count = len(markdown)

            page_record = {
                "source_id": source_id,
                "url": url,
                "canonical_url": canonical_url,
                "full_content": markdown,
                "section_title": None,  # Regular page, not a section
                "section_order": 0,
                "word_count": word_count,
                "char_count": char_count,
                "chunk_count": 0,  # Will be updated after chunking
                "metadata": {
                    "knowledge_type": request.get("knowledge_type", "documentation"),
                    "crawl_type": crawl_type,
                    "page_type": "documentation",
                    "tags": request.get("tags", []),
                },
            }
            pages_to_insert.append(page_record)
            canonical_to_url[canonical_url] = url

        # Batch upsert pages (deduped by canonical_url)
        if pages_to_insert:
            try:
                safe_logfire_info(
                    f"Upserting {len(pages_to_insert)} pages into ptolemy_page_metadata table (by canonical_url)"
                )
                result = (
                    self.supabase_client.table("ptolemy_page_metadata")
                    .upsert(pages_to_insert, on_conflict="canonical_url")
                    .execute()
                )

                # Build url → page_id mapping (map both raw URL and canonical URL to page_id)
                page_ids_for_source_links: list[str] = []
                for page in result.data:
                    page_id = page["id"]
                    canonical = page.get("canonical_url")
                    raw_url = page.get("url")

                    # Map both the raw URL and any URL that canonicalizes to the same value
                    if raw_url:
                        url_to_page_id[raw_url] = page_id
                    if canonical and canonical in canonical_to_url:
                        original_url = canonical_to_url[canonical]
                        url_to_page_id[original_url] = page_id

                    page_ids_for_source_links.append(page_id)

                safe_logfire_info(
                    f"Successfully stored {len(page_ids_for_source_links)}/{len(pages_to_insert)} pages in ptolemy_page_metadata"
                )

                # Create page-source provenance links
                await self._create_page_source_links(page_ids_for_source_links, source_id)

            except APIError as e:
                safe_logfire_error(
                    f"Database error upserting pages | source_id={source_id} | attempted={len(pages_to_insert)} | error={str(e)}"
                )
                logger.error(f"Failed to upsert pages for source {source_id}: {e}", exc_info=True)
                # Don't raise - allow chunking to continue even if page storage fails

            except Exception as e:
                safe_logfire_error(
                    f"Unexpected error upserting pages | source_id={source_id} | attempted={len(pages_to_insert)} | error={str(e)}"
                )
                logger.error(f"Unexpected error upserting pages for source {source_id}: {e}", exc_info=True)
                # Don't raise - allow chunking to continue

        return url_to_page_id

    async def store_llms_full_sections(
        self,
        base_url: str,
        content: str,
        source_id: str,
        request: dict[str, Any],
        crawl_type: str = "llms_full",
    ) -> dict[str, str]:
        """
        Store llms-full.txt sections as separate pages.

        Each H1 section gets its own page record with a synthetic URL that includes
        a fragment identifier (e.g., #Authentication). The fragment is preserved in
        the canonical_url for llms-full URLs to distinguish sections.

        Args:
            base_url: Base URL of the llms-full.txt file
            content: Full text content of the file
            source_id: The source ID these sections belong to
            request: The original crawl request
            crawl_type: Type of crawl (defaults to "llms_full")

        Returns:
            {url: page_id} mapping for FK references in chunks
        """
        url_to_page_id: dict[str, str] = {}

        # Parse sections from content
        sections = parse_llms_full_sections(content, base_url)

        if not sections:
            logger.warning(f"No sections found in llms-full.txt file: {base_url}")
            return url_to_page_id

        safe_logfire_info(
            f"Parsed {len(sections)} sections from llms-full.txt file: {base_url}"
        )

        # Prepare page records for each section
        pages_to_insert: list[dict[str, Any]] = []
        canonical_to_url: dict[str, str] = {}

        for section in sections:
            # For llms-full sections, the URL already includes the fragment
            # canonicalize_page_url preserves fragments for llms-full URLs
            canonical_url = URLHandler.canonicalize_page_url(section.url)

            page_record = {
                "source_id": source_id,
                "url": section.url,
                "canonical_url": canonical_url,
                "full_content": section.content,
                "section_title": section.section_title,
                "section_order": section.section_order,
                "word_count": section.word_count,
                "char_count": len(section.content),
                "chunk_count": 0,  # Will be updated after chunking
                "metadata": {
                    "knowledge_type": request.get("knowledge_type", "documentation"),
                    "crawl_type": crawl_type,
                    "page_type": "llms_full_section",
                    "tags": request.get("tags", []),
                    "section_metadata": {
                        "section_title": section.section_title,
                        "section_order": section.section_order,
                        "base_url": base_url,
                    },
                },
            }
            pages_to_insert.append(page_record)
            canonical_to_url[canonical_url] = section.url

        # Batch upsert pages (deduped by canonical_url)
        if pages_to_insert:
            try:
                safe_logfire_info(
                    f"Upserting {len(pages_to_insert)} section pages into ptolemy_page_metadata (by canonical_url)"
                )
                result = (
                    self.supabase_client.table("ptolemy_page_metadata")
                    .upsert(pages_to_insert, on_conflict="canonical_url")
                    .execute()
                )

                # Build url → page_id mapping
                page_ids_for_source_links: list[str] = []
                for page in result.data:
                    page_id = page["id"]
                    canonical = page.get("canonical_url")
                    raw_url = page.get("url")

                    if raw_url:
                        url_to_page_id[raw_url] = page_id
                    if canonical and canonical in canonical_to_url:
                        original_url = canonical_to_url[canonical]
                        url_to_page_id[original_url] = page_id

                    page_ids_for_source_links.append(page_id)

                safe_logfire_info(
                    f"Successfully stored {len(page_ids_for_source_links)}/{len(pages_to_insert)} section pages"
                )

                # Create page-source provenance links
                await self._create_page_source_links(page_ids_for_source_links, source_id)

            except APIError as e:
                safe_logfire_error(
                    f"Database error upserting sections | base_url={base_url} | attempted={len(pages_to_insert)} | error={str(e)}"
                )
                logger.error(f"Failed to upsert sections for {base_url}: {e}", exc_info=True)
                # Don't raise - allow process to continue

            except Exception as e:
                safe_logfire_error(
                    f"Unexpected error upserting sections | base_url={base_url} | attempted={len(pages_to_insert)} | error={str(e)}"
                )
                logger.error(f"Unexpected error upserting sections for {base_url}: {e}", exc_info=True)
                # Don't raise - allow process to continue

        return url_to_page_id

    async def update_page_chunk_count(self, page_id: str, chunk_count: int) -> None:
        """
        Update the chunk_count field for a page after chunking is complete.

        Args:
            page_id: The UUID of the page to update
            chunk_count: Number of chunks created from this page
        """
        try:
            self.supabase_client.table("ptolemy_page_metadata").update(
                {"chunk_count": chunk_count}
            ).eq("id", page_id).execute()

            safe_logfire_info(f"Updated chunk_count={chunk_count} for page_id={page_id}")

        except APIError as e:
            logger.warning(
                f"Database error updating chunk_count for page {page_id}: {e}", exc_info=True
            )
        except Exception as e:
            logger.warning(
                f"Unexpected error updating chunk_count for page {page_id}: {e}", exc_info=True
            )

    async def _create_page_source_links(self, page_ids: list[str], source_id: str) -> None:
        """
        Create or update page-source provenance links in ptolemy_page_sources.

        This tracks which sources reference each page, enabling provenance tracking
        and multi-source page queries.

        Args:
            page_ids: List of page UUIDs to link
            source_id: The source ID to link to the pages
        """
        if not page_ids:
            return

        try:
            # Prepare link records with upsert semantics
            links_to_upsert = [
                {
                    "page_id": page_id,
                    "source_id": source_id,
                    "last_seen_at": "now()",  # Update timestamp on re-crawl
                }
                for page_id in page_ids
            ]

            # Upsert links - updates last_seen_at if link exists
            self.supabase_client.table("ptolemy_page_sources").upsert(
                links_to_upsert,
                on_conflict="page_id,source_id",
            ).execute()

            safe_logfire_info(
                f"Created/updated {len(links_to_upsert)} page-source links for source_id={source_id}"
            )

        except APIError as e:
            # Don't fail the crawl if page-source linking fails
            logger.warning(
                f"Database error creating page-source links | source_id={source_id} | pages={len(page_ids)} | error={str(e)}",
                exc_info=True,
            )
        except Exception as e:
            logger.warning(
                f"Unexpected error creating page-source links | source_id={source_id} | pages={len(page_ids)} | error={str(e)}",
                exc_info=True,
            )
