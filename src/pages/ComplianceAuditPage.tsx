import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import logger from "../lib/logger";
import { useToast } from "../contexts/ToastContext";
import BuildStepper from "../components/BuildStepper";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComplianceFinding {
  finding_id: number;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  related_step: number | null;
  recommendation: string;
}

type FindingStatus = "pending" | "resolved" | "skipped";

interface FindingState extends ComplianceFinding {
  status: FindingStatus;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  high: "bg-warn-light text-warn border-warn",
  medium: "bg-[#FFF3CD] text-[#856404] border-[#D4A017]",
  low: "bg-info-light text-info border-info",
};

const severityBadge: Record<string, string> = {
  high: "bg-warn text-white",
  medium: "bg-[#D4A017] text-white",
  low: "bg-info text-white",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplianceAuditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userProfile } = useAuth();

  // SOP data
  const [sopTitle, setSopTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Compliance check
  const [findings, setFindings] = useState<FindingState[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  // Finalize
  const [finalizing, setFinalizing] = useState(false);

  // Guard against StrictMode double-mount
  const hasCheckedRef = useRef(false);

  // ── Fetch SOP + run check ─────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    async function init() {
      // Fetch SOP title
      const { data: sopData, error: sopError } = await supabase
        .from("sops")
        .select("title")
        .eq("id", id)
        .single();

      if (sopError) {
        logger.error("compliance_fetch_sop_error", { message: sopError.message });
      } else {
        setSopTitle(sopData.title);
      }

      setLoading(false);

      // Auto-run compliance check (guard prevents StrictMode double-fire)
      if (!hasCheckedRef.current) {
        hasCheckedRef.current = true;
        runComplianceCheck(sopData?.title ?? "");
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Run compliance check ──────────────────────────────────────────────────

  async function runComplianceCheck(title?: string) {
    setCheckError("");
    setChecking(true);
    logger.info("compliance_check_start", { sopId: id });

    try {
      // Fetch SOP steps
      const { data: stepsData, error: stepsError } = await supabase
        .from("sop_steps")
        .select("step_number, title, description")
        .eq("sop_id", id)
        .is("deleted_at", null)
        .order("step_number", { ascending: true });

      if (stepsError) throw stepsError;
      if (!stepsData || stepsData.length === 0) {
        setCheckError("No SOP steps found. Go back to Draft and add steps first.");
        setChecking(false);
        return;
      }

      // Fetch org profile for context
      let industryType = "";
      let state = "";
      let governingBodies: { name: string; level: string }[] = [];

      if (userProfile?.org_id) {
        const { data: orgData } = await supabase
          .from("orgs")
          .select("industry_type, state")
          .eq("id", userProfile.org_id)
          .single();

        if (orgData) {
          industryType = orgData.industry_type ?? "";
          state = orgData.state ?? "";
        }

        const { data: gbData } = await supabase
          .from("governing_bodies")
          .select("name, level")
          .eq("org_id", userProfile.org_id)
          .is("deleted_at", null);

        if (gbData) {
          governingBodies = gbData;
        }
      }

      // Call AI gateway
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "compliance-check",
            payload: {
              sop_title: title || sopTitle,
              steps: stepsData,
              industry_type: industryType,
              state,
              governing_bodies: governingBodies,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success) throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const rawFindings = fnData.data.findings as ComplianceFinding[];
      const statefulFindings: FindingState[] = rawFindings.map((f) => ({
        ...f,
        status: "pending" as FindingStatus,
      }));

      setFindings(statefulFindings);
      logger.info("compliance_check_success", { sopId: id, findingCount: rawFindings.length });
      setChecking(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("compliance_check_error", { sopId: id, message });
      setCheckError(message);
      showToast(message, "error");
      setChecking(false);
    }
  }

  // ── Finding actions ───────────────────────────────────────────────────────

  function markCompliant(findingId: number) {
    setFindings((prev) =>
      prev.map((f) =>
        f.finding_id === findingId ? { ...f, status: "resolved" } : f
      ),
    );
    logger.info("compliance_finding_resolve", { sopId: id, findingId });
  }

  function markSkipped(findingId: number) {
    setFindings((prev) =>
      prev.map((f) =>
        f.finding_id === findingId ? { ...f, status: "skipped" } : f
      ),
    );
    logger.info("compliance_finding_skip", { sopId: id, findingId });
  }

  function handleUpdateSOP() {
    navigate(`/sops/${id}/build/draft`);
  }

  // ── Finalize SOP ──────────────────────────────────────────────────────────

  async function handleFinalize() {
    setFinalizing(true);
    logger.info("sop_finalize", { sopId: id });

    try {
      const { error } = await supabase
        .from("sops")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      showToast("SOP published successfully", "success");
      navigate(`/sops/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("sop_finalize_error", { sopId: id, message });
      showToast(message, "error");
      setFinalizing(false);
    }
  }

  // ── Summary counts ────────────────────────────────────────────────────────

  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;
  const resolvedCount = findings.filter((f) => f.status === "resolved").length;
  const skippedCount = findings.filter((f) => f.status === "skipped").length;
  const totalFindings = findings.length;

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  // ── Render: Checking ──────────────────────────────────────────────────────

  if (checking) {
    return (
      <div>
        <Link
          to={`/sops/${id}/build/draft`}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          &larr; Back to Draft
        </Link>

        <h1 className="mt-4 font-display text-2xl font-600">
          {sopTitle || "Compliance Audit"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Checking your SOP against regulations and best practices.
        </p>

        <div className="mt-6 max-w-[700px]">
          <BuildStepper currentStep={3} />

          <div className="mt-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-card-border border-t-primary" />
            <p className="mt-4 text-sm font-500 text-text">
              Running compliance check...
            </p>
            <p className="mt-1 text-xs text-text-muted">
              This may take a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main ──────────────────────────────────────────────────────────

  return (
    <div>
      <Link
        to={`/sops/${id}/build/draft`}
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Draft
      </Link>

      <h1 className="mt-4 font-display text-2xl font-600">
        {sopTitle || "Compliance Audit"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Review compliance findings and resolve or skip each one.
      </p>

      <div className="mt-6 max-w-[700px]">
        <BuildStepper currentStep={3} />

        {/* Check error */}
        {checkError && (
          <div className="mb-6 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            <p>{checkError}</p>
            <button
              type="button"
              onClick={() => runComplianceCheck()}
              className="mt-2 text-sm font-500 text-primary hover:text-primary-hover"
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary bar */}
        {findings.length > 0 && (
          <div className="mb-6 rounded-sm border border-card-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-500 text-text">{totalFindings} findings:</span>
              {highCount > 0 && (
                <span className="text-warn font-500">{highCount} High</span>
              )}
              {mediumCount > 0 && (
                <span className="text-[#856404] font-500">{mediumCount} Medium</span>
              )}
              {lowCount > 0 && (
                <span className="text-info font-500">{lowCount} Low</span>
              )}
              <span className="text-text-muted">|</span>
              <span className="text-accent font-500">{resolvedCount} resolved</span>
              <span className="text-text-muted">{skippedCount} skipped</span>
            </div>
          </div>
        )}

        {/* No findings */}
        {findings.length === 0 && !checkError && (
          <div className="text-center py-10">
            <p className="text-sm text-accent font-500">No compliance issues found!</p>
            <p className="mt-1 text-xs text-text-muted">Your SOP looks good. You can finalize it below.</p>
          </div>
        )}

        {/* Findings list */}
        {findings.length > 0 && (
          <div className="space-y-3">
            {findings.map((finding) => {
              const isDimmed = finding.status === "resolved" || finding.status === "skipped";
              return (
                <div
                  key={finding.finding_id}
                  className={`rounded border p-4 shadow-sm transition-opacity ${
                    isDimmed
                      ? "opacity-50 border-card-border bg-card"
                      : `${severityColor[finding.severity]} border`
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-600 uppercase ${
                        severityBadge[finding.severity]
                      }`}
                    >
                      {finding.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-500 text-text">{finding.title}</p>
                      {finding.related_step && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          Related to Step {finding.related_step}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description + recommendation */}
                  <p className="mt-2 text-sm text-text-muted">{finding.description}</p>
                  <p className="mt-1 text-sm text-text">
                    <span className="font-500">Recommendation:</span> {finding.recommendation}
                  </p>

                  {/* Action buttons */}
                  {finding.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => markCompliant(finding.finding_id)}
                        className="rounded-sm border border-accent bg-accent-light px-3 py-1.5 text-xs font-500 text-accent transition-colors hover:bg-accent hover:text-white"
                      >
                        Compliant
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateSOP}
                        className="rounded-sm border border-primary bg-white px-3 py-1.5 text-xs font-500 text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        Update SOP
                      </button>
                      <button
                        type="button"
                        onClick={() => markSkipped(finding.finding_id)}
                        className="rounded-sm border border-card-border bg-white px-3 py-1.5 text-xs font-500 text-text-muted transition-colors hover:text-text"
                      >
                        Skip
                      </button>
                    </div>
                  )}

                  {/* Resolved/skipped label */}
                  {finding.status === "resolved" && (
                    <p className="mt-3 text-xs font-500 text-accent">Marked as compliant</p>
                  )}
                  {finding.status === "skipped" && (
                    <p className="mt-3 text-xs font-500 text-text-muted">Skipped</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Bottom actions ─────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-between">
          <Link
            to={`/sops/${id}/build/draft`}
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Back to Draft
          </Link>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={finalizing}
            className="rounded-sm bg-accent px-6 py-2.5 text-sm font-600 text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {finalizing ? "Publishing..." : "Finalize SOP"}
          </button>
        </div>
      </div>
    </div>
  );
}
