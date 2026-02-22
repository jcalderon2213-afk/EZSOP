import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import BuildStepper from "../components/BuildStepper";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RefLink {
  url: string;
  label: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContextUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sopTitle, setSopTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [links, setLinks] = useState<RefLink[]>([{ url: "", label: "" }]);
  const [regulationText, setRegulationText] = useState("");

  // ── Fetch SOP title ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    async function fetchSOP() {
      const { data, error } = await supabase
        .from("sops")
        .select("title")
        .eq("id", id)
        .single();

      if (error) {
        logger.error("context_upload_fetch_error", { message: error.message });
      } else {
        setSopTitle(data.title);
      }
      setLoading(false);
    }

    fetchSOP();

    // Restore from localStorage if exists
    const stored = localStorage.getItem(`sop-context-${id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.links) && parsed.links.length > 0) {
          setLinks(parsed.links);
        }
        if (parsed.regulationText) {
          setRegulationText(parsed.regulationText);
        }
      } catch {
        // Ignore corrupted data
      }
    }
  }, [id]);

  // ── Link management ─────────────────────────────────────────────────────

  function updateLink(index: number, field: "url" | "label", value: string) {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  }

  function addLink() {
    setLinks((prev) => [...prev, { url: "", label: "" }]);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Save & navigate ─────────────────────────────────────────────────────

  function handleContinue() {
    // Filter out empty links
    const validLinks = links.filter((l) => l.url.trim() || l.label.trim());

    localStorage.setItem(
      `sop-context-${id}`,
      JSON.stringify({
        links: validLinks,
        regulationText: regulationText.trim(),
      }),
    );

    logger.info("context_upload_saved", {
      sopId: id,
      linkCount: validLinks.length,
      hasText: regulationText.trim().length > 0,
    });

    navigate(`/sops/${id}/build/voice`);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/sops/${id}`}
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to SOP
      </Link>

      <h1 className="mt-4 font-display text-2xl font-600">
        {sopTitle || "Context & Upload"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Add reference materials and regulation text for this SOP.
      </p>

      <div className="mt-6 max-w-[700px]">
        <BuildStepper currentStep={0} />

        {/* ── Reference Links ──────────────────────────────────────────── */}
        <div className="rounded border border-card-border bg-card p-6 shadow">
          <h2 className="text-sm font-600 text-text">Reference Links</h2>
          <p className="mt-1 text-xs text-text-muted">
            Add links to regulations, guidelines, or reference documents.
          </p>

          <div className="mt-4 space-y-3">
            {links.map((link, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                  />
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(i, "label", e.target.value)}
                    className={inputClass}
                    placeholder="Label (e.g. OSHA Guidelines)"
                  />
                </div>
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="mt-2 text-sm text-warn hover:text-warn transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLink}
            className="mt-3 text-sm font-500 text-primary transition-colors hover:text-primary-hover"
          >
            + Add Link
          </button>
        </div>

        {/* ── Regulation Text ──────────────────────────────────────────── */}
        <div className="mt-6 rounded border border-card-border bg-card p-6 shadow">
          <h2 className="text-sm font-600 text-text">Regulation Text</h2>
          <p className="mt-1 text-xs text-text-muted">
            Paste relevant regulation or guideline text directly.
          </p>

          <textarea
            rows={8}
            value={regulationText}
            onChange={(e) => setRegulationText(e.target.value)}
            className={inputClass + " mt-4 resize-y"}
            placeholder="Paste relevant regulation text here..."
          />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            to={`/sops/${id}/build/voice`}
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Skip
          </Link>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-sm bg-primary px-6 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
