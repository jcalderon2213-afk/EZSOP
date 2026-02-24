-- =============================================================================
-- 002 — Knowledge Base Redesign Migration
-- Run this in Supabase SQL Editor BEFORE deploying the frontend changes.
-- =============================================================================

-- ── 1. Add `level` column to knowledge_items ────────────────────────────────

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS level TEXT
    DEFAULT 'internal'
    CHECK (level IN ('federal', 'state', 'county', 'local', 'internal'));

-- Backfill any existing rows that got NULL (shouldn't happen with DEFAULT, but safe)
UPDATE public.knowledge_items
  SET level = 'internal'
  WHERE level IS NULL;

-- ── 2. Add `provided_transcript` column for voice entries ───────────────────

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS provided_transcript TEXT;

-- ── 3. RLS for knowledge_items ──────────────────────────────────────────────

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org
CREATE POLICY "knowledge_items_select" ON public.knowledge_items
  FOR SELECT USING (
    org_id = get_user_org_id()
  );

-- INSERT: members of the org, OR creator of the org (onboarding — user's
-- org_id may not be set yet when the checklist is first generated)
CREATE POLICY "knowledge_items_insert" ON public.knowledge_items
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    OR org_id IN (SELECT id FROM public.orgs WHERE created_by = auth.uid())
  );

-- UPDATE: members of the org
CREATE POLICY "knowledge_items_update" ON public.knowledge_items
  FOR UPDATE USING (
    org_id = get_user_org_id()
  );

-- DELETE: members of the org
CREATE POLICY "knowledge_items_delete" ON public.knowledge_items
  FOR DELETE USING (
    org_id = get_user_org_id()
  );

-- ── 4. RLS for knowledge_base ───────────────────────────────────────────────

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org
CREATE POLICY "knowledge_base_select" ON public.knowledge_base
  FOR SELECT USING (
    org_id = get_user_org_id()
  );

-- INSERT: members of the org, OR creator of the org
CREATE POLICY "knowledge_base_insert" ON public.knowledge_base
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    OR org_id IN (SELECT id FROM public.orgs WHERE created_by = auth.uid())
  );

-- UPDATE: members of the org
CREATE POLICY "knowledge_base_update" ON public.knowledge_base
  FOR UPDATE USING (
    org_id = get_user_org_id()
  );

-- ── 5. RLS for knowledge_interviews ─────────────────────────────────────────
-- (Also missing — adding for completeness)

ALTER TABLE public.knowledge_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_interviews_select" ON public.knowledge_interviews
  FOR SELECT USING (
    org_id = get_user_org_id()
  );

CREATE POLICY "knowledge_interviews_insert" ON public.knowledge_interviews
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    OR org_id IN (SELECT id FROM public.orgs WHERE created_by = auth.uid())
  );

CREATE POLICY "knowledge_interviews_update" ON public.knowledge_interviews
  FOR UPDATE USING (
    org_id = get_user_org_id()
  );
