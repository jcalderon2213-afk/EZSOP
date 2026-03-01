import { NavLink, useLocation } from "react-router-dom";
import { useCreateSOP } from "../../contexts/CreateSOPContext";

const navGroups = [
  {
    items: [
      { label: "Home", to: "/dashboard", emoji: "🏠" },
      { label: "My SOPs", to: "/sops", emoji: "📚" },
      { label: "Business Profile", to: "/profile", emoji: "🏢" },
      { label: "Knowledge Base", to: "/knowledge", emoji: "📖" },
    ],
  },
  {
    items: [
      { label: "Is Juan Ready?", to: "/readiness", emoji: "✅" },
    ],
  },
  {
    items: [
      { label: "Practice Mode", to: "/practice", emoji: "💬" },
      { label: "Compliance Log", to: "/compliance", emoji: "🛡️" },
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
    <aside className="fixed top-0 left-0 z-30 flex h-screen w-[260px] flex-col bg-[#1e293b] text-[#cbd5e1] -translate-x-full lg:translate-x-0 transition-transform">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5">
        <h1 className="text-[26px] font-900 tracking-tight">
          <span className="text-primary">EZ</span>
          <span className="text-white">SOP</span>
        </h1>
        <p className="mt-1 text-xs text-[#94a3b8]">SOP Builder</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="mx-3 my-3 h-px bg-white/10" />
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = checkActive(item.to, pathname);
                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.to}
                      className={`flex w-full items-center gap-3.5 rounded-sm px-4 py-3.5 text-[15px] font-600 transition-colors ${
                        active
                          ? "bg-primary/20 text-white"
                          : "hover:bg-white/8 text-[#cbd5e1]"
                      }`}
                    >
                      <span className="text-lg leading-none">{item.emoji}</span>
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Create SOP button */}
        <div className="mx-3 my-3 h-px bg-white/10" />
        <button
          type="button"
          onClick={() => openCreateSOP()}
          className="flex w-full items-center gap-3.5 rounded-sm px-4 py-3.5 text-[15px] font-700 transition-colors hover:bg-primary/20 text-primary"
        >
          <span className="text-lg leading-none">➕</span>
          Create New SOP
        </button>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 text-xs text-[#64748b]">
        EZSOP v0.1
      </div>
    </aside>
  );
}
