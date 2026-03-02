import { useState } from "react";
import {
  afhSopCategories,
  getChecklistByCategory,
  getChecklistTotal,
} from "../data/afhSopChecklist";
import type { AfhSopCategory, AfhSopChecklistItem } from "../data/afhSopChecklist";
import { useCreateSOP } from "../contexts/CreateSOPContext";

// Category description blurbs
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "daily-ops":
    "Procedures your team runs every shift to keep the home safe and well-documented.",
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
    // Strip leading "How do you " to get a clean SOP title
    const raw = item.question.replace(/\?$/, "");
    const title = raw.replace(/^How do you /i, "").replace(/^What do you do /i, "").replace(/^What are your /i, "");
    // Capitalize first letter
    const sopTitle = title.charAt(0).toUpperCase() + title.slice(1);
    openCreateSOP({ title: sopTitle });
  }

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 120px)", margin: "-32px -32px -32px -32px" }}>
      {/* ── LEFT PANEL: Category sub-menu ─────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-gray-200 bg-white">
        <div className="sticky top-[60px] overflow-y-auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
          {/* Header */}
          <div className="border-b border-gray-100 px-5 py-5">
            <h1 className="text-lg font-700 text-gray-900">SOP Checklist</h1>
            <p className="mt-0.5 text-[13px] text-gray-500">
              0 of {totalItems} done
            </p>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: "0%" }}
              />
            </div>
          </div>

          {/* Category list */}
          <nav className="py-1">
            {afhSopCategories.map((cat) => (
              <CategoryRow
                key={cat.key}
                category={cat}
                isActive={cat.key === selectedKey}
                completedCount={0}
                onClick={() => setSelectedKey(cat.key)}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* ── RIGHT PANEL: Checklist items ──────────────────────────────── */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[#fefdf8] p-8">
        {/* Category header */}
        <div className="mb-6">
          <h2 className="flex items-center gap-2.5 text-xl font-700 text-gray-900">
            <span className="text-xl">{selectedCategory.icon}</span>
            {selectedCategory.label}
          </h2>
          <p className="mt-1.5 text-[14px] text-gray-500">
            {CATEGORY_DESCRIPTIONS[selectedKey] ?? ""}
          </p>

          {/* Category progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: "0%" }}
              />
            </div>
            <span className="shrink-0 text-[13px] font-600 text-gray-500">
              0 of {items.length} done
            </span>
          </div>
        </div>

        {/* Items list — flat rows, no card borders */}
        <div>
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
  isActive,
  completedCount,
  onClick,
}: {
  category: AfhSopCategory;
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
      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition-colors ${
        isActive
          ? "border-l-[3px] border-blue-500 bg-blue-50"
          : "border-l-[3px] border-transparent hover:bg-gray-50"
      }`}
    >
      <span className="text-base leading-none">{category.icon}</span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-600 leading-snug ${
            isActive ? "text-blue-700" : "text-gray-700"
          }`}
        >
          {category.label}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {completedCount} of {total} done
        </p>
      </div>
      {/* Badge */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
          allDone
            ? "bg-green-100 text-green-700"
            : inProgress
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-400"
        }`}
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
    <div className="flex items-start gap-3 rounded-md px-4 py-4 transition-colors hover:bg-gray-50">
      {/* Empty circle */}
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-600 leading-snug text-gray-800">
          {item.question}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-400">
          {item.why}
        </p>
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={onStart}
        className="shrink-0 rounded-md bg-blue-600 px-3.5 py-1.5 text-[12px] font-600 text-white transition-colors hover:bg-blue-700"
      >
        Start This SOP
      </button>
    </div>
  );
}
