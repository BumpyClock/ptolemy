-- =====================================================
-- Migration 009: Add CASCADE DELETE constraints
-- =====================================================
-- This migration adds CASCADE DELETE to foreign key constraints
-- for ptolemy_crawled_pages and ptolemy_code_examples tables
-- to fix database timeout issues when deleting large sources
--
-- Issue: Deleting sources with thousands of crawled pages times out
-- Solution: Let the database handle cascading deletes efficiently
-- =====================================================

-- Start transaction for atomic changes
BEGIN;

-- Drop existing foreign key constraints
ALTER TABLE ptolemy_crawled_pages
    DROP CONSTRAINT IF EXISTS ptolemy_crawled_pages_source_id_fkey;

ALTER TABLE ptolemy_code_examples
    DROP CONSTRAINT IF EXISTS ptolemy_code_examples_source_id_fkey;

-- Re-add foreign key constraints with CASCADE DELETE
ALTER TABLE ptolemy_crawled_pages
    ADD CONSTRAINT ptolemy_crawled_pages_source_id_fkey
    FOREIGN KEY (source_id)
    REFERENCES ptolemy_sources(source_id)
    ON DELETE CASCADE;

ALTER TABLE ptolemy_code_examples
    ADD CONSTRAINT ptolemy_code_examples_source_id_fkey
    FOREIGN KEY (source_id)
    REFERENCES ptolemy_sources(source_id)
    ON DELETE CASCADE;

-- Add comment explaining the CASCADE behavior
COMMENT ON CONSTRAINT ptolemy_crawled_pages_source_id_fkey ON ptolemy_crawled_pages IS
    'Foreign key with CASCADE DELETE - automatically deletes all crawled pages when source is deleted';

COMMENT ON CONSTRAINT ptolemy_code_examples_source_id_fkey ON ptolemy_code_examples IS
    'Foreign key with CASCADE DELETE - automatically deletes all code examples when source is deleted';

-- Record the migration
INSERT INTO ptolemy_migrations (version, migration_name)
VALUES ('0.1.0', '009_add_cascade_delete_constraints')
ON CONFLICT (version, migration_name) DO NOTHING;

-- Commit transaction
COMMIT;

-- =====================================================
-- Verification queries (run separately if needed)
-- =====================================================
-- To verify the constraints after migration:
--
-- SELECT
--     tc.table_name,
--     tc.constraint_name,
--     tc.constraint_type,
--     rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.referential_constraints rc
--     ON tc.constraint_name = rc.constraint_name
-- WHERE tc.table_name IN ('ptolemy_crawled_pages', 'ptolemy_code_examples')
--     AND tc.constraint_type = 'FOREIGN KEY';
--
-- Expected result: Both constraints should show delete_rule = 'CASCADE'
-- =====================================================