import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCreateSOP } from "../contexts/CreateSOPContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReadinessItem {
  id: string;
  org_id: string;
  group_key: string;
  group_label: string;
  sort_order: number;
  title: string;
  description: string | null;
  status: "ready" | "needs_training" | null;
  is_custom: boolean;
  source: string;
  linked_sop_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface GroupConfig {
  key: string;
  label: string;
  icon: JSX.Element;
}

// ── Group config ───────────────────────────────────────────────────────────

const GROUPS: GroupConfig[] = [
  {
    key: "paperwork",
    label: "Paperwork & Documents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
  },
  {
    key: "training",
    label: "Required Training",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
  {
    key: "skills",
    label: "Skills",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
  {
    key: "on_the_job",
    label: "On-the-Job Readiness",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// ── Default seed items ─────────────────────────────────────────────────────

const DEFAULT_ITEMS: Omit<ReadinessItem, "id" | "org_id" | "created_at" | "updated_at" | "deleted_at" | "linked_sop_id">[] = [
  // Paperwork & Documents
  { group_key: "paperwork", group_label: "Paperwork & Documents", sort_order: 0, title: "DHS background check approved", description: "State-required background check must be approved before manager can work unsupervised", status: null, is_custom: false, source: "default" },
  { group_key: "paperwork", group_label: "Paperwork & Documents", sort_order: 1, title: "Orientation record signed (APD 0349)", description: "Official state orientation form documenting new employee orientation completion", status: null, is_custom: false, source: "default" },
  { group_key: "paperwork", group_label: "Paperwork & Documents", sort_order: 2, title: "Caregiver Preparatory Study Guide reviewed (DHS 9030)", description: "State-required study guide covering basic caregiving knowledge and expectations", status: null, is_custom: false, source: "default" },
  { group_key: "paperwork", group_label: "Paperwork & Documents", sort_order: 3, title: "DHS notified of new Resident Manager", description: "Notify DHS of new manager appointment within required timeframe", status: null, is_custom: false, source: "default" },
  { group_key: "paperwork", group_label: "Paperwork & Documents", sort_order: 4, title: "Employment paperwork completed (W-4, I-9, Oregon new hire)", description: "Federal and state employment forms including tax withholding and work eligibility", status: null, is_custom: false, source: "default" },

  // Required Training
  { group_key: "training", group_label: "Required Training", sort_order: 0, title: "CPR & First Aid certified (in-person only)", description: "Must be in-person certification from approved provider, not online-only", status: null, is_custom: false, source: "default" },
  { group_key: "training", group_label: "Required Training", sort_order: 1, title: "Ensuring Quality Care (EQC) completed", description: "Oregon-required training covering quality standards for care facilities", status: null, is_custom: false, source: "default" },
  { group_key: "training", group_label: "Required Training", sort_order: 2, title: "HCBS/IBL training completed", description: "Home and Community-Based Services / Independent Business License training", status: null, is_custom: false, source: "default" },
  { group_key: "training", group_label: "Required Training", sort_order: 3, title: "Dementia Care training completed", description: "Required training on caring for residents with dementia and cognitive impairment", status: null, is_custom: false, source: "default" },
  { group_key: "training", group_label: "Required Training", sort_order: 4, title: "Inclusive Care training completed", description: "Training on providing culturally responsive and inclusive care", status: null, is_custom: false, source: "default" },

  // Skills
  { group_key: "skills", group_label: "Skills", sort_order: 0, title: "Medication administration (6 rights)", description: "Demonstrates correct medication admin: right person, drug, dose, time, route, documentation", status: null, is_custom: false, source: "default" },
  { group_key: "skills", group_label: "Skills", sort_order: 1, title: "Emergency evacuation procedures", description: "Knows evacuation routes, fire extinguisher locations, and emergency protocols", status: null, is_custom: false, source: "default" },
  { group_key: "skills", group_label: "Skills", sort_order: 2, title: "Abuse recognition & mandatory reporting", description: "Can identify signs of abuse/neglect and knows mandatory reporting procedures", status: null, is_custom: false, source: "default" },
  { group_key: "skills", group_label: "Skills", sort_order: 3, title: "Person-centered care approach", description: "Understands and demonstrates individualized, person-centered care techniques", status: null, is_custom: false, source: "default" },
  { group_key: "skills", group_label: "Skills", sort_order: 4, title: "Proper body mechanics for transfers", description: "Demonstrates safe lifting and transfer techniques to prevent injury", status: null, is_custom: false, source: "default" },
  { group_key: "skills", group_label: "Skills", sort_order: 5, title: "Behavioral support techniques", description: "Understands de-escalation and positive behavioral support strategies", status: null, is_custom: false, source: "default" },

  // On-the-Job Readiness
  { group_key: "on_the_job", group_label: "On-the-Job Readiness", sort_order: 0, title: "Shadowed at least 2–3 full shifts", description: "New manager has observed experienced staff through multiple complete shifts", status: null, is_custom: false, source: "default" },
  { group_key: "on_the_job", group_label: "On-the-Job Readiness", sort_order: 1, title: "Knows each resident's care plan", description: "Can describe key care needs, preferences, and routines for each resident", status: null, is_custom: false, source: "default" },
  { group_key: "on_the_job", group_label: "On-the-Job Readiness", sort_order: 2, title: "Knows where everything is in the home", description: "Familiar with location of supplies, medications, emergency equipment, and documents", status: null, is_custom: false, source: "default" },
  { group_key: "on_the_job", group_label: "On-the-Job Readiness", sort_order: 3, title: "30-day check-in completed", description: "Formal check-in meeting conducted within 30 days of start date", status: null, is_custom: false, source: "default" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function progressMessage(pct: number, name: string): string {
  if (pct === 0) return "Tap Ready or Needs Training to get started.";
  if (pct < 25) return "Off to a good start!";
  if (pct < 50) return "Making progress — keep going!";
  if (pct < 75) return `${name} is getting there!`;
  if (pct < 100) return "Almost ready — just a few more!";
  return `${name} is fully ready!`;
}

// ── Confetti component ──────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const colors = ["#D4764E", "#4A8B6E", "#5B8DB8", "#7B6BA1", "#C9544A"];
    const color = colors[i % colors.length];
    const left = 8 + Math.random() * 84;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 6;
    return (
      <div
        key={i}
        className="confetti-piece absolute rounded-xs"
        style={{
          left: `${left}%`,
          top: -10,
          width: size,
          height: size,
          backgroundColor: color,
          animationDelay: `${delay}s`,
        }}
      />
    );
  });
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{pieces}</div>;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ManagerReadinessPage() {
  const { userProfile } = useAuth();
  const { openCreateSOP } = useCreateSOP();
  const { showToast } = useToast();

  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [managerName, setManagerName] = useState("Juan");
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevAllReadyRef = useRef(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add item state
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const orgId = userProfile?.org_id;

  // ── Derived stats ───────────────────────────────────────────────────

  const activeItems = items.filter((i) => !i.deleted_at);
  const readyCount = activeItems.filter((i) => i.status === "ready").length;
  const needsTrainingCount = activeItems.filter((i) => i.status === "needs_training").length;
  const notAssessedCount = activeItems.filter((i) => !i.status).length;
  const totalCount = activeItems.length;
  const pctReady = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const allReady = totalCount > 0 && readyCount === totalCount;

  // ── Celebration trigger ─────────────────────────────────────────────

  useEffect(() => {
    if (allReady && !prevAllReadyRef.current && !loading) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2500);
      return () => clearTimeout(timer);
    }
    prevAllReadyRef.current = allReady;
  }, [allReady, loading]);

  // ── Load data ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!orgId) return;

    async function load() {
      // Fetch manager name
      const { data: orgData } = await supabase
        .from("orgs")
        .select("manager_name")
        .eq("id", orgId)
        .single();
      if (orgData?.manager_name) setManagerName(orgData.manager_name);

      // Fetch existing items
      const { data: existing, error } = await supabase
        .from("manager_readiness_items")
        .select("*")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("readiness_fetch_error", { message: error.message });
        showToast("Failed to load readiness items", "error");
        setLoading(false);
        return;
      }

      if (existing && existing.length > 0) {
        setItems(existing as ReadinessItem[]);
        logger.info("readiness_loaded", { count: existing.length });
        setLoading(false);
        return;
      }

      // Seed default items
      const toInsert = DEFAULT_ITEMS.map((item) => ({ ...item, org_id: orgId }));
      const { data: seeded, error: seedErr } = await supabase
        .from("manager_readiness_items")
        .insert(toInsert)
        .select();

      if (seedErr) {
        logger.error("readiness_seed_error", { message: seedErr.message });
        showToast("Failed to create checklist", "error");
        setLoading(false);
        return;
      }

      setItems((seeded ?? []) as ReadinessItem[]);
      logger.info("readiness_seeded", { count: seeded?.length });
      showToast("Readiness checklist created!", "success");
      setLoading(false);
    }

    load();
  }, [orgId]);

  // ── Toggle item status ──────────────────────────────────────────────

  async function toggleStatus(item: ReadinessItem, target: "ready" | "needs_training") {
    const newStatus = item.status === target ? null : target;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );

    const { error } = await supabase
      .from("manager_readiness_items")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (error) {
      // Revert
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)),
      );
      showToast("Failed to update status", "error");
    }
  }

  // ── Edit item ───────────────────────────────────────────────────────

  function startEdit(item: ReadinessItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.description ?? "");
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return;

    const { error } = await supabase
      .from("manager_readiness_items")
      .update({ title: editTitle.trim(), description: editDesc.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", editingId);

    if (error) {
      showToast("Failed to save changes", "error");
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId
          ? { ...i, title: editTitle.trim(), description: editDesc.trim() || null }
          : i,
      ),
    );
    setEditingId(null);
    showToast("Item updated", "success");
  }

  // ── Delete item ─────────────────────────────────────────────────────

  async function deleteItem(id: string) {
    const { error } = await supabase
      .from("manager_readiness_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      showToast("Failed to delete item", "error");
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, deleted_at: new Date().toISOString() } : i)));
    showToast("Item removed", "success");
  }

  // ── Add item ────────────────────────────────────────────────────────

  async function addItem(groupKey: string) {
    if (!addTitle.trim() || !orgId) return;

    const group = GROUPS.find((g) => g.key === groupKey);
    const groupItems = activeItems.filter((i) => i.group_key === groupKey);
    const maxSort = groupItems.reduce((max, i) => Math.max(max, i.sort_order), -1);

    const { data, error } = await supabase
      .from("manager_readiness_items")
      .insert({
        org_id: orgId,
        group_key: groupKey,
        group_label: group?.label ?? groupKey,
        sort_order: maxSort + 1,
        title: addTitle.trim(),
        description: addDesc.trim() || null,
        status: null,
        is_custom: true,
        source: "custom",
      })
      .select()
      .single();

    if (error || !data) {
      showToast("Failed to add item", "error");
      return;
    }

    setItems((prev) => [...prev, data as ReadinessItem]);
    setAddingGroup(null);
    setAddTitle("");
    setAddDesc("");
    showToast("Item added", "success");
  }

  // ── Loading state ───────────────────────────────────────────────────

  if (loading) {
    return <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>;
  }

  // ── Progress ring SVG ───────────────────────────────────────────────

  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - pctReady / 100);
  const ringColor = allReady ? "var(--color-accent)" : "var(--color-primary)";

  return (
    <div className="relative">
      {/* Celebration overlay */}
      {showCelebration && <Confetti />}

      {/* Page header */}
      <h1 className="font-display text-2xl font-600">
        Is {managerName} Ready?
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Track readiness across paperwork, training, skills, and on-the-job tasks.
      </p>

      {/* ── Needs Training Banner ──────────────────────────────────── */}
      {needsTrainingCount > 0 && (
        <div className="mt-5 flex items-center gap-3 rounded border border-warn/30 bg-warn-light px-4 py-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm font-500 text-warn">
            {needsTrainingCount} item{needsTrainingCount > 1 ? "s" : ""} need{needsTrainingCount === 1 ? "s" : ""} training — consider creating SOPs to help {managerName} get up to speed.
          </p>
        </div>
      )}

      {/* ── Progress ring + stats ──────────────────────────────────── */}
      <div className={`mt-6 flex items-center gap-6 rounded border border-card-border bg-card p-6 shadow ${allReady ? "celebrate-bounce" : ""}`}>
        {/* SVG ring */}
        <div className="relative shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Track */}
            <circle
              cx="64"
              cy="64"
              r={ringRadius}
              fill="none"
              stroke="var(--color-card-border)"
              strokeWidth="10"
            />
            {/* Fill */}
            <circle
              cx="64"
              cy="64"
              r={ringRadius}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.4s ease" }}
            />
            {/* Text */}
            <text x="64" y="58" textAnchor="middle" className="text-2xl font-700" fill="var(--color-text)" style={{ fontSize: 28, fontWeight: 700 }}>
              {pctReady}%
            </text>
            <text x="64" y="78" textAnchor="middle" fill="var(--color-text-muted)" style={{ fontSize: 12 }}>
              ready
            </text>
          </svg>
          {allReady && (
            <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white text-xs">
              ✓
            </div>
          )}
        </div>

        {/* Stats + message */}
        <div className="flex-1">
          <p className="text-lg font-600 text-text">{progressMessage(pctReady, managerName)}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              {readyCount} ready
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-warn" />
              {needsTrainingCount} need training
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-card-border" />
              {notAssessedCount} not assessed
            </span>
          </div>
        </div>
      </div>

      {/* ── Checklist groups ───────────────────────────────────────── */}
      <div className="mt-8 space-y-6">
        {GROUPS.map((group) => {
          const groupItems = activeItems
            .filter((i) => i.group_key === group.key)
            .sort((a, b) => a.sort_order - b.sort_order);
          const groupReady = groupItems.filter((i) => i.status === "ready").length;
          const groupNeedsTraining = groupItems.filter((i) => i.status === "needs_training").length;
          const groupTotal = groupItems.length;

          let badgeText: string;
          let badgeStyle: string;
          if (groupTotal === 0) {
            badgeText = "No items";
            badgeStyle = "bg-bg text-text-muted";
          } else if (groupReady === groupTotal) {
            badgeText = "All ready";
            badgeStyle = "bg-accent-light text-accent";
          } else if (groupNeedsTraining > 0) {
            badgeText = `${groupReady} ready · ${groupNeedsTraining} need training`;
            badgeStyle = "bg-warn-light text-warn";
          } else if (groupReady > 0) {
            badgeText = `${groupReady} of ${groupTotal} ready`;
            badgeStyle = "bg-accent-light text-accent";
          } else {
            badgeText = "Not assessed yet";
            badgeStyle = "bg-bg text-text-muted";
          }

          return (
            <div key={group.key} className="rounded border border-card-border bg-card shadow">
              {/* Group header */}
              <div className="flex items-center gap-3 border-b border-card-border px-5 py-4">
                <span className="text-text-muted">{group.icon}</span>
                <h2 className="flex-1 font-display text-base font-600 text-text">{group.label}</h2>
                <span className={`rounded-xs px-2.5 py-0.5 text-xs font-500 ${badgeStyle}`}>
                  {badgeText}
                </span>
              </div>

              {/* Items */}
              <ul>
                {groupItems.map((item) => (
                  <li
                    key={item.id}
                    className="group flex items-start gap-3 border-b border-card-border/50 px-5 py-3.5 last:border-b-0"
                  >
                    {editingId === item.id ? (
                      /* ── Inline edit form ─────────────────────────── */
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-sm border border-card-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full rounded-sm border border-card-border bg-bg px-3 py-1.5 text-xs text-text-muted outline-none focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded-sm bg-primary px-3 py-1 text-xs font-500 text-white hover:bg-primary-hover"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-sm px-3 py-1 text-xs font-500 text-text-muted hover:text-text"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal item display ──────────────────────── */
                      <>
                        {/* Item text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-500 ${item.status === "ready" ? "text-accent" : item.status === "needs_training" ? "text-warn" : "text-text"}`}>
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{item.description}</p>
                          )}
                          {/* Create SOP / View SOP button */}
                          {item.linked_sop_id ? (
                            <Link
                              to={`/sops/${item.linked_sop_id}`}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-accent-light px-2.5 py-1 text-xs font-500 text-accent transition-colors hover:bg-accent hover:text-white"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              View SOP
                            </Link>
                          ) : item.status === "needs_training" ? (
                            <button
                              type="button"
                              onClick={() => openCreateSOP({ title: item.title, readinessItemId: item.id })}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-primary-light px-2.5 py-1 text-xs font-500 text-primary transition-colors hover:bg-primary hover:text-white"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v8M8 12h8" />
                              </svg>
                              Create SOP for this
                            </button>
                          ) : null}
                        </div>

                        {/* Edit / Delete buttons (visible on hover) */}
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-text-light transition-colors hover:bg-bg hover:text-text"
                            aria-label="Edit item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-text-light transition-colors hover:bg-warn-light hover:text-warn"
                            aria-label="Delete item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>

                        {/* Toggle buttons */}
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleStatus(item, "ready")}
                            className={`rounded-sm px-3 py-1.5 text-xs font-600 transition-colors ${
                              item.status === "ready"
                                ? "bg-accent text-white"
                                : "border border-card-border bg-card text-text-muted hover:border-accent hover:text-accent"
                            }`}
                          >
                            Ready
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(item, "needs_training")}
                            className={`rounded-sm px-3 py-1.5 text-xs font-600 transition-colors ${
                              item.status === "needs_training"
                                ? "bg-warn text-white"
                                : "border border-card-border bg-card text-text-muted hover:border-warn hover:text-warn"
                            }`}
                          >
                            Needs Training
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}

                {/* Add item row */}
                {addingGroup === group.key ? (
                  <li className="border-b border-card-border/50 px-5 py-3.5 last:border-b-0">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        placeholder="Item title"
                        className="w-full rounded-sm border border-card-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && addTitle.trim()) addItem(group.key);
                          if (e.key === "Escape") { setAddingGroup(null); setAddTitle(""); setAddDesc(""); }
                        }}
                      />
                      <input
                        type="text"
                        value={addDesc}
                        onChange={(e) => setAddDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full rounded-sm border border-card-border bg-bg px-3 py-1.5 text-xs text-text-muted outline-none focus:border-primary"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && addTitle.trim()) addItem(group.key);
                          if (e.key === "Escape") { setAddingGroup(null); setAddTitle(""); setAddDesc(""); }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addItem(group.key)}
                          disabled={!addTitle.trim()}
                          className="rounded-sm bg-primary px-3 py-1 text-xs font-500 text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingGroup(null); setAddTitle(""); setAddDesc(""); }}
                          className="rounded-sm px-3 py-1 text-xs font-500 text-text-muted hover:text-text"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => { setAddingGroup(group.key); setAddTitle(""); setAddDesc(""); }}
                      className="flex items-center gap-1.5 text-xs font-500 text-text-muted transition-colors hover:text-primary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      Add item
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
