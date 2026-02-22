import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useAuth } from "../contexts/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Org {
  id: string;
  name: string;
  industry_type: string | null;
  industry_custom_label: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
}

interface GoverningBody {
  id: string;
  name: string;
  level: string;
  url: string | null;
}

// Local-only type for edit form (no id yet for new entries)
interface GoverningBodyDraft {
  id: string | null;
  name: string;
  level: string;
  url: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const btnPrimary =
  "rounded-sm bg-primary px-5 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50";

const btnSecondary =
  "rounded-sm border border-card-border bg-card px-5 py-2.5 text-sm font-500 text-text-muted transition-colors hover:text-text";

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusinessProfilePage() {
  const { userProfile } = useAuth();

  // Data
  const [org, setOrg] = useState<Org | null>(null);
  const [governingBodies, setGoverningBodies] = useState<GoverningBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editIndustryType, setEditIndustryType] = useState("");
  const [editIndustryCustomLabel, setEditIndustryCustomLabel] = useState("");
  const [editState, setEditState] = useState("");
  const [editCounty, setEditCounty] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editGBs, setEditGBs] = useState<GoverningBodyDraft[]>([]);

  // Add governing body form
  const [gbName, setGbName] = useState("");
  const [gbLevel, setGbLevel] = useState("");
  const [gbUrl, setGbUrl] = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchProfile() {
    if (!userProfile?.org_id) return;

    const [orgResult, gbResult] = await Promise.all([
      supabase.from("orgs").select("*").eq("id", userProfile.org_id).single(),
      supabase
        .from("governing_bodies")
        .select("id, name, level, url")
        .eq("org_id", userProfile.org_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

    if (orgResult.error) {
      logger.error("profile_fetch_error", { message: orgResult.error.message });
      setError(orgResult.error.message);
      setLoading(false);
      return;
    }

    if (gbResult.error) {
      logger.error("profile_fetch_error", { message: gbResult.error.message });
      setError(gbResult.error.message);
      setLoading(false);
      return;
    }

    logger.info("profile_fetch_success", {
      orgId: orgResult.data.id,
      gbCount: gbResult.data.length,
    });

    setOrg(orgResult.data as Org);
    setGoverningBodies(gbResult.data as GoverningBody[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  // ── Enter edit mode ───────────────────────────────────────────────────────

  function startEditing() {
    if (!org) return;
    setEditName(org.name);
    setEditIndustryType(org.industry_type ?? "");
    setEditIndustryCustomLabel(org.industry_custom_label ?? "");
    setEditState(org.state ?? "");
    setEditCounty(org.county ?? "");
    setEditCity(org.city ?? "");
    setEditGBs(
      governingBodies.map((gb) => ({
        id: gb.id,
        name: gb.name,
        level: gb.level,
        url: gb.url ?? "",
      })),
    );
    setGbName("");
    setGbLevel("");
    setGbUrl("");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
  }

  // ── Edit form helpers ─────────────────────────────────────────────────────

  const editValid =
    editName.trim() !== "" &&
    editIndustryType !== "" &&
    (editIndustryType !== "Other" || editIndustryCustomLabel.trim() !== "") &&
    editState !== "" &&
    editCounty.trim() !== "" &&
    editCity.trim() !== "";

  function addGoverningBody() {
    if (!gbName.trim() || !gbLevel) return;
    setEditGBs((prev) => [
      ...prev,
      { id: null, name: gbName.trim(), level: gbLevel, url: gbUrl.trim() },
    ]);
    setGbName("");
    setGbLevel("");
    setGbUrl("");
  }

  function removeGoverningBody(index: number) {
    setEditGBs((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!org || !userProfile?.org_id) return;
    setError("");
    setSaving(true);
    logger.info("profile_update_attempt", { orgId: org.id });

    try {
      // 1. Update org row
      const { error: orgError } = await supabase
        .from("orgs")
        .update({
          name: editName.trim(),
          industry_type: editIndustryType,
          industry_custom_label:
            editIndustryType === "Other" ? editIndustryCustomLabel.trim() : null,
          state: editState,
          county: editCounty.trim(),
          city: editCity.trim(),
        })
        .eq("id", org.id);

      if (orgError) throw orgError;

      // 2. Soft-delete all existing governing bodies
      if (governingBodies.length > 0) {
        const { error: deleteError } = await supabase
          .from("governing_bodies")
          .update({ deleted_at: new Date().toISOString() })
          .eq("org_id", org.id)
          .is("deleted_at", null);

        if (deleteError) throw deleteError;
      }

      // 3. Insert new governing bodies
      if (editGBs.length > 0) {
        const rows = editGBs.map((gb) => ({
          org_id: org.id,
          name: gb.name,
          level: gb.level,
          url: gb.url || null,
        }));

        const { error: insertError } = await supabase
          .from("governing_bodies")
          .insert(rows);

        if (insertError) throw insertError;
      }

      logger.info("profile_update_success", {
        orgId: org.id,
        gbCount: editGBs.length,
      });

      // 4. Re-fetch and exit edit mode
      setEditing(false);
      setSaving(false);
      setLoading(true);
      await fetchProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("profile_update_error", { orgId: org.id, message });
      setError(message);
      setSaving(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const stateLabel =
    US_STATES.find((s) => s.abbr === org?.state)?.name ?? org?.state ?? "—";
  const industryLabel =
    org?.industry_type === "Other"
      ? org.industry_custom_label ?? "Other"
      : org?.industry_type ?? "—";

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Business Profile</h1>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Business Profile</h1>
        {error && (
          <div className="mt-6 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}
        <p className="mt-10 text-center text-sm text-text-muted">
          No organization found.
        </p>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-600">Edit Business Profile</h1>
        </div>

        <div className="mt-6 max-w-[600px] rounded border border-card-border bg-card p-6 shadow">
          {error && (
            <div className="mb-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Org name */}
            <div>
              <label htmlFor="editName" className="mb-1 block text-sm font-500 text-text">
                Organization name <span className="text-warn">*</span>
              </label>
              <input
                id="editName"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Industry type */}
            <div>
              <label htmlFor="editIndustry" className="mb-1 block text-sm font-500 text-text">
                Industry type <span className="text-warn">*</span>
              </label>
              <select
                id="editIndustry"
                value={editIndustryType}
                onChange={(e) => setEditIndustryType(e.target.value)}
                className={inputClass}
              >
                <option value="">Select industry...</option>
                {INDUSTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "Other" ? "Other (Type your own)" : t}
                  </option>
                ))}
              </select>
            </div>

            {editIndustryType === "Other" && (
              <div>
                <label htmlFor="editIndustryCustom" className="mb-1 block text-sm font-500 text-text">
                  Custom industry label <span className="text-warn">*</span>
                </label>
                <input
                  id="editIndustryCustom"
                  type="text"
                  value={editIndustryCustomLabel}
                  onChange={(e) => setEditIndustryCustomLabel(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {/* State */}
            <div>
              <label htmlFor="editState" className="mb-1 block text-sm font-500 text-text">
                State <span className="text-warn">*</span>
              </label>
              <select
                id="editState"
                value={editState}
                onChange={(e) => setEditState(e.target.value)}
                className={inputClass}
              >
                <option value="">Select state...</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* County / City */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="editCounty" className="mb-1 block text-sm font-500 text-text">
                  County <span className="text-warn">*</span>
                </label>
                <input
                  id="editCounty"
                  type="text"
                  value={editCounty}
                  onChange={(e) => setEditCounty(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="editCity" className="mb-1 block text-sm font-500 text-text">
                  City <span className="text-warn">*</span>
                </label>
                <input
                  id="editCity"
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* ── Governing Bodies ────────────────────────────────────────────── */}
            <div className="border-t border-card-border pt-4">
              <h3 className="mb-3 text-sm font-600 text-text">Governing Bodies</h3>

              {/* Add form */}
              <div className="space-y-3">
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
                      className={inputClass}
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
              </div>

              {/* List */}
              {editGBs.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {editGBs.map((gb, i) => (
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

              {editGBs.length === 0 && (
                <p className="mt-3 text-sm text-text-muted">
                  No governing bodies added.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={cancelEditing} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !editValid}
                onClick={handleSave}
                className={btnPrimary}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Read-only view ────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-600">Business Profile</h1>
        <button type="button" onClick={startEditing} className={btnPrimary}>
          Edit Profile
        </button>
      </div>

      <div className="mt-6 max-w-[600px] space-y-6">
        {error && (
          <div className="rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}

        {/* Business Info card */}
        <div className="rounded border border-card-border bg-card p-6 shadow">
          <h2 className="mb-4 text-sm font-600 text-text">Business Info</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Organization</dt>
              <dd className="font-500 text-text">{org.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Industry</dt>
              <dd className="font-500 text-text">{industryLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Location</dt>
              <dd className="font-500 text-text">
                {org.city ?? "—"}, {org.county ?? "—"} County, {stateLabel}
              </dd>
            </div>
          </dl>
        </div>

        {/* Governing Bodies card */}
        <div className="rounded border border-card-border bg-card p-6 shadow">
          <h2 className="mb-4 text-sm font-600 text-text">Governing Bodies</h2>
          {governingBodies.length === 0 ? (
            <p className="text-sm text-text-muted">None configured.</p>
          ) : (
            <ul className="space-y-2">
              {governingBodies.map((gb) => (
                <li
                  key={gb.id}
                  className="rounded-sm border border-card-border px-4 py-2.5 text-sm"
                >
                  <span className="font-500 text-text">{gb.name}</span>
                  <span className="ml-2 text-text-muted">({gb.level})</span>
                  {gb.url && (
                    <a
                      href={gb.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline"
                    >
                      {gb.url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
