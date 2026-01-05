"""
Topic Service

Business logic for managing topics and topic-source mappings.
Topics group related sources for organization and deduplication.
"""

from typing import Any

from ...config.logfire_config import get_logger
from ...utils import get_supabase_client

logger = get_logger(__name__)


class TopicService:
    """Service for managing topics and their source mappings."""

    def __init__(self, supabase_client=None):
        """
        Initialize the topic service.

        Args:
            supabase_client: Optional Supabase client for testing. If not provided,
                           uses the default client from get_supabase_client().
        """
        self.supabase_client = supabase_client or get_supabase_client()

    def list_topics(self) -> tuple[bool, dict[str, Any]]:
        """
        List all topics with source counts.

        Returns:
            Tuple of (success, result_dict) where result_dict contains:
            - On success: {"topics": list of topic dicts}
            - On failure: {"error": error message}
        """
        try:
            # Get all topics
            response = (
                self.supabase_client.table("ptolemy_topics")
                .select("*")
                .order("name")
                .execute()
            )

            topics = []
            for topic in response.data:
                # Get source count for this topic
                source_count_response = (
                    self.supabase_client.table("ptolemy_topic_sources")
                    .select("source_id", count="exact")
                    .eq("topic_id", topic["id"])
                    .execute()
                )

                topics.append({
                    "id": topic["id"],
                    "name": topic["name"],
                    "description": topic.get("description"),
                    "related_topic_ids": topic.get("related_topic_ids", []),
                    "source_count": source_count_response.count or 0,
                    "created_at": topic["created_at"],
                    "updated_at": topic["updated_at"],
                })

            logger.info(f"Listed {len(topics)} topics")
            return True, {"topics": topics}

        except Exception as e:
            logger.error(f"Error listing topics: {e}", exc_info=True)
            return False, {"error": f"Database error: {str(e)}"}

    def get_topic(self, topic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get a single topic by ID.

        Args:
            topic_id: UUID of the topic to retrieve

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("ptolemy_topics")
                .select("*")
                .eq("id", topic_id)
                .single()
                .execute()
            )

            topic = response.data

            # Get source count
            source_count_response = (
                self.supabase_client.table("ptolemy_topic_sources")
                .select("source_id", count="exact")
                .eq("topic_id", topic_id)
                .execute()
            )

            result = {
                "id": topic["id"],
                "name": topic["name"],
                "description": topic.get("description"),
                "related_topic_ids": topic.get("related_topic_ids", []),
                "source_count": source_count_response.count or 0,
                "created_at": topic["created_at"],
                "updated_at": topic["updated_at"],
            }

            logger.info(f"Retrieved topic: {topic['name']} (id={topic_id})")
            return True, {"topic": result}

        except Exception as e:
            logger.error(f"Error getting topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Topic not found or error: {str(e)}"}

    def create_topic(
        self,
        name: str,
        description: str | None = None,
        related_topic_ids: list[str] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new topic.

        Args:
            name: Unique name for the topic
            description: Optional description
            related_topic_ids: Optional list of related topic UUIDs

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            topic_data = {
                "name": name.strip(),
                "description": description.strip() if description else None,
                "related_topic_ids": related_topic_ids or [],
            }

            response = (
                self.supabase_client.table("ptolemy_topics")
                .insert(topic_data)
                .execute()
            )

            topic = response.data[0]
            logger.info(f"Created topic: {name} (id={topic['id']})")

            return True, {
                "topic": {
                    "id": topic["id"],
                    "name": topic["name"],
                    "description": topic.get("description"),
                    "related_topic_ids": topic.get("related_topic_ids", []),
                    "source_count": 0,
                    "created_at": topic["created_at"],
                    "updated_at": topic["updated_at"],
                }
            }

        except Exception as e:
            error_msg = str(e)
            if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
                logger.warning(f"Topic name already exists: {name}")
                return False, {"error": f"Topic with name '{name}' already exists"}
            logger.error(f"Error creating topic: {e}", exc_info=True)
            return False, {"error": f"Database error: {str(e)}"}

    def update_topic(
        self,
        topic_id: str,
        name: str | None = None,
        description: str | None = None,
        related_topic_ids: list[str] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update an existing topic.

        Args:
            topic_id: UUID of the topic to update
            name: Optional new name
            description: Optional new description
            related_topic_ids: Optional new list of related topic UUIDs

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            update_data = {}
            if name is not None:
                update_data["name"] = name.strip()
            if description is not None:
                update_data["description"] = description.strip() if description else None
            if related_topic_ids is not None:
                update_data["related_topic_ids"] = related_topic_ids

            if not update_data:
                return False, {"error": "No fields to update"}

            response = (
                self.supabase_client.table("ptolemy_topics")
                .update(update_data)
                .eq("id", topic_id)
                .execute()
            )

            if not response.data:
                return False, {"error": f"Topic {topic_id} not found"}

            topic = response.data[0]
            logger.info(f"Updated topic: {topic['name']} (id={topic_id})")

            # Get source count
            source_count_response = (
                self.supabase_client.table("ptolemy_topic_sources")
                .select("source_id", count="exact")
                .eq("topic_id", topic_id)
                .execute()
            )

            return True, {
                "topic": {
                    "id": topic["id"],
                    "name": topic["name"],
                    "description": topic.get("description"),
                    "related_topic_ids": topic.get("related_topic_ids", []),
                    "source_count": source_count_response.count or 0,
                    "created_at": topic["created_at"],
                    "updated_at": topic["updated_at"],
                }
            }

        except Exception as e:
            error_msg = str(e)
            if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
                logger.warning(f"Topic name already exists: {name}")
                return False, {"error": f"Topic with name '{name}' already exists"}
            logger.error(f"Error updating topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Database error: {str(e)}"}

    def delete_topic(self, topic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Delete a topic.

        Note: This will also delete all topic-source mappings (CASCADE).

        Args:
            topic_id: UUID of the topic to delete

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Check if topic exists first
            check_response = (
                self.supabase_client.table("ptolemy_topics")
                .select("id, name")
                .eq("id", topic_id)
                .execute()
            )

            if not check_response.data:
                return False, {"error": f"Topic {topic_id} not found"}

            topic_name = check_response.data[0]["name"]

            # Delete the topic (CASCADE will handle topic_sources)
            self.supabase_client.table("ptolemy_topics").delete().eq("id", topic_id).execute()

            logger.info(f"Deleted topic: {topic_name} (id={topic_id})")
            return True, {"message": f"Topic '{topic_name}' deleted successfully"}

        except Exception as e:
            logger.error(f"Error deleting topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Database error: {str(e)}"}

    def get_topic_sources(self, topic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get all sources belonging to a topic.

        Args:
            topic_id: UUID of the topic

        Returns:
            Tuple of (success, result_dict) with sources list
        """
        try:
            # Verify topic exists
            topic_response = (
                self.supabase_client.table("ptolemy_topics")
                .select("id, name")
                .eq("id", topic_id)
                .single()
                .execute()
            )

            # Get source IDs for this topic
            mapping_response = (
                self.supabase_client.table("ptolemy_topic_sources")
                .select("source_id")
                .eq("topic_id", topic_id)
                .execute()
            )

            source_ids = [m["source_id"] for m in mapping_response.data]

            if not source_ids:
                return True, {
                    "topic_id": topic_id,
                    "topic_name": topic_response.data["name"],
                    "sources": [],
                }

            # Get source details
            sources_response = (
                self.supabase_client.table("ptolemy_sources")
                .select("source_id, source_url, source_display_name, title, metadata, created_at")
                .in_("source_id", source_ids)
                .execute()
            )

            logger.info(f"Retrieved {len(sources_response.data)} sources for topic {topic_id}")
            return True, {
                "topic_id": topic_id,
                "topic_name": topic_response.data["name"],
                "sources": sources_response.data,
            }

        except Exception as e:
            logger.error(f"Error getting sources for topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Topic not found or error: {str(e)}"}

    def move_source_to_topic(self, source_id: str, topic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Move a source to a different topic (v1: single topic per source).

        This removes any existing topic mapping and creates a new one.

        Args:
            source_id: ID of the source to move
            topic_id: UUID of the destination topic

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Verify source exists
            source_response = (
                self.supabase_client.table("ptolemy_sources")
                .select("source_id, source_display_name")
                .eq("source_id", source_id)
                .single()
                .execute()
            )

            # Verify topic exists
            topic_response = (
                self.supabase_client.table("ptolemy_topics")
                .select("id, name")
                .eq("id", topic_id)
                .single()
                .execute()
            )

            # Delete existing mapping (if any)
            self.supabase_client.table("ptolemy_topic_sources").delete().eq(
                "source_id", source_id
            ).execute()

            # Create new mapping
            self.supabase_client.table("ptolemy_topic_sources").insert({
                "topic_id": topic_id,
                "source_id": source_id,
            }).execute()

            logger.info(
                f"Moved source {source_response.data['source_display_name']} "
                f"to topic {topic_response.data['name']}"
            )

            return True, {
                "message": f"Source moved to topic '{topic_response.data['name']}'",
                "source_id": source_id,
                "topic_id": topic_id,
            }

        except Exception as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "no rows" in error_msg.lower():
                return False, {"error": "Source or topic not found"}
            logger.error(f"Error moving source {source_id} to topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Database error: {str(e)}"}

    def get_topic_pages(self, topic_id: str, limit: int = 100, offset: int = 0) -> tuple[bool, dict[str, Any]]:
        """
        Get deduplicated pages for a topic.

        Pages are deduplicated by canonical_url across all sources in the topic.

        Args:
            topic_id: UUID of the topic
            limit: Maximum pages to return
            offset: Pagination offset

        Returns:
            Tuple of (success, result_dict) with deduplicated pages
        """
        try:
            # Verify topic exists
            topic_response = (
                self.supabase_client.table("ptolemy_topics")
                .select("id, name")
                .eq("id", topic_id)
                .single()
                .execute()
            )

            # Get source IDs for this topic
            mapping_response = (
                self.supabase_client.table("ptolemy_topic_sources")
                .select("source_id")
                .eq("topic_id", topic_id)
                .execute()
            )

            source_ids = [m["source_id"] for m in mapping_response.data]

            if not source_ids:
                return True, {
                    "topic_id": topic_id,
                    "topic_name": topic_response.data["name"],
                    "pages": [],
                    "total": 0,
                }

            # Get page IDs linked to these sources via ptolemy_page_sources
            page_sources_response = (
                self.supabase_client.table("ptolemy_page_sources")
                .select("page_id")
                .in_("source_id", source_ids)
                .execute()
            )

            # Get unique page IDs
            page_ids = list(set(ps["page_id"] for ps in page_sources_response.data))

            if not page_ids:
                return True, {
                    "topic_id": topic_id,
                    "topic_name": topic_response.data["name"],
                    "pages": [],
                    "total": 0,
                }

            # Get page metadata with pagination
            pages_response = (
                self.supabase_client.table("ptolemy_page_metadata")
                .select("id, url, canonical_url, section_title, word_count, chunk_count, created_at, updated_at")
                .in_("id", page_ids)
                .order("updated_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            # Get source counts for each page
            pages_with_counts = []
            for page in pages_response.data:
                source_count_response = (
                    self.supabase_client.table("ptolemy_page_sources")
                    .select("source_id", count="exact")
                    .eq("page_id", page["id"])
                    .execute()
                )
                pages_with_counts.append({
                    **page,
                    "source_count": source_count_response.count or 0,
                })

            logger.info(f"Retrieved {len(pages_with_counts)} pages for topic {topic_id}")
            return True, {
                "topic_id": topic_id,
                "topic_name": topic_response.data["name"],
                "pages": pages_with_counts,
                "total": len(page_ids),
            }

        except Exception as e:
            logger.error(f"Error getting pages for topic {topic_id}: {e}", exc_info=True)
            return False, {"error": f"Topic not found or error: {str(e)}"}
