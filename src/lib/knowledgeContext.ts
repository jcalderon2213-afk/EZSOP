import { supabase } from "./supabase";

/**
 * Fetch the knowledge base summary for an org.
 * Returns the summary string if the knowledge base has been built, or null.
 */
export async function fetchKnowledgeContext(
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("knowledge_base")
    .select("summary")
    .eq("org_id", orgId)
    .eq("status", "complete")
    .maybeSingle();

  return data?.summary ?? null;
}
