import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

export default function BabifiedTopBar() {
  const { userProfile } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!userProfile) return;

    // Derive a display name from the email (everything before @)
    const emailName = userProfile.email.split("@")[0];
    // Capitalize first letter
    setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));

    // Fetch org name
    if (userProfile.org_id) {
      supabase
        .from("orgs")
        .select("name")
        .eq("id", userProfile.org_id)
        .single()
        .then(({ data }) => {
          if (data?.name) setOrgName(data.name);
        });
    }
  }, [userProfile]);

  return (
    <header
      className="fixed top-0 left-0 lg:left-[260px] right-0 z-20 flex items-center justify-between bg-white px-8"
      style={{ height: 60, borderBottom: "3px solid var(--color-primary)" }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-0.5">
        <span className="text-[28px] font-900 tracking-tight text-primary">EZ</span>
        <span className="text-[28px] font-900 tracking-tight text-text">SOP</span>
      </Link>

      {/* Right side — user greeting + settings */}
      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-[15px] text-text-muted">
            Hi, <strong className="text-text">{userName}</strong>
            {orgName && (
              <>
                {" "}&nbsp;|&nbsp; {orgName}
              </>
            )}
          </span>
        )}
        <Link
          to="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-primary-light hover:text-primary"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
