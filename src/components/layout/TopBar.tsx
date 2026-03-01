import { useLocation, Link } from "react-router-dom";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  sops: "SOPs",
  create: "Create",
  context: "Context & Upload",
  voice: "Voice Capture",
  transcript: "Transcript Review",
  draft: "Draft Editor",
  compliance: "Compliance Audit",
  profile: "Business Profile",
  readiness: "Manager Readiness",
  practice: "Practice Mode",
  debrief: "Debrief",
};

export default function TopBar() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    let label = labelMap[seg];

    if (!label) {
      // Dynamic segment — infer label from context
      const prev = segments[i - 1];
      if (prev === "sops") label = `SOP #${seg}`;
      else if (prev === "practice") label = "Scenario";
      else label = seg;
    }

    // Handle compliance ambiguity: top-level /compliance → "Compliance Log"
    if (seg === "compliance" && i === 0) {
      label = "Compliance Log";
    }

    return { label, path };
  });

  return (
    <header className="fixed top-0 left-0 lg:left-[260px] right-0 z-20 flex h-14 items-center border-b border-card-border bg-card px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-light">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
              {isLast ? (
                <span className="font-500 text-text">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="text-text-muted hover:text-text transition-colors">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Right side — org switcher / user menu will go here */}
      <div className="ml-auto" />
    </header>
  );
}
