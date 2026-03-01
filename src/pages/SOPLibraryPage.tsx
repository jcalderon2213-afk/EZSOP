import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useCreateSOP } from "../contexts/CreateSOPContext";
import { useAuth } from "../contexts/AuthContext";

interface SOP {
  id: string;
  title: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#fef3c7] text-[#92400e]",
  published: "bg-accent-light text-[#166534]",
  archived: "bg-bg text-text-muted",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SOPLibraryPage() {
  const { openCreateSOP } = useCreateSOP();
  const { userProfile } = useAuth();
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    async function fetchSOPs() {
      logger.info("sop_library_fetch_start");

      const { data, error: fetchError } = await supabase
        .from("sops")
        .select("id, title, category, status, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (fetchError) {
        logger.error("sop_library_fetch_error", { message: fetchError.message });
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      logger.info("sop_library_fetch_success", { count: data.length });
      setSops(data as SOP[]);
      setLoading(false);
    }

    async function fetchOrgName() {
      if (!userProfile?.org_id) return;
      const { data } = await supabase
        .from("orgs")
        .select("name")
        .eq("id", userProfile.org_id)
        .single();
      if (data?.name) setOrgName(data.name);
    }

    fetchSOPs();
    fetchOrgName();
  }, [userProfile?.org_id]);

  return (
    <div>
      {/* Back link */}
      <Link
        to="/"
        className="text-[15px] font-700 text-primary hover:underline"
      >
        &larr; Back to Home
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-[28px] font-900">📚 My SOPs</h1>
        <button
          type="button"
          onClick={openCreateSOP}
          className="rounded-[8px] bg-primary px-6 py-3 text-[15px] font-700 text-white transition-colors hover:bg-primary-hover"
        >
          + New SOP
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-[8px] bg-warn-light px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      )}

      {/* Empty state — Day in the Life welcome */}
      {!loading && !error && sops.length === 0 && (
        <div className="mx-auto mt-12 max-w-[520px]">
          <div className="rounded-[16px] border-2 border-[#b6d4fe] bg-primary-light px-8 py-10 text-center">
            <div className="text-[64px] leading-none">🌅</div>
            <h2 className="mt-4 text-[24px] font-900 text-text">
              Welcome to EZSOP!
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-text-muted">
              Let's start by documenting a typical day at{" "}
              <strong className="text-text">{orgName || "your home"}</strong>.
              We'll walk you through it step by step — just describe what
              happens from morning to night.
            </p>
            <button
              type="button"
              onClick={() =>
                openCreateSOP({
                  title: "A Day in the Life",
                  isDayInLife: true,
                })
              }
              className="mt-6 rounded-[8px] bg-primary px-8 py-3.5 text-[16px] font-700 text-white transition-colors hover:bg-primary-hover"
            >
              Let's Go! 🚀
            </button>
          </div>

          <p className="mt-6 text-center text-[14px] text-text-muted">
            Or{" "}
            <button
              type="button"
              onClick={() => openCreateSOP()}
              className="font-700 text-primary hover:underline"
            >
              create a different SOP
            </button>{" "}
            instead.
          </p>
        </div>
      )}

      {/* SOP row list */}
      {!loading && sops.length > 0 && (
        <div className="mt-6 space-y-3">
          {sops.map((sop) => (
            <div
              key={sop.id}
              className="flex items-center gap-4 rounded-[12px] border-2 border-[#e0e0e0] bg-white px-6 py-5 transition-colors hover:border-primary hover:bg-[#fafbff]"
            >
              {/* Title + category */}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-600 text-text truncate">{sop.title}</p>
                <p className="mt-0.5 text-[13px] text-text-muted">
                  {sop.category ?? "Uncategorized"}
                </p>
              </div>

              {/* Updated date */}
              <p className="shrink-0 text-[13px] text-text-muted">
                Updated {formatDate(sop.updated_at)}
              </p>

              {/* Status pill */}
              <span
                className={`shrink-0 rounded-full px-3.5 py-1 text-[13px] font-700 ${STATUS_STYLES[sop.status] ?? STATUS_STYLES.draft}`}
              >
                {sop.status}
              </span>

              {/* Action buttons */}
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/sops/${sop.id}`}
                  className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-primary-hover"
                >
                  View &rarr;
                </Link>
                <Link
                  to={`/sops/${sop.id}`}
                  className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:border-primary hover:text-primary"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
