CREATE INDEX IF NOT EXISTS idx_ptolemy_sources_title_trgm ON ptolemy_sources USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ptolemy_sources_summary_trgm ON ptolemy_sources USING GIN (summary gin_trgm_ops);
