import { useReducer } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateSOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  sopId: string;
  sopTitle: string;
}

interface ModalState {
  currentStep: number;
  buildMode: "guided" | "talk" | null;
  regulatorySources: string[];
  transcript: string;
  guidedConversation: unknown[];
  coveredTopics: string[];
  generatedSteps: unknown[];
  suggestedSteps: unknown[];
  complianceScore: number | null;
  complianceFindings: unknown[];
}

type ModalAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BUILD_MODE"; mode: ModalState["buildMode"] }
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
  buildMode: null,
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
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CreateSOPModal({
  isOpen,
  onClose,
  sopTitle,
}: CreateSOPModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { currentStep } = state;
  const stepIndex = currentStep - 1;

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

  function handleFinalize() {
    // Placeholder — will wire up later
    onClose();
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

          {/* Placeholder content per step */}
          <div className="mt-6 rounded-sm border border-dashed border-card-border p-8 text-center">
            <p className="text-sm text-text-light">
              Step {currentStep} content will go here.
            </p>
          </div>
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
              className="rounded-sm bg-primary px-6 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              className="rounded-sm bg-accent px-6 py-2 text-sm font-600 text-white transition-colors hover:bg-accent-hover"
            >
              Finalize
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
