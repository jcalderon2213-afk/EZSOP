import { NavLink, useLocation } from "react-router-dom";
import { useCreateSOP } from "../../contexts/CreateSOPContext";

const CREATE_SOP_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const navGroups = [
  {
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
            <path d="M9 21V12h6v9" />
          </svg>
        ),
      },
      {
        label: "SOP Library",
        to: "/sops",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        ),
      },
      {
        label: "Business Profile",
        to: "/profile",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        label: "Knowledge Base",
        to: "/knowledge",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
          </svg>
        ),
      },
    ],
  },
  {
    items: [
      {
        label: "Is Juan Ready?",
        to: "/readiness",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M17 11l2 2 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    items: [
      {
        label: "Practice Mode",
        to: "/practice",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
          </svg>
        ),
        color: "text-purple",
      },
    ],
  },
  {
    items: [
      {
        label: "Compliance Log",
        to: "/compliance",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
    ],
  },
];

function checkActive(to: string, pathname: string): boolean {
  return pathname === to || pathname.startsWith(to + "/");
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { openCreateSOP } = useCreateSOP();

  return (
    <aside className="fixed top-0 left-0 z-30 flex h-screen w-[260px] flex-col bg-sidebar-bg text-sidebar-text -translate-x-full lg:translate-x-0 transition-transform">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-2xl font-700 tracking-tight">
          <span className="text-white">EZ</span>
          <span className="text-primary">SOP</span>
        </h1>
        <p className="mt-0.5 text-xs text-text-light">SOP Builder</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="mx-2 my-2 h-px bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = checkActive(item.to, pathname);
                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.to}
                      className={`flex w-full items-center gap-3 rounded-sm px-3.5 py-3 text-sm font-500 transition-colors ${
                        active
                          ? "bg-sidebar-active text-white"
                          : `hover:bg-sidebar-hover ${item.color ?? ""}`
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Create SOP button — opens modal instead of navigating */}
        <div className="mx-2 my-2 h-px bg-white/10" />
        <button
          type="button"
          onClick={openCreateSOP}
          className="flex w-full items-center gap-3 rounded-sm px-3.5 py-3 text-sm font-500 transition-colors hover:bg-sidebar-hover text-primary"
        >
          {CREATE_SOP_ICON}
          Create SOP
        </button>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 text-xs text-text-light">
        EZSOP v0.1
      </div>
    </aside>
  );
}
