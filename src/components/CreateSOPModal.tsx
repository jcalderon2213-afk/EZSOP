import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { useAuth } from "../contexts/AuthContext";
import { useCreateSOP } from "../contexts/CreateSOPContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import { fetchKnowledgeContext } from "../lib/knowledgeContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateSOPModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Recommendation {
  id: string;
  title: string;
  category: string;
  description: string;
  sort_order: number;
  status: "suggested" | "started" | "completed";
}

interface StepResource {
  type: "url" | "form" | "doc";
  label: string;
  url: string;
}

interface GeneratedStep {
  step_number: number;
  title: string;
  description: string;
  resources?: StepResource[];
}

interface ComplianceFinding {
  finding_id: number;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  related_step: number | null;
  recommendation: string;
}

interface GuidedQuestion {
  id: number;
  question: string;
  answers: string[];
}

interface GuidedAnswer {
  questionId: number;
  question: string;
  answer: string;
}

interface ModalState {
  currentStep: number;
  // Step 1: Choose SOP
  sopTitle: string;
  sopCategory: string;
  sopDescription: string;
  recommendations: Recommendation[];
  recommendationsLoading: boolean;
  // Step 2+: existing fields
  buildMode: "guided" | "talk" | null;
  transcript: string;
  generatedSteps: GeneratedStep[];
  complianceScore: number | null;
  complianceFindings: ComplianceFinding[];
  // Guided mode
  guidedQuestions: GuidedQuestion[];
  guidedAnswers: GuidedAnswer[];
  guidedCurrentIndex: number;
  guidedLoading: boolean;
  guidedError: string | null;
  guidedOtherText: string;
  guidedShowOther: boolean;
}

type ModalAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_SOP_INFO"; title: string; category: string; description: string }
  | { type: "SET_RECOMMENDATIONS"; recommendations: Recommendation[] }
  | { type: "SET_RECOMMENDATIONS_LOADING"; loading: boolean }
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
  | { type: "SET_GUIDED_QUESTIONS"; questions: GuidedQuestion[] }
  | { type: "SET_GUIDED_ANSWER"; questionId: number; question: string; answer: string }
  | { type: "SET_GUIDED_LOADING" }
  | { type: "SET_GUIDED_ERROR"; error: string }
  | { type: "SET_GUIDED_OTHER_TEXT"; text: string }
  | { type: "TOGGLE_GUIDED_OTHER" }
  | { type: "RESET" };

// ── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Pick a Procedure",
  "Build Mode",
  "Describe It",
  "Review Steps",
  "Compliance",
] as const;

