"""
Topics API Routes

API endpoints for managing topics and topic-source mappings.
Topics enable grouping of related sources for organization and deduplication.
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config.logfire_config import get_logger, logfire
from ..services.topics import TopicService

logger = get_logger(__name__)
router = APIRouter(prefix="/api", tags=["topics"])


# Request Models
class CreateTopicRequest(BaseModel):
    """Request model for creating a topic."""

    name: str
    description: str | None = None
    related_topic_ids: list[str] | None = None


class UpdateTopicRequest(BaseModel):
    """Request model for updating a topic."""

    name: str | None = None
    description: str | None = None
    related_topic_ids: list[str] | None = None


class MoveSourceRequest(BaseModel):
    """Request model for moving a source to a topic."""

    source_id: str


# Response Models
class TopicResponse(BaseModel):
    """Response model for a single topic."""

    id: str
    name: str
    description: str | None = None
    related_topic_ids: list[str] = []
    source_count: int = 0
    created_at: str
    updated_at: str


class TopicListResponse(BaseModel):
    """Response model for list of topics."""

    topics: list[TopicResponse]
    count: int
    timestamp: str


class TopicSourcesResponse(BaseModel):
    """Response model for topic sources."""

    topic_id: str
    topic_name: str
    sources: list[dict]


class TopicPagesResponse(BaseModel):
    """Response model for topic pages."""

    topic_id: str
    topic_name: str
    pages: list[dict]
    total: int


# Endpoints
@router.get("/topics")
async def list_topics() -> TopicListResponse:
    """
    List all topics with their source counts.

    Returns:
        TopicListResponse with list of topics
    """
    try:
        logfire.debug("Listing all topics")

        topic_service = TopicService()
        success, result = topic_service.list_topics()

        if not success:
            raise HTTPException(status_code=500, detail=result)

        topics = result["topics"]
        logfire.info(f"Topics listed | count={len(topics)}")

        return TopicListResponse(
            topics=[TopicResponse(**t) for t in topics],
            count=len(topics),
            timestamp=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list topics | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str) -> dict:
    """
    Get a single topic by ID.

    Args:
        topic_id: UUID of the topic

    Returns:
        Topic details with source count
    """
    try:
        logfire.debug(f"Getting topic | topic_id={topic_id}")

        topic_service = TopicService()
        success, result = topic_service.get_topic(topic_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Topic retrieved | topic_id={topic_id}")
        return {"topic": TopicResponse(**result["topic"])}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get topic | topic_id={topic_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/topics")
async def create_topic(request: CreateTopicRequest) -> dict:
    """
    Create a new topic.

    Args:
        request: CreateTopicRequest with name, optional description, and related_topic_ids

    Returns:
        Created topic
    """
    try:
        logfire.debug(f"Creating topic | name={request.name}")

        topic_service = TopicService()
        success, result = topic_service.create_topic(
            name=request.name,
            description=request.description,
            related_topic_ids=request.related_topic_ids,
        )

        if not success:
            if "already exists" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result)
            raise HTTPException(status_code=400, detail=result)

        logfire.info(f"Topic created | topic_id={result['topic']['id']} | name={request.name}")
        return {"topic": TopicResponse(**result["topic"])}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create topic | name={request.name} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: str, request: UpdateTopicRequest) -> dict:
    """
    Update an existing topic.

    Args:
        topic_id: UUID of the topic to update
        request: UpdateTopicRequest with optional name, description, related_topic_ids

    Returns:
        Updated topic
    """
    try:
        logfire.debug(f"Updating topic | topic_id={topic_id}")

        topic_service = TopicService()
        success, result = topic_service.update_topic(
            topic_id=topic_id,
            name=request.name,
            description=request.description,
            related_topic_ids=request.related_topic_ids,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            if "already exists" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result)
            raise HTTPException(status_code=400, detail=result)

        logfire.info(f"Topic updated | topic_id={topic_id}")
        return {"topic": TopicResponse(**result["topic"])}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update topic | topic_id={topic_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str) -> dict:
    """
    Delete a topic.

    Note: This will unlink all sources from the topic but not delete the sources.

    Args:
        topic_id: UUID of the topic to delete

    Returns:
        Confirmation message
    """
    try:
        logfire.debug(f"Deleting topic | topic_id={topic_id}")

        topic_service = TopicService()
        success, result = topic_service.delete_topic(topic_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Topic deleted | topic_id={topic_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete topic | topic_id={topic_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/topics/{topic_id}/sources")
async def get_topic_sources(topic_id: str) -> TopicSourcesResponse:
    """
    Get all sources belonging to a topic.

    Args:
        topic_id: UUID of the topic

    Returns:
        TopicSourcesResponse with list of sources
    """
    try:
        logfire.debug(f"Getting sources for topic | topic_id={topic_id}")

        topic_service = TopicService()
        success, result = topic_service.get_topic_sources(topic_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Topic sources retrieved | topic_id={topic_id} | count={len(result['sources'])}")
        return TopicSourcesResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get topic sources | topic_id={topic_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/topics/{topic_id}/sources")
async def move_source_to_topic(topic_id: str, request: MoveSourceRequest) -> dict:
    """
    Move a source to this topic.

    In v1 (single topic per source), this removes the source from any existing
    topic and adds it to the specified topic.

    Args:
        topic_id: UUID of the destination topic
        request: MoveSourceRequest with source_id

    Returns:
        Confirmation message
    """
    try:
        logfire.debug(f"Moving source to topic | topic_id={topic_id} | source_id={request.source_id}")

        topic_service = TopicService()
        success, result = topic_service.move_source_to_topic(
            source_id=request.source_id,
            topic_id=topic_id,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            raise HTTPException(status_code=400, detail=result)

        logfire.info(f"Source moved to topic | topic_id={topic_id} | source_id={request.source_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to move source to topic | topic_id={topic_id} | source_id={request.source_id} | error={str(e)}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/topics/{topic_id}/pages")
async def get_topic_pages(topic_id: str, limit: int = 100, offset: int = 0) -> TopicPagesResponse:
    """
    Get deduplicated pages for a topic.

    Pages are deduplicated by canonical_url across all sources in the topic.
    Each page includes a source_count indicating how many sources reference it.

    Args:
        topic_id: UUID of the topic
        limit: Maximum pages to return (default 100)
        offset: Pagination offset (default 0)

    Returns:
        TopicPagesResponse with deduplicated pages
    """
    try:
        logfire.debug(f"Getting pages for topic | topic_id={topic_id} | limit={limit} | offset={offset}")

        topic_service = TopicService()
        success, result = topic_service.get_topic_pages(topic_id, limit=limit, offset=offset)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Topic pages retrieved | topic_id={topic_id} | returned={len(result['pages'])} | total={result['total']}"
        )
        return TopicPagesResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get topic pages | topic_id={topic_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
