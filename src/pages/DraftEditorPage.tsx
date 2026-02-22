import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useToast } from "../contexts/ToastContext";
import BuildStepper from "../components/BuildStepper";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SOPStep {
  id: string;
  step_number: number;
  title: string;
  description: string | null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const btnPrimary =
  "rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50";

const btnSecondary =
  "rounded-sm border border-card-border bg-card px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text";

// ── Component ─────────────────────────────────────────────────────────────────

export default function DraftEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // SOP data
  const [sopTitle, setSopTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Steps
  const [steps, setSteps] = useState<SOPStep[]>([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Inline editing
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [stepSaving, setStepSaving] = useState(false);

  // Add step
  const [addingStep, setAddingStep] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Guard against StrictMode double-mount
  const hasGeneratedRef = useRef(false);

  // ── Fetch SOP + steps ─────────────────────────────────────────────────────

  async function fetchSteps() {
    const { data, error } = await supabase
      .from("sop_steps")
      .select("id, step_number, title, description")
      .eq("sop_id", id)
      .is("deleted_at", null)
      .order("step_number", { ascending: true });

    if (error) {
      logger.error("draft_fetch_steps_error", { message: error.message });
      return [];
    }

    return data as SOPStep[];
  }

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
        logger.error("draft_fetch_sop_error", { message: sopError.message });
      } else {
        setSopTitle(sopData.title);
      }

      // Fetch existing steps
      const existingSteps = await fetchSteps();
      setSteps(existingSteps);
      setStepsLoaded(true);
      setLoading(false);

      // If no steps exist, auto-generate (guard prevents StrictMode double-fire)
      if (existingSteps.length === 0 && !hasGeneratedRef.current) {
        hasGeneratedRef.current = true;
        handleGenerate();
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Generate steps via AI ─────────────────────────────────────────────────

  async function handleGenerate() {
    setGenError("");
    setGenerating(true);
    logger.info("draft_generate_start", { sopId: id });

    try {
      // Read from localStorage
      const transcript = localStorage.getItem(`sop-voice-${id}`) ?? "";
      const contextRaw = localStorage.getItem(`sop-context-${id}`);
      let contextLinks: { url: string; label: string }[] = [];
      let regulationText = "";

      if (contextRaw) {
        try {
          const parsed = JSON.parse(contextRaw);
          if (Array.isArray(parsed.links)) contextLinks = parsed.links;
          if (parsed.regulationText) regulationText = parsed.regulationText;
        } catch {
          // Ignore
        }
      }

      if (!transcript && contextLinks.length === 0 && !regulationText) {
        setGenError("No process description or context found. Go back to Capture and describe your process.");
        setGenerating(false);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "generate-sop-steps",
            payload: {
              transcript: transcript || "No transcript provided.",
              context_links: contextLinks.filter((l) => l.url.trim()),
              regulation_text: regulationText,
              sop_title: sopTitle,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success) throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const generatedSteps = fnData.data.steps as Array<{
        step_number: number;
        title: string;
        description: string;
      }>;

      // Insert into sop_steps
      const rows = generatedSteps.map((s) => ({
        sop_id: id,
        step_number: s.step_number,
        title: s.title,
        description: s.description || null,
      }));

      const { error: insertError } = await supabase.from("sop_steps").insert(rows);
      if (insertError) throw insertError;

      logger.info("draft_generate_success", { sopId: id, stepCount: generatedSteps.length });
      showToast("SOP steps generated", "success");

      // Re-fetch to get IDs
      const freshSteps = await fetchSteps();
      setSteps(freshSteps);
      setGenerating(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("draft_generate_error", { sopId: id, message });
      setGenError(message);
      showToast(message, "error");
      setGenerating(false);
    }
  }

  // ── Edit step ─────────────────────────────────────────────────────────────

  function startEditingStep(step: SOPStep) {
    setEditingStepId(step.id);
    setEditTitle(step.title);
    setEditDescription(step.description ?? "");
  }

  function cancelEditingStep() {
    setEditingStepId(null);
  }

  async function handleSaveStep(stepId: string) {
    setStepSaving(true);

    const { error } = await supabase
      .from("sop_steps")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      })
      .eq("id", stepId);

    if (error) {
      logger.error("draft_step_edit", { stepId, error: error.message });
      showToast(error.message, "error");
      setStepSaving(false);
      return;
    }

    logger.info("draft_step_edit", { stepId });
    showToast("Step updated", "success");
    setEditingStepId(null);
    setStepSaving(false);
    const freshSteps = await fetchSteps();
    setSteps(freshSteps);
  }

  // ── Delete step ───────────────────────────────────────────────────────────

  async function handleDeleteStep(stepId: string) {
    const { error } = await supabase
      .from("sop_steps")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", stepId);

    if (error) {
      logger.error("draft_step_delete", { stepId, error: error.message });
      showToast(error.message, "error");
      return;
    }

    logger.info("draft_step_delete", { stepId });
    showToast("Step deleted", "success");
    const freshSteps = await fetchSteps();
    setSteps(freshSteps);
  }

  // ── Reorder steps ─────────────────────────────────────────────────────────

  async function handleMoveStep(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const stepA = steps[index];
    const stepB = steps[swapIndex];
    if (!stepA || !stepB) return;

    const { error: errA } = await supabase
      .from("sop_steps")
      .update({ step_number: stepB.step_number })
      .eq("id", stepA.id);

    if (errA) {
      logger.error("draft_step_reorder", { error: errA.message });
      showToast(errA.message, "error");
      return;
    }

    const { error: errB } = await supabase
      .from("sop_steps")
      .update({ step_number: stepA.step_number })
      .eq("id", stepB.id);

    if (errB) {
      logger.error("draft_step_reorder", { error: errB.message });
      showToast(errB.message, "error");
      return;
    }

    logger.info("draft_step_reorder", { stepAId: stepA.id, stepBId: stepB.id, direction });
    showToast("Step reordered", "success");
    const freshSteps = await fetchSteps();
    setSteps(freshSteps);
  }

  // ── Add step ──────────────────────────────────────────────────────────────

  async function handleAddStep() {
    setAddSaving(true);
    const stepNumber = steps.length > 0 ? Math.max(...steps.map((s) => s.step_number)) + 1 : 1;

    const { error } = await supabase.from("sop_steps").insert({
      sop_id: id,
      step_number: stepNumber,
      title: addTitle.trim(),
      description: addDescription.trim() || null,
    });

    if (error) {
      logger.error("draft_step_add", { error: error.message });
      showToast(error.message, "error");
      setAddSaving(false);
      return;
    }

    logger.info("draft_step_add", { sopId: id, stepNumber });
    showToast("Step added", "success");
    setAddTitle("");
    setAddDescription("");
    setAddingStep(false);
    setAddSaving(false);
    const freshSteps = await fetchSteps();
    setSteps(freshSteps);
  }

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  // ── Render: Generating ────────────────────────────────────────────────────

  if (generating) {
    return (
      <div>
        <Link
          to={`/sops/${id}/build/voice`}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          &larr; Back to Capture
        </Link>

        <h1 className="mt-4 font-display text-2xl font-600">
          {sopTitle || "Draft Editor"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          AI is generating your SOP steps.
        </p>

        <div className="mt-6 max-w-[700px]">
          <BuildStepper currentStep={2} />

          <div className="mt-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-card-border border-t-primary" />
            <p className="mt-4 text-sm font-500 text-text">
              Generating your SOP steps...
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
        to={`/sops/${id}/build/voice`}
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Capture
      </Link>

      <h1 className="mt-4 font-display text-2xl font-600">
        {sopTitle || "Draft Editor"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Review and edit the generated SOP steps.
      </p>

      <div className="mt-6 max-w-[700px]">
        <BuildStepper currentStep={2} />

        {/* Generation error */}
        {genError && (
          <div className="mb-6 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            <p>{genError}</p>
            <button
              type="button"
              onClick={handleGenerate}
              className="mt-2 text-sm font-500 text-primary hover:text-primary-hover"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state (no steps, no error) */}
        {steps.length === 0 && !genError && stepsLoaded && (
          <div className="text-center py-10">
            <p className="text-sm text-text-muted">No steps yet.</p>
            <button
              type="button"
              onClick={handleGenerate}
              className={btnPrimary + " mt-4"}
            >
              Generate Steps
            </button>
          </div>
        )}

        {/* Steps list */}
        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className="flex gap-4 rounded border border-card-border bg-card p-4 shadow-sm"
              >
                {/* Step number badge */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-600 text-white">
                  {i + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingStepId === step.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={inputClass}
                        placeholder="Step title"
                      />
                      <textarea
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className={inputClass + " resize-y"}
                        placeholder="Step description (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEditingStep}
                          className={btnSecondary + " !px-3 !py-1.5 text-xs"}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveStep(step.id)}
                          disabled={stepSaving || !editTitle.trim()}
                          className={btnPrimary + " !px-3 !py-1.5 text-xs"}
                        >
                          {stepSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-500 text-text">{step.title}</p>
                      {step.description && (
                        <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                          {step.description}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingStepId !== step.id && (
                  <div className="flex shrink-0 items-start gap-1">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveStep(i, "up")}
                        className="rounded px-1.5 py-1 text-xs text-text-muted hover:text-text transition-colors"
                        title="Move up"
                      >
                        ↑
                      </button>
                    )}
                    {i < steps.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveStep(i, "down")}
                        className="rounded px-1.5 py-1 text-xs text-text-muted hover:text-text transition-colors"
                        title="Move down"
                      >
                        ↓
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditingStep(step)}
                      className="rounded px-1.5 py-1 text-xs text-text-muted hover:text-text transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStep(step.id)}
                      className="rounded px-1.5 py-1 text-xs text-warn hover:text-warn transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add step form */}
            {addingStep && (
              <div className="rounded border border-card-border bg-card p-4 shadow-sm">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Step title"
                  />
                  <textarea
                    rows={3}
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    className={inputClass + " resize-y"}
                    placeholder="Step description (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingStep(false);
                        setAddTitle("");
                        setAddDescription("");
                      }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      disabled={addSaving || !addTitle.trim()}
                      className={btnPrimary}
                    >
                      {addSaving ? "Saving..." : "Save Step"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add step button */}
            {!addingStep && (
              <button
                type="button"
                onClick={() => setAddingStep(true)}
                className="mt-2 rounded-sm border border-dashed border-card-border px-4 py-2.5 text-sm font-500 text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                + Add Step
              </button>
            )}
          </div>
        )}

        {/* ── Bottom actions ─────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-between">
          <Link
            to={`/sops/${id}/build/voice`}
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Back to Capture
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/sops/${id}/build/compliance`)}
            className="rounded-sm bg-primary px-6 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
          >
            Continue to Compliance →
          </button>
        </div>
      </div>
    </div>
  );
}
