import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateSOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  sopId: string;
  sopTitle: string;
}

interface GeneratedStep {
  step_number: number;
  title: string;
  description: string;
}

interface ComplianceFinding {
  finding_id: number;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  related_step: number | null;
  recommendation: string;
}

interface ModalState {
  currentStep: number;
  buildMode: "guided" | "talk" | null;
  regulatorySources: string[];
  transcript: string;
  guidedConversation: unknown[];
  coveredTopics: string[];
  generatedSteps: GeneratedStep[];
  suggestedSteps: unknown[];
  complianceScore: number | null;
  complianceFindings: ComplianceFinding[];
}

type ModalAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUILD_MODE"; mode: ModalState["buildMode"] }
  | { type: "SET_TRANSCRIPT"; transcript: string }
  | { type: "APPEND_TRANSCRIPT"; chunk: string }
  | { type: "SET_GENERATED_STEPS"; steps: GeneratedStep[] }
  | { type: "UPDATE_STEP"; index: number; title: string; description: string }
  | { type: "DELETE_STEP"; index: number }
  | { type: "REORDER_STEP"; index: number; direction: "up" | "down" }
  | { type: "ADD_STEP"; title: string; description: string }
  | { type: "SET_COMPLIANCE_SCORE"; score: number }
  | { type: "SET_COMPLIANCE_FINDINGS"; findings: ComplianceFinding[] }
  | { type: "SET_FIELD"; field: keyof ModalState; value: unknown }
  | { type: "RESET" };

// ── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Build Mode",
  "Regulatory Context",
  "Capture",
  "Review Draft",
  "Compliance",
] as const;

const STEP_SUBTITLES = [
  "Choose how you'd like to build this SOP.",
  "Select the regulatory frameworks that apply.",
  "Describe your process — speak or type.",
  "Review and refine the generated draft.",
  "Check compliance and finalize.",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

// ── Reducer ──────────────────────────────────────────────────────────────────

const initialState: ModalState = {
  currentStep: 1,
  buildMode: "guided",
  regulatorySources: [],
  transcript: "",
  guidedConversation: [],
  coveredTopics: [],
  generatedSteps: [],
  suggestedSteps: [],
  complianceScore: null,
  complianceFindings: [],
};

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_BUILD_MODE":
      return { ...state, buildMode: action.mode };
    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.transcript };
    case "APPEND_TRANSCRIPT": {
      const prev = state.transcript;
      const separator = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
      return { ...state, transcript: prev + separator + action.chunk };
    }
    case "SET_GENERATED_STEPS":
      return { ...state, generatedSteps: action.steps };
    case "UPDATE_STEP": {
      const updated = state.generatedSteps.map((s, i) =>
        i === action.index
          ? { ...s, title: action.title, description: action.description }
          : s,
      );
      return { ...state, generatedSteps: updated };
    }
    case "DELETE_STEP": {
      const filtered = state.generatedSteps
        .filter((_, i) => i !== action.index)
        .map((s, i) => ({ ...s, step_number: i + 1 }));
      return { ...state, generatedSteps: filtered };
    }
    case "REORDER_STEP": {
      const arr = [...state.generatedSteps];
      const swapIndex = action.direction === "up" ? action.index - 1 : action.index + 1;
      if (swapIndex < 0 || swapIndex >= arr.length) return state;
      [arr[action.index], arr[swapIndex]] = [arr[swapIndex], arr[action.index]];
      const renumbered = arr.map((s, i) => ({ ...s, step_number: i + 1 }));
      return { ...state, generatedSteps: renumbered };
    }
    case "ADD_STEP": {
      const nextNum = state.generatedSteps.length + 1;
      return {
        ...state,
        generatedSteps: [
          ...state.generatedSteps,
          { step_number: nextNum, title: action.title, description: action.description },
        ],
      };
    }
    case "SET_COMPLIANCE_SCORE":
      return { ...state, complianceScore: action.score };
    case "SET_COMPLIANCE_FINDINGS":
      return { ...state, complianceFindings: action.findings };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

function computeScore(findings: ComplianceFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "high") score -= 15;
    else if (f.severity === "medium") score -= 8;
    else if (f.severity === "low") score -= 3;
  }
  return Math.max(0, score);
}

