// Shared types for the Knowledge Base feature

export interface BusinessProfile {
  industry_subtype: string | null;
  services: string[];
  client_types: string[];
  staff_count_range: string;
  licensing_bodies: string[];
  certifications_held: string[];
  years_in_operation: number | null;
  special_considerations: string[];
  has_existing_sops: boolean;
  pain_points: string[];
}

export interface KnowledgeItem {
  id: string;
  org_id: string;
  title: string;
  description: string;
  type: "LINK" | "PDF" | "DOCUMENT" | "VOICE" | "OTHER";
  priority: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  level: "federal" | "state" | "county" | "local" | "internal";
  suggested_source: string | null;
  status: "pending" | "provided" | "learned" | "skipped";
  provided_url: string | null;
  provided_file: string | null;
  provided_text: string | null;
  provided_transcript: string | null;
  sort_order: number | null;
}

export interface KnowledgeBase {
  id: string;
  org_id: string;
  summary: string;
  learned_topics: string[];
  source_count: number;
  status: string;
  built_at: string;
}
