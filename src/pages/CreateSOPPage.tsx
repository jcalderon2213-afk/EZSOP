import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Recommendation {
  id: string;
  title: string;
  category: string;
  description: string;
  sort_order: number;
  status: "suggested" | "started" | "completed";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  suggested: "bg-info-light text-info",
  started: "bg-primary-light text-primary",
  completed: "bg-accent-light text-accent",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateSOPPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── Fetch recommendations ─────────────────────────────────────────────────

  async function fetchRecommendations() {
    if (!userProfile?.org_id) return;
    logger.info("recommendations_fetch_start", { orgId: userProfile.org_id });

    const { data, error: fetchError } = await supabase
      .from("sop_recommendations")
      .select("id, title, category, description, sort_order, status")
      .eq("org_id", userProfile.org_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      logger.error("recommendations_fetch_error", { message: fetchError.message });
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    logger.info("recommendations_fetch_success", { count: data.length });
    setRecommendations(data as Recommendation[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  // ── Generate recommendations ──────────────────────────────────────────────

  async function handleGenerate() {
    if (!userProfile?.org_id) return;
    setError("");
    setGenerating(true);
    logger.info("recommendations_generate_attempt", { orgId: userProfile.org_id });

    try {
      // Fetch org data + governing bodies in parallel
      const [orgResult, gbResult] = await Promise.all([
        supabase
          .from("orgs")
          .select("industry_type, state, county")
          .eq("id", userProfile.org_id)
          .single(),
        supabase
          .from("governing_bodies")
          .select("name, level")
          .eq("org_id", userProfile.org_id)
          .is("deleted_at", null),
      ]);

      if (orgResult.error) throw orgResult.error;
      if (gbResult.error) throw gbResult.error;

      const org = orgResult.data;
      const governingBodies = gbResult.data;

      // Call the edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "recommend-sops",
            payload: {
              industry_type: org.industry_type,
              state: org.state,
              county: org.county,
              governing_bodies: governingBodies,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success) throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const recs = fnData.data.recommendations as Array<{
        title: string;
        category: string;
        description: string;
        sort_order: number;
      }>;

      // Insert into sop_recommendations
      const rows = recs.map((rec) => ({
        org_id: userProfile.org_id,
        title: rec.title,
        category: rec.category,
        description: rec.description,
        sort_order: rec.sort_order,
        status: "suggested",
      }));

      const { error: insertError } = await supabase
        .from("sop_recommendations")
        .insert(rows);

      if (insertError) throw insertError;

      logger.info("recommendations_generate_success", { count: recs.length });
      showToast("Recommendations generated", "success");

      // Re-fetch to get the inserted rows with IDs
      setGenerating(false);
      setLoading(true);
      await fetchRecommendations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("recommendations_generate_error", { message });
      setError(message);
      showToast(message, "error");
      setGenerating(false);
    }
  }

  // ── Start a recommendation (create SOP from it) ──────────────────────────

  async function handleStart(rec: Recommendation) {
    if (!userProfile) return;
    setStartingId(rec.id);
    logger.info("recommendation_start_attempt", { recId: rec.id, title: rec.title });

    try {
      // Create SOP from recommendation
      const { data: sop, error: sopError } = await supabase
        .from("sops")
        .insert({
          title: rec.title,
          category: rec.category,
          purpose: rec.description,
          status: "draft",
          org_id: userProfile.org_id,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (sopError) throw sopError;

      // Update recommendation status to 'started'
      const { error: updateError } = await supabase
        .from("sop_recommendations")
        .update({ status: "started" })
        .eq("id", rec.id);

      if (updateError) throw updateError;

      logger.info("recommendation_start_success", { recId: rec.id, sopId: sop.id });
      showToast("SOP created from recommendation", "success");
      navigate(`/sops/${sop.id}/build/context`, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("recommendation_start_error", { recId: rec.id, message });
      showToast(message, "error");
      setStartingId(null);
    }
  }

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Create SOP</h1>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  // ── Render: Generating ────────────────────────────────────────────────────

  if (generating) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Create SOP</h1>
        <div className="mt-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-card-border border-t-primary" />
          <p className="mt-4 text-sm font-500 text-text">
            Generating recommendations for your business...
          </p>
          <p className="mt-1 text-xs text-text-muted">
            This may take a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: No recommendations yet ────────────────────────────────────────

  if (recommendations.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Create SOP</h1>

        {error && (
          <div className="mt-6 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}

        <div className="mt-16 text-center">
          <h2 className="font-display text-xl font-600 text-text">
            Get AI-powered SOP recommendations
          </h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-text-muted">
            Based on your industry, location, and governing bodies, we'll generate
            a tailored list of recommended Standard Operating Procedures.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-6 rounded-sm bg-primary px-6 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
          >
            Generate Recommendations
          </button>
        </div>

        <div className="mt-12 border-t border-card-border pt-6 text-center">
          <Link
            to="/sops/create/custom"
            className="text-sm font-500 text-primary transition-colors hover:text-primary-hover"
          >
            + Create Custom SOP
          </Link>
        </div>
      </div>
    );
  }

  // ── Render: Recommendations list ──────────────────────────────────────────

  return (
    <div>
      <h1 className="font-display text-2xl font-600">Create SOP</h1>
      <p className="mt-1 text-sm text-text-muted">
        Recommended SOPs for your business. Click "Start" to create one.
      </p>

      {error && (
        <div className="mt-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      <div className="mt-6 max-w-[700px] space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-center gap-4 rounded border border-card-border bg-card p-5 shadow transition-shadow hover:shadow-lg"
          >
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-500 text-text">{rec.title}</h3>
                <span className="shrink-0 rounded-xs bg-purple-light px-2 py-0.5 text-xs font-500 text-purple">
                  {rec.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-muted">{rec.description}</p>
            </div>

            {/* Status + action */}
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-xs px-2 py-0.5 text-xs font-500 ${STATUS_STYLES[rec.status] ?? STATUS_STYLES.suggested}`}
              >
                {rec.status}
              </span>
              {rec.status === "suggested" && (
                <button
                  type="button"
                  onClick={() => handleStart(rec)}
                  disabled={startingId === rec.id}
                  className="text-sm font-500 text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
                >
                  {startingId === rec.id ? "Starting..." : "Start →"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-[700px] border-t border-card-border pt-6">
        <Link
          to="/sops/create/custom"
          className="text-sm font-500 text-primary transition-colors hover:text-primary-hover"
        >
          + Create Custom SOP
        </Link>
      </div>
    </div>
  );
}