export default function CreateSOPModal({
  isOpen,
  onClose,
  sopTitle,
}: CreateSOPModalProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [state, dispatch] = useReducer(reducer, initialState);
  const { currentStep } = state;
  const stepIndex = currentStep - 1;

  const handleTranscriptChunk = useCallback((chunk: string) => {
    dispatch({ type: "APPEND_TRANSCRIPT", chunk });
  }, []);

  const { isRecording, duration, toggleRecording, isSupported, formatDuration } =
    useSpeechRecognition(handleTranscriptChunk);

  // ── Step 4: Draft generation state ──────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const hasGeneratedRef = useRef(false);

  // ── Step 5: Compliance state ───────────────────────────────────────────
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [resolvedFindings, setResolvedFindings] = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const hasCheckedComplianceRef = useRef(false);

  // Auto-generate when entering Step 4
  useEffect(() => {
    if (
      currentStep === 4 &&
      state.generatedSteps.length === 0 &&
      !hasGeneratedRef.current &&
      !generating
    ) {
      hasGeneratedRef.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Auto-run compliance check when entering Step 5
  useEffect(() => {
    if (currentStep !== 5 || hasCheckedComplianceRef.current) return;
    hasCheckedComplianceRef.current = true;
    runComplianceCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  async function runComplianceCheck() {
    setComplianceError("");
    setComplianceLoading(true);

    try {
      // Fetch org context in parallel
      const orgId = userProfile?.org_id;
      if (!orgId) throw new Error("No organization found");

      const [orgResult, gbResult] = await Promise.all([
        supabase
          .from("orgs")
          .select("industry_type, state")
          .eq("id", orgId)
          .single(),
        supabase
          .from("governing_bodies")
          .select("name, level")
          .eq("org_id", orgId)
          .is("deleted_at", null),
      ]);

      if (orgResult.error) throw orgResult.error;
      if (gbResult.error) throw gbResult.error;

      const org = orgResult.data;
      const governingBodies = gbResult.data;

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "compliance-check",
            payload: {
              sop_title: sopTitle,
              steps: state.generatedSteps.map((s) => ({
                step_number: s.step_number,
                title: s.title,
                description: s.description,
              })),
              industry_type: org.industry_type,
              state: org.state,
              governing_bodies: governingBodies,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success)
        throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const findings = fnData.data.findings as ComplianceFinding[];
      dispatch({ type: "SET_COMPLIANCE_FINDINGS", findings });
      dispatch({ type: "SET_COMPLIANCE_SCORE", score: computeScore(findings) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setComplianceError(message);
    } finally {
      setComplianceLoading(false);
    }
  }

  async function handleGenerate() {
    setGenError("");
    setGenerating(true);

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "generate-sop-steps",
            payload: {
              transcript: state.transcript || "No transcript provided.",
              context_links: [],
              regulation_text: "",
              sop_title: sopTitle,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success)
        throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const steps = fnData.data.steps as GeneratedStep[];
      dispatch({ type: "SET_GENERATED_STEPS", steps });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setGenError(message);
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  function goNext() {
    if (currentStep < TOTAL_STEPS) {
      dispatch({ type: "SET_STEP", step: currentStep + 1 });
    }
  }

  function goBack() {
    if (currentStep > 1) {
      dispatch({ type: "SET_STEP", step: currentStep - 1 });
    }
  }

  function handleDotClick(step: number) {
    if (step <= currentStep) {
      dispatch({ type: "SET_STEP", step });
    }
  }

  async function handleFinalize() {
    if (!userProfile) return;
    setFinalizing(true);

    try {
      // 1. Create SOP row
      const { data: sop, error: sopError } = await supabase
        .from("sops")
        .insert({
          title: sopTitle,
          status: "published",
          org_id: userProfile.org_id,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (sopError) throw sopError;

      // 2. Insert all steps
      const stepRows = state.generatedSteps.map((s) => ({
        sop_id: sop.id,
        step_number: s.step_number,
        title: s.title,
        description: s.description,
      }));

      if (stepRows.length > 0) {
        const { error: stepsError } = await supabase
          .from("sop_steps")
          .insert(stepRows);

        if (stepsError) throw stepsError;
      }

      // 3. Success
      showToast("SOP finalized!", "success");
      onClose();
      navigate(`/sops/${sop.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(message, "error");
    } finally {
      setFinalizing(false);
    }
  }

  function toggleFinding(findingId: number) {
    setResolvedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  }

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[700px] flex-col rounded bg-card shadow-lg mx-4">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 rounded-t bg-card border-b border-card-border px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-500 text-text-muted tracking-wide uppercase">
                Step {currentStep} of {TOTAL_STEPS}
              </p>
              <h2 className="mt-1 font-display text-lg font-600 text-text">
                {sopTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-card-border hover:text-text"
              aria-label="Close modal"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="3" y1="3" x2="13" y2="13" />
                <line x1="13" y1="3" x2="3" y2="13" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-card-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              }}
            />
          </div>

          {/* Dot indicators */}
          <div className="mt-3 flex items-center justify-center gap-3">
            {STEP_LABELS.map((label, i) => {
              const step = i + 1;
              const isActive = step === currentStep;
              const isCompleted = step < currentStep;
              const isClickable = step <= currentStep;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleDotClick(step)}
                  disabled={!isClickable}
                  className={`group flex flex-col items-center gap-1 ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  }`}
                  aria-label={`${label} — step ${step}`}
                >
                  <span
                    className={`block h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                      isActive
                        ? "border-primary bg-primary"
                        : isCompleted
                          ? "border-accent bg-accent"
                          : "border-card-border bg-card"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-500 leading-none transition-colors ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                          ? "text-accent"
                          : "text-text-light"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        {/* ── Body (scrollable) ───────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <h3 className="font-display text-xl font-600 text-text">
            {STEP_LABELS[stepIndex]}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {STEP_SUBTITLES[stepIndex]}
          </p>

          {/* ── Step content ─────────────────────────────────────── */}
          {currentStep === 1 ? (
            <div className="mt-6 space-y-4">
              {/* Helper callout */}
              <div className="flex gap-3 rounded-sm border border-primary/20 bg-primary-light px-4 py-3">
                <span className="text-lg leading-none" aria-hidden="true">💡</span>
                <p className="text-sm text-text-muted">
                  The build mode determines how we'll capture your process. You can always switch modes later.
                </p>
              </div>

              {/* Guided card */}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_BUILD_MODE", mode: "guided" })}
                className={`flex w-full items-start gap-4 rounded-sm border px-5 py-4 text-left transition-colors ${
                  state.buildMode === "guided"
                    ? "border-primary bg-primary-light"
                    : "border-card-border bg-card hover:border-primary hover:bg-primary-light"
                }`}
              >
                {/* Radio dot */}
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  {state.buildMode === "guided" && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-600 text-text">Guided</span>
                    <span className="rounded-xs bg-accent-light px-2 py-0.5 text-[11px] font-600 text-accent">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    We'll ask smart questions one at a time to uncover every step of your process — with suggestions to make it easy.
                  </p>
                </div>
              </button>

              {/* Talk It Out card */}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_BUILD_MODE", mode: "talk" })}
                className={`flex w-full items-start gap-4 rounded-sm border px-5 py-4 text-left transition-colors ${
                  state.buildMode === "talk"
                    ? "border-primary bg-primary-light"
                    : "border-card-border bg-card hover:border-primary hover:bg-primary-light"
                }`}
              >
                {/* Radio dot */}
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  {state.buildMode === "talk" && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                <div>
                  <span className="text-sm font-600 text-text">Talk It Out</span>
                  <p className="mt-1 text-sm text-text-muted">
                    Explain your process naturally — record yourself or type it out. We'll organize it into steps.
                  </p>
                </div>
              </button>
            </div>
          ) : currentStep === 3 && state.buildMode === "talk" ? (
            /* ── Step 3: Talk It Out ─────────────────────────────── */
            <div className="mt-6 space-y-6">
              {/* Mode badge */}
              <div className="flex justify-center">
                <span className="rounded-full bg-purple-light px-3 py-1 text-[11px] font-600 uppercase tracking-wide text-purple">
                  Talk It Out Mode
                </span>
              </div>

              {/* Mic record area */}
              <div className="flex flex-col items-center gap-3">
                {isSupported ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 text-2xl transition-colors ${
                        isRecording
                          ? "border-warn bg-warn pulse-record"
                          : "border-warn bg-warn-light hover:bg-warn/10"
                      }`}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      🎙️
                    </button>
                    <p className="text-sm font-500 text-text-muted">
                      {isRecording
                        ? `Stop Recording (${formatDuration(duration)})`
                        : "Start Recording"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    Voice input not supported in this browser. Type your process below.
                  </p>
                )}
              </div>

              {/* Textarea + Clear */}
              <div>
                <textarea
                  value={state.transcript}
                  onChange={(e) =>
                    dispatch({ type: "SET_TRANSCRIPT", transcript: e.target.value })
                  }
                  rows={6}
                  className="w-full min-h-[120px] resize-y rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Type your process here… or use the record button above."
                />
                {state.transcript && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "SET_TRANSCRIPT", transcript: "" })
                      }
                      className="text-sm text-text-muted transition-colors hover:text-warn"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt hints */}
              <div className="rounded-sm border-l-[3px] border-primary bg-primary-light px-4 py-3">
                <p className="text-xs font-600 uppercase tracking-wide text-primary">
                  Try starting with…
                </p>
                <ul className="mt-2 space-y-1 text-sm italic text-text-muted">
                  <li>"First thing I do is…"</li>
                  <li>"If they don't have their documents…"</li>
                  <li>"Before they can start working I need to…"</li>
                  <li>"The background check process is…"</li>
                </ul>
              </div>
            </div>
          ) : currentStep === 3 && state.buildMode === "guided" ? (
            /* ── Step 3: Guided placeholder ──────────────────────── */
            <div className="mt-6 rounded-sm border border-dashed border-card-border p-8 text-center">
              <p className="text-sm text-text-light">
                Guided mode coming soon.
              </p>
            </div>
          ) : currentStep === 4 ? (
            /* ── Step 4: Review Draft ────────────────────────────── */
            <div className="mt-6">
              {generating ? (
                /* Loading spinner */
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-card-border border-t-primary" />
                  <p className="mt-4 text-sm font-500 text-text">
                    Generating SOP steps...
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    This may take a few seconds.
                  </p>
                </div>
              ) : genError ? (
                /* Error state */
                <div className="rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
                  <p>{genError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasGeneratedRef.current = false;
                      handleGenerate();
                    }}
                    className="mt-2 text-sm font-500 text-primary hover:text-primary-hover"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                /* Steps list */
                <div className="space-y-3">
                  {state.generatedSteps.map((step, i) => (
                    <div
                      key={step.step_number}
                      className="flex gap-4 rounded border border-card-border bg-card p-4 shadow-sm"
                    >
                      {/* Step number badge */}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-600 text-white">
                        {i + 1}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        {editingIndex === i ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Step title"
                            />
                            <textarea
                              rows={3}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="w-full resize-y rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Step description"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="rounded-sm border border-card-border bg-card px-3 py-1.5 text-xs font-500 text-text-muted transition-colors hover:text-text"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!editTitle.trim()}
                                onClick={() => {
                                  dispatch({
                                    type: "UPDATE_STEP",
                                    index: i,
                                    title: editTitle.trim(),
                                    description: editDescription.trim(),
                                  });
                                  setEditingIndex(null);
                                }}
                                className="rounded-sm bg-primary px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-500 text-text">
                              {step.title}
                            </p>
                            {step.description && (
                              <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                                {step.description}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      {editingIndex !== i && (
                        <div className="flex shrink-0 items-start gap-1">
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({ type: "REORDER_STEP", index: i, direction: "up" })
                              }
                              className="rounded px-1.5 py-1 text-xs text-text-muted transition-colors hover:text-text"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          {i < state.generatedSteps.length - 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({ type: "REORDER_STEP", index: i, direction: "down" })
                              }
                              className="rounded px-1.5 py-1 text-xs text-text-muted transition-colors hover:text-text"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(i);
                              setEditTitle(step.title);
                              setEditDescription(step.description);
                            }}
                            className="rounded px-1.5 py-1 text-xs text-text-muted transition-colors hover:text-text"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "DELETE_STEP", index: i })}
                            className="rounded px-1.5 py-1 text-xs text-warn transition-colors hover:text-warn"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add step form */}
                  {addingStep ? (
                    <div className="rounded border border-card-border bg-card p-4 shadow-sm">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          className="w-full rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="Step title"
                        />
                        <textarea
                          rows={3}
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          className="w-full resize-y rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="Step description"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingStep(false);
                              setAddTitle("");
                              setAddDescription("");
                            }}
                            className="rounded-sm border border-card-border bg-card px-3 py-1.5 text-xs font-500 text-text-muted transition-colors hover:text-text"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!addTitle.trim()}
                            onClick={() => {
                              dispatch({
                                type: "ADD_STEP",
                                title: addTitle.trim(),
                                description: addDescription.trim(),
                              });
                              setAddTitle("");
                              setAddDescription("");
                              setAddingStep(false);
                            }}
                            className="rounded-sm bg-primary px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                          >
                            Save Step
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingStep(true)}
                      className="w-full rounded-sm border border-dashed border-card-border px-4 py-2.5 text-sm font-500 text-text-muted transition-colors hover:border-primary hover:text-primary"
                    >
                      + Add Step
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : currentStep === 5 ? (
            /* ── Step 5: Compliance Audit + Finalize ──────────────── */
            <div className="mt-6">
              {complianceLoading ? (
                /* Loading spinner */
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-card-border border-t-primary" />
                  <p className="mt-4 text-sm font-500 text-text">
                    Running compliance audit...
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    This may take a few seconds.
                  </p>
                </div>
              ) : complianceError ? (
                /* Error state */
                <div className="rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
                  <p>{complianceError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasCheckedComplianceRef.current = false;
                      runComplianceCheck();
                    }}
                    className="mt-2 text-sm font-500 text-primary hover:text-primary-hover"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                /* Results */
                <div className="space-y-6">
                  {/* ── Score Ring ─────────────────────────────────── */}
                  {state.complianceScore !== null && (
                    <div className="flex items-center gap-5">
                      <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
                        {/* Background track */}
                        <circle
                          cx="34"
                          cy="34"
                          r="31"
                          fill="none"
                          stroke="var(--color-card-border)"
                          strokeWidth="6"
                        />
                        {/* Filled arc */}
                        <circle
                          cx="34"
                          cy="34"
                          r="31"
                          fill="none"
                          stroke="var(--color-primary)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 31}`}
                          strokeDashoffset={`${2 * Math.PI * 31 * (1 - state.complianceScore / 100)}`}
                          transform="rotate(-90 34 34)"
                        />
                        {/* Score text */}
                        <text
                          x="34"
                          y="34"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-display font-700"
                          fill="var(--color-text)"
                          fontSize="18"
                        >
                          {state.complianceScore}
                        </text>
                      </svg>
                      <div>
                        <p className="text-sm font-600 text-text">
                          Compliance Score: {state.complianceScore} / 100
                        </p>
                        <p className="mt-0.5 text-sm text-text-muted">
                          {state.complianceScore >= 90
                            ? "Looking good!"
                            : state.complianceScore >= 70
                              ? `Needs attention — ${state.complianceFindings.length} finding${state.complianceFindings.length === 1 ? "" : "s"}`
                              : `Needs revision — ${state.complianceFindings.length} finding${state.complianceFindings.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Findings cards ────────────────────────────── */}
                  {state.complianceFindings.length > 0 && (
                    <div className="space-y-3">
                      {state.complianceFindings.map((f) => {
                        const isResolved = resolvedFindings.has(f.finding_id);
                        return (
                          <div
                            key={f.finding_id}
                            className={`rounded border border-card-border bg-card p-4 shadow-sm transition-opacity ${
                              isResolved ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Severity badge */}
                              <span
                                className={`mt-0.5 shrink-0 rounded-xs px-2 py-0.5 text-[11px] font-600 uppercase ${
                                  f.severity === "high"
                                    ? "bg-warn-light text-warn"
                                    : f.severity === "medium"
                                      ? "bg-orange-100 text-orange-600"
                                      : "bg-info-light text-info"
                                }`}
                              >
                                {f.severity}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-500 text-text">{f.title}</p>
                                <p className="mt-1 text-sm text-text-muted">{f.description}</p>
                                {f.recommendation && (
                                  <p className="mt-1 text-xs text-text-light italic">
                                    {f.recommendation}
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Actions */}
                            {!isResolved && (
                              <div className="mt-3 flex gap-2 pl-8">
                                <button
                                  type="button"
                                  onClick={() => toggleFinding(f.finding_id)}
                                  className="rounded-sm bg-accent px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-accent-hover"
                                >
                                  &#10003; Compliant
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
                                  className="rounded-sm border border-card-border bg-card px-3 py-1.5 text-xs font-500 text-text-muted transition-colors hover:text-text"
                                >
                                  Update SOP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFinding(f.finding_id)}
                                  className="rounded-sm px-3 py-1.5 text-xs font-500 text-text-light transition-colors hover:text-text-muted"
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Confirmation checkbox row ─────────────────── */}
                  <button
                    type="button"
                    onClick={() => setConfirmed((c) => !c)}
                    className="flex w-full items-center gap-3 rounded-sm bg-accent-light px-4 py-3 text-left transition-colors hover:bg-accent-light/80"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        confirmed
                          ? "border-accent bg-accent text-white"
                          : "border-card-border bg-card"
                      }`}
                    >
                      {confirmed && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-text">
                      I confirm this SOP reflects my current facility process and I have reviewed all compliance findings.
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Placeholder for step 2 */
            <div className="mt-6 rounded-sm border border-dashed border-card-border p-8 text-center">
              <p className="text-sm text-text-light">
                Step {currentStep} content will go here.
              </p>
            </div>
          )}
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between border-t border-card-border px-6 py-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-sm border border-card-border bg-card px-5 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={currentStep === 1 && !state.buildMode}
              className={`rounded-sm bg-primary px-6 py-2 text-sm font-600 text-white transition-colors ${
                currentStep === 1 && !state.buildMode
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-primary-hover"
              }`}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={!confirmed || finalizing}
              className={`rounded-sm bg-accent px-6 py-2 text-sm font-600 text-white transition-colors ${
                !confirmed || finalizing
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-accent-hover"
              }`}
            >
              {finalizing ? "Finalizing..." : "Finalize"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
