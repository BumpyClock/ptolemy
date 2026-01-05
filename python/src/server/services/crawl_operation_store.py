"""
Crawl Operation Store

Database-backed storage for crawl operation state, replacing in-memory globals.
Provides persistent progress tracking, cancellation support, and concurrency control.
"""

import json
from datetime import datetime
from typing import Any

from ..config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info
from ..utils import get_supabase_client

logger = get_logger(__name__)


class CrawlOperationStore:
    """
    Database-backed store for crawl operation state.

    Replaces:
    - active_crawl_tasks dict in knowledge_api.py
    - _active_orchestrations dict in crawling_service.py
    - _progress_states dict in progress_tracker.py
    """

    def __init__(self, supabase_client=None):
        """Initialize the store with a Supabase client."""
        self.supabase = supabase_client or get_supabase_client()

    async def create_operation(
        self,
        progress_id: str,
        operation_type: str = "crawl",
        initial_data: dict[str, Any] | None = None,
    ) -> bool:
        """
        Create a new crawl operation record.

        Args:
            progress_id: Unique identifier for the operation
            operation_type: Type of operation (crawl, upload, refresh)
            initial_data: Optional initial metadata

        Returns:
            True if created successfully, False otherwise
        """
        try:
            metadata = initial_data or {}
            # Store logs array in metadata
            metadata["logs"] = metadata.get("logs", [])
            metadata["start_time"] = datetime.now().isoformat()

            data = {
                "progress_id": progress_id,
                "operation_type": operation_type,
                "status": "initializing",
                "progress": 0,
                "log": metadata.get("log", f"Starting {operation_type} operation"),
                "metadata": json.dumps(metadata),
            }

            result = self.supabase.table("ptolemy_crawl_operations").insert(data).execute()

            if result.data:
                safe_logfire_info(
                    f"Created crawl operation | progress_id={progress_id} | type={operation_type}"
                )
                return True
            return False

        except Exception as e:
            safe_logfire_error(f"Failed to create crawl operation | error={e} | progress_id={progress_id}")
            return False

    async def update_operation(
        self,
        progress_id: str,
        status: str | None = None,
        progress: int | None = None,
        log: str | None = None,
        **kwargs,
    ) -> bool:
        """
        Update a crawl operation's state.

        Args:
            progress_id: Operation identifier
            status: New status
            progress: Progress percentage (0-100)
            log: Log message
            **kwargs: Additional metadata to merge

        Returns:
            True if updated successfully
        """
        try:
            # First get existing metadata to merge
            existing = await self.get_operation(progress_id)
            if not existing:
                safe_logfire_error(f"Cannot update non-existent operation | progress_id={progress_id}")
                return False

            existing_metadata = existing.get("metadata", {})
            if isinstance(existing_metadata, str):
                existing_metadata = json.loads(existing_metadata)

            # Build update data
            update_data = {}

            if status is not None:
                update_data["status"] = status

            if progress is not None:
                # Prevent progress from going backwards
                current_progress = existing.get("progress", 0)
                update_data["progress"] = max(current_progress, min(100, max(0, progress)))

            if log is not None:
                update_data["log"] = log
                # Append to logs array in metadata
                logs = existing_metadata.get("logs", [])
                logs.append({
                    "timestamp": datetime.now().isoformat(),
                    "message": log,
                    "status": status or existing.get("status", "unknown"),
                    "progress": update_data.get("progress", existing.get("progress", 0)),
                })
                # Keep only last 200 log entries
                if len(logs) > 200:
                    logs = logs[-200:]
                existing_metadata["logs"] = logs

            # Merge additional kwargs into metadata
            protected_fields = {"progress", "status", "log", "progress_id", "operation_type"}
            for key, value in kwargs.items():
                if key not in protected_fields:
                    existing_metadata[key] = value

            update_data["metadata"] = json.dumps(existing_metadata)

            # Perform update
            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .update(update_data)
                .eq("progress_id", progress_id)
                .execute()
            )

            return bool(result.data)

        except Exception as e:
            safe_logfire_error(f"Failed to update crawl operation | error={e} | progress_id={progress_id}")
            return False

    async def complete_operation(
        self,
        progress_id: str,
        completion_data: dict[str, Any] | None = None,
    ) -> bool:
        """
        Mark an operation as completed.

        Args:
            progress_id: Operation identifier
            completion_data: Optional completion metadata

        Returns:
            True if completed successfully
        """
        try:
            existing = await self.get_operation(progress_id)
            if not existing:
                return False

            existing_metadata = existing.get("metadata", {})
            if isinstance(existing_metadata, str):
                existing_metadata = json.loads(existing_metadata)

            # Merge completion data
            if completion_data:
                existing_metadata.update(completion_data)

            existing_metadata["end_time"] = datetime.now().isoformat()

            # Calculate duration
            if "start_time" in existing_metadata:
                try:
                    start = datetime.fromisoformat(existing_metadata["start_time"])
                    end = datetime.fromisoformat(existing_metadata["end_time"])
                    duration = (end - start).total_seconds()
                    existing_metadata["duration"] = str(duration)
                    existing_metadata["duration_formatted"] = self._format_duration(duration)
                except Exception:
                    pass

            update_data = {
                "status": "completed",
                "progress": 100,
                "log": completion_data.get("log", "Operation completed successfully") if completion_data else "Operation completed",
                "completed_at": datetime.now().isoformat(),
                "metadata": json.dumps(existing_metadata),
            }

            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .update(update_data)
                .eq("progress_id", progress_id)
                .execute()
            )

            if result.data:
                safe_logfire_info(f"Completed crawl operation | progress_id={progress_id}")
                # Release any held slot
                await self.release_slot(progress_id)
                return True
            return False

        except Exception as e:
            safe_logfire_error(f"Failed to complete crawl operation | error={e} | progress_id={progress_id}")
            return False

    async def error_operation(
        self,
        progress_id: str,
        error_message: str,
        error_details: dict[str, Any] | None = None,
    ) -> bool:
        """
        Mark an operation as failed with error.

        Args:
            progress_id: Operation identifier
            error_message: Error message
            error_details: Optional error details

        Returns:
            True if updated successfully
        """
        try:
            existing = await self.get_operation(progress_id)
            if not existing:
                return False

            existing_metadata = existing.get("metadata", {})
            if isinstance(existing_metadata, str):
                existing_metadata = json.loads(existing_metadata)

            existing_metadata["error"] = error_message
            existing_metadata["error_time"] = datetime.now().isoformat()
            if error_details:
                existing_metadata["error_details"] = error_details

            update_data = {
                "status": "error",
                "log": error_message,
                "completed_at": datetime.now().isoformat(),
                "metadata": json.dumps(existing_metadata),
            }

            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .update(update_data)
                .eq("progress_id", progress_id)
                .execute()
            )

            if result.data:
                safe_logfire_error(f"Crawl operation error | progress_id={progress_id} | error={error_message}")
                # Release any held slot
                await self.release_slot(progress_id)
                return True
            return False

        except Exception as e:
            safe_logfire_error(f"Failed to set error on crawl operation | error={e} | progress_id={progress_id}")
            return False

    async def get_operation(self, progress_id: str) -> dict[str, Any] | None:
        """
        Get operation state by progress_id.

        Args:
            progress_id: Operation identifier

        Returns:
            Operation data dict or None if not found
        """
        try:
            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .select("*")
                .eq("progress_id", progress_id)
                .execute()
            )

            if result.data and len(result.data) > 0:
                data = result.data[0]
                # Parse metadata JSON if it's a string
                if isinstance(data.get("metadata"), str):
                    try:
                        data["metadata"] = json.loads(data["metadata"])
                    except json.JSONDecodeError:
                        data["metadata"] = {}
                return data
            return None

        except Exception as e:
            safe_logfire_error(f"Failed to get crawl operation | error={e} | progress_id={progress_id}")
            return None

    async def delete_operation(self, progress_id: str) -> bool:
        """
        Delete an operation record.

        Args:
            progress_id: Operation identifier

        Returns:
            True if deleted successfully
        """
        try:
            # Release slot first
            await self.release_slot(progress_id)

            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .delete()
                .eq("progress_id", progress_id)
                .execute()
            )

            return bool(result.data)

        except Exception as e:
            safe_logfire_error(f"Failed to delete crawl operation | error={e} | progress_id={progress_id}")
            return False

    # ========== Cancellation Support ==========

    async def request_cancellation(self, progress_id: str) -> bool:
        """
        Request cancellation of an operation.

        Args:
            progress_id: Operation identifier

        Returns:
            True if cancellation was requested successfully
        """
        try:
            # Use the database function for atomic update
            result = self.supabase.rpc(
                "ptolemy_request_cancellation",
                {"p_progress_id": progress_id}
            ).execute()

            success = result.data if result.data is not None else False
            if success:
                safe_logfire_info(f"Cancellation requested | progress_id={progress_id}")
            return success

        except Exception as e:
            safe_logfire_error(f"Failed to request cancellation | error={e} | progress_id={progress_id}")
            return False

    async def is_cancelled(self, progress_id: str) -> bool:
        """
        Check if an operation has been cancelled.

        Args:
            progress_id: Operation identifier

        Returns:
            True if cancellation has been requested
        """
        try:
            result = self.supabase.rpc(
                "ptolemy_is_operation_cancelled",
                {"p_progress_id": progress_id}
            ).execute()

            return result.data if result.data is not None else False

        except Exception as e:
            safe_logfire_error(f"Failed to check cancellation | error={e} | progress_id={progress_id}")
            return False

    async def mark_cancelled(self, progress_id: str) -> bool:
        """
        Mark an operation as cancelled (final state).

        Args:
            progress_id: Operation identifier

        Returns:
            True if marked successfully
        """
        try:
            existing = await self.get_operation(progress_id)
            current_progress = existing.get("progress", 0) if existing else 0

            update_data = {
                "status": "cancelled",
                "log": "Operation cancelled by user",
                "completed_at": datetime.now().isoformat(),
            }

            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .update(update_data)
                .eq("progress_id", progress_id)
                .execute()
            )

            if result.data:
                safe_logfire_info(f"Operation marked cancelled | progress_id={progress_id}")
                # Release any held slot
                await self.release_slot(progress_id)
                return True
            return False

        except Exception as e:
            safe_logfire_error(f"Failed to mark cancelled | error={e} | progress_id={progress_id}")
            return False

    # ========== Concurrency Control (Slot-based) ==========

    async def acquire_slot(self, progress_id: str) -> bool:
        """
        Attempt to acquire a crawl slot for concurrency control.

        Args:
            progress_id: Operation identifier

        Returns:
            True if slot was acquired, False if all slots are in use
        """
        try:
            result = self.supabase.rpc(
                "ptolemy_acquire_crawl_slot",
                {"p_progress_id": progress_id}
            ).execute()

            acquired = result.data if result.data is not None else False
            if acquired:
                safe_logfire_info(f"Acquired crawl slot | progress_id={progress_id}")
            else:
                safe_logfire_info(f"No crawl slots available | progress_id={progress_id}")
            return acquired

        except Exception as e:
            safe_logfire_error(f"Failed to acquire crawl slot | error={e} | progress_id={progress_id}")
            return False

    async def release_slot(self, progress_id: str) -> bool:
        """
        Release a crawl slot.

        Args:
            progress_id: Operation identifier

        Returns:
            True if released successfully
        """
        try:
            self.supabase.rpc(
                "ptolemy_release_crawl_slot",
                {"p_progress_id": progress_id}
            ).execute()

            safe_logfire_info(f"Released crawl slot | progress_id={progress_id}")
            return True

        except Exception as e:
            safe_logfire_error(f"Failed to release crawl slot | error={e} | progress_id={progress_id}")
            return False

    async def get_slot_count(self) -> int:
        """
        Get the current number of crawl slots.

        Returns:
            Number of slots configured
        """
        try:
            result = self.supabase.rpc("ptolemy_get_slot_count").execute()
            return result.data if result.data is not None else 3

        except Exception as e:
            safe_logfire_error(f"Failed to get slot count | error={e}")
            return 3  # Default

    async def set_slot_count(self, count: int) -> bool:
        """
        Set the number of crawl slots (1-10).

        Args:
            count: Number of slots to configure

        Returns:
            True if set successfully
        """
        try:
            self.supabase.rpc(
                "ptolemy_set_slot_count",
                {"p_count": count}
            ).execute()

            safe_logfire_info(f"Set crawl slot count | count={count}")
            return True

        except Exception as e:
            safe_logfire_error(f"Failed to set slot count | error={e}")
            return False

    # ========== Utility Methods ==========

    async def list_active_operations(self) -> list[dict[str, Any]]:
        """
        List all active (non-terminal) operations.

        Returns:
            List of active operation records
        """
        try:
            result = (
                self.supabase.table("ptolemy_crawl_operations")
                .select("*")
                .not_.in_("status", ["completed", "error", "cancelled"])
                .execute()
            )

            operations = result.data or []
            # Parse metadata
            for op in operations:
                if isinstance(op.get("metadata"), str):
                    try:
                        op["metadata"] = json.loads(op["metadata"])
                    except json.JSONDecodeError:
                        op["metadata"] = {}
            return operations

        except Exception as e:
            safe_logfire_error(f"Failed to list active operations | error={e}")
            return []

    async def cleanup_old_operations(self, hours_old: int = 24) -> int:
        """
        Remove old completed operations.

        Args:
            hours_old: Age threshold in hours

        Returns:
            Number of operations deleted
        """
        try:
            result = self.supabase.rpc(
                "ptolemy_cleanup_old_operations",
                {"p_hours_old": hours_old}
            ).execute()

            deleted = result.data if result.data is not None else 0
            if deleted > 0:
                safe_logfire_info(f"Cleaned up {deleted} old crawl operations")
            return deleted

        except Exception as e:
            safe_logfire_error(f"Failed to cleanup old operations | error={e}")
            return 0

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


# Singleton instance for easy import
_store_instance: CrawlOperationStore | None = None


def get_crawl_operation_store() -> CrawlOperationStore:
    """Get the singleton CrawlOperationStore instance."""
    global _store_instance
    if _store_instance is None:
        _store_instance = CrawlOperationStore()
    return _store_instance
