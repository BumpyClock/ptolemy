"""
Progress Tracker Utility

Tracks operation progress with database persistence and in-memory caching.
Provides HTTP polling access with database fallback for multi-worker support.
"""

import asyncio
from datetime import datetime
from typing import Any

from ...config.logfire_config import safe_logfire_error, safe_logfire_info


class ProgressTracker:
    """
    Utility class for tracking progress updates with database persistence.

    Uses in-memory cache for fast reads with database fallback.
    State can be accessed via HTTP polling endpoints.
    """

    # Class-level in-memory cache for fast access
    _progress_states: dict[str, dict[str, Any]] = {}

    # Database store instance (lazy initialization)
    _db_store = None

    @classmethod
    def _get_db_store(cls):
        """Get the database store instance (lazy initialization)."""
        if cls._db_store is None:
            from ...services.crawl_operation_store import get_crawl_operation_store
            cls._db_store = get_crawl_operation_store()
        return cls._db_store

    def __init__(self, progress_id: str, operation_type: str = "crawl"):
        """
        Initialize the progress tracker.

        Args:
            progress_id: Unique progress identifier
            operation_type: Type of operation (crawl, upload, etc.)
        """
        self.progress_id = progress_id
        self.operation_type = operation_type
        self.state = {
            "progress_id": progress_id,
            "type": operation_type,
            "start_time": datetime.now().isoformat(),
            "status": "initializing",
            "progress": 0,
            "logs": [],
        }
        # Store in class-level cache
        ProgressTracker._progress_states[progress_id] = self.state

    @classmethod
    def get_progress(cls, progress_id: str) -> dict[str, Any] | None:
        """
        Get progress state by ID.

        Checks in-memory cache first, falls back to database if not found.
        """
        # Check cache first
        if progress_id in cls._progress_states:
            return cls._progress_states[progress_id]

        # Fall back to database
        try:
            store = cls._get_db_store()
            # Use sync wrapper since this is a classmethod called from sync context
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                # If we're in an async context, we can't call await directly
                # Return None and let the async caller handle it
                return None
            except RuntimeError:
                # No running loop, we can run async code
                result = asyncio.run(store.get_operation(progress_id))
                if result:
                    # Convert DB format to expected format
                    state = cls._db_to_state(result)
                    # Cache it
                    cls._progress_states[progress_id] = state
                    return state
        except Exception as e:
            safe_logfire_error(f"Failed to get progress from DB | error={e} | progress_id={progress_id}")

        return None

    @classmethod
    async def get_progress_async(cls, progress_id: str) -> dict[str, Any] | None:
        """
        Get progress state by ID (async version).

        Checks in-memory cache first, falls back to database if not found.
        """
        # Check cache first
        if progress_id in cls._progress_states:
            return cls._progress_states[progress_id]

        # Fall back to database
        try:
            store = cls._get_db_store()
            result = await store.get_operation(progress_id)
            if result:
                # Convert DB format to expected format
                state = cls._db_to_state(result)
                # Cache it
                cls._progress_states[progress_id] = state
                return state
        except Exception as e:
            safe_logfire_error(f"Failed to get progress from DB | error={e} | progress_id={progress_id}")

        return None

    @classmethod
    def _db_to_state(cls, db_record: dict) -> dict[str, Any]:
        """Convert database record format to state format."""
        metadata = db_record.get("metadata", {})
        if isinstance(metadata, str):
            import json
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}

        state = {
            "progress_id": db_record.get("progress_id"),
            "type": db_record.get("operation_type", "crawl"),
            "status": db_record.get("status", "unknown"),
            "progress": db_record.get("progress", 0),
            "log": db_record.get("log", ""),
            "logs": metadata.get("logs", []),
            "start_time": metadata.get("start_time", db_record.get("created_at")),
        }

        # Merge metadata fields
        for key, value in metadata.items():
            if key not in state and key != "logs":
                state[key] = value

        return state

    @classmethod
    def clear_progress(cls, progress_id: str) -> None:
        """Remove progress state from memory cache."""
        if progress_id in cls._progress_states:
            del cls._progress_states[progress_id]

    @classmethod
    def list_active(cls) -> dict[str, dict[str, Any]]:
        """Get all active progress states from cache."""
        return cls._progress_states.copy()

    @classmethod
    async def _delayed_cleanup(cls, progress_id: str, delay_seconds: int = 30):
        """
        Remove progress state from memory after a delay.

        This gives clients time to see the final state before cleanup.
        Database records are cleaned up separately by ptolemy_cleanup_old_operations.
        """
        await asyncio.sleep(delay_seconds)
        if progress_id in cls._progress_states:
            status = cls._progress_states[progress_id].get("status", "unknown")
            # Only clean up if still in terminal state (prevent cleanup of reused IDs)
            if status in ["completed", "failed", "error", "cancelled"]:
                del cls._progress_states[progress_id]
                safe_logfire_info(f"Progress cache cleaned up after delay | progress_id={progress_id} | status={status}")

    async def start(self, initial_data: dict[str, Any] | None = None):
        """
        Start progress tracking with initial data.

        Args:
            initial_data: Optional initial data to include
        """
        self.state["status"] = "starting"
        self.state["start_time"] = datetime.now().isoformat()

        if initial_data:
            self.state.update(initial_data)

        self._update_state()

        # Create database record
        try:
            store = self._get_db_store()
            await store.create_operation(
                progress_id=self.progress_id,
                operation_type=self.operation_type,
                initial_data=self.state.copy(),
            )
        except Exception as e:
            safe_logfire_error(f"Failed to create DB record on start | error={e} | progress_id={self.progress_id}")

        safe_logfire_info(
            f"Progress tracking started | progress_id={self.progress_id} | type={self.operation_type}"
        )

    async def update(self, status: str, progress: int, log: str, **kwargs):
        """
        Update progress with status, progress, and log message.

        Args:
            status: Current status (analyzing, crawling, processing, etc.)
            progress: Progress value (0-100)
            log: Log message describing current operation
            **kwargs: Additional data to include in update
        """
        # Debug logging for document_storage issue
        if status == "document_storage" and progress >= 90:
            safe_logfire_info(
                f"DEBUG: ProgressTracker.update called | status={status} | progress={progress} | "
                f"current_state_progress={self.state.get('progress', 0)} | kwargs_keys={list(kwargs.keys())}"
            )

        # CRITICAL: Never allow progress to go backwards
        current_progress = self.state.get("progress", 0)
        new_progress = min(100, max(0, progress))

        if new_progress < current_progress:
            safe_logfire_info(
                f"Progress backwards prevented: {current_progress}% -> {new_progress}% | "
                f"progress_id={self.progress_id} | status={status}"
            )
            actual_progress = current_progress
        else:
            actual_progress = new_progress

        self.state.update({
            "status": status,
            "progress": actual_progress,
            "log": log,
            "timestamp": datetime.now().isoformat(),
        })

        # DEBUG: Log final state for document_storage
        if status == "document_storage" and actual_progress >= 35:
            safe_logfire_info(
                f"DEBUG ProgressTracker state updated | status={status} | actual_progress={actual_progress} | "
                f"state_progress={self.state.get('progress')} | received_progress={progress}"
            )

        # Add log entry
        if "logs" not in self.state:
            self.state["logs"] = []
        self.state["logs"].append({
            "timestamp": datetime.now().isoformat(),
            "message": log,
            "status": status,
            "progress": actual_progress,
        })
        # Keep only the last 200 log entries
        if len(self.state["logs"]) > 200:
            self.state["logs"] = self.state["logs"][-200:]

        # Add any additional data (but don't allow overriding core fields)
        protected_fields = {"progress", "status", "log", "progress_id", "type", "start_time"}
        for key, value in kwargs.items():
            if key not in protected_fields:
                self.state[key] = value

        self._update_state()

        # Update database record asynchronously
        try:
            store = self._get_db_store()
            await store.update_operation(
                progress_id=self.progress_id,
                status=status,
                progress=actual_progress,
                log=log,
                **kwargs,
            )
        except Exception as e:
            safe_logfire_error(f"Failed to update DB record | error={e} | progress_id={self.progress_id}")

        # Schedule cleanup for terminal states
        if status in ["cancelled", "failed"]:
            asyncio.create_task(self._delayed_cleanup(self.progress_id))

    async def complete(self, completion_data: dict[str, Any] | None = None):
        """
        Mark progress as completed with optional completion data.

        Args:
            completion_data: Optional data about the completed operation
        """
        self.state["status"] = "completed"
        self.state["progress"] = 100
        self.state["end_time"] = datetime.now().isoformat()

        if completion_data:
            self.state.update(completion_data)

        # Calculate duration
        if "start_time" in self.state:
            start = datetime.fromisoformat(self.state["start_time"])
            end = datetime.fromisoformat(self.state["end_time"])
            duration = (end - start).total_seconds()
            self.state["duration"] = str(duration)
            self.state["duration_formatted"] = self._format_duration(duration)

        self._update_state()

        # Update database record
        try:
            store = self._get_db_store()
            await store.complete_operation(
                progress_id=self.progress_id,
                completion_data=completion_data,
            )
        except Exception as e:
            safe_logfire_error(f"Failed to complete DB record | error={e} | progress_id={self.progress_id}")

        safe_logfire_info(
            f"Progress completed | progress_id={self.progress_id} | type={self.operation_type} | duration={self.state.get('duration_formatted', 'unknown')}"
        )

        # Schedule cleanup after delay to allow clients to see final state
        asyncio.create_task(self._delayed_cleanup(self.progress_id))

    async def error(self, error_message: str, error_details: dict[str, Any] | None = None):
        """
        Mark progress as failed with error information.

        Args:
            error_message: Error message
            error_details: Optional additional error details
        """
        self.state.update({
            "status": "error",
            "error": error_message,
            "error_time": datetime.now().isoformat(),
        })

        if error_details:
            self.state["error_details"] = error_details

        self._update_state()

        # Update database record
        try:
            store = self._get_db_store()
            await store.error_operation(
                progress_id=self.progress_id,
                error_message=error_message,
                error_details=error_details,
            )
        except Exception as e:
            safe_logfire_error(f"Failed to set error in DB record | error={e} | progress_id={self.progress_id}")

        safe_logfire_error(
            f"Progress error | progress_id={self.progress_id} | type={self.operation_type} | error={error_message}"
        )

        # Schedule cleanup after delay to allow clients to see final state
        asyncio.create_task(self._delayed_cleanup(self.progress_id))

    async def update_batch_progress(
        self, current_batch: int, total_batches: int, batch_size: int, message: str
    ):
        """
        Update progress for batch operations.

        Args:
            current_batch: Current batch number (1-based)
            total_batches: Total number of batches
            batch_size: Size of each batch
            message: Progress message
        """
        progress_val = int((current_batch / max(total_batches, 1)) * 100)
        await self.update(
            status="processing_batch",
            progress=progress_val,
            log=message,
            current_batch=current_batch,
            total_batches=total_batches,
            batch_size=batch_size,
        )

    async def update_crawl_stats(
        self,
        processed_pages: int,
        total_pages: int,
        current_url: str | None = None,
        pages_found: int | None = None
    ):
        """
        Update crawling statistics with detailed metrics.

        Args:
            processed_pages: Number of pages processed
            total_pages: Total pages to process
            current_url: Currently processing URL
            pages_found: Total pages discovered during crawl
        """
        progress_val = int((processed_pages / max(total_pages, 1)) * 100)
        log = f"Processing page {processed_pages}/{total_pages}"
        if current_url:
            log += f": {current_url}"

        update_data = {
            "status": "crawling",
            "progress": progress_val,
            "log": log,
            "processed_pages": processed_pages,
            "total_pages": total_pages,
            "current_url": current_url,
        }

        if pages_found is not None:
            update_data["pages_found"] = pages_found

        await self.update(**update_data)

    async def update_storage_progress(
        self,
        chunks_stored: int,
        total_chunks: int,
        operation: str = "storing",
        word_count: int | None = None,
        embeddings_created: int | None = None
    ):
        """
        Update document storage progress with detailed metrics.

        Args:
            chunks_stored: Number of chunks stored
            total_chunks: Total chunks to store
            operation: Storage operation description
            word_count: Total word count processed
            embeddings_created: Number of embeddings created
        """
        progress_val = int((chunks_stored / max(total_chunks, 1)) * 100)

        update_data = {
            "status": "document_storage",
            "progress": progress_val,
            "log": f"{operation}: {chunks_stored}/{total_chunks} chunks",
            "chunks_stored": chunks_stored,
            "total_chunks": total_chunks,
        }

        if word_count is not None:
            update_data["word_count"] = word_count
        if embeddings_created is not None:
            update_data["embeddings_created"] = embeddings_created

        await self.update(**update_data)

    async def update_code_extraction_progress(
        self,
        completed_summaries: int,
        total_summaries: int,
        code_blocks_found: int,
        current_file: str | None = None
    ):
        """
        Update code extraction progress with detailed metrics.

        Args:
            completed_summaries: Number of code summaries completed
            total_summaries: Total code summaries to generate
            code_blocks_found: Total number of code blocks found
            current_file: Current file being processed
        """
        progress_val = int((completed_summaries / max(total_summaries, 1)) * 100)

        log = f"Extracting code: {completed_summaries}/{total_summaries} summaries"
        if current_file:
            log += f" - {current_file}"

        await self.update(
            status="code_extraction",
            progress=progress_val,
            log=log,
            completed_summaries=completed_summaries,
            total_summaries=total_summaries,
            code_blocks_found=code_blocks_found,
            current_file=current_file
        )

    def _update_state(self):
        """Update progress state in memory cache."""
        ProgressTracker._progress_states[self.progress_id] = self.state

        safe_logfire_info(
            f"📊 [PROGRESS] Updated {self.operation_type} | ID: {self.progress_id} | "
            f"Status: {self.state.get('status')} | Progress: {self.state.get('progress')}%"
        )

    def _format_duration(self, seconds: float) -> str:
        """Format duration in seconds to human-readable string."""
        if seconds < 60:
            return f"{seconds:.1f} seconds"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f} minutes"
        else:
            hours = seconds / 3600
            return f"{hours:.1f} hours"

    def get_state(self) -> dict[str, Any]:
        """Get current progress state."""
        return self.state.copy()


# Helper functions for cancellation checking
async def check_operation_cancelled(progress_id: str) -> bool:
    """
    Check if an operation has been cancelled.

    Args:
        progress_id: Operation identifier

    Returns:
        True if cancellation has been requested
    """
    try:
        from ...services.crawl_operation_store import get_crawl_operation_store
        store = get_crawl_operation_store()
        return await store.is_cancelled(progress_id)
    except Exception as e:
        safe_logfire_error(f"Failed to check cancellation | error={e} | progress_id={progress_id}")
        return False


async def request_operation_cancellation(progress_id: str) -> bool:
    """
    Request cancellation of an operation.

    Args:
        progress_id: Operation identifier

    Returns:
        True if cancellation was requested successfully
    """
    try:
        from ...services.crawl_operation_store import get_crawl_operation_store
        store = get_crawl_operation_store()
        return await store.request_cancellation(progress_id)
    except Exception as e:
        safe_logfire_error(f"Failed to request cancellation | error={e} | progress_id={progress_id}")
        return False
