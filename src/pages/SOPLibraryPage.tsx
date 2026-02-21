import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

interface SOP {
  id: string;
  title: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-warn-light text-warn",
  published: "bg-accent-light text-accent",
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
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    fetchSOPs();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-600">SOP Library</h1>
        <Link
          to="/sops/create"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
        >
          + New SOP
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      )}

      {/* Empty state */}
      {!loading && !error && sops.length === 0 && (
        <div className="mt-16 text-center">
          <h2 className="font-display text-xl font-600 text-text">No SOPs yet</h2>
          <p className="mt-2 text-sm text-text-muted">
            Create your first Standard Operating Procedure to get started.
          </p>
          <Link
            to="/sops/create"
            className="mt-6 inline-block rounded-sm bg-primary px-5 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
          >
            Create your first SOP
          </Link>
        </div>
      )}

      {/* SOP grid */}
      {!loading && sops.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sops.map((sop) => (
            <Link
              key={sop.id}
              to={`/sops/${sop.id}`}
              className="block rounded border border-card-border bg-card p-5 shadow transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-500 text-text line-clamp-2">{sop.title}</h3>
                <span
                  className={`shrink-0 rounded-xs px-2 py-0.5 text-xs font-500 ${STATUS_STYLES[sop.status] ?? STATUS_STYLES.draft}`}
                >
                  {sop.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                {sop.category ?? "Uncategorized"}
              </p>
              <p className="mt-3 text-xs text-text-light">
                Updated {formatDate(sop.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
