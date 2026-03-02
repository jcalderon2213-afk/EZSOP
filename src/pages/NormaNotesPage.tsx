import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import EditNoteModal from "../components/EditNoteModal";
import type { NormaNote } from "../types/knowledge";

type SourceFilter = "all" | NormaNote["source_type"];

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

const FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "talk-it-out", label: "Talk It Out" },
  { value: "guided-mode", label: "Guided Q&A" },
  { value: "voice-source", label: "Voice Source" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export default function NormaNotesPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<NormaNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [editingNote, setEditingNote] = useState<NormaNote | null>(null);

  useEffect(() => {
    if (!userProfile?.org_id) return;
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  async function fetchNotes() {
    const { data, error: fetchError } = await supabase
      .from("norma_notes")
      .select("*")
      .eq("org_id", userProfile!.org_id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setNotes(data as NormaNote[]);
    setLoading(false);
  }

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (filter !== "all") {
      result = result.filter((n) => n.source_type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.source_label.toLowerCase().includes(q) ||
          n.transcript.toLowerCase().includes(q),
      );
    }
    return result;
  }, [notes, filter, search]);

  async function handleDelete(note: NormaNote) {
    const confirmed = window.confirm(
      `Delete this transcript?\n\n"${truncate(note.source_label, 60)}"\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("norma_notes")
      .delete()
      .eq("id", note.id);

    if (deleteError) {
      showToast(deleteError.message, "error");
      return;
    }

    // Optionally delete linked knowledge_item
    if (note.knowledge_item_id) {
      const deleteKi = window.confirm(
        "Also remove the linked knowledge source? (This won't affect any SOPs already created.)",
      );
      if (deleteKi) {
        await supabase.from("knowledge_items").delete().eq("id", note.knowledge_item_id);
      }
    }

    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    showToast("Transcript deleted", "success");
  }

  function handleSaved(updated: NormaNote) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/"
        className="text-[15px] font-700 text-primary hover:underline"
      >
        &larr; Back to Home
      </Link>

      {/* Header */}
      <div className="mt-4">
        <h1 className="font-display text-2xl font-600">Norma's Notes</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every transcript from SOP creation is saved here automatically.
        </p>
      </div>

      {/* Search + filter bar */}
      {!loading && notes.length > 0 && (
        <div className="mt-5 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transcripts..."
              className="w-full rounded-[8px] border-2 border-[#e0e0e0] bg-white py-2.5 pl-9 pr-3.5 text-[14px] text-text outline-none placeholder:text-text-light focus:border-primary"
            />
          </div>

          {/* Source filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SourceFilter)}
            className="rounded-[8px] border-2 border-[#e0e0e0] bg-white px-3 py-2.5 text-[13px] font-600 text-text-muted outline-none transition-colors focus:border-primary"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-[8px] bg-warn-light px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      )}

      {/* Empty state */}
      {!loading && !error && notes.length === 0 && (
        <div className="mx-auto mt-12 max-w-[480px] text-center">
          <div className="text-[56px] leading-none">📝</div>
          <h2 className="mt-4 text-[20px] font-700 text-text">No transcripts yet</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
            Create an SOP using Talk It Out or Guided Mode to start logging transcripts here automatically.
          </p>
        </div>
      )}

      {/* No results after filtering */}
      {!loading && notes.length > 0 && filteredNotes.length === 0 && (
        <p className="mt-10 text-center text-sm text-text-muted">
          No transcripts match your search.
        </p>
      )}

      {/* Notes table */}
      {!loading && filteredNotes.length > 0 && (
        <>
          <div className="mt-5 rounded-[12px] border border-card-border bg-card shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border bg-bg text-left text-[12px] font-700 uppercase tracking-wider text-text-muted">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Transcript</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((note) => (
                  <tr
                    key={note.id}
                    className="border-b border-card-border last:border-b-0 transition-colors hover:bg-[#fafbff]"
                  >
                    <td className="px-5 py-3.5 text-[13px] text-text-muted whitespace-nowrap">
                      {formatDate(note.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-700 ${SOURCE_STYLES[note.source_type]}`}>
                          {SOURCE_LABELS[note.source_type]}
                        </span>
                        <span className="text-[13px] text-text truncate max-w-[180px]">
                          {note.source_label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-text-muted max-w-[300px]">
                      <span className="line-clamp-2">{truncate(note.transcript, 120)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingNote(note)}
                        className="rounded-[6px] border border-card-border bg-white px-3 py-1.5 text-[12px] font-600 text-text-muted transition-colors hover:border-primary hover:text-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note)}
                        className="ml-2 rounded-[6px] border border-card-border bg-white px-3 py-1.5 text-[12px] font-600 text-text-muted transition-colors hover:border-warn hover:text-warn"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <p className="mt-3 text-right text-[12px] text-text-light">
            {filteredNotes.length} transcript{filteredNotes.length !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {/* Edit modal */}
      <EditNoteModal
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
