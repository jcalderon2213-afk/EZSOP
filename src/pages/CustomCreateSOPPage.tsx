import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

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

export default function CustomCreateSOPPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [purpose, setPurpose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    logger.info("sop_create_attempt", { title });

    const { data, error: insertError } = await supabase
      .from("sops")
      .insert({
        title: title.trim(),
        category: category.trim() || null,
        purpose: purpose.trim() || null,
        frequency: frequency || null,
        status: "draft",
        org_id: userProfile!.org_id,
        created_by: userProfile!.id,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("sop_create_error", { message: insertError.message });
      setError(insertError.message);
      showToast(insertError.message, "error");
      setSaving(false);
      return;
    }

    logger.info("sop_create_success", { sopId: data.id });
    showToast("SOP created", "success");
    navigate(`/sops/${data.id}`, { replace: true });
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-600">Create Custom SOP</h1>

      <div className="mt-6 max-w-[600px] rounded border border-card-border bg-card p-6 shadow">
        {error && (
          <div className="mb-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-500 text-text">
              Title <span className="text-warn">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Morning Medication Administration"
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-500 text-text">
              Category
            </label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              placeholder="e.g. Health & Safety"
            />
          </div>

          <div>
            <label htmlFor="purpose" className="mb-1 block text-sm font-500 text-text">
              Purpose
            </label>
            <textarea
              id="purpose"
              rows={4}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={inputClass + " resize-y"}
              placeholder="Describe the purpose of this SOP..."
            />
          </div>

          <div>
            <label htmlFor="frequency" className="mb-1 block text-sm font-500 text-text">
              Frequency
            </label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className={inputClass}
            >
              <option value="">Select frequency...</option>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/sops/create"
              className="rounded-sm border border-card-border bg-card px-5 py-2.5 text-sm font-500 text-text-muted transition-colors hover:text-text"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-sm bg-primary px-5 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create SOP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
