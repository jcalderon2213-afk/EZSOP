import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import type { KnowledgeItem, KnowledgeBase } from "../types/knowledge";

// ── Props ────────────────────────────────────────────────────────────────────

interface KnowledgeBaseTableProps {
  orgId: string;
  items: KnowledgeItem[];
  onItemsChange: (items: KnowledgeItem[]) => void;
  knowledgeBase: KnowledgeBase | null;
  onBuildKnowledgeBase: () => void;
  building: boolean;
  onOpenAddSource: () => void;
  onSuggestSource: () => Promise<void>;
  suggesting: boolean;
  suggestExhausted: boolean;
}

// ── Display helpers ──────────────────────────────────────────────────────────

type DisplayStatus = "Verified" | "Pending" | "Skipped";

function getDisplayStatus(status: KnowledgeItem["status"]): DisplayStatus {
  if (status === "provided" || status === "learned") return "Verified";
  if (status === "skipped") return "Skipped";
  return "Pending";
}

const STATUS_DOT_COLOR: Record<DisplayStatus, string> = {
  Verified: "bg-accent",
  Pending: "bg-[#F9A825]",
  Skipped: "bg-text-light",
};

const STATUS_TEXT_COLOR: Record<DisplayStatus, string> = {
  Verified: "text-accent",
  Pending: "text-[#D4851C]",
  Skipped: "text-text-light",
};

function getTypeLabel(type: KnowledgeItem["type"]): string {
  switch (type) {
    case "LINK": return "Link";
    case "PDF": return "PDF";
    case "DOCUMENT": return "Doc";
    case "VOICE": return "Voice";
    case "OTHER": return "Other";
    default: return type;
  }
}

