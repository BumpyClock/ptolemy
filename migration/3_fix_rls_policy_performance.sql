-- Migration: Fix RLS Policy Performance Issues
-- Date: 2025-12-31
-- Description: Updates service_role policies to use TO clause instead of USING (auth.role() = 'service_role')
--              This fixes two Supabase linter warnings:
--              1. auth_rls_initplan - per-row re-evaluation of auth.role()
--              2. multiple_permissive_policies - overlapping permissive policies

-- =====================================================
-- ptolemy_settings
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access" ON ptolemy_settings;
CREATE POLICY "Allow service role full access" ON ptolemy_settings
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_migrations
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_migrations" ON ptolemy_migrations;
CREATE POLICY "Allow service role full access to ptolemy_migrations" ON ptolemy_migrations
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_projects
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_projects" ON ptolemy_projects;
CREATE POLICY "Allow service role full access to ptolemy_projects" ON ptolemy_projects
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_tasks
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_tasks" ON ptolemy_tasks;
CREATE POLICY "Allow service role full access to ptolemy_tasks" ON ptolemy_tasks
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_project_sources
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_project_sources" ON ptolemy_project_sources;
CREATE POLICY "Allow service role full access to ptolemy_project_sources" ON ptolemy_project_sources
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_document_versions
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_document_versions" ON ptolemy_document_versions;
CREATE POLICY "Allow service role full access to ptolemy_document_versions" ON ptolemy_document_versions
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- ptolemy_prompts
-- =====================================================
DROP POLICY IF EXISTS "Allow service role full access to ptolemy_prompts" ON ptolemy_prompts;
CREATE POLICY "Allow service role full access to ptolemy_prompts" ON ptolemy_prompts
    FOR ALL TO service_role
    USING (true);
