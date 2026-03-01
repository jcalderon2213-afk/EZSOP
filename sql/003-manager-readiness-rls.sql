-- =============================================================================
-- 003 — Manager Readiness RLS Policies
-- Run this in Supabase SQL Editor AFTER creating the manager_readiness_items table.
-- =============================================================================

ALTER TABLE public.manager_readiness_items ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org
CREATE POLICY "manager_readiness_items_select" ON public.manager_readiness_items
  FOR SELECT USING (
    org_id = get_user_org_id()
  );

-- INSERT: members of the org
CREATE POLICY "manager_readiness_items_insert" ON public.manager_readiness_items
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
  );

-- UPDATE: members of the org
CREATE POLICY "manager_readiness_items_update" ON public.manager_readiness_items
  FOR UPDATE USING (
    org_id = get_user_org_id()
  );

-- DELETE: members of the org
CREATE POLICY "manager_readiness_items_delete" ON public.manager_readiness_items
  FOR DELETE USING (
    org_id = get_user_org_id()
  );
