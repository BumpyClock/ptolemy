-- Migration: Add ptolemy_crawl_operations table
-- Purpose: Replace in-memory crawl task tracking with database-backed storage
-- This enables multi-worker correctness and persistent progress tracking

-- Create the crawl operations table for tracking crawl state
CREATE TABLE IF NOT EXISTS ptolemy_crawl_operations (
    -- Primary identification
    progress_id TEXT PRIMARY KEY,

    -- Operation type and status
    operation_type TEXT NOT NULL DEFAULT 'crawl',  -- 'crawl', 'upload', etc.
    status TEXT NOT NULL DEFAULT 'initializing',   -- initializing, starting, crawling, processing, completed, error, cancelled

    -- Progress tracking
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    log TEXT,

    -- Cancellation support
    cancellation_requested BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Metadata (logs, stats, source_id, url, etc.)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for querying active operations
CREATE INDEX IF NOT EXISTS idx_ptolemy_crawl_operations_status
    ON ptolemy_crawl_operations(status);

-- Index for finding operations by type
CREATE INDEX IF NOT EXISTS idx_ptolemy_crawl_operations_type
    ON ptolemy_crawl_operations(operation_type);

-- Index for finding active (non-terminal) operations
CREATE INDEX IF NOT EXISTS idx_ptolemy_crawl_operations_active
    ON ptolemy_crawl_operations(status)
    WHERE status NOT IN ('completed', 'error', 'cancelled');

-- Partial index for cancellation checks (only non-cancelled operations)
CREATE INDEX IF NOT EXISTS idx_ptolemy_crawl_operations_cancellation
    ON ptolemy_crawl_operations(progress_id)
    WHERE cancellation_requested = FALSE;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_ptolemy_crawl_operations_updated_at
    BEFORE UPDATE ON ptolemy_crawl_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ptolemy_crawl_operations ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other ptolemy tables)
CREATE POLICY "Allow service role full access" ON ptolemy_crawl_operations
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Allow authenticated users to read and update" ON ptolemy_crawl_operations
    FOR ALL TO authenticated
    USING (true);

-- Add comments
COMMENT ON TABLE ptolemy_crawl_operations IS 'Tracks crawl and upload operations for progress monitoring and cancellation support';
COMMENT ON COLUMN ptolemy_crawl_operations.progress_id IS 'Unique identifier for the operation (UUID)';
COMMENT ON COLUMN ptolemy_crawl_operations.operation_type IS 'Type of operation: crawl, upload, refresh';
COMMENT ON COLUMN ptolemy_crawl_operations.status IS 'Current status: initializing, starting, discovery, analyzing, crawling, processing, document_storage, code_extraction, finalization, completed, error, cancelled';
COMMENT ON COLUMN ptolemy_crawl_operations.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN ptolemy_crawl_operations.cancellation_requested IS 'Flag set by cancellation endpoint to signal operation should stop';
COMMENT ON COLUMN ptolemy_crawl_operations.metadata IS 'JSONB field storing logs, url, source_id, stats, and other operation data';


-- Table for concurrency control (slot-based approach)
-- Each row represents a slot; limit slots to enforce concurrency
CREATE TABLE IF NOT EXISTS ptolemy_crawl_slots (
    slot_id SERIAL PRIMARY KEY,
    progress_id TEXT REFERENCES ptolemy_crawl_operations(progress_id) ON DELETE SET NULL,
    acquired_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT slot_progress_unique UNIQUE (progress_id)
);

-- Insert the default number of slots (matches DEFAULT_CONCURRENT_CRAWL_LIMIT = 3)
-- This is idempotent - won't insert if slots already exist
INSERT INTO ptolemy_crawl_slots (slot_id)
SELECT generate_series(1, 3)
ON CONFLICT DO NOTHING;

-- Function to acquire a crawl slot
CREATE OR REPLACE FUNCTION ptolemy_acquire_crawl_slot(p_progress_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_slot_id INTEGER;
BEGIN
    -- Try to acquire an available slot (one with NULL progress_id)
    UPDATE ptolemy_crawl_slots
    SET progress_id = p_progress_id, acquired_at = NOW()
    WHERE slot_id = (
        SELECT slot_id FROM ptolemy_crawl_slots
        WHERE progress_id IS NULL
        ORDER BY slot_id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING slot_id INTO v_slot_id;

    RETURN v_slot_id IS NOT NULL;
END;
$$;

-- Function to release a crawl slot
CREATE OR REPLACE FUNCTION ptolemy_release_crawl_slot(p_progress_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE ptolemy_crawl_slots
    SET progress_id = NULL, acquired_at = NULL
    WHERE progress_id = p_progress_id;
END;
$$;

-- Function to get current slot count (for dynamic adjustment)
CREATE OR REPLACE FUNCTION ptolemy_get_slot_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM ptolemy_crawl_slots;
$$;

-- Function to adjust slot count
CREATE OR REPLACE FUNCTION ptolemy_set_slot_count(p_count INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Validate input
    IF p_count < 1 OR p_count > 10 THEN
        RAISE EXCEPTION 'Slot count must be between 1 and 10';
    END IF;

    SELECT COUNT(*) INTO v_current_count FROM ptolemy_crawl_slots;

    IF p_count > v_current_count THEN
        -- Add new slots
        INSERT INTO ptolemy_crawl_slots (slot_id)
        SELECT generate_series(v_current_count + 1, p_count);
    ELSIF p_count < v_current_count THEN
        -- Remove unused slots (only those not currently acquired)
        DELETE FROM ptolemy_crawl_slots
        WHERE slot_id > p_count AND progress_id IS NULL;
    END IF;
END;
$$;

-- Function to check if operation should be cancelled
CREATE OR REPLACE FUNCTION ptolemy_is_operation_cancelled(p_progress_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(cancellation_requested, FALSE)
    FROM ptolemy_crawl_operations
    WHERE progress_id = p_progress_id;
$$;

-- Function to request cancellation
CREATE OR REPLACE FUNCTION ptolemy_request_cancellation(p_progress_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE ptolemy_crawl_operations
    SET cancellation_requested = TRUE, updated_at = NOW()
    WHERE progress_id = p_progress_id
      AND status NOT IN ('completed', 'error', 'cancelled');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- Cleanup function for old completed operations (run periodically)
CREATE OR REPLACE FUNCTION ptolemy_cleanup_old_operations(p_hours_old INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM ptolemy_crawl_operations
    WHERE status IN ('completed', 'error', 'cancelled')
      AND updated_at < NOW() - (p_hours_old || ' hours')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION ptolemy_acquire_crawl_slot IS 'Attempts to acquire a crawl slot for concurrency control. Returns TRUE if slot acquired.';
COMMENT ON FUNCTION ptolemy_release_crawl_slot IS 'Releases a crawl slot when operation completes or fails.';
COMMENT ON FUNCTION ptolemy_is_operation_cancelled IS 'Checks if cancellation has been requested for an operation.';
COMMENT ON FUNCTION ptolemy_request_cancellation IS 'Requests cancellation of an active operation. Returns TRUE if successful.';
COMMENT ON FUNCTION ptolemy_cleanup_old_operations IS 'Removes old completed/failed/cancelled operations. Default: 24 hours old.';