const STEP_SUBTITLES = [
  "Pick a recommended SOP or create your own.",
  "How do you want to build it?",
  "Describe how you do it — speak or type.",
  "Review and refine the generated steps.",
  "Check compliance and finalize.",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

const CATEGORY_OPTIONS = [
  "Operations",
  "HR & Training",
  "Safety & Compliance",
  "Client Care",
  "Administrative",
  "Other",
];

const CATEGORY_EMOJI: Record<string, string> = {
  "Operations": "⚙️",
  "HR & Training": "👥",
  "Safety & Compliance": "🛡️",
  "Client Care": "💝",
  "Administrative": "📋",
  "Other": "📌",
};

// ── Reducer ──────────────────────────────────────────────────────────────────

const initialState: ModalState = {
  currentStep: 1,
  sopTitle: "",
  sopCategory: "",
  sopDescription: "",
  recommendations: [],
  recommendationsLoading: false,
  buildMode: "guided",
  transcript: "",
  generatedSteps: [],
  complianceScore: null,
  complianceFindings: [],
  guidedQuestions: [],
  guidedAnswers: [],
  guidedCurrentIndex: 0,
  guidedLoading: false,
  guidedError: null,
  guidedOtherText: "",
  guidedShowOther: false,
};

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_SOP_INFO":
      return {
        ...state,
        sopTitle: action.title,
        sopCategory: action.category,
        sopDescription: action.description,
      };
    case "SET_RECOMMENDATIONS":
      return { ...state, recommendations: action.recommendations };
    case "SET_RECOMMENDATIONS_LOADING":
      return { ...state, recommendationsLoading: action.loading };
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
    case "SET_GUIDED_QUESTIONS":
      return { ...state, guidedQuestions: action.questions, guidedLoading: false, guidedError: null };
    case "SET_GUIDED_ANSWER":
      return {
        ...state,
        guidedAnswers: [...state.guidedAnswers, { questionId: action.questionId, question: action.question, answer: action.answer }],
        guidedCurrentIndex: state.guidedCurrentIndex + 1,
        guidedShowOther: false,
        guidedOtherText: "",
      };
    case "SET_GUIDED_LOADING":
      return { ...state, guidedLoading: true, guidedError: null };
    case "SET_GUIDED_ERROR":
      return { ...state, guidedError: action.error, guidedLoading: false };
    case "SET_GUIDED_OTHER_TEXT":
      return { ...state, guidedOtherText: action.text };
    case "TOGGLE_GUIDED_OTHER":
      return { ...state, guidedShowOther: !state.guidedShowOther, guidedOtherText: "" };
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
}: CreateSOPModalProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { consumePrefill } = useCreateSOP();
  const { showToast } = useToast();

  const [state, dispatch] = useReducer(reducer, initialState);
  const { currentStep } = state;
  const stepIndex = currentStep - 1;

  // ── Consume prefill data when modal opens ───────────────────────────
  const hasPrefillRef = useRef(false);
  const readinessItemIdRef = useRef<string | null>(null);
  const isDayInLifeRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasPrefillRef.current = false;
      isDayInLifeRef.current = false;
      return;
    }
    if (hasPrefillRef.current) return;
    hasPrefillRef.current = true;

    const prefill = consumePrefill();
    if (prefill?.title) {
      dispatch({ type: "RESET" });
      dispatch({
        type: "SET_SOP_INFO",
        title: prefill.title,
        category: prefill.isDayInLife ? "Operations" : "",
        description: "",
      });
      // Skip Step 1 (Pick a Procedure) — go straight to Step 2 (Build Mode)
      dispatch({ type: "SET_STEP", step: 2 });
    }
    // Store readiness item ID for linking after finalization
    readinessItemIdRef.current = prefill?.readinessItemId ?? null;
    isDayInLifeRef.current = prefill?.isDayInLife ?? false;
  }, [isOpen, consumePrefill]);

  const handleTranscriptChunk = useCallback((chunk: string) => {
    dispatch({ type: "APPEND_TRANSCRIPT", chunk });
  }, []);

  const { isRecording, duration, toggleRecording, isSupported, formatDuration } =
    useSpeechRecognition(handleTranscriptChunk);

  // ── Step 1: Recommendations state ─────────────────────────────────────
  const [recsError, setRecsError] = useState("");
  const hasLoadedRecsRef = useRef(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState(CATEGORY_OPTIONS[0]);
  const [customDescription, setCustomDescription] = useState("");

  // ── Step 4: Draft generation state ────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const hasGeneratedRef = useRef(false);

  // ── Step 5: Compliance state ──────────────────────────────────────────
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [resolvedFindings, setResolvedFindings] = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const hasCheckedComplianceRef = useRef(false);

  // ── Step 3 Guided: load questions ───────────────────────────────────────
  const hasLoadedGuidedRef = useRef(false);

  useEffect(() => {
    if (
      currentStep === 3 &&
      state.buildMode === "guided" &&
      state.guidedQuestions.length === 0 &&
      !state.guidedLoading &&
      !hasLoadedGuidedRef.current
    ) {
      hasLoadedGuidedRef.current = true;
      loadGuidedQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  async function loadGuidedQuestions() {
    dispatch({ type: "SET_GUIDED_LOADING" });

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "generate-guided-questions",
            payload: {
              sop_title: state.sopTitle,
              sop_category: state.sopCategory,
              org_id: userProfile?.org_id,
              is_day_in_life: isDayInLifeRef.current,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success)
        throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const questions = fnData.data.questions as GuidedQuestion[];
      dispatch({ type: "SET_GUIDED_QUESTIONS", questions });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "SET_GUIDED_ERROR", error: message });
    }
  }

  // ── Load/generate recommendations when entering Step 1 ────────────────
  useEffect(() => {
    if (currentStep !== 1 || hasLoadedRecsRef.current || !isOpen) return;
    if (state.recommendations.length > 0) return;
    hasLoadedRecsRef.current = true;
    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isOpen]);

  async function loadRecommendations() {
    const orgId = userProfile?.org_id;
    if (!orgId) return;

    setRecsError("");
    dispatch({ type: "SET_RECOMMENDATIONS_LOADING", loading: true });

    try {
      // Check for existing recommendations
      const { data, error: fetchError } = await supabase
        .from("sop_recommendations")
        .select("id, title, category, description, sort_order, status")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        dispatch({ type: "SET_RECOMMENDATIONS", recommendations: data as Recommendation[] });
        dispatch({ type: "SET_RECOMMENDATIONS_LOADING", loading: false });
        return;
      }

      // No existing recs — generate via AI
      const [orgResult, gbResult, knowledgeContext] = await Promise.all([
        supabase
          .from("orgs")
          .select("industry_type, state, county")
          .eq("id", orgId)
          .single(),
        supabase
          .from("governing_bodies")
          .select("name, level")
          .eq("org_id", orgId)
          .is("deleted_at", null),
        fetchKnowledgeContext(orgId),
      ]);

      if (orgResult.error) throw orgResult.error;
      if (gbResult.error) throw gbResult.error;

      const org = orgResult.data;
      const governingBodies = gbResult.data;

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "recommend-sops",
            payload: {
              org_id: orgId,
              industry_type: org.industry_type,
              state: org.state,
              county: org.county,
              governing_bodies: governingBodies,
              knowledge_context: knowledgeContext,
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
        org_id: orgId,
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

      // Re-fetch to get the inserted rows with IDs
      const { data: inserted, error: refetchError } = await supabase
        .from("sop_recommendations")
        .select("id, title, category, description, sort_order, status")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (refetchError) throw refetchError;

      dispatch({ type: "SET_RECOMMENDATIONS", recommendations: inserted as Recommendation[] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setRecsError(message);
    } finally {
      dispatch({ type: "SET_RECOMMENDATIONS_LOADING", loading: false });
    }
  }

  // Auto-generate when entering Step 4 (Review Steps)
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

      const knowledgeContext = await fetchKnowledgeContext(orgId);

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "compliance-check",
            payload: {
              org_id: orgId,
              sop_title: state.sopTitle,
              steps: state.generatedSteps.map((s) => ({
                step_number: s.step_number,
                title: s.title,
                description: s.description,
              })),
              industry_type: org.industry_type,
              state: org.state,
              governing_bodies: governingBodies,
              knowledge_context: knowledgeContext,
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
      const knowledgeContext = userProfile?.org_id
        ? await fetchKnowledgeContext(userProfile.org_id)
        : null;

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "generate-sop-steps",
            payload: {
              org_id: userProfile?.org_id,
              transcript: state.transcript || "No transcript provided.",
              context_links: [],
              regulation_text: "",
              sop_title: state.sopTitle,
              sop_category: state.sopCategory,
              knowledge_context: knowledgeContext,
              is_day_in_life: isDayInLifeRef.current,
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

  function handleSelectRecommendation(rec: Recommendation) {
    dispatch({
      type: "SET_SOP_INFO",
      title: rec.title,
      category: rec.category,
      description: rec.description,
    });
    goNext();
  }

  function handleCustomContinue() {
    if (!customTitle.trim()) return;
    dispatch({
      type: "SET_SOP_INFO",
      title: customTitle.trim(),
      category: customCategory,
      description: customDescription.trim(),
    });
    goNext();
  }

  async function handleFinalize() {
    if (!userProfile) return;
    setFinalizing(true);

    try {
      // 1. Create SOP row
      const { data: sop, error: sopError } = await supabase
        .from("sops")
        .insert({
          title: state.sopTitle,
          category: state.sopCategory,
          status: "published",
          org_id: userProfile.org_id,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (sopError) throw sopError;

      // 2. Insert all steps (map resources → links jsonb column)
      const stepRows = state.generatedSteps.map((s) => ({
        sop_id: sop.id,
        step_number: s.step_number,
        title: s.title,
        description: s.description,
        links: s.resources && s.resources.length > 0 ? s.resources : null,
      }));

      if (stepRows.length > 0) {
        const { error: stepsError } = await supabase
          .from("sop_steps")
          .insert(stepRows);

        if (stepsError) throw stepsError;
      }

      // 3. Link to readiness item if applicable
      if (readinessItemIdRef.current) {
        await supabase
          .from("manager_readiness_items")
          .update({ linked_sop_id: sop.id, updated_at: new Date().toISOString() })
          .eq("id", readinessItemIdRef.current);
        readinessItemIdRef.current = null;
      }

      // 4. Success
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

  const guidedComplete =
    state.buildMode === "guided" &&
    state.guidedQuestions.length > 0 &&
    state.guidedCurrentIndex >= state.guidedQuestions.length;

  const continueDisabled =
    (currentStep === 1 && !state.sopTitle) ||
    (currentStep === 2 && !state.buildMode) ||
    (currentStep === 3 && state.buildMode === "guided" && !guidedComplete);

  // Button label for step 3 (Capture) — "Build My SOP" instead of "Continue"
  const continueLabel = currentStep === 3 ? "Build My SOP" : "Continue";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[650px] flex-col rounded-[16px] bg-card shadow-lg mx-4">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 rounded-t-[16px] bg-card border-b border-[#e0e0e0] px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-700 text-text-muted tracking-wide uppercase">
                Step {currentStep} of {TOTAL_STEPS}
              </p>
              <h2 className="mt-1 text-[22px] font-900 text-text">
                {state.sopTitle || "New SOP"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-[#f0f0f0] hover:text-text"
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
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#e0e0e0] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              }}
            />
          </div>

          {/* Dot indicators */}
          <div className="mt-3 flex items-center justify-center gap-4">
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
                    className={`block h-3 w-3 rounded-full border-2 transition-colors ${
                      isActive
                        ? "border-primary bg-primary"
                        : isCompleted
                          ? "border-accent bg-accent"
                          : "border-[#e0e0e0] bg-card"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-700 leading-none transition-colors ${
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
          <h3 className="text-[22px] font-800 text-text">
            {STEP_LABELS[stepIndex]}
          </h3>
          <p className="mt-1 text-[15px] text-text-muted">
            {STEP_SUBTITLES[stepIndex]}
          </p>

          {/* ── Step content ─────────────────────────────────────── */}
          {currentStep === 1 ? (
            /* ── Step 1: Pick a Procedure ─────────────────────────── */
            <div className="mt-6">
              {state.recommendationsLoading ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#e0e0e0] border-t-primary" />
                  <p className="mt-4 text-[15px] font-600 text-text">
                    Generating recommendations for your business...
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    This may take a few seconds.
                  </p>
                </div>
              ) : recsError ? (
                <div className="rounded-[10px] border-2 border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[14px] text-warn">
                  <p>{recsError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasLoadedRecsRef.current = false;
                      loadRecommendations();
                    }}
                    className="mt-2 text-[14px] font-700 text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Recommendations list */}
                  {state.recommendations.length > 0 && (
                    <div className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                      {state.recommendations.map((rec) => (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => handleSelectRecommendation(rec)}
                          className="flex w-full items-start gap-4 rounded-[12px] border-2 border-[#e0e0e0] bg-white p-5 text-left transition-all hover:border-primary hover:bg-primary-light"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[15px] font-700 text-text">
                                {CATEGORY_EMOJI[rec.category] ?? "📌"} {rec.title}
                              </h4>
                              <span className="shrink-0 rounded-full bg-purple-light px-2.5 py-0.5 text-[11px] font-700 text-purple">
                                {rec.category}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] text-text-muted line-clamp-2">
                              {rec.description}
                            </p>
                          </div>
                          <span className="mt-1 shrink-0 text-[14px] font-700 text-primary">
                            Select &rarr;
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-[#e0e0e0]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-4 text-[13px] font-600 text-text-muted">
                        Or write your own
                      </span>
                    </div>
                  </div>

                  {/* Custom SOP form */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="SOP Title (required)"
                      className="w-full rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-3 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-3 text-[15px] text-text outline-none focus:border-primary"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief description (optional)"
                      className="w-full resize-y rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-3 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleCustomContinue}
                      disabled={!customTitle.trim()}
                      className="rounded-[8px] bg-primary px-6 py-3 text-[15px] font-700 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                      Continue &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : currentStep === 2 ? (
            /* ── Step 2: How Do You Want to Build It? ─────────────── */
            <div className="mt-6 space-y-4">
              {/* Helper callout */}
              <div className="flex gap-3 rounded-[12px] border-2 border-[#b6d4fe] bg-primary-light px-5 py-4">
                <span className="text-lg leading-none" aria-hidden="true">💡</span>
                <p className="text-[14px] text-text leading-relaxed">
                  Choose how you'd like to describe your process. You can always switch later.
                </p>
              </div>

              {/* Guided card */}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_BUILD_MODE", mode: "guided" })}
                className={`flex w-full items-start gap-4 rounded-[12px] border-2 p-5 text-left transition-colors ${
                  state.buildMode === "guided"
                    ? "border-primary bg-primary-light"
                    : "border-[#e0e0e0] bg-white hover:border-primary hover:bg-primary-light"
                }`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  {state.buildMode === "guided" && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-700 text-text">Guided</span>
                    <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-700 text-accent">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-text-muted">
                    We'll ask smart questions one at a time to uncover every step of your process.
                  </p>
                </div>
              </button>

              {/* Talk It Out card */}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_BUILD_MODE", mode: "talk" })}
                className={`flex w-full items-start gap-4 rounded-[12px] border-2 p-5 text-left transition-colors ${
                  state.buildMode === "talk"
                    ? "border-primary bg-primary-light"
                    : "border-[#e0e0e0] bg-white hover:border-primary hover:bg-primary-light"
                }`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  {state.buildMode === "talk" && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                <div>
                  <span className="text-[15px] font-700 text-text">Talk It Out</span>
                  <p className="mt-1 text-[14px] text-text-muted">
                    Explain your process naturally — record yourself or type it out. We'll organize it into steps.
                  </p>
                </div>
              </button>
            </div>
          ) : currentStep === 3 && state.buildMode === "talk" ? (
            /* ── Step 3: Talk It Out (Capture) ────────────────────── */
            <div className="mt-6 space-y-6">
              {/* Mic record area */}
              <div className="flex flex-col items-center gap-3 py-2">
                {isSupported ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-3 text-[28px] transition-colors ${
                        isRecording
                          ? "border-[#ef4444] bg-[#ef4444] pulse-record text-white"
                          : "border-[#ef4444] bg-[#fef2f2] hover:bg-[#fecaca]"
                      }`}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      🎙️
                    </button>
                    <p className="text-[14px] font-600 text-text-muted">
                      {isRecording
                        ? `Recording... ${formatDuration(duration)}`
                        : "Tap to record yourself explaining it"}
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-text-muted">
                    Voice input not supported in this browser. Type your process below.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-[#e0e0e0]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-4 text-[13px] font-600 text-text-muted">
                    — or type it out —
                  </span>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  value={state.transcript}
                  onChange={(e) =>
                    dispatch({ type: "SET_TRANSCRIPT", transcript: e.target.value })
                  }
                  rows={6}
                  className="w-full min-h-[160px] resize-y rounded-[12px] border-2 border-[#e0e0e0] bg-white px-4 py-4 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Example: First I unlock the medication cabinet. I check the MAR for whats due..."
                />
                {state.transcript && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "SET_TRANSCRIPT", transcript: "" })
                      }
                      className="text-[13px] font-600 text-text-muted transition-colors hover:text-warn"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Tip box */}
              <div className="rounded-[12px] border-2 border-[#b6d4fe] bg-primary-light px-5 py-4">
                <p className="text-[14px] text-text leading-relaxed">
                  💡 <strong>Tip:</strong> Pretend you're showing someone new how to do this on their first day.
                </p>
              </div>
            </div>
          ) : currentStep === 3 && state.buildMode === "guided" ? (
            /* ── Step 3: Guided Interview ──────────────────────────── */
            <div className="mt-6">
              {state.guidedLoading ? (
                /* Loading */
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#e0e0e0] border-t-primary" />
                  <p className="mt-4 text-[15px] font-600 text-text">
                    Preparing your questions...
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    This will just take a moment.
                  </p>
                </div>
              ) : state.guidedError ? (
                /* Error */
                <div className="rounded-[10px] border-2 border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[14px] text-warn">
                  <p>{state.guidedError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasLoadedGuidedRef.current = false;
                      loadGuidedQuestions();
                    }}
                    className="mt-2 text-[14px] font-700 text-primary hover:underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : state.guidedQuestions.length > 0 && state.guidedCurrentIndex < state.guidedQuestions.length ? (
                /* Question UI */
                (() => {
                  const q = state.guidedQuestions[state.guidedCurrentIndex];
                  return (
                    <div>
                      {/* Progress */}
                      <p className="text-[13px] font-600 text-text-muted">
                        Question {state.guidedCurrentIndex + 1} of {state.guidedQuestions.length}
                      </p>

                      {/* Question */}
                      <h4 className="mt-3 text-[18px] font-700 text-text leading-snug">
                        {q.question}
                      </h4>

                      {/* Answer cards */}
                      <div className="mt-5 space-y-2.5">
                        {q.answers.map((ans, ai) => (
                          <button
                            key={ai}
                            type="button"
                            onClick={() =>
                              dispatch({
                                type: "SET_GUIDED_ANSWER",
                                questionId: q.id,
                                question: q.question,
                                answer: ans,
                              })
                            }
                            className="flex w-full items-center gap-3 rounded-[12px] border-2 border-[#e0e0e0] bg-white p-4 text-left text-[15px] text-text transition-all hover:border-primary hover:bg-primary-light"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#e0e0e0] text-[13px] font-700 text-text-muted">
                              {String.fromCharCode(65 + ai)}
                            </span>
                            <span>{ans}</span>
                          </button>
                        ))}

                        {/* "Something else" option */}
                        {!state.guidedShowOther ? (
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "TOGGLE_GUIDED_OTHER" })}
                            className="flex w-full items-center gap-3 rounded-[12px] border-2 border-dashed border-[#e0e0e0] bg-white p-4 text-left text-[15px] text-text-muted transition-all hover:border-primary hover:text-text"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#e0e0e0] text-[13px] font-700">
                              ✏️
                            </span>
                            <span>Something else...</span>
                          </button>
                        ) : (
                          <div className="rounded-[12px] border-2 border-primary bg-primary-light p-4">
                            <textarea
                              rows={2}
                              value={state.guidedOtherText}
                              onChange={(e) =>
                                dispatch({ type: "SET_GUIDED_OTHER_TEXT", text: e.target.value })
                              }
                              className="w-full resize-y rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Type your answer..."
                              autoFocus
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => dispatch({ type: "TOGGLE_GUIDED_OTHER" })}
                                className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:text-text"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!state.guidedOtherText.trim()}
                                onClick={() =>
                                  dispatch({
                                    type: "SET_GUIDED_ANSWER",
                                    questionId: q.id,
                                    question: q.question,
                                    answer: state.guidedOtherText.trim(),
                                  })
                                }
                                className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                              >
                                Submit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress dots */}
                      <div className="mt-6 flex justify-center gap-2">
                        {state.guidedQuestions.map((_, di) => (
                          <div
                            key={di}
                            className={`h-2.5 w-2.5 rounded-full ${
                              di < state.guidedCurrentIndex
                                ? "bg-primary"
                                : di === state.guidedCurrentIndex
                                  ? "bg-primary/40"
                                  : "border-2 border-[#e0e0e0] bg-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : guidedComplete ? (
                /* Completed — show summary */
                <div>
                  <div className="flex items-center gap-2 text-[16px] font-700 text-text">
                    <span>✅</span> All done! Here's what you told us:
                  </div>
                  <div className="mt-4 space-y-3">
                    {state.guidedAnswers.map((a, ai) => (
                      <div
                        key={ai}
                        className="rounded-[10px] border-2 border-[#e0e0e0] bg-white px-4 py-3"
                      >
                        <p className="text-[13px] font-700 text-text-muted">
                          Q{ai + 1}: {a.question}
                        </p>
                        <p className="mt-1 text-[15px] text-text">{a.answer}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[14px] text-text-muted text-center">
                    Click <strong>Build My SOP</strong> below to generate your steps.
                  </p>
                </div>
              ) : null}
            </div>
          ) : currentStep === 4 ? (
            /* ── Step 4: Review Your Steps ────────────────────────── */
            <div className="mt-6">
              {generating ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#e0e0e0] border-t-primary" />
                  <p className="mt-4 text-[15px] font-600 text-text">
                    Building your SOP steps...
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    This may take a few seconds.
                  </p>
                </div>
              ) : genError ? (
                <div className="rounded-[10px] border-2 border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[14px] text-warn">
                  <p>{genError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasGeneratedRef.current = false;
                      handleGenerate();
                    }}
                    className="mt-2 text-[14px] font-700 text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {state.generatedSteps.map((step, i) => (
                    <div
                      key={step.step_number}
                      className="flex gap-4 rounded-[12px] border-2 border-[#e0e0e0] bg-white p-5"
                    >
                      {/* Step number badge */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-800 text-white">
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
                              className="w-full rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Step title"
                            />
                            <textarea
                              rows={3}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="w-full resize-y rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Step description"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:text-text"
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
                                className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[15px] font-600 text-text">
                              {step.title}
                            </p>
                            {step.description && (() => {
                              const lines = step.description.split("\n").filter((l) => l.trim());
                              const hasBullets = lines.some((l) => l.trim().startsWith("•"));
                              if (hasBullets) {
                                return (
                                  <ul className="mt-1.5 space-y-1">
                                    {lines.map((line, li) => (
                                      <li key={li} className="flex gap-2 text-[14px] text-text-muted">
                                        <span className="shrink-0 text-primary">•</span>
                                        <span>{line.replace(/^•\s*/, "")}</span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              }
                              return (
                                <p className="mt-1 text-[14px] text-text-muted whitespace-pre-wrap">
                                  {step.description}
                                </p>
                              );
                            })()}
                            {/* Resources from AI */}
                            {step.resources && step.resources.length > 0 && (
                              <div className="mt-2 border-t border-[#e0e0e0] pt-2">
                                <p className="text-[11px] font-700 text-text-muted uppercase tracking-wide">🔗 Links & Resources</p>
                                <ul className="mt-1 space-y-0.5">
                                  {step.resources.map((r, ri) => (
                                    <li key={ri} className="flex items-center gap-2 text-[12px]">
                                      <span>{r.type === "form" ? "📄" : r.type === "doc" ? "📋" : "🔗"}</span>
                                      {r.url ? (
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{r.label}</a>
                                      ) : (
                                        <span className="text-text-muted">{r.label}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
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
                              className="rounded px-1.5 py-1 text-[13px] font-600 text-text-muted transition-colors hover:text-text"
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
                              className="rounded px-1.5 py-1 text-[13px] font-600 text-text-muted transition-colors hover:text-text"
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
                            className="rounded px-1.5 py-1 text-[13px] font-600 text-text-muted transition-colors hover:text-text"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "DELETE_STEP", index: i })}
                            className="rounded px-1.5 py-1 text-[13px] font-600 text-warn transition-colors hover:text-warn"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add step form */}
                  {addingStep ? (
                    <div className="rounded-[12px] border-2 border-[#e0e0e0] bg-white p-5">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          className="w-full rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="Step title"
                        />
                        <textarea
                          rows={3}
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          className="w-full resize-y rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                            className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:text-text"
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
                            className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
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
                      className="w-full rounded-[12px] border-2 border-dashed border-[#e0e0e0] px-5 py-3 text-[14px] font-600 text-text-muted transition-colors hover:border-primary hover:text-primary"
                    >
                      + Add Step
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : currentStep === 5 ? (
            /* ── Step 5: Compliance Check ─────────────────────────── */
            <div className="mt-6">
              {complianceLoading ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#e0e0e0] border-t-primary" />
                  <p className="mt-4 text-[15px] font-600 text-text">
                    Running compliance check...
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    This may take a few seconds.
                  </p>
                </div>
              ) : complianceError ? (
                <div className="rounded-[10px] border-2 border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[14px] text-warn">
                  <p>{complianceError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      hasCheckedComplianceRef.current = false;
                      runComplianceCheck();
                    }}
                    className="mt-2 text-[14px] font-700 text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Score Ring */}
                  {state.complianceScore !== null && (
                    <div className="flex items-center gap-5 rounded-[12px] border-2 border-[#e0e0e0] bg-white p-5">
                      <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="#e0e0e0"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="var(--color-primary)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${2 * Math.PI * 36 * (1 - state.complianceScore / 100)}`}
                          transform="rotate(-90 40 40)"
                        />
                        <text
                          x="40"
                          y="40"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-800"
                          fill="var(--color-text)"
                          fontSize="22"
                        >
                          {state.complianceScore}
                        </text>
                      </svg>
                      <div>
                        <p className="text-[16px] font-800 text-text">
                          Compliance Score: {state.complianceScore}/100
                        </p>
                        <p className="mt-0.5 text-[14px] text-text-muted">
                          {state.complianceScore >= 90
                            ? "Looking good!"
                            : state.complianceScore >= 70
                              ? `Needs attention — ${state.complianceFindings.length} finding${state.complianceFindings.length === 1 ? "" : "s"}`
                              : `Needs revision — ${state.complianceFindings.length} finding${state.complianceFindings.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Findings cards */}
                  {state.complianceFindings.length > 0 && (
                    <div className="space-y-3">
                      {state.complianceFindings.map((f) => {
                        const isResolved = resolvedFindings.has(f.finding_id);
                        return (
                          <div
                            key={f.finding_id}
                            className={`rounded-[12px] border-2 border-[#fecaca] bg-[#fef2f2] p-5 transition-opacity ${
                              isResolved ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-800 uppercase ${
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
                                <p className="text-[15px] font-600 text-text">{f.title}</p>
                                <p className="mt-1 text-[14px] text-text-muted">{f.description}</p>
                                {f.recommendation && (
                                  <p className="mt-1 text-[13px] text-text-light italic">
                                    {f.recommendation}
                                  </p>
                                )}
                              </div>
                            </div>
                            {!isResolved && (
                              <div className="mt-3 flex gap-2 pl-8">
                                <button
                                  type="button"
                                  onClick={() => toggleFinding(f.finding_id)}
                                  className="rounded-[8px] bg-accent px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-accent-hover"
                                >
                                  &#10003; Compliant
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
                                  className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:text-text"
                                >
                                  Update SOP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFinding(f.finding_id)}
                                  className="rounded-[8px] px-4 py-2 text-[13px] font-700 text-text-light transition-colors hover:text-text-muted"
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

                  {/* Confirmation checkbox */}
                  <button
                    type="button"
                    onClick={() => setConfirmed((c) => !c)}
                    className="flex w-full items-center gap-3 rounded-[12px] border-2 border-accent/30 bg-accent-light px-5 py-4 text-left transition-colors hover:bg-accent-light/80"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        confirmed
                          ? "border-accent bg-accent text-white"
                          : "border-[#e0e0e0] bg-white"
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
                    <span className="text-[14px] font-600 text-text">
                      I confirm this SOP reflects my current facility process and I have reviewed all compliance findings.
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between border-t border-[#e0e0e0] px-6 py-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-6 py-2.5 text-[14px] font-700 text-text-muted transition-colors hover:text-text"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => {
                // For guided mode: compile Q&A into transcript before advancing
                if (currentStep === 3 && state.buildMode === "guided" && guidedComplete) {
                  const transcript = state.guidedAnswers
                    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
                    .join("\n\n");
                  dispatch({ type: "SET_TRANSCRIPT", transcript });
                }
                goNext();
              }}
              disabled={continueDisabled}
              className={`rounded-[8px] bg-primary px-7 py-2.5 text-[15px] font-700 text-white transition-colors ${
                continueDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-primary-hover"
              }`}
            >
              {continueLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={!confirmed || finalizing}
              className={`rounded-[8px] bg-accent px-7 py-2.5 text-[15px] font-700 text-white transition-colors ${
                !confirmed || finalizing
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-accent-hover"
              }`}
            >
              {finalizing ? "Finalizing..." : "Finalize SOP"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
