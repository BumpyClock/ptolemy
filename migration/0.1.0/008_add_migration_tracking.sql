-- Migration: 008_add_migration_tracking.sql
-- Description: Create ptolemy_migrations table for tracking applied database migrations
-- Version: 0.1.0
-- Author: Ptolemy Team
-- Date: 2025

-- Create ptolemy_migrations table for tracking applied migrations
CREATE TABLE IF NOT EXISTS ptolemy_migrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(32),
  UNIQUE(version, migration_name)
);

-- Add index for fast lookups by version
CREATE INDEX IF NOT EXISTS idx_ptolemy_migrations_version ON ptolemy_migrations(version);

-- Add index for sorting by applied date
CREATE INDEX IF NOT EXISTS idx_ptolemy_migrations_applied_at ON ptolemy_migrations(applied_at DESC);

-- Add comment describing table purpose
COMMENT ON TABLE ptolemy_migrations IS 'Tracks database migrations that have been applied to maintain schema version consistency';
COMMENT ON COLUMN ptolemy_migrations.version IS 'Ptolemy version that introduced this migration';
COMMENT ON COLUMN ptolemy_migrations.migration_name IS 'Filename of the migration SQL file';
COMMENT ON COLUMN ptolemy_migrations.applied_at IS 'Timestamp when migration was applied';
COMMENT ON COLUMN ptolemy_migrations.checksum IS 'Optional MD5 checksum of migration file content';

-- Record this migration as applied (self-recording pattern)
-- This allows the migration system to bootstrap itself
INSERT INTO ptolemy_migrations (version, migration_name)
VALUES ('0.1.0', '008_add_migration_tracking')
ON CONFLICT (version, migration_name) DO NOTHING;

-- Retroactively record previously applied migrations (001-007)
-- Since these migrations couldn't self-record (table didn't exist yet),
-- we record them here to ensure the migration system knows they've been applied
INSERT INTO ptolemy_migrations (version, migration_name)
VALUES
  ('0.1.0', '001_add_source_url_display_name'),
  ('0.1.0', '002_add_hybrid_search_tsvector'),
  ('0.1.0', '003_ollama_add_columns'),
  ('0.1.0', '004_ollama_migrate_data'),
  ('0.1.0', '005_ollama_create_functions'),
  ('0.1.0', '006_ollama_create_indexes_optional'),
  ('0.1.0', '007_add_priority_column_to_tasks')
ON CONFLICT (version, migration_name) DO NOTHING;

-- Enable Row Level Security on migrations table
ALTER TABLE ptolemy_migrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes this idempotent)
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_migrations" ON ptolemy_migrations;
DROP POLICY IF EXISTS "Allow authenticated users to read ptolemy_migrations" ON ptolemy_migrations;

-- Create RLS policies for migrations table
-- Service role has full access
CREATE POLICY "Allow service role full access to ptolemy_migrations" ON ptolemy_migrations
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can only read migrations (they cannot modify migration history)
CREATE POLICY "Allow authenticated users to read ptolemy_migrations" ON ptolemy_migrations
    FOR SELECT TO authenticated
    USING (true);