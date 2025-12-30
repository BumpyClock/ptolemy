-- Migration: 012_rename_legacy_schema_to_ptolemy.sql
-- Description: Rename legacy schema objects to ptolemy_* and refresh dependent functions/data
-- Version: 0.1.0
-- Author: Ptolemy Team
-- Date: 2025

-- =====================================================
-- SECTION 1: OPTIONAL LEGACY BACKUP (KNOWLEDGE TABLES)
-- =====================================================
DO $$
DECLARE
    backup_suffix TEXT := to_char(now(), 'YYYYMMDD_HH24MISS');
BEGIN
    IF to_regclass('public.archon_sources') IS NOT NULL THEN
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM archon_sources', 'ptolemy_sources_backup_' || backup_suffix);
    END IF;

    IF to_regclass('public.archon_crawled_pages') IS NOT NULL THEN
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM archon_crawled_pages', 'ptolemy_crawled_pages_backup_' || backup_suffix);
    END IF;

    IF to_regclass('public.archon_code_examples') IS NOT NULL THEN
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM archon_code_examples', 'ptolemy_code_examples_backup_' || backup_suffix);
    END IF;
END;
$$;

-- =====================================================
-- SECTION 2: RENAME LEGACY OBJECTS
-- =====================================================
DO $$
DECLARE
    record_row RECORD;
