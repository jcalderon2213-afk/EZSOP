import { useEffect, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import type { NormaNote } from "../types/knowledge";

interface EditNoteModalProps {
  note: NormaNote | null;
  onClose: () => void;
  onSaved: (updated: NormaNote) => void;
}

const SOURCE_LABELS: Record<NormaNote["source_type"], string> = {
  "talk-it-out": "Talk It Out",
  "guided-mode": "Guided Q&A",
  "voice-source": "Voice Source",
};

const SOURCE_STYLES: Record<NormaNote["source_type"], string> = {
  "talk-it-out": "bg-primary-light text-primary",
  "guided-mode": "bg-accent-light text-[#166534]",
  "voice-source": "bg-[#fef3c7] text-[#92400e]",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EditNoteModal({ note, onClose, onSaved }: EditNoteModalProps) {
  const { showToast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) setTranscript(note.transcript);
  }, [note]);

  if (!note) return null;

  async function handleSave() {
    if (!note || saving) return;
    const trimmed = transcript.trim();
    if (!trimmed) {
      showToast("Transcript cannot be empty", "error");
      return;
    }

    setSaving(true);
    try {
      // Update norma_notes
      const { error } = await supabase
        .from("norma_notes")
        .update({ transcript: trimmed, updated_at: new Date().toISOString() })
        .eq("id", note.id);

      if (error) throw new Error(error.message);

      // Also update linked knowledge_item if exists
      if (note.knowledge_item_id) {
        await supabase
          .from("knowledge_items")
          .update({ provided_transcript: trimmed })
          .eq("id", note.knowledge_item_id);
      }

      showToast("Transcript updated!", "success");
      onSaved({ ...note, transcript: trimmed, updated_at: new Date().toISOString() });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-[94vw] max-w-[540px] flex-col overflow-hidden rounded-[16px] bg-bg shadow-lg"
        style={{ animation: "page-enter 250ms ease" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-card-border bg-bg px-6 py-5 rounded-t-[16px]">
          <div>
            <h2 className="font-display text-xl font-600">Edit Transcript</h2>
            <p className="mt-0.5 text-[13px] text-text-muted">Update the saved transcript text</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-card-border bg-card text-base text-text-muted transition-all hover:border-warn hover:bg-warn-light hover:text-warn"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Source info (read-only) */}
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[12px] font-700 ${SOURCE_STYLES[note.source_type]}`}>
              {SOURCE_LABELS[note.source_type]}
            </span>
            <span className="text-[13px] text-text-muted">{note.source_label}</span>
          </div>
          <p className="text-[12px] text-text-light">{formatDate(note.created_at)}</p>

          {/* Editable transcript */}
          <div>
            <label className="mb-1.5 block text-[13px] font-600 text-text">Transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              className="w-full resize-y rounded-[12px] border-2 border-[#e0e0e0] bg-white px-4 py-4 text-[15px] text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-card-border bg-bg px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-500 text-text-muted transition-colors hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !transcript.trim()}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