function getLevelLabel(level: KnowledgeItem["level"]): string {
  if (!level) return "—";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getPreviewText(item: KnowledgeItem): string {
  if (item.provided_url) return item.provided_url;
  if (item.provided_file) return item.provided_file;
  if (item.provided_transcript) {
    const len = item.provided_transcript.length;
    return `${len.toLocaleString()} characters (voice)`;
  }
  if (item.provided_text) {
    const len = item.provided_text.length;
    return `${len.toLocaleString()} characters`;
  }
  if (item.suggested_source) return item.suggested_source;
  if (item.status === "skipped") return "Not provided";
  return "No link provided yet";
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

// ── Sort types ───────────────────────────────────────────────────────────────

type SortKey = "name" | "type" | "level" | "status";
type SortDir = "asc" | "desc";

function compareFn(a: KnowledgeItem, b: KnowledgeItem, key: SortKey, dir: SortDir): number {
  let va: string;
  let vb: string;

  switch (key) {
    case "name":
      va = a.title.toLowerCase();
      vb = b.title.toLowerCase();
      break;
    case "type":
      va = a.type;
      vb = b.type;
      break;
    case "level":
      va = a.level || "";
      vb = b.level || "";
      break;
    case "status":
      va = getDisplayStatus(a.status);
      vb = getDisplayStatus(b.status);
      break;
  }

  const cmp = va.localeCompare(vb);
  return dir === "asc" ? cmp : -cmp;
}

// ── Filter options ───────────────────────────────────────────────────────────

const TYPE_OPTIONS = ["All", "Link", "PDF", "Document", "Voice"] as const;
const LEVEL_OPTIONS = ["All", "Federal", "State", "County", "Local", "Internal"] as const;
const STATUS_OPTIONS = ["All", "Verified", "Pending", "Skipped"] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeBaseTable({
  orgId,
  items,
  onItemsChange,
  knowledgeBase,
  onBuildKnowledgeBase,
  building,
  onOpenAddSource,
  onSuggestSource,
  suggesting,
  suggestExhausted,
}: KnowledgeBaseTableProps) {
  const { refreshKnowledgeBase } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Search & filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Filtering & sorting ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...items];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      );
    }

    // Type filter
    if (typeFilter !== "All") {
      const typeMap: Record<string, KnowledgeItem["type"]> = {
        Link: "LINK",
        PDF: "PDF",
        Document: "DOCUMENT",
        Voice: "VOICE",
      };
      const dbType = typeMap[typeFilter];
      if (dbType) result = result.filter((i) => i.type === dbType);
    }

    // Level filter
    if (levelFilter !== "All") {
      const lvl = levelFilter.toLowerCase();
      result = result.filter((i) => i.level === lvl);
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter(
        (i) => getDisplayStatus(i.status) === statusFilter,
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => compareFn(a, b, sortKey, sortDir));
    }

    return result;
  }, [items, search, typeFilter, levelFilter, statusFilter, sortKey, sortDir]);

  // Counts
  const verifiedCount = items.filter((i) => getDisplayStatus(i.status) === "Verified").length;
  const pendingCount = items.filter((i) => getDisplayStatus(i.status) === "Pending").length;
  const skippedCount = items.filter((i) => getDisplayStatus(i.status) === "Skipped").length;

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return <span className="ml-1 text-[10px] opacity-40">↕</span>;
    return (
      <span className="ml-1 text-[10px] opacity-80">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  async function handleDelete(item: KnowledgeItem) {
    const confirmed = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("knowledge_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    onItemsChange(items.filter((i) => i.id !== item.id));
    showToast("Source deleted", "success");
  }

  function handleOpen(item: KnowledgeItem) {
    if (item.provided_url) {
      window.open(item.provided_url, "_blank", "noopener");
    } else if (item.suggested_source) {
      window.open(item.suggested_source, "_blank", "noopener");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-600">Knowledge Base</h1>
          <p className="mt-1 text-sm text-text-muted">
            Your compliance reference library · {items.length} source{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSuggestSource}
            disabled={suggesting || suggestExhausted}
            className="inline-flex items-center gap-1.5 rounded-sm border border-card-border bg-card px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {suggesting ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-light border-t-primary" />
                Thinking...
              </>
            ) : suggestExhausted ? (
              "No more suggestions"
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                  <line x1="9" y1="21" x2="15" y2="21" />
                </svg>
                Suggest Source
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenAddSource}
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Source
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sources..."
            className="w-full rounded-sm border border-card-border bg-card py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-light focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "All" ? "All Types" : o}</option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "All" ? "All Levels" : o}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-sm border border-card-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "All" ? "All Status" : o}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-[12px] border border-card-border bg-card shadow">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-border bg-[#FDFBF8]">
                <th
                  className="cursor-pointer select-none px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted hover:text-text"
                  onClick={() => handleSort("name")}
                >
                  Name {sortArrow("name")}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted hover:text-text"
                  onClick={() => handleSort("type")}
                >
                  Type {sortArrow("type")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted">
                  Description
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted hover:text-text"
                  onClick={() => handleSort("level")}
                >
                  Level {sortArrow("level")}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted hover:text-text"
                  onClick={() => handleSort("status")}
                >
                  Status {sortArrow("status")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-600 uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                    {items.length === 0
                      ? "No sources yet. Click \"Add Source\" to get started."
                      : "No sources match your filters."}
                  </td>
                </tr>
              )}
              {filtered.map((item) => {
                const ds = getDisplayStatus(item.status);
                const isSkipped = ds === "Skipped";
                const preview = getPreviewText(item);
                const hasLink = !!(item.provided_url || item.suggested_source);

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-card-border transition-colors last:border-b-0 hover:bg-[#FDFBF8] ${isSkipped ? "opacity-55" : ""}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-600 text-text leading-snug">
                        {item.title}
                      </div>
                      <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-text-light">
                        {hasLink && item.provided_url ? (
                          <a
                            href={item.provided_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-info hover:underline"
                          >
                            {truncate(item.provided_url.replace(/^https?:\/\//, ""), 40)}
                          </a>
                        ) : item.type === "VOICE" && item.provided_transcript ? (
                          <span>🎤 voice transcript</span>
                        ) : (
                          <span>{truncate(preview, 40)}</span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-[12px] font-500 text-text-muted">
                      {getTypeLabel(item.type)}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="max-w-[280px] truncate text-[12px] leading-snug text-text-muted">
                        {item.description || "—"}
                      </div>
                    </td>

                    {/* Level */}
                    <td className="px-4 py-3 text-[12px] font-500 text-text-muted">
                      {getLevelLabel(item.level)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 text-[12px] font-500 ${STATUS_TEXT_COLOR[ds]}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLOR[ds]}`} />
                        {ds}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {/* Open / View / Play — contextual by type and status */}
                        {isSkipped ? (
                          <ActionButton
                            title="Provide"
                            className="text-primary"
                            onClick={() => {/* placeholder — AddSourceModal will handle */}}
                          >
                            ➕
                          </ActionButton>
                        ) : item.type === "LINK" ? (
                          <ActionButton title="Open" onClick={() => handleOpen(item)}>
                            🔗
                          </ActionButton>
                        ) : item.type === "VOICE" ? (
                          <ActionButton title="Play" onClick={() => {/* placeholder */}}>
                            ▶️
                          </ActionButton>
                        ) : (
                          <ActionButton title="View" onClick={() => {/* placeholder */}}>
                            👁️
                          </ActionButton>
                        )}

                        {!isSkipped && (
                          <ActionButton title="Edit" onClick={() => {/* placeholder */}}>
                            ✏️
                          </ActionButton>
                        )}

                        <ActionButton
                          title="Delete"
                          className="hover:!bg-warn-light hover:!text-warn"
                          onClick={() => handleDelete(item)}
                        >
                          🗑️
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-card-border bg-[#FDFBF8] px-4 py-2.5 text-[12px] text-text-muted">
          <span>
            Showing {filtered.length} source{filtered.length !== 1 ? "s" : ""}
            {" · "}{verifiedCount} verified
            {" · "}{pendingCount} pending
            {" · "}{skippedCount} skipped
          </span>
        </div>
      </div>

      {/* KB Status Bar */}
      {knowledgeBase ? (
        <div className="mt-4 flex items-center gap-3 rounded-sm border border-accent/30 bg-accent-light px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-base text-white">
            ✓
          </div>
          <div className="flex-1 text-sm">
            <span className="font-600 text-accent">Knowledge Base Complete</span>
            {" · "}Built from {knowledgeBase.source_count} source{knowledgeBase.source_count !== 1 ? "s" : ""}
            <br />
            <span className="text-[12px] text-text-muted">
              Last built: {new Date(knowledgeBase.built_at).toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onBuildKnowledgeBase}
            disabled={building}
            className="rounded-sm border border-card-border bg-card px-3 py-1.5 text-[12px] font-500 text-text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {building ? "Updating..." : "Update Knowledge Base"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await refreshKnowledgeBase();
              navigate("/sops");
            }}
            className="rounded-sm bg-primary px-3 py-1.5 text-[12px] font-600 text-white transition-colors hover:bg-primary-hover"
          >
            Create SOPs →
          </button>
        </div>
      ) : items.filter((i) => i.status === "provided" || i.status === "learned").length > 0 ? (
        <div className="mt-4 rounded-sm border border-dashed border-accent/40 bg-accent-light/50 px-4 py-4">
          <h3 className="text-sm font-600 text-text">Build Knowledge Base</h3>
          <p className="mt-1 text-xs text-text-muted">
            Synthesize your {items.filter((i) => i.status === "provided" || i.status === "learned").length} provided
            source{items.filter((i) => i.status === "provided" || i.status === "learned").length !== 1 ? "s" : ""} into
            a knowledge base that powers SOP generation and compliance checks.
          </p>
          <button
            type="button"
            onClick={onBuildKnowledgeBase}
            disabled={building}
            className="mt-3 rounded-sm bg-accent px-5 py-2 text-sm font-600 text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {building ? "Building..." : "Build Knowledge Base →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Small action button ──────────────────────────────────────────────────────

function ActionButton({
  title,
  onClick,
  className = "",
  children,
}: {
  title: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border-none bg-transparent text-[14px] text-text-muted transition-all hover:bg-bg hover:text-text ${className}`}
    >
      {children}
    </button>
  );
}