BEGIN
    -- Rename tables
    FOR record_row IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE '%archon_%'
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE public.%I RENAME TO %I',
                record_row.tablename,
                replace(record_row.tablename, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;

    -- Rename sequences
    FOR record_row IN
        SELECT c.relname AS sequence_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'S'
          AND c.relname LIKE '%archon_%'
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER SEQUENCE public.%I RENAME TO %I',
                record_row.sequence_name,
                replace(record_row.sequence_name, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;

    -- Rename indexes
    FOR record_row IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname LIKE '%archon_%'
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER INDEX public.%I RENAME TO %I',
                record_row.indexname,
                replace(record_row.indexname, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;

    -- Rename constraints
    FOR record_row IN
        SELECT
            conname,
            replace(conrelid::regclass::text, 'public.', '') AS table_name
        FROM pg_constraint
        WHERE conname LIKE '%archon_%'
          AND conrelid IN (
              SELECT oid
              FROM pg_class
              WHERE relnamespace = 'public'::regnamespace
          )
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
                record_row.table_name,
                record_row.conname,
                replace(record_row.conname, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;

    -- Rename triggers
    FOR record_row IN
        SELECT
            t.tgname,
            c.relname AS table_name
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND t.tgisinternal = false
          AND t.tgname LIKE '%archon_%'
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE public.%I RENAME TRIGGER %I TO %I',
                record_row.table_name,
                record_row.tgname,
                replace(record_row.tgname, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;

    -- Rename policies
    FOR record_row IN
        SELECT
            p.polname,
            c.relname AS table_name
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND p.polname LIKE '%archon_%'
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER POLICY %I ON public.%I RENAME TO %I',
                record_row.polname,
                record_row.table_name,
                replace(record_row.polname, 'archon_', 'ptolemy_')
            );
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;
END;
$$;

-- =====================================================
-- SECTION 3: DROP LEGACY SEARCH FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS match_archon_crawled_pages_multi(vector, integer, integer, jsonb, text);
DROP FUNCTION IF EXISTS match_archon_crawled_pages(vector(1536), integer, jsonb, text);
DROP FUNCTION IF EXISTS match_archon_code_examples_multi(vector, integer, integer, jsonb, text);
DROP FUNCTION IF EXISTS match_archon_code_examples(vector(1536), integer, jsonb, text);

DROP FUNCTION IF EXISTS hybrid_search_archon_crawled_pages_multi(vector, integer, text, integer, jsonb, text);
DROP FUNCTION IF EXISTS hybrid_search_archon_crawled_pages(vector(1536), text, integer, jsonb, text);
DROP FUNCTION IF EXISTS hybrid_search_archon_code_examples_multi(vector, integer, text, integer, jsonb, text);
DROP FUNCTION IF EXISTS hybrid_search_archon_code_examples(vector(1536), text, integer, jsonb, text);

-- =====================================================
-- SECTION 4: RECREATE SEARCH FUNCTIONS WITH PTOLEMY TABLES
-- =====================================================

-- Create multi-dimensional function to search for documentation chunks
CREATE OR REPLACE FUNCTION match_ptolemy_crawled_pages_multi (
  query_embedding VECTOR,
  embedding_dimension INTEGER,
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  sql_query TEXT;
  embedding_column TEXT;
BEGIN
  -- Determine which embedding column to use based on dimension
  CASE embedding_dimension
    WHEN 384 THEN embedding_column := 'embedding_384';
    WHEN 768 THEN embedding_column := 'embedding_768';
    WHEN 1024 THEN embedding_column := 'embedding_1024';
    WHEN 1536 THEN embedding_column := 'embedding_1536';
    WHEN 3072 THEN embedding_column := 'embedding_3072';
    ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
  END CASE;

  -- Build dynamic query
  sql_query := format('
    SELECT id, url, chunk_number, content, metadata, source_id,
           1 - (%I <=> $1) AS similarity
    FROM ptolemy_crawled_pages
    WHERE (%I IS NOT NULL)
      AND metadata @> $3
      AND ($4 IS NULL OR source_id = $4)
    ORDER BY %I <=> $1
    LIMIT $2',
    embedding_column, embedding_column, embedding_column);

  -- Execute dynamic query
  RETURN QUERY EXECUTE sql_query USING query_embedding, match_count, filter, source_filter;
END;
$$;

-- Legacy compatibility function (defaults to 1536D)
CREATE OR REPLACE FUNCTION match_ptolemy_crawled_pages (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM match_ptolemy_crawled_pages_multi(query_embedding, 1536, match_count, filter, source_filter);
END;
$$;

-- Create multi-dimensional function to search for code examples
CREATE OR REPLACE FUNCTION match_ptolemy_code_examples_multi (
  query_embedding VECTOR,
  embedding_dimension INTEGER,
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  summary TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  sql_query TEXT;
  embedding_column TEXT;
BEGIN
  -- Determine which embedding column to use based on dimension
  CASE embedding_dimension
    WHEN 384 THEN embedding_column := 'embedding_384';
    WHEN 768 THEN embedding_column := 'embedding_768';
    WHEN 1024 THEN embedding_column := 'embedding_1024';
    WHEN 1536 THEN embedding_column := 'embedding_1536';
    WHEN 3072 THEN embedding_column := 'embedding_3072';
    ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
  END CASE;

  -- Build dynamic query
  sql_query := format('
    SELECT id, url, chunk_number, content, summary, metadata, source_id,
           1 - (%I <=> $1) AS similarity
    FROM ptolemy_code_examples
    WHERE (%I IS NOT NULL)
      AND metadata @> $3
      AND ($4 IS NULL OR source_id = $4)
    ORDER BY %I <=> $1
    LIMIT $2',
    embedding_column, embedding_column, embedding_column);

  -- Execute dynamic query
  RETURN QUERY EXECUTE sql_query USING query_embedding, match_count, filter, source_filter;
END;
$$;

-- Legacy compatibility function (defaults to 1536D)
CREATE OR REPLACE FUNCTION match_ptolemy_code_examples (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb,
  source_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  url VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  summary TEXT,
  metadata JSONB,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM match_ptolemy_code_examples_multi(query_embedding, 1536, match_count, filter, source_filter);
END;
$$;

-- Multi-dimensional hybrid search function for ptolemy_crawled_pages
CREATE OR REPLACE FUNCTION hybrid_search_ptolemy_crawled_pages_multi(
    query_embedding VECTOR,
    embedding_dimension INTEGER,
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    max_vector_results INT;
    max_text_results INT;
    sql_query TEXT;
    embedding_column TEXT;
BEGIN
    -- Determine which embedding column to use based on dimension
    CASE embedding_dimension
        WHEN 384 THEN embedding_column := 'embedding_384';
        WHEN 768 THEN embedding_column := 'embedding_768';
        WHEN 1024 THEN embedding_column := 'embedding_1024';
        WHEN 1536 THEN embedding_column := 'embedding_1536';
        WHEN 3072 THEN embedding_column := 'embedding_3072';
        ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
    END CASE;

    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    -- Build dynamic query with proper embedding column
    sql_query := format('
    WITH vector_results AS (
        -- Vector similarity search
        SELECT 
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            1 - (cp.%I <=> $1) AS vector_sim
        FROM ptolemy_crawled_pages cp
        WHERE cp.metadata @> $4
            AND ($5 IS NULL OR cp.source_id = $5)
            AND cp.%I IS NOT NULL
        ORDER BY cp.%I <=> $1
        LIMIT $2
    ),
    text_results AS (
        -- Full-text search with ranking
        SELECT 
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            ts_rank_cd(cp.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim
        FROM ptolemy_crawled_pages cp
        WHERE cp.metadata @> $4
            AND ($5 IS NULL OR cp.source_id = $5)
            AND cp.content_search_vector @@ plainto_tsquery(''english'', $6)
        ORDER BY text_sim DESC
        LIMIT $3
    ),
    combined_results AS (
        -- Combine results from both searches
        SELECT 
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- Use vector similarity if available, otherwise text similarity
            COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
            -- Determine match type
            CASE 
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                WHEN v.id IS NOT NULL THEN ''vector''
                ELSE ''keyword''
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT * FROM combined_results
    ORDER BY similarity DESC
    LIMIT $2',
    embedding_column, embedding_column, embedding_column);

    -- Execute dynamic query
    RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text;
END;
$$;

-- Legacy compatibility function (defaults to 1536D)
CREATE OR REPLACE FUNCTION hybrid_search_ptolemy_crawled_pages(
    query_embedding vector(1536),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT * FROM hybrid_search_ptolemy_crawled_pages_multi(query_embedding, 1536, query_text, match_count, filter, source_filter);
END;
$$;

-- Multi-dimensional hybrid search function for ptolemy_code_examples
CREATE OR REPLACE FUNCTION hybrid_search_ptolemy_code_examples_multi(
    query_embedding VECTOR,
    embedding_dimension INTEGER,
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    summary TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    max_vector_results INT;
    max_text_results INT;
    sql_query TEXT;
    embedding_column TEXT;
BEGIN
    -- Determine which embedding column to use based on dimension
    CASE embedding_dimension
        WHEN 384 THEN embedding_column := 'embedding_384';
        WHEN 768 THEN embedding_column := 'embedding_768';
        WHEN 1024 THEN embedding_column := 'embedding_1024';
        WHEN 1536 THEN embedding_column := 'embedding_1536';
        WHEN 3072 THEN embedding_column := 'embedding_3072';
        ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
    END CASE;

    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    -- Build dynamic query with proper embedding column
    sql_query := format('
    WITH vector_results AS (
        -- Vector similarity search
        SELECT 
            ce.id,
            ce.url,
            ce.chunk_number,
            ce.content,
            ce.summary,
            ce.metadata,
            ce.source_id,
            1 - (ce.%I <=> $1) AS vector_sim
        FROM ptolemy_code_examples ce
        WHERE ce.metadata @> $4
            AND ($5 IS NULL OR ce.source_id = $5)
            AND ce.%I IS NOT NULL
        ORDER BY ce.%I <=> $1
        LIMIT $2
    ),
    text_results AS (
        -- Full-text search with ranking (searches both content and summary)
        SELECT 
            ce.id,
            ce.url,
            ce.chunk_number,
            ce.content,
            ce.summary,
            ce.metadata,
            ce.source_id,
            ts_rank_cd(ce.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim
        FROM ptolemy_code_examples ce
        WHERE ce.metadata @> $4
            AND ($5 IS NULL OR ce.source_id = $5)
            AND ce.content_search_vector @@ plainto_tsquery(''english'', $6)
        ORDER BY text_sim DESC
        LIMIT $3
    ),
    combined_results AS (
        -- Combine results from both searches
        SELECT 
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.summary, t.summary) AS summary,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- Use vector similarity if available, otherwise text similarity
            COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
            -- Determine match type
            CASE 
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                WHEN v.id IS NOT NULL THEN ''vector''
                ELSE ''keyword''
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT * FROM combined_results
    ORDER BY similarity DESC
    LIMIT $2',
    embedding_column, embedding_column, embedding_column);

    -- Execute dynamic query
    RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text;
END;
$$;

-- Legacy compatibility function (defaults to 1536D)
CREATE OR REPLACE FUNCTION hybrid_search_ptolemy_code_examples(
    query_embedding vector(1536),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    summary TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT * FROM hybrid_search_ptolemy_code_examples_multi(query_embedding, 1536, query_text, match_count, filter, source_filter);
END;
$$;

-- Add comments to document the new functionality
COMMENT ON FUNCTION hybrid_search_ptolemy_crawled_pages_multi IS 'Multi-dimensional hybrid search combining vector similarity and full-text search with configurable embedding dimensions';
COMMENT ON FUNCTION hybrid_search_ptolemy_crawled_pages IS 'Legacy hybrid search function for backward compatibility (uses 1536D embeddings)';
COMMENT ON FUNCTION hybrid_search_ptolemy_code_examples_multi IS 'Multi-dimensional hybrid search on code examples with configurable embedding dimensions';
COMMENT ON FUNCTION hybrid_search_ptolemy_code_examples IS 'Legacy hybrid search function for code examples (uses 1536D embeddings)';

-- =====================================================
-- SECTION 5: REFRESH TASK ARCHIVE FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION archive_task(
    task_id_param UUID,
    archived_by_param TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
    task_exists BOOLEAN;
BEGIN
    -- Check if task exists and is not already archived
    SELECT EXISTS(
        SELECT 1 FROM ptolemy_tasks
        WHERE id = task_id_param AND archived = FALSE
    ) INTO task_exists;

    IF NOT task_exists THEN
        RETURN FALSE;
    END IF;

    -- Archive the task
    UPDATE ptolemy_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id = task_id_param;

    -- Also archive all subtasks
    UPDATE ptolemy_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE parent_task_id = task_id_param AND archived = FALSE;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 6: UPDATE STORED SETTINGS PAYLOADS
-- =====================================================
UPDATE ptolemy_settings
SET value = REPLACE(value, 'archon_compatibility', 'ptolemy_compatibility')
WHERE key = 'ollama_discovered_models'
  AND value IS NOT NULL
  AND value LIKE '%archon_compatibility%';

-- =====================================================
-- SECTION 7: RECORD MIGRATION (IF TRACKING TABLE EXISTS)
-- =====================================================
DO $$
BEGIN
    IF to_regclass('public.ptolemy_migrations') IS NOT NULL THEN
        INSERT INTO ptolemy_migrations (version, migration_name)
        VALUES ('0.1.0', '012_rename_legacy_schema_to_ptolemy')
        ON CONFLICT (version, migration_name) DO NOTHING;
    END IF;
END;
$$;

-- Final status
SELECT '✅ Legacy schema rename complete' AS status;
