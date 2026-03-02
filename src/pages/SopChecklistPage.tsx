import { useState } from "react";
import {
  afhSopCategories,
  getChecklistByCategory,
  getChecklistTotal,
} from "../data/afhSopChecklist";
import type { AfhSopCategory, AfhSopChecklistItem } from "../data/afhSopChecklist";
import { useCreateSOP } from "../contexts/CreateSOPContext";

// Short names for left panel (matching mockup)
const SHORT_NAMES: Record<string, string> = {
  "daily-ops": "Daily Operations",
  medication: "Medication Mgmt",
  "resident-care": "Resident Care",
  "change-condition": "Change in Condition",
  incident: "Incidents & Abuse",
  communication: "Communication",
  safety: "Safety & Emergency",
  staffing: "Staffing & Training",
  admin: "Admin & Compliance",
  admissions: "Admissions & Billing",
  "resident-rights": "Resident Rights",
};

// Category description blurbs for right panel
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "daily-ops":
    "These SOPs cover your home's daily routine, shift changes, and owner oversight.",
  medication:
    "Everything from receiving new orders to disposal — the full medication lifecycle.",
  "resident-care":
    "Service plan compliance, personal care, dietary needs, and ongoing monitoring.",
  "change-condition":
    "Spotting, documenting, and communicating changes in resident health or status.",
  incident:
    "Reporting obligations, abuse prevention, elopement response, and trend tracking.",
  communication:
    "Physician calls, family updates, case manager coordination, and record-keeping.",
  safety:
    "Fire drills, emergency plans, infection control, facility maintenance, and pest control.",
  staffing:
    "Orientation, training hours, background checks, scheduling, and BOLI compliance.",
  admin:
    "Billing, licensing, insurance, provider agreements, and financial record-keeping.",
  admissions:
    "Move-ins, move-outs, Medicaid eligibility, meal plans, and prior authorizations.",
  "resident-rights":
    "Personal property tracking, complaint resolution, and privacy protections.",
};

export default function SopChecklistPage() {
  const [selectedKey, setSelectedKey] = useState(afhSopCategories[0].key);
  const { openCreateSOP } = useCreateSOP();
  const totalItems = getChecklistTotal();
  const selectedCategory = afhSopCategories.find((c) => c.key === selectedKey)!;
  const items = getChecklistByCategory(selectedKey);

  function handleStartSOP(item: AfhSopChecklistItem) {
    const raw = item.question.replace(/\?$/, "");
    const title = raw
      .replace(/^How do you /i, "")
      .replace(/^What do you do /i, "")
      .replace(/^What are your /i, "");
    const sopTitle = title.charAt(0).toUpperCase() + title.slice(1);
    openCreateSOP({ title: sopTitle });
  }

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 120px)", margin: "-32px" }}>
      {/* ── LEFT PANEL: Category sub-menu (260px, matches mockup) ──── */}
      <div className="w-[260px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white" style={{ paddingTop: 20, paddingBottom: 20 }}>
        {/* Header */}
        <div className="border-b border-gray-100 px-4 pb-4" style={{ marginBottom: 8 }}>
          <p className="text-[13px] font-600 uppercase tracking-wide text-gray-400" style={{ letterSpacing: "0.5px", marginBottom: 8 }}>
            SOP Checklist
          </p>
          <p className="mb-2 text-[13px] text-gray-500">
            <strong className="font-700 text-blue-600">0</strong> of <strong className="font-700 text-blue-600">{totalItems}</strong> done
          </p>
          {/* Mini progress bar with gradient */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{ width: "0%", background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }}
            />
          </div>
        </div>

        {/* Category list */}
        <nav>
          {afhSopCategories.map((cat) => (
            <CategoryRow
              key={cat.key}
              category={cat}
              shortName={SHORT_NAMES[cat.key] ?? cat.label}
              isActive={cat.key === selectedKey}
              completedCount={0}
              onClick={() => setSelectedKey(cat.key)}
            />
          ))}
        </nav>
      </div>

      {/* ── RIGHT PANEL: Checklist items (max-width 720px) ────────── */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[#fefdf8]" style={{ padding: "28px 36px" }}>
        {/* Category header */}
        <div style={{ marginBottom: 24 }}>
          <h2 className="flex items-center text-[22px] font-700 tracking-tight text-gray-800" style={{ gap: 10, marginBottom: 4 }}>
            <span className="text-[26px]">{selectedCategory.icon}</span>
            {selectedCategory.label}
          </h2>
          <p className="text-[14px] text-gray-500" style={{ marginLeft: 36 }}>
            {CATEGORY_DESCRIPTIONS[selectedKey] ?? ""}
          </p>

          {/* Category progress bar */}
          <div className="flex items-center" style={{ gap: 12, marginLeft: 36, marginTop: 10 }}>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100" style={{ flex: 1, maxWidth: 200 }}>
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: "0%" }}
              />
            </div>
            <span className="text-[13px] font-600 text-gray-500">
              0 of {items.length} done
            </span>
          </div>
        </div>

        {/* Items list */}
        <div className="flex flex-col" style={{ gap: 2, maxWidth: 720 }}>
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onStart={() => handleStartSOP(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  shortName,
  isActive,
  completedCount,
  onClick,
}: {
  category: AfhSopCategory;
  shortName: string;
  isActive: boolean;
  completedCount: number;
  onClick: () => void;
}) {
  const total = category.count;
  const allDone = completedCount === total && total > 0;
  const inProgress = completedCount > 0 && !allDone;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center border-l-[3px] text-left transition-all ${
        isActive
          ? "border-blue-500 bg-blue-50 font-600 text-blue-700"
          : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800"
      }`}
      style={{ gap: 10, padding: "10px 16px", fontSize: 13 }}
    >
      <span className="shrink-0 text-center" style={{ fontSize: 18, width: 24 }}>
        {category.icon}
      </span>
      <span className="min-w-0 flex-1" style={{ lineHeight: 1.3 }}>
        <span className="block">{shortName}</span>
        <span
          className={`block text-[11px] font-400 ${isActive ? "text-blue-500" : "text-gray-400"}`}
          style={{ marginTop: 1 }}
        >
          {completedCount} of {total} done
        </span>
      </span>
      {/* Badge */}
      <span
        className={`shrink-0 rounded-full text-[11px] font-600 ${
          allDone
            ? "bg-green-100 text-green-700"
            : inProgress
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-400"
        }`}
        style={{ padding: "1px 7px" }}
      >
        {allDone ? "\u2713" : `${completedCount}/${total}`}
      </span>
    </button>
  );
}

function ChecklistItemRow({
  item,
  onStart,
}: {
  item: AfhSopChecklistItem;
  onStart: () => void;
}) {
  return (
    <div
      className="flex items-start rounded-lg transition-colors hover:bg-white"
      style={{ gap: 14, padding: 16 }}
    >
      {/* Empty circle */}
      <div
        className="mt-px shrink-0 rounded-full border-2 border-gray-300"
        style={{ width: 26, height: 26 }}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-500 leading-snug text-gray-800" style={{ marginBottom: 3 }}>
          {item.question}
        </p>
        <p className="text-[13px] leading-snug text-gray-400">
          {item.why}
        </p>
      </div>

      {/* Action button */}
      <div className="mt-px shrink-0">
        <button
          type="button"
          onClick={onStart}
          className="flex items-center whitespace-nowrap rounded-lg bg-blue-600 text-[13px] font-600 text-white transition-colors hover:bg-blue-700"
          style={{ gap: 6, padding: "7px 14px" }}
        >
          🎤 Start This SOP
        </button>
      </div>
    </div>
  );
}
