-- Migration: Add atomic metadata update function
-- Purpose: Prevent race conditions when updating ptolemy_sources metadata
-- Uses JSONB merge operator (||) for atomic update

-- Function to atomically update metadata using JSONB merge
CREATE OR REPLACE FUNCTION ptolemy_update_source_metadata(
    p_source_id TEXT,
    p_metadata_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated_metadata JSONB;
BEGIN
    -- Atomic update using JSONB merge operator
    -- This merges the new values into existing metadata without read-modify-write race
    UPDATE ptolemy_sources
    SET metadata = COALESCE(metadata, '{}'::jsonb) || p_metadata_updates,
        updated_at = NOW()
    WHERE source_id = p_source_id
    RETURNING metadata INTO v_updated_metadata;

    RETURN v_updated_metadata;
END;
$$;

COMMENT ON FUNCTION ptolemy_update_source_metadata IS 'Atomically merges metadata updates using JSONB || operator to prevent race conditions';

-- Also add a combined update function that can handle both title and metadata
CREATE OR REPLACE FUNCTION ptolemy_update_source(
    p_source_id TEXT,
    p_title TEXT DEFAULT NULL,
    p_metadata_updates JSONB DEFAULT NULL
)
RETURNS TABLE (
    source_id TEXT,
    title TEXT,
    metadata JSONB,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE ptolemy_sources s
    SET
        title = COALESCE(p_title, s.title),
        metadata = CASE
            WHEN p_metadata_updates IS NOT NULL
            THEN COALESCE(s.metadata, '{}'::jsonb) || p_metadata_updates
            ELSE s.metadata
        END,
        updated_at = NOW()
    WHERE s.source_id = p_source_id
    RETURNING s.source_id, s.title, s.metadata, s.updated_at;
END;
$$;

COMMENT ON FUNCTION ptolemy_update_source IS 'Atomically updates source title and/or metadata fields';
