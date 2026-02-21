-- =============================================================================
-- EZSOP RLS Policies
-- Run this in Supabase SQL Editor
-- =============================================================================

-- ── Helper function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ORGS
-- =============================================================================

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org, or the creator (needed during onboarding before org_id is set)
CREATE POLICY "orgs_select" ON public.orgs
  FOR SELECT USING (
    id = get_user_org_id()
    OR created_by = auth.uid()
  );

-- INSERT: any authenticated user, must set created_by to themselves
CREATE POLICY "orgs_insert" ON public.orgs
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- UPDATE: only members of the org
CREATE POLICY "orgs_update" ON public.orgs
  FOR UPDATE USING (
    id = get_user_org_id()
  );

-- DELETE: only the creator
CREATE POLICY "orgs_delete" ON public.orgs
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- =============================================================================
-- USERS
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT: own row always, plus org members
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR org_id = get_user_org_id()
  );

-- INSERT: can only create own row
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );

-- UPDATE: can only update own row
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (
    id = auth.uid()
  );

-- =============================================================================
-- GOVERNING_BODIES
-- =============================================================================

ALTER TABLE public.governing_bodies ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org
CREATE POLICY "governing_bodies_select" ON public.governing_bodies
  FOR SELECT USING (
    org_id = get_user_org_id()
  );

-- INSERT: members of the org, OR creator of the org (onboarding race condition —
-- user's org_id hasn't been set yet when governing bodies are inserted)
CREATE POLICY "governing_bodies_insert" ON public.governing_bodies
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    OR org_id IN (SELECT id FROM public.orgs WHERE created_by = auth.uid())
  );

-- UPDATE: members of the org
CREATE POLICY "governing_bodies_update" ON public.governing_bodies
  FOR UPDATE USING (
    org_id = get_user_org_id()
  );

-- DELETE: members of the org
CREATE POLICY "governing_bodies_delete" ON public.governing_bodies
  FOR DELETE USING (
    org_id = get_user_org_id()
  );
