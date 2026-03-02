import { useState } from "react";
import {
  afhSopCategories,
  getChecklistByCategory,
  getChecklistTotal,
} from "../data/afhSopChecklist";
import type { AfhSopCategory, AfhSopChecklistItem } from "../data/afhSopChecklist";

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
  const totalItems = getChecklistTotal();
  const selectedCategory = afhSopCategories.find((c) => c.key === selectedKey)!;
  const items = getChecklistByCategory(selectedKey);

  return (
    <div className="flex gap-6" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* ── LEFT PANEL: Category sub-menu ─────────────────────────────── */}
      <div className="w-[260px] shrink-0">
        <div className="sticky top-[76px] rounded-lg border border-gray-200 bg-white">
          {/* Header */}
          <div className="border-b border-gray-100 px-5 py-4">
            <h1 className="text-lg font-700 text-gray-900">SOP Checklist</h1>
            <p className="mt-0.5 text-[13px] text-gray-500">
              0 of {totalItems} done
            </p>
            {/* Overall progress bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: "0%" }}
              />
            </div>
          </div>

          {/* Category list */}
          <nav className="max-h-[calc(100vh-220px)] overflow-y-auto py-1">
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
      <div className="min-w-0 flex-1">
        {/* Category header */}
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-xl font-700 text-gray-900">
            <span>{selectedCategory.icon}</span>
            {selectedCategory.label}
          </h2>
          <p className="mt-1 text-[14px] text-gray-500">
            {CATEGORY_DESCRIPTIONS[selectedKey] ?? ""}
          </p>

          {/* Category progress */}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: "0%" }}
              />
            </div>
            <span className="shrink-0 text-[13px] font-600 text-gray-500">
              0 of {items.length} done
            </span>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-3">
          {items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} />
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
      className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
        isActive
          ? "border-l-[3px] border-blue-600 bg-blue-50"
          : "border-l-[3px] border-transparent hover:bg-gray-50"
      }`}
    >
      <span className="text-base leading-none">{category.icon}</span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] font-600 ${
            isActive ? "text-blue-700" : "text-gray-700"
          }`}
        >
          {category.label}
        </p>
        <p className="text-[11px] text-gray-400">
          {completedCount} of {total} done
        </p>
      </div>
      {/* Badge */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-700 ${
          allDone
            ? "bg-green-100 text-green-700"
            : inProgress
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-400"
        }`}
      >
        {allDone ? "\u2713" : `${completedCount}/${total}`}
      </span>
    </button>
  );
}

function ChecklistItemRow({ item }: { item: AfhSopChecklistItem }) {
  // All items show as "still needed" for now
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-blue-200">
      <div className="flex items-start gap-3">
        {/* Empty circle */}
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300" />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-600 text-gray-800 leading-snug">
            {item.question}
          </p>
          <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">
            {item.why}
          </p>
        </div>

        {/* Action button */}
        <button
          type="button"
          className="shrink-0 rounded-md bg-blue-600 px-3.5 py-1.5 text-[12px] font-600 text-white transition-colors hover:bg-blue-700"
        >
          Start This SOP
        </button>
      </div>
    </div>
  );
}
