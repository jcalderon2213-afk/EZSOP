import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useCreateSOP } from "../contexts/CreateSOPContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

interface SOP {
  id: string;
  title: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

type SortOption =
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "title_asc"
  | "title_desc"
  | "status_asc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created_desc", label: "Newest First" },
  { value: "created_asc", label: "Oldest First" },
  { value: "updated_desc", label: "Recently Updated" },
  { value: "title_asc", label: "Name A\u2013Z" },
  { value: "title_desc", label: "Name Z\u2013A" },
  { value: "status_asc", label: "Status" },
];

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
  const { showToast } = useToast();
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("created_desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  async function fetchSOPs() {
    logger.info("sop_library_fetch_start");

    const { data, error: fetchError } = await supabase
      .from("sops")
      .select("id, title, category, status, created_at, updated_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

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

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  // ── Client-side sorting ───────────────────────────────────────────────

  const sortedSops = useMemo(() => {
    const sorted = [...sops];
    sorted.sort((a, b) => {
      switch (sortOption) {
        case "created_desc":
          return b.created_at.localeCompare(a.created_at);
        case "created_asc":
          return a.created_at.localeCompare(b.created_at);
        case "updated_desc":
          return b.updated_at.localeCompare(a.updated_at);
        case "title_asc":
          return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        case "title_desc":
          return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
        case "status_asc": {
          const order: Record<string, number> = { published: 0, draft: 1, archived: 2 };
          return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [sops, sortOption]);

  // ── Selection helpers ─────────────────────────────────────────────────

  const allSelected = sortedSops.length > 0 && selectedIds.size === sortedSops.length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSops.map((s) => s.id)));
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────

  async function bulkSetStatus(newStatus: "draft" | "published") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);

    const { error: updateError } = await supabase
      .from("sops")
      .update({ status: newStatus })
      .in("id", ids);

    if (updateError) {
      showToast(updateError.message, "error");
      setBulkLoading(false);
      return;
    }

    showToast(`${ids.length} SOP${ids.length > 1 ? "s" : ""} set to ${newStatus}`, "success");
    setSelectedIds(new Set());
    await fetchSOPs();
    setBulkLoading(false);
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${ids.length} SOP${ids.length > 1 ? "s" : ""}? This can't be undone.`,
    );
    if (!confirmed) return;

    setBulkLoading(true);

    const { error: deleteError } = await supabase
      .from("sops")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);

    if (deleteError) {
      showToast(deleteError.message, "error");
      setBulkLoading(false);
      return;
    }

    showToast(`${ids.length} SOP${ids.length > 1 ? "s" : ""} deleted`, "success");
    setSelectedIds(new Set());
    await fetchSOPs();
    setBulkLoading(false);
  }

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
        <div className="flex items-center gap-3">
          {/* Sort dropdown — only show when SOPs exist */}
          {sops.length > 0 && (
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2.5 text-[13px] font-600 text-text-muted outline-none transition-colors focus:border-primary"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={openCreateSOP}
            className="rounded-[8px] bg-primary px-6 py-3 text-[15px] font-700 text-white transition-colors hover:bg-primary-hover"
          >
            + New SOP
          </button>
        </div>
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

      {/* Bulk action bar */}
      {!loading && sops.length > 0 && selectedIds.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-[12px] border-2 border-primary bg-white px-5 py-3 shadow-sm">
          <p className="text-[14px] font-700 text-primary">
            {selectedIds.size} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => bulkSetStatus("draft")}
              className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-4 py-2 text-[13px] font-700 text-text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              Set as Draft
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => bulkSetStatus("published")}
              className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-700 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Set as Published
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={bulkDelete}
              className="rounded-[8px] border-2 border-warn bg-white px-4 py-2 text-[13px] font-700 text-warn transition-colors hover:bg-warn-light disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* SOP row list */}
      {!loading && sops.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Select All header */}
          <label className="flex cursor-pointer items-center gap-3 px-2 py-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary accent-[#2563eb]"
            />
            <span className="text-[13px] font-600 text-text-muted">
              Select All
            </span>
          </label>

          {sortedSops.map((sop) => {
            const isSelected = selectedIds.has(sop.id);
            return (
              <div
                key={sop.id}
                className={`flex items-center gap-4 rounded-[12px] border-2 px-6 py-5 transition-colors ${
                  isSelected
                    ? "border-primary bg-[#eff6ff]"
                    : "border-[#e0e0e0] bg-white hover:border-primary hover:bg-[#fafbff]"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(sop.id)}
                  className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-primary accent-[#2563eb]"
                />

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
            );
          })}
        </div>
      )}

    </div>
  );
}
