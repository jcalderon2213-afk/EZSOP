import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useAuth } from "../contexts/AuthContext";

// ── US States ──────────────────────────────────────────────────────────────────

const US_STATES = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

const INDUSTRY_TYPES = [
  "Adult Foster Home",
  "Residential Care Facility",
  "Assisted Living Facility",
  "In-Home Care Agency",
  "Daycare",
  "Group Home",
  "Healthcare Clinic",
  "Other",
];

const GB_LEVELS = ["federal", "state", "county", "local"] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface GoverningBody {
  name: string;
  level: string;
  url: string;
}

// ── Stepper ────────────────────────────────────────────────────────────────────

const STEPS = ["Business Info", "Governing Bodies", "Confirmation"];

function Stepper({ current }: { current: number }) {
  return (
    <nav className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <span className="text-text-light">&rarr;</span>}
          <span
            className={`rounded-sm px-3 py-1.5 text-sm font-500 ${
              i === current
                ? "bg-primary text-white"
                : "border border-card-border bg-card text-text-muted"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </nav>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const selectClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const btnPrimary =
  "rounded-sm bg-primary px-5 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50";

const btnSecondary =
  "rounded-sm border border-card-border bg-card px-5 py-2.5 text-sm font-500 text-text-muted transition-colors hover:text-text";

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { userProfile, refreshProfile } = useAuth();

  // Wizard step
  const [step, setStep] = useState(0);

  // Step 1 — Business Info
  const [orgName, setOrgName] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [industryCustomLabel, setIndustryCustomLabel] = useState("");
  const [usState, setUsState] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");

  // Step 2 — Governing Bodies
  const [governingBodies, setGoverningBodies] = useState<GoverningBody[]>([]);
  const [gbName, setGbName] = useState("");
  const [gbLevel, setGbLevel] = useState("");
  const [gbUrl, setGbUrl] = useState("");
  const [showConfirmNone, setShowConfirmNone] = useState(false);

  // Step 3 — Submission
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Step navigation ──────────────────────────────────────────────────────────

  function goNext() {
    logger.info("onboarding_step_changed", { step: step + 1 });
    setStep((s) => s + 1);
  }

  function goBack() {
    logger.info("onboarding_step_changed", { step: step - 1 });
    setStep((s) => s - 1);
  }

  // ── Step 1 validation ────────────────────────────────────────────────────────

  const step1Valid =
    orgName.trim() !== "" &&
    industryType !== "" &&
    (industryType !== "Other" || industryCustomLabel.trim() !== "") &&
    usState !== "" &&
    county.trim() !== "" &&
    city.trim() !== "";

  // ── Step 2 — add / remove governing bodies ──────────────────────────────────

  function addGoverningBody() {
    if (!gbName.trim() || !gbLevel) return;
    setGoverningBodies((prev) => [...prev, { name: gbName.trim(), level: gbLevel, url: gbUrl.trim() }]);
    setGbName("");
    setGbLevel("");
    setGbUrl("");
  }

  function removeGoverningBody(index: number) {
    setGoverningBodies((prev) => prev.filter((_, i) => i !== index));
  }

  function handleStep2Next() {
    if (governingBodies.length === 0) {
      setShowConfirmNone(true);
    } else {
      goNext();
    }
  }

  // ── Step 3 — finish setup ────────────────────────────────────────────────────

  async function handleFinish() {
    setError("");
    setSaving(true);

    try {
      // 1. Create org
      const { data: org, error: orgError } = await supabase
        .from("orgs")
        .insert({
          name: orgName.trim(),
          industry_type: industryType,
          industry_custom_label: industryType === "Other" ? industryCustomLabel.trim() : null,
          state: usState,
          county: county.trim(),
          city: city.trim(),
        })
        .select()
        .single();

      if (orgError) throw orgError;
      logger.info("onboarding_org_created", { orgId: org.id });

      // 2. Insert governing bodies
      if (governingBodies.length > 0) {
        const rows = governingBodies.map((gb) => ({
          org_id: org.id,
          name: gb.name,
          level: gb.level,
          url: gb.url || null,
        }));

        const { error: gbError } = await supabase.from("governing_bodies").insert(rows);
        if (gbError) throw gbError;
        logger.info("onboarding_governing_bodies_saved", { count: governingBodies.length });
      }

      // 3. Update user with org_id
      if (userProfile) {
        const { error: userError } = await supabase
          .from("users")
          .update({ org_id: org.id })
          .eq("id", userProfile.id);

        if (userError) throw userError;
        logger.info("onboarding_user_updated", { userId: userProfile.id, orgId: org.id });
      }

      // 4. Refresh auth context so route guard sees org_id
      await refreshProfile();

      logger.info("onboarding_complete");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("onboarding_error", { message });
      setError(message);
      setSaving(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const stateLabel = US_STATES.find((s) => s.abbr === usState)?.name ?? usState;
  const industryLabel = industryType === "Other" ? industryCustomLabel : industryType;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[580px] rounded bg-card border border-card-border shadow p-8">
        {/* Logo */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-700 tracking-tight">
            <span className="text-text">EZ</span>
            <span className="text-primary">SOP</span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">Business Profile Setup</p>
        </div>

        <Stepper current={step} />

        {/* ── Step 1: Business Info ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="orgName" className="mb-1 block text-sm font-500 text-text">
                Organization name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputClass}
                placeholder="Sunny Acres Care Home"
              />
            </div>

            <div>
              <label htmlFor="industryType" className="mb-1 block text-sm font-500 text-text">
                Industry type
              </label>
              <select
                id="industryType"
                value={industryType}
                onChange={(e) => setIndustryType(e.target.value)}
                className={selectClass}
              >
                <option value="">Select industry...</option>
                {INDUSTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "Other" ? "Other (Type your own)" : t}
                  </option>
                ))}
              </select>
            </div>

            {industryType === "Other" && (
              <div>
                <label htmlFor="industryCustom" className="mb-1 block text-sm font-500 text-text">
                  Custom industry label
                </label>
                <input
                  id="industryCustom"
                  type="text"
                  required
                  value={industryCustomLabel}
                  onChange={(e) => setIndustryCustomLabel(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Memory Care Facility"
                />
              </div>
            )}

            <div>
              <label htmlFor="usState" className="mb-1 block text-sm font-500 text-text">
                State
              </label>
              <select
                id="usState"
                value={usState}
                onChange={(e) => setUsState(e.target.value)}
                className={selectClass}
              >
                <option value="">Select state...</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="county" className="mb-1 block text-sm font-500 text-text">
                  County
                </label>
                <input
                  id="county"
                  type="text"
                  required
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className={inputClass}
                  placeholder="Multnomah"
                />
              </div>
              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-500 text-text">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                  placeholder="Portland"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" disabled={!step1Valid} onClick={goNext} className={btnPrimary}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Governing Bodies ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Confirm-none prompt */}
            {showConfirmNone && (
              <div className="rounded-sm border border-card-border bg-primary-light px-4 py-4 text-sm">
                <p className="font-500 text-text">
                  Are you sure your business is not regulated by any governing body?
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmNone(false)}
                    className={btnSecondary}
                  >
                    Add Governing Body
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmNone(false);
                      goNext();
                    }}
                    className={btnPrimary}
                  >
                    Confirm None Apply
                  </button>
                </div>
              </div>
            )}

            {/* Add form */}
            {!showConfirmNone && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="gbName" className="mb-1 block text-sm font-500 text-text">
                      Name
                    </label>
                    <input
                      id="gbName"
                      type="text"
                      value={gbName}
                      onChange={(e) => setGbName(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. OSHA"
                    />
                  </div>
                  <div>
                    <label htmlFor="gbLevel" className="mb-1 block text-sm font-500 text-text">
                      Level
                    </label>
                    <select
                      id="gbLevel"
                      value={gbLevel}
                      onChange={(e) => setGbLevel(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select level...</option>
                      {GB_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="gbUrl" className="mb-1 block text-sm font-500 text-text">
                    URL <span className="text-text-light">(optional)</span>
                  </label>
                  <input
                    id="gbUrl"
                    type="text"
                    value={gbUrl}
                    onChange={(e) => setGbUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </div>

                <button
                  type="button"
                  disabled={!gbName.trim() || !gbLevel}
                  onClick={addGoverningBody}
                  className={btnSecondary + " disabled:opacity-50"}
                >
                  + Add
                </button>
              </>
            )}

            {/* List */}
            {governingBodies.length > 0 && (
              <ul className="space-y-2 border-t border-card-border pt-4">
                {governingBodies.map((gb, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-sm border border-card-border bg-card px-4 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-500 text-text">{gb.name}</span>
                      <span className="ml-2 text-text-muted">({gb.level})</span>
                      {gb.url && (
                        <span className="ml-2 text-text-light">{gb.url}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGoverningBody(i)}
                      className="text-sm text-warn hover:text-warn transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={goBack} className={btnSecondary}>
                Back
              </button>
              <button type="button" onClick={handleStep2Next} className={btnPrimary}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirmation ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            {error && (
              <div className="rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
                {error}
              </div>
            )}

            {/* Business info summary */}
            <div className="rounded-sm border border-card-border p-4">
              <h3 className="mb-3 text-sm font-600 text-text">Business Info</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Organization</dt>
                  <dd className="font-500 text-text">{orgName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Industry</dt>
                  <dd className="font-500 text-text">{industryLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Location</dt>
                  <dd className="font-500 text-text">
                    {city}, {county} County, {stateLabel}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Governing bodies summary */}
            <div className="rounded-sm border border-card-border p-4">
              <h3 className="mb-3 text-sm font-600 text-text">Governing Bodies</h3>
              {governingBodies.length === 0 ? (
                <p className="text-sm text-text-muted">None &mdash; confirmed by user</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {governingBodies.map((gb, i) => (
                    <li
                      key={i}
                      className="rounded-sm border border-card-border bg-card px-4 py-2.5"
                    >
                      <span className="font-500 text-text">{gb.name}</span>
                      <span className="ml-2 text-text-muted">({gb.level})</span>
                      {gb.url && (
                        <span className="ml-2 text-text-light">{gb.url}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={goBack} className={btnSecondary}>
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className={btnPrimary}
              >
                {saving ? "Saving..." : "Finish Setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
