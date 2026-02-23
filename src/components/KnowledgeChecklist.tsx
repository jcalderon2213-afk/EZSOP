import { useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

// ── Shared Types ─────────────────────────────────────────────────────────────

export interface BusinessProfile {
  industry_subtype: string | null;
  services: string[];
  client_types: string[];
  staff_count_range: string;
  licensing_bodies: string[];
  certifications_held: string[];
  years_in_operation: number | null;
  special_considerations: string[];
  has_existing_sops: boolean;
  pain_points: string[];
}

export interface KnowledgeItem {
  id: string;
  org_id: string;
  title: string;
  description: string;
  type: "LINK" | "PDF" | "DOCUMENT" | "OTHER";
  priority: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  suggested_source: string | null;
  status: "pending" | "provided" | "learned" | "skipped";
  provided_url: string | null;
  provided_file: string | null;
  provided_text: string | null;
  sort_order: number | null;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  profile: BusinessProfile;
  initialItems: KnowledgeItem[];
  onBack: () => void;
}

// ── Priority section config ──────────────────────────────────────────────────

const PRIORITY_SECTIONS = [
  { key: "REQUIRED" as const, label: "Required", color: "text-warn", bg: "bg-warn-light" },
  { key: "RECOMMENDED" as const, label: "Recommended", color: "text-info", bg: "bg-info-light" },
  { key: "OPTIONAL" as const, label: "Optional", color: "text-text-muted", bg: "bg-card-border" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeChecklist({ orgId, initialItems, onBack }: Props) {
  const { showToast } = useToast();

  const [items, setItems] = useState<KnowledgeItem[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    type: "DOCUMENT" as KnowledgeItem["type"],
    priority: "RECOMMENDED" as KnowledgeItem["priority"],
  });
  const [saving, setSaving] = useState<string | null>(null);

  // Progress
  const completedCount = items.filter((i) =>
    ["provided", "learned", "skipped"].includes(i.status),
  ).length;
  const progressPercent =
    items.length > 0 ? (completedCount / items.length) * 100 : 0;

  // Group by priority
  const grouped = {
    REQUIRED: items.filter((i) => i.priority === "REQUIRED"),
    RECOMMENDED: items.filter((i) => i.priority === "RECOMMENDED"),
    OPTIONAL: items.filter((i) => i.priority === "OPTIONAL"),
  };

  // ── DB update helper ─────────────────────────────────────────────────────

  async function updateItem(id: string, updates: Record<string, unknown>) {
    setSaving(id);
    const { error } = await supabase
      .from("knowledge_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      showToast(error.message, "error");
      setSaving(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? ({ ...item, ...updates } as KnowledgeItem) : item,
      ),
    );
    setSaving(null);
  }

  // ── Item actions ─────────────────────────────────────────────────────────

  function handleUseThis(item: KnowledgeItem) {
    updateItem(item.id, { status: "provided", provided_url: item.suggested_source });
  }

  function handleSaveUrl(item: KnowledgeItem) {
    const url = inputValues[item.id]?.trim();
    if (!url) return;
    updateItem(item.id, { status: "provided", provided_url: url });
    setEditingId(null);
  }

  function handleSaveFile(item: KnowledgeItem, filename: string) {
    updateItem(item.id, { status: "provided", provided_file: filename });
  }

  function handleSaveText(item: KnowledgeItem) {
    const text = inputValues[item.id]?.trim();
    if (!text) return;
    updateItem(item.id, { status: "provided", provided_text: text });
    setEditingId(null);
  }

  function handleSkip(item: KnowledgeItem) {
    updateItem(item.id, { status: "skipped" });
  }

  function handleReopen(item: KnowledgeItem) {
    updateItem(item.id, {
      status: "pending",
      provided_url: null,
      provided_file: null,
      provided_text: null,
    });
    setEditingId(null);
  }

  async function handleAddItem() {
    if (!addForm.title.trim()) return;

    const nextSort = items.length > 0
      ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1
      : 1;
    const { data, error } = await supabase
      .from("knowledge_items")
      .insert({
        org_id: orgId,
        title: addForm.title.trim(),
        description: addForm.description.trim(),
        type: addForm.type,
        priority: addForm.priority,
        status: "pending",
        sort_order: nextSort,
      })
      .select()
      .single();

    if (error) {
      showToast(error.message, "error");
      return;
    }

    setItems((prev) => [...prev, data as KnowledgeItem]);
    setAddForm({ title: "", description: "", type: "DOCUMENT", priority: "RECOMMENDED" });
    setShowAddForm(false);
    showToast("Item added", "success");
  }

  // ── Type badge ───────────────────────────────────────────────────────────

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      LINK: "bg-info-light text-info",
      PDF: "bg-warn-light text-warn",
      DOCUMENT: "bg-accent-light text-accent",
      OTHER: "bg-card-border text-text-muted",
    };
    return (
      <span
        className={`rounded-xs px-2 py-0.5 text-xs font-500 ${colors[type] ?? colors.OTHER}`}
      >
        {type}
      </span>
    );
  }

  // ── Per-item input renderers ─────────────────────────────────────────────

  function renderItemInput(item: KnowledgeItem) {
    if (item.status === "provided" || item.status === "learned") {
      return (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">
            &#10003;
          </span>
          <span className="flex-1 truncate text-xs text-accent">
            {item.provided_url || item.provided_file || item.provided_text || "Provided"}
          </span>
          <button
            type="button"
            onClick={() => handleReopen(item)}
            className="shrink-0 text-xs text-text-muted underline hover:text-text"
          >
            Change
          </button>
        </div>
      );
    }

    if (item.status === "skipped") {
      return (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs italic text-text-muted">Skipped</span>
          <button
            type="button"
            onClick={() => handleReopen(item)}
            className="text-xs text-text-muted underline hover:text-text"
          >
            Reopen
          </button>
        </div>
      );
    }

    switch (item.type) {
      case "LINK":
        return renderLinkInput(item);
      case "PDF":
        return renderPdfInput(item);
      case "DOCUMENT":
      case "OTHER":
        return renderTextInput(item);
      default:
        return null;
    }
  }

  function renderLinkInput(item: KnowledgeItem) {
    if (editingId === item.id || !item.suggested_source) {
      return (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={inputValues[item.id] ?? ""}
              onChange={(e) =>
                setInputValues((prev) => ({ ...prev, [item.id]: e.target.value }))
              }
              placeholder="https://..."
              className="flex-1 rounded-xs border border-card-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => handleSaveUrl(item)}
              disabled={!inputValues[item.id]?.trim() || saving === item.id}
              className="rounded-xs bg-primary px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleSkip(item)}
            className="text-xs text-text-muted underline hover:text-text"
          >
            Skip for now
          </button>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        <p className="truncate text-xs text-text-muted">
          Suggested:{" "}
          <a
            href={item.suggested_source}
            target="_blank"
            rel="noreferrer"
            className="text-info underline"
          >
            {item.suggested_source}
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleUseThis(item)}
            disabled={saving === item.id}
            className="rounded-xs bg-accent px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Use This
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(item.id);
              setInputValues((prev) => ({ ...prev, [item.id]: "" }));
            }}
            className="rounded-xs border border-card-border px-3 py-1.5 text-xs font-500 text-text-muted transition-colors hover:text-text"
          >
            Use Different Link
          </button>
          <button
            type="button"
            onClick={() => handleSkip(item)}
            className="text-xs text-text-muted underline hover:text-text"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  function renderPdfInput(item: KnowledgeItem) {
    return (
      <div className="mt-3 space-y-2">
        {item.suggested_source && (
          <p className="truncate text-xs text-text-muted">
            Reference:{" "}
            <a
              href={item.suggested_source}
              target="_blank"
              rel="noreferrer"
              className="text-info underline"
            >
              {item.suggested_source}
            </a>
          </p>
        )}
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSaveFile(item, file.name);
          }}
          className="text-sm text-text-muted file:mr-3 file:rounded-xs file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-500 file:text-primary"
        />
        <button
          type="button"
          onClick={() => handleSkip(item)}
          className="block text-xs text-text-muted underline hover:text-text"
        >
          Skip for now
        </button>
      </div>
    );
  }

  function renderTextInput(item: KnowledgeItem) {
    return (
      <div className="mt-3 space-y-2">
        <textarea
          value={inputValues[item.id] ?? ""}
          onChange={(e) =>
            setInputValues((prev) => ({ ...prev, [item.id]: e.target.value }))
          }
          rows={3}
          placeholder={
            item.type === "DOCUMENT"
              ? "Paste or type document content..."
              : "Add notes or details..."
          }
          className="w-full rounded-xs border border-card-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSaveText(item)}
            disabled={!inputValues[item.id]?.trim() || saving === item.id}
            className="rounded-xs bg-primary px-3 py-1.5 text-xs font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => handleSkip(item)}
            className="text-xs text-text-muted underline hover:text-text"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-xs border border-card-border text-text-muted transition-colors hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-display text-2xl font-600">Document Checklist</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Collect the documents and links your business needs for compliance.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>
            {completedCount} of {items.length} items completed
          </span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card-border">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, var(--color-accent), var(--color-primary))",
            }}
          />
        </div>
      </div>

      {/* Priority groups */}
      <div className="mt-6 space-y-8">
        {PRIORITY_SECTIONS.map(({ key, label, color, bg }) => {
          const groupItems = grouped[key];
          if (groupItems.length === 0) return null;

          return (
            <section key={key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className={`text-sm font-600 ${color}`}>{label}</h2>
                <span
                  className={`rounded-full ${bg} px-2 py-0.5 text-xs font-500 ${color}`}
                >
                  {groupItems.length}
                </span>
              </div>
              <div className="space-y-3">
                {groupItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded border border-card-border bg-card p-4 shadow-sm transition-opacity ${
                      item.status === "skipped" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-600 text-text">
                            {item.title}
                          </h3>
                          {typeBadge(item.type)}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    {renderItemInput(item)}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add your own */}
      <div className="mt-8 border-t border-card-border pt-6">
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm font-500 text-primary transition-colors hover:text-primary-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Add Your Own Item
          </button>
        ) : (
          <div className="rounded border border-card-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-600 text-text">Add Custom Item</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={addForm.title}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Item title"
                className="w-full rounded-xs border border-card-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <textarea
                value={addForm.description}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
                placeholder="Why is this needed? (optional)"
                className="w-full rounded-xs border border-card-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-3">
                <select
                  value={addForm.type}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      type: e.target.value as KnowledgeItem["type"],
                    }))
                  }
                  className="rounded-xs border border-card-border px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="LINK">Link</option>
                  <option value="PDF">PDF</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="OTHER">Other</option>
                </select>
                <select
                  value={addForm.priority}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      priority: e.target.value as KnowledgeItem["priority"],
                    }))
                  }
                  className="rounded-xs border border-card-border px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="REQUIRED">Required</option>
                  <option value="RECOMMENDED">Recommended</option>
                  <option value="OPTIONAL">Optional</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!addForm.title.trim()}
                  className="rounded-xs bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xs border border-card-border px-4 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
