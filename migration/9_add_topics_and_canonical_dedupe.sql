-- Migration: Add Topics + Canonical URL Dedupe
-- Purpose: Enable topic-based grouping of sources and canonical URL deduplication
--
-- Schema changes:
--   1. ptolemy_topics - Topic definitions for grouping sources
--   2. ptolemy_topic_sources - Join table for source-to-topic mapping (v1: one topic per source)
--   3. ptolemy_page_sources - Join table for page-to-source provenance tracking
--   4. ptolemy_page_metadata.canonical_url - Canonical URL for page deduplication
--   5. ptolemy_crawled_pages.canonical_url - Canonical URL for chunk deduplication
--   6. Updated unique constraint on chunks: (page_id, chunk_number) instead of (url, chunk_number)

-- =====================================================
-- SECTION 1: TOPICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ptolemy_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    related_topic_ids UUID[] DEFAULT '{}',  -- Soft relationships for UX only
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Unique name constraint (user-scoped uniqueness can be added later)
    CONSTRAINT ptolemy_topics_name_unique UNIQUE(name)
);

-- Indexes for topics
CREATE INDEX IF NOT EXISTS idx_ptolemy_topics_name ON ptolemy_topics(name);
CREATE INDEX IF NOT EXISTS idx_ptolemy_topics_created_at ON ptolemy_topics(created_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_ptolemy_topics_updated_at
    BEFORE UPDATE ON ptolemy_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ptolemy_topics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow service role full access to ptolemy_topics" ON ptolemy_topics
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Allow authenticated users to access ptolemy_topics" ON ptolemy_topics
    FOR ALL TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE ptolemy_topics IS 'Topic definitions for grouping related sources';
COMMENT ON COLUMN ptolemy_topics.id IS 'Unique identifier for the topic';
COMMENT ON COLUMN ptolemy_topics.name IS 'Human-readable name for the topic';
COMMENT ON COLUMN ptolemy_topics.description IS 'Optional description of the topic';
COMMENT ON COLUMN ptolemy_topics.related_topic_ids IS 'Array of related topic IDs for discovery/navigation (soft relationships only)';

-- =====================================================
-- SECTION 2: TOPIC-SOURCE JOIN TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ptolemy_topic_sources (
    topic_id UUID NOT NULL REFERENCES ptolemy_topics(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES ptolemy_sources(source_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    PRIMARY KEY (topic_id, source_id),
    -- v1: Enforce single-topic per source. To evolve to many-to-many, drop this constraint.
    CONSTRAINT ptolemy_topic_sources_source_unique UNIQUE(source_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ptolemy_topic_sources_topic_id ON ptolemy_topic_sources(topic_id);
CREATE INDEX IF NOT EXISTS idx_ptolemy_topic_sources_source_id ON ptolemy_topic_sources(source_id);

-- Enable RLS
ALTER TABLE ptolemy_topic_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow service role full access to ptolemy_topic_sources" ON ptolemy_topic_sources
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Allow authenticated users to access ptolemy_topic_sources" ON ptolemy_topic_sources
    FOR ALL TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE ptolemy_topic_sources IS 'Join table mapping sources to topics (v1: one topic per source)';
COMMENT ON COLUMN ptolemy_topic_sources.topic_id IS 'Foreign key to ptolemy_topics.id';
COMMENT ON COLUMN ptolemy_topic_sources.source_id IS 'Foreign key to ptolemy_sources.source_id';

-- =====================================================
-- SECTION 3: PAGE-SOURCE PROVENANCE JOIN TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ptolemy_page_sources (
    page_id UUID NOT NULL REFERENCES ptolemy_page_metadata(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES ptolemy_sources(source_id) ON DELETE CASCADE,
    first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    PRIMARY KEY (page_id, source_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ptolemy_page_sources_page_id ON ptolemy_page_sources(page_id);
CREATE INDEX IF NOT EXISTS idx_ptolemy_page_sources_source_id ON ptolemy_page_sources(source_id);

-- Enable RLS
ALTER TABLE ptolemy_page_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow service role full access to ptolemy_page_sources" ON ptolemy_page_sources
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Allow authenticated users to access ptolemy_page_sources" ON ptolemy_page_sources
    FOR ALL TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE ptolemy_page_sources IS 'Tracks which sources reference each canonical page (provenance)';
COMMENT ON COLUMN ptolemy_page_sources.page_id IS 'Foreign key to ptolemy_page_metadata.id';
COMMENT ON COLUMN ptolemy_page_sources.source_id IS 'Foreign key to ptolemy_sources.source_id';
COMMENT ON COLUMN ptolemy_page_sources.first_seen_at IS 'When this source first referenced this page';
COMMENT ON COLUMN ptolemy_page_sources.last_seen_at IS 'When this source last referenced this page (updated on re-crawl)';

-- =====================================================
-- SECTION 4: ADD CANONICAL_URL TO ptolemy_page_metadata
-- =====================================================

-- Add canonical_url column (nullable initially for backfill)
ALTER TABLE ptolemy_page_metadata
ADD COLUMN IF NOT EXISTS canonical_url TEXT;

-- Create unique index on canonical_url (partial - only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptolemy_page_metadata_canonical_url_unique
    ON ptolemy_page_metadata(canonical_url)
    WHERE canonical_url IS NOT NULL;

-- Regular index for lookups
CREATE INDEX IF NOT EXISTS idx_ptolemy_page_metadata_canonical_url
    ON ptolemy_page_metadata(canonical_url);

-- Comment
COMMENT ON COLUMN ptolemy_page_metadata.canonical_url IS 'Normalized URL for deduplication (preserves fragments for llms-full sections)';

-- =====================================================
-- SECTION 5: ADD CANONICAL_URL TO ptolemy_crawled_pages
-- =====================================================

-- Add canonical_url column
ALTER TABLE ptolemy_crawled_pages
ADD COLUMN IF NOT EXISTS canonical_url TEXT;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_ptolemy_crawled_pages_canonical_url
    ON ptolemy_crawled_pages(canonical_url);

-- Comment
COMMENT ON COLUMN ptolemy_crawled_pages.canonical_url IS 'Normalized URL matching the parent page canonical_url';

-- =====================================================
-- SECTION 6: UPDATE CHUNK UNIQUENESS CONSTRAINT
-- =====================================================

-- Drop the old url-based unique constraint on ptolemy_crawled_pages
-- Note: This constraint was created in complete_setup.sql line 229
ALTER TABLE ptolemy_crawled_pages
DROP CONSTRAINT IF EXISTS ptolemy_crawled_pages_url_chunk_number_key;

-- Create new unique constraint based on page_id + chunk_number
-- This enables proper chunk-level dedupe by canonical page
-- Note: page_id can be NULL for legacy chunks, so we use a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptolemy_crawled_pages_page_chunk_unique
    ON ptolemy_crawled_pages(page_id, chunk_number)
    WHERE page_id IS NOT NULL;

-- Keep a fallback constraint for chunks without page_id (legacy data)
-- This ensures we don't create duplicate chunks during the transition period
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptolemy_crawled_pages_url_chunk_fallback
    ON ptolemy_crawled_pages(url, chunk_number)
    WHERE page_id IS NULL;

-- Comment
COMMENT ON INDEX idx_ptolemy_crawled_pages_page_chunk_unique IS 'Primary uniqueness: (page_id, chunk_number) for canonical dedupe';
COMMENT ON INDEX idx_ptolemy_crawled_pages_url_chunk_fallback IS 'Fallback uniqueness for legacy chunks without page_id';

-- =====================================================
-- SECTION 7: HELPER FUNCTIONS
-- =====================================================

-- Function to get sources for a topic
CREATE OR REPLACE FUNCTION ptolemy_get_topic_sources(p_topic_id UUID)
RETURNS TABLE(source_id TEXT, source_url TEXT, source_display_name TEXT)
LANGUAGE sql
STABLE
AS $$
    SELECT s.source_id, s.source_url, s.source_display_name
    FROM ptolemy_sources s
    JOIN ptolemy_topic_sources ts ON ts.source_id = s.source_id
    WHERE ts.topic_id = p_topic_id
    ORDER BY s.source_display_name;
$$;

-- Function to get deduped pages for a topic
CREATE OR REPLACE FUNCTION ptolemy_get_topic_pages(p_topic_id UUID)
RETURNS TABLE(
    page_id UUID,
    canonical_url TEXT,
    url TEXT,
    section_title TEXT,
    word_count INT,
    chunk_count INT,
    source_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT ON (pm.id)
        pm.id as page_id,
        pm.canonical_url,
        pm.url,
        pm.section_title,
        pm.word_count,
        pm.chunk_count,
        (SELECT COUNT(DISTINCT ps2.source_id) FROM ptolemy_page_sources ps2 WHERE ps2.page_id = pm.id) as source_count
    FROM ptolemy_page_metadata pm
    JOIN ptolemy_page_sources ps ON ps.page_id = pm.id
    JOIN ptolemy_topic_sources ts ON ts.source_id = ps.source_id
    WHERE ts.topic_id = p_topic_id
    ORDER BY pm.id, pm.updated_at DESC;
$$;

-- Function to move a source to a different topic
CREATE OR REPLACE FUNCTION ptolemy_move_source_to_topic(p_source_id TEXT, p_new_topic_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    -- Delete existing topic mapping (if any)
    DELETE FROM ptolemy_topic_sources WHERE source_id = p_source_id;

    -- Insert new topic mapping
    INSERT INTO ptolemy_topic_sources (topic_id, source_id)
    VALUES (p_new_topic_id, p_source_id);

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Comments
COMMENT ON FUNCTION ptolemy_get_topic_sources IS 'Returns all sources belonging to a topic';
COMMENT ON FUNCTION ptolemy_get_topic_pages IS 'Returns deduplicated pages for a topic with source count';
COMMENT ON FUNCTION ptolemy_move_source_to_topic IS 'Moves a source from its current topic to a new topic';
