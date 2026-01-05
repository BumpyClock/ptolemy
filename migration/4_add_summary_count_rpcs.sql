CREATE OR REPLACE FUNCTION ptolemy_count_crawled_pages_by_source(source_ids text[])
RETURNS TABLE (source_id text, count bigint)
LANGUAGE sql
STABLE
AS $$
    SELECT source_id, COUNT(*)::bigint AS count
    FROM ptolemy_crawled_pages
    WHERE source_id = ANY(source_ids)
    GROUP BY source_id;
$$;

CREATE OR REPLACE FUNCTION ptolemy_count_code_examples_by_source(source_ids text[])
RETURNS TABLE (source_id text, count bigint)
LANGUAGE sql
STABLE
AS $$
    SELECT source_id, COUNT(*)::bigint AS count
    FROM ptolemy_code_examples
    WHERE source_id = ANY(source_ids)
    GROUP BY source_id;
$$;
