const DEFAULT_STEPS = ["Context", "Voice", "Transcript", "Draft", "Compliance"];

interface BuildStepperProps {
  currentStep: number;
  steps?: string[];
}

export default function BuildStepper({ currentStep, steps = DEFAULT_STEPS }: BuildStepperProps) {
  return (
    <nav className="mb-8 flex items-center justify-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <span className="text-text-light">&rsaquo;</span>}
          <span
            className={`rounded-sm px-3 py-1.5 text-sm font-500 ${
              i === currentStep
                ? "bg-primary text-white"
                : i < currentStep
                  ? "bg-accent-light text-accent"
                  : "border border-card-border bg-card text-text-muted"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </nav>
  );
}
