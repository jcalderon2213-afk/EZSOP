-- Norma's Notes: persistent transcript log for SOP creation flows
-- Each row captures a voice/guided/talk-it-out transcript and optionally
-- links to a knowledge_item so the AI gateway can use it as context.

CREATE TABLE norma_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  source_type       text NOT NULL CHECK (source_type IN ('talk-it-out','guided-mode','voice-source')),
  source_label      text NOT NULL,
  transcript        text NOT NULL CHECK (char_length(transcript) <= 5000),
  knowledge_item_id uuid REFERENCES knowledge_items(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS (same org-member pattern as knowledge_items)
ALTER TABLE norma_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY norma_notes_select ON norma_notes FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY norma_notes_insert ON norma_notes FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY norma_notes_update ON norma_notes FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY norma_notes_delete ON norma_notes FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
