-- Migration: Add full-text search for source inference
-- Purpose: Move _infer_source_id scoring from Python to database for better performance
-- Uses PostgreSQL tsvector with weighted ranking

-- Add tsvector column for full-text search
ALTER TABLE ptolemy_sources
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_ptolemy_sources_search_vector
ON ptolemy_sources USING GIN (search_vector);

-- Function to build the search vector with weights
-- A (highest): title
-- B: tags from metadata
-- C: source_id
-- D (lowest): summary
CREATE OR REPLACE FUNCTION ptolemy_sources_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    tags_text TEXT;
BEGIN
    -- Extract tags from metadata JSONB
    tags_text := COALESCE(
        (SELECT string_agg(elem::text, ' ')
         FROM jsonb_array_elements_text(COALESCE(NEW.metadata->'tags', '[]'::jsonb)) AS elem),
        ''
    );

    -- Build weighted tsvector
    -- Weight A (0.9): title
    -- Weight B (0.6): tags
    -- Weight C (0.4): source_id
    -- Weight D (0.1): summary
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', tags_text), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.source_id, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');

    RETURN NEW;
END;
$$;

-- Create trigger to auto-update search_vector
DROP TRIGGER IF EXISTS ptolemy_sources_search_vector_trigger ON ptolemy_sources;
CREATE TRIGGER ptolemy_sources_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, summary, metadata, source_id
    ON ptolemy_sources
    FOR EACH ROW
    EXECUTE FUNCTION ptolemy_sources_search_vector_update();

-- Backfill existing rows
UPDATE ptolemy_sources
SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english',
        COALESCE((SELECT string_agg(elem::text, ' ')
                  FROM jsonb_array_elements_text(COALESCE(metadata->'tags', '[]'::jsonb)) AS elem), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(source_id, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'D');

-- Function to infer source_id from a query using full-text search
-- Returns the best matching source_id or NULL if no good match
CREATE OR REPLACE FUNCTION ptolemy_infer_source_id(p_query TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_query tsquery;
    v_result RECORD;
    v_second_score FLOAT;
BEGIN
    -- Convert query to tsquery (simple tokenization)
    -- Use plainto_tsquery for simple word matching (similar to original Python logic)
    v_query := plainto_tsquery('english', p_query);

    -- If query is empty, return NULL
    IF v_query IS NULL OR v_query::text = '' THEN
        RETURN NULL;
    END IF;

    -- Get top 2 matches with their scores
    -- ts_rank with weights matching the original Python scoring:
    -- {D, C, B, A} = {0.1, 0.3, 0.3, 0.4} (normalized from 1, 3, 3, 4)
    FOR v_result IN
        SELECT
            source_id,
            ts_rank('{0.1, 0.3, 0.3, 0.4}', search_vector, v_query) AS score
        FROM ptolemy_sources
        WHERE search_vector @@ v_query
        ORDER BY score DESC
        LIMIT 2
    LOOP
        -- First iteration: check if top score meets minimum threshold
        -- ts_rank returns values typically 0-1, so we use 0.1 as threshold
        -- (equivalent to original score of 4 out of max ~12)
        IF v_result.score < 0.05 THEN
            RETURN NULL;
        END IF;

        -- Store for comparison
        IF v_second_score IS NULL THEN
            v_second_score := 0;
        END IF;

        -- Check if top score is at least 1.5x the second score
        IF v_second_score > 0 AND v_result.score < v_second_score * 1.5 THEN
            RETURN NULL;
        END IF;

        -- Return the first (best) match
        RETURN v_result.source_id;
    END LOOP;

    -- No matches found
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION ptolemy_infer_source_id IS 'Infer the best matching source_id for a query using full-text search with weighted ranking';

-- Alternative function that returns score along with source_id for debugging
CREATE OR REPLACE FUNCTION ptolemy_infer_source_id_with_scores(p_query TEXT)
RETURNS TABLE (
    source_id TEXT,
    score FLOAT,
    is_selected BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_query tsquery;
    v_top_score FLOAT := 0;
    v_second_score FLOAT := 0;
    v_selected_id TEXT := NULL;
BEGIN
    v_query := plainto_tsquery('english', p_query);

    IF v_query IS NULL OR v_query::text = '' THEN
        RETURN;
    END IF;

    -- Get all matching sources with scores
    RETURN QUERY
    WITH ranked AS (
        SELECT
            s.source_id,
            ts_rank('{0.1, 0.3, 0.3, 0.4}', s.search_vector, v_query) AS score,
            ROW_NUMBER() OVER (ORDER BY ts_rank('{0.1, 0.3, 0.3, 0.4}', s.search_vector, v_query) DESC) AS rn
        FROM ptolemy_sources s
        WHERE s.search_vector @@ v_query
    ),
    top_two AS (
        SELECT * FROM ranked WHERE rn <= 2
    ),
    selection AS (
        SELECT
            CASE
                WHEN (SELECT score FROM top_two WHERE rn = 1) >= 0.05
                     AND ((SELECT score FROM top_two WHERE rn = 2) IS NULL
                          OR (SELECT score FROM top_two WHERE rn = 1) >= (SELECT score FROM top_two WHERE rn = 2) * 1.5)
                THEN (SELECT source_id FROM top_two WHERE rn = 1)
                ELSE NULL
            END AS selected_id
    )
    SELECT
        r.source_id,
        r.score,
        r.source_id = (SELECT selected_id FROM selection) AS is_selected
    FROM ranked r
    ORDER BY r.score DESC
    LIMIT 10;
END;
$$;

COMMENT ON FUNCTION ptolemy_infer_source_id_with_scores IS 'Debug version that shows all scores and selection logic';
