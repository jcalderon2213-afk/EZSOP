import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SOP {
  id: string;
  title: string;
  category: string | null;
  purpose: string | null;
  frequency: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

interface SOPStep {
  id: string;
  sop_id: string;
  step_number: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-warn-light text-warn",
  published: "bg-accent-light text-accent",
  archived: "bg-bg text-text-muted",
};

const FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Annually",
  "As Needed",
];

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const btnSecondary =
  "rounded-sm border border-card-border bg-card px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text";

const btnPrimary =
  "rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SOPDetailPage() {
  const { id } = useParams();

  // SOP state
  const [sop, setSop] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // SOP edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editFrequency, setEditFrequency] = useState("");

  // Steps state
  const [steps, setSteps] = useState<SOPStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsError, setStepsError] = useState("");

  // Add step form
  const [addingStep, setAddingStep] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit step
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepEditTitle, setStepEditTitle] = useState("");
  const [stepEditDescription, setStepEditDescription] = useState("");
  const [stepSaving, setStepSaving] = useState(false);

  // ── Fetch SOP ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchSOP() {
      logger.info("sop_detail_fetch_start", { sopId: id });

      const { data, error: fetchError } = await supabase
        .from("sops")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (fetchError) {
        logger.error("sop_detail_fetch_error", { message: fetchError.message });
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      logger.info("sop_detail_fetch_success", { sopId: id });
      setSop(data as SOP);
      setLoading(false);
    }

    fetchSOP();
  }, [id]);

  // ── Fetch Steps ──────────────────────────────────────────────────────────────

  async function fetchSteps() {
    const { data, error: fetchError } = await supabase
      .from("sop_steps")
      .select("*")
      .eq("sop_id", id)
      .is("deleted_at", null)
      .order("step_number", { ascending: true });

    if (fetchError) {
      logger.error("sop_steps_fetch_error", { message: fetchError.message });
      setStepsError(fetchError.message);
      setStepsLoading(false);
      return;
    }

    logger.info("sop_steps_fetch_success", { sopId: id, count: data.length });
    setSteps(data as SOPStep[]);
    setStepsLoading(false);
  }

  useEffect(() => {
    if (!loading && sop) fetchSteps();
  }, [loading, sop]);

  // ── SOP Edit ─────────────────────────────────────────────────────────────────

  function startEditing() {
    if (!sop) return;
    setEditTitle(sop.title);
    setEditCategory(sop.category ?? "");
    setEditPurpose(sop.purpose ?? "");
    setEditFrequency(sop.frequency ?? "");
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError("");
  }

  async function handleSave() {
    if (!sop) return;
    setSaveError("");
    setSaving(true);
    logger.info("sop_detail_update_attempt", { sopId: sop.id });

    const { data, error: updateError } = await supabase
      .from("sops")
      .update({
        title: editTitle.trim(),
        category: editCategory.trim() || null,
        purpose: editPurpose.trim() || null,
        frequency: editFrequency || null,
      })
      .eq("id", sop.id)
      .select()
      .single();

    if (updateError) {
      logger.error("sop_detail_update_error", { message: updateError.message });
      setSaveError(updateError.message);
      setSaving(false);
      return;
    }

    logger.info("sop_detail_update_success", { sopId: sop.id });
    setSop(data as SOP);
    setEditing(false);
    setSaving(false);
  }

  // ── Add Step ─────────────────────────────────────────────────────────────────

  async function handleAddStep() {
    setAddSaving(true);
    const stepNumber = steps.length + 1;

    const { error: insertError } = await supabase
      .from("sop_steps")
      .insert({
        sop_id: id,
        step_number: stepNumber,
        title: addTitle.trim(),
        description: addDescription.trim() || null,
      });

    if (insertError) {
      logger.error("sop_step_create_error", { message: insertError.message });
      setAddSaving(false);
      return;
    }

    logger.info("sop_step_create_success", { sopId: id, stepNumber });
    setAddTitle("");
    setAddDescription("");
    setAddingStep(false);
    setAddSaving(false);
    await fetchSteps();
  }

  // ── Edit Step ────────────────────────────────────────────────────────────────

  function startEditingStep(step: SOPStep) {
    setEditingStepId(step.id);
    setStepEditTitle(step.title);
    setStepEditDescription(step.description ?? "");
  }

  function cancelEditingStep() {
    setEditingStepId(null);
  }

  async function handleSaveStep(stepId: string) {
    setStepSaving(true);

    const { error: updateError } = await supabase
      .from("sop_steps")
      .update({
        title: stepEditTitle.trim(),
        description: stepEditDescription.trim() || null,
      })
      .eq("id", stepId);

    if (updateError) {
      logger.error("sop_step_update_error", { message: updateError.message });
      setStepSaving(false);
      return;
    }

    logger.info("sop_step_update_success", { stepId });
    setEditingStepId(null);
    setStepSaving(false);
    await fetchSteps();
  }

  // ── Delete Step ──────────────────────────────────────────────────────────────

  async function handleDeleteStep(stepId: string) {
    const { error: deleteError } = await supabase
      .from("sop_steps")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", stepId);

    if (deleteError) {
      logger.error("sop_step_delete_error", { message: deleteError.message });
      return;
    }

    logger.info("sop_step_delete_success", { stepId });
    await fetchSteps();
  }

  // ── Reorder Steps ────────────────────────────────────────────────────────────

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
      logger.error("sop_step_reorder_error", { message: errA.message });
      return;
    }

    const { error: errB } = await supabase
      .from("sop_steps")
      .update({ step_number: stepA.step_number })
      .eq("id", stepB.id);

    if (errB) {
      logger.error("sop_step_reorder_error", { message: errB.message });
      return;
    }

    logger.info("sop_step_reorder_success", {
      stepAId: stepA.id,
      stepBId: stepB.id,
      direction,
    });
    await fetchSteps();
  }

  // ── Render: Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>;
  }

  if (error || !sop) {
    return (
      <div className="mt-10 text-center">
        <h2 className="font-display text-xl font-600 text-text">SOP not found</h2>
        <p className="mt-2 text-sm text-text-muted">
          {error || "This SOP doesn't exist or has been deleted."}
        </p>
        <Link
          to="/sops"
          className="mt-4 inline-block text-sm font-500 text-primary hover:text-primary-hover transition-colors"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  // ── Render: Main ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back link */}
      <Link
        to="/sops"
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Library
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={inputClass + " max-w-[400px] font-display text-xl font-600"}
            />
          ) : (
            <h1 className="font-display text-2xl font-600">{sop.title}</h1>
          )}
          <span
            className={`shrink-0 rounded-xs px-2 py-0.5 text-xs font-500 ${STATUS_STYLES[sop.status] ?? STATUS_STYLES.draft}`}
          >
            {sop.status}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <button type="button" onClick={cancelEditing} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className={btnPrimary}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button type="button" onClick={startEditing} className={btnSecondary}>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
          {saveError}
        </div>
      )}

      {/* Detail card */}
      <div className="mt-6 max-w-[700px] rounded border border-card-border bg-card p-6 shadow">
        <dl className="space-y-5">
          {/* Category */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Category</dt>
            {editing ? (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className={inputClass + " mt-1"}
                placeholder="e.g. Health & Safety"
              />
            ) : (
              <dd className="mt-1 text-sm text-text">
                {sop.category ?? "Uncategorized"}
              </dd>
            )}
          </div>

          {/* Purpose */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Purpose</dt>
            {editing ? (
              <textarea
                rows={4}
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
                className={inputClass + " mt-1 resize-y"}
                placeholder="Describe the purpose of this SOP..."
              />
            ) : (
              <dd className="mt-1 text-sm text-text whitespace-pre-wrap">
                {sop.purpose ?? "No purpose set"}
              </dd>
            )}
          </div>

          {/* Frequency */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Frequency</dt>
            {editing ? (
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                className={inputClass + " mt-1"}
              >
                <option value="">Not set</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <dd className="mt-1 text-sm text-text">
                {sop.frequency ?? "Not set"}
              </dd>
            )}
          </div>

          {/* Dates */}
          <div className="flex gap-8 border-t border-card-border pt-5">
            <div>
              <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Created</dt>
              <dd className="mt-1 text-sm text-text">{formatDate(sop.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Last updated</dt>
              <dd className="mt-1 text-sm text-text">{formatDate(sop.updated_at)}</dd>
            </div>
          </div>
        </dl>
      </div>

      {/* ── Steps Section ───────────────────────────────────────────────────── */}
      <div className="mt-10 max-w-[700px]">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-600">Steps</h2>
          {!stepsLoading && (
            <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-500 text-text-muted">
              {steps.length}
            </span>
          )}
        </div>

        {/* Steps error */}
        {stepsError && (
          <div className="mt-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {stepsError}
          </div>
        )}

        {/* Steps loading */}
        {stepsLoading && (
          <p className="mt-4 text-sm text-text-muted">Loading steps...</p>
        )}

        {/* Steps list */}
        {!stepsLoading && (
          <div className="mt-4 space-y-3">
            {steps.length === 0 && !addingStep && (
              <p className="text-sm text-text-muted">No steps yet. Add your first step below.</p>
            )}

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
                        value={stepEditTitle}
                        onChange={(e) => setStepEditTitle(e.target.value)}
                        className={inputClass}
                        placeholder="Step title"
                      />
                      <textarea
                        rows={3}
                        value={stepEditDescription}
                        onChange={(e) => setStepEditDescription(e.target.value)}
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
                          disabled={stepSaving || !stepEditTitle.trim()}
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
      </div>
    </div>
  );
}
