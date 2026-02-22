import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

interface SOP {
  id: string;
  title: string;
  category: string | null;
  purpose: string | null;
  frequency: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-warn-light text-warn",
  published: "bg-accent-light text-accent",
  archived: "bg-bg text-text-muted",
};

const FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Annually",
  "As Needed",
];

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SOPDetailPage() {
  const { id } = useParams();

  const [sop, setSop] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editFrequency, setEditFrequency] = useState("");

  useEffect(() => {
    async function fetchSOP() {
      logger.info("sop_detail_fetch_start", { sopId: id });

      const { data, error: fetchError } = await supabase
        .from("sops")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (fetchError) {
        logger.error("sop_detail_fetch_error", { message: fetchError.message });
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      logger.info("sop_detail_fetch_success", { sopId: id });
      setSop(data as SOP);
      setLoading(false);
    }

    fetchSOP();
  }, [id]);

  function startEditing() {
    if (!sop) return;
    setEditTitle(sop.title);
    setEditCategory(sop.category ?? "");
    setEditPurpose(sop.purpose ?? "");
    setEditFrequency(sop.frequency ?? "");
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError("");
  }

  async function handleSave() {
    if (!sop) return;
    setSaveError("");
    setSaving(true);
    logger.info("sop_detail_update_attempt", { sopId: sop.id });

    const { data, error: updateError } = await supabase
      .from("sops")
      .update({
        title: editTitle.trim(),
        category: editCategory.trim() || null,
        purpose: editPurpose.trim() || null,
        frequency: editFrequency || null,
      })
      .eq("id", sop.id)
      .select()
      .single();

    if (updateError) {
      logger.error("sop_detail_update_error", { message: updateError.message });
      setSaveError(updateError.message);
      setSaving(false);
      return;
    }

    logger.info("sop_detail_update_success", { sopId: sop.id });
    setSop(data as SOP);
    setEditing(false);
    setSaving(false);
  }

  // Loading
  if (loading) {
    return <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>;
  }

  // Error / not found
  if (error || !sop) {
    return (
      <div className="mt-10 text-center">
        <h2 className="font-display text-xl font-600 text-text">SOP not found</h2>
        <p className="mt-2 text-sm text-text-muted">
          {error || "This SOP doesn't exist or has been deleted."}
        </p>
        <Link
          to="/sops"
          className="mt-4 inline-block text-sm font-500 text-primary hover:text-primary-hover transition-colors"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/sops"
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Library
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={inputClass + " max-w-[400px] font-display text-xl font-600"}
            />
          ) : (
            <h1 className="font-display text-2xl font-600">{sop.title}</h1>
          )}
          <span
            className={`shrink-0 rounded-xs px-2 py-0.5 text-xs font-500 ${STATUS_STYLES[sop.status] ?? STATUS_STYLES.draft}`}
          >
            {sop.status}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-sm border border-card-border bg-card px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-sm border border-card-border bg-card px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
          {saveError}
        </div>
      )}

      {/* Detail card */}
      <div className="mt-6 max-w-[700px] rounded border border-card-border bg-card p-6 shadow">
        <dl className="space-y-5">
          {/* Category */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Category</dt>
            {editing ? (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className={inputClass + " mt-1"}
                placeholder="e.g. Health & Safety"
              />
            ) : (
              <dd className="mt-1 text-sm text-text">
                {sop.category ?? "Uncategorized"}
              </dd>
            )}
          </div>

          {/* Purpose */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Purpose</dt>
            {editing ? (
              <textarea
                rows={4}
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
                className={inputClass + " mt-1 resize-y"}
                placeholder="Describe the purpose of this SOP..."
              />
            ) : (
              <dd className="mt-1 text-sm text-text whitespace-pre-wrap">
                {sop.purpose ?? "No purpose set"}
              </dd>
            )}
          </div>

          {/* Frequency */}
          <div>
            <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Frequency</dt>
            {editing ? (
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                className={inputClass + " mt-1"}
              >
                <option value="">Not set</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <dd className="mt-1 text-sm text-text">
                {sop.frequency ?? "Not set"}
              </dd>
            )}
          </div>

          {/* Dates */}
          <div className="flex gap-8 border-t border-card-border pt-5">
            <div>
              <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Created</dt>
              <dd className="mt-1 text-sm text-text">{formatDate(sop.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-500 text-text-muted uppercase tracking-wide">Last updated</dt>
              <dd className="mt-1 text-sm text-text">{formatDate(sop.updated_at)}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}
