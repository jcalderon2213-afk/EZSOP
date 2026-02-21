import { NavLink, Outlet, useLocation } from "react-router-dom";

const steps = [
  { label: "Context", path: "context" },
  { label: "Voice", path: "voice" },
  { label: "Transcript", path: "transcript" },
  { label: "Draft", path: "draft" },
  { label: "Compliance", path: "compliance" },
];

export default function CreateSOPPage() {
  const { pathname } = useLocation();

  return (
    <div>
      <h1 className="font-display text-2xl font-600">Create SOP</h1>
      <p className="mt-1 text-sm text-text-muted">/sops/create</p>

      {/* Stepper */}
      <nav className="mt-6 flex items-center gap-2">
        {steps.map((step, i) => {
          const active = pathname.endsWith(step.path);
          return (
            <div key={step.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-text-light">&rarr;</span>}
              <NavLink
                to={step.path}
                className={`rounded-sm px-3 py-1.5 text-sm font-500 transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "border border-card-border bg-card text-text-muted hover:text-text"
                }`}
              >
                {step.label}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Sub-step content */}
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
