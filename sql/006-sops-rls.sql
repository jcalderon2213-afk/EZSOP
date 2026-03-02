-- Enable RLS on sops table
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;

CREATE POLICY sops_select ON sops FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY sops_insert ON sops FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY sops_update ON sops FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY sops_delete ON sops FOR DELETE
  USING (org_id = get_user_org_id());

-- Enable RLS on sop_steps table
ALTER TABLE sop_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY sop_steps_select ON sop_steps FOR SELECT
  USING (sop_id IN (SELECT id FROM sops WHERE org_id = get_user_org_id()));

CREATE POLICY sop_steps_insert ON sop_steps FOR INSERT
  WITH CHECK (sop_id IN (SELECT id FROM sops WHERE org_id = get_user_org_id()));

CREATE POLICY sop_steps_update ON sop_steps FOR UPDATE
  USING (sop_id IN (SELECT id FROM sops WHERE org_id = get_user_org_id()));

CREATE POLICY sop_steps_delete ON sop_steps FOR DELETE
  USING (sop_id IN (SELECT id FROM sops WHERE org_id = get_user_org_id()));
