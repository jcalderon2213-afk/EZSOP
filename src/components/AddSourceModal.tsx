import { useCallback, useRef, useState } from "react";
import useSpeechRecognition, { formatDuration } from "../hooks/useSpeechRecognition";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import type { KnowledgeItem } from "../types/knowledge";

// ── Props ────────────────────────────────────────────────────────────────────

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  existingCount: number;
  onSourceAdded: (item: KnowledgeItem) => void;
}

// ── Tab types ────────────────────────────────────────────────────────────────

type SourceTab = "link" | "pdf" | "doc" | "voice";

const TABS: { key: SourceTab; icon: string; label: string; hint: string }[] = [
  { key: "link", icon: "🔗", label: "Link", hint: "Website or URL" },
  { key: "pdf", icon: "📄", label: "PDF", hint: "Upload a file" },
  { key: "doc", icon: "📝", label: "Document", hint: "Paste or type" },
  { key: "voice", icon: "🎤", label: "Talk It Out", hint: "Speak naturally" },
];

const LEVEL_OPTIONS = ["federal", "state", "county", "local", "internal"] as const;

type Level = (typeof LEVEL_OPTIONS)[number];

// ── Component ────────────────────────────────────────────────────────────────

export default function AddSourceModal({
  isOpen,
  onClose,
  orgId,
  existingCount,
  onSourceAdded,
}: AddSourceModalProps) {
  const { showToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<SourceTab>("link");

  // Shared fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Level | "">("");

  // Link-specific
  const [url, setUrl] = useState("");

  // PDF-specific
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Doc-specific
  const [docContent, setDocContent] = useState("");

  // Voice-specific
  const [voicePhase, setVoicePhase] = useState<"idle" | "recording" | "done">("idle");
  const [transcript, setTranscript] = useState("");
  const [finalDuration, setFinalDuration] = useState(0);

  // Saving
  const [saving, setSaving] = useState(false);

  // ── Speech recognition ──────────────────────────────────────────────────

  const handleTranscriptChunk = useCallback((chunk: string) => {
    setTranscript((prev) => (prev ? prev + " " + chunk.trim() : chunk.trim()));
  }, []);

  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    isSupported: speechSupported,
  } = useSpeechRecognition(handleTranscriptChunk);

  // ── Reset ───────────────────────────────────────────────────────────────

  function resetForm() {
    setActiveTab("link");
    setName("");
    setDescription("");
    setLevel("");
    setUrl("");
    setFile(null);
    setDocContent("");
    setVoicePhase("idle");
    setTranscript("");
    setFinalDuration(0);
    setSaving(false);
  }

  function handleClose() {
    if (isRecording) stopRecording();
    resetForm();
    onClose();
  }

  function handleTabSwitch(tab: SourceTab) {
    if (isRecording) stopRecording();
    setActiveTab(tab);
  }

  // ── Voice handlers ──────────────────────────────────────────────────────

  function handleStartRecording() {
    setTranscript("");
    setFinalDuration(0);
    startRecording();
    setVoicePhase("recording");
  }

  function handleStopRecording() {
    setFinalDuration(duration);
    stopRecording();
    setVoicePhase("done");
  }

  function handleReRecord() {
    setTranscript("");
    setFinalDuration(0);
    setVoicePhase("idle");
  }

  // ── File handlers ───────────────────────────────────────────────────────

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;
    setFile(selectedFile);
    if (!name) setName(selectedFile.name.replace(/\.[^.]+$/, ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  // ── Validation ──────────────────────────────────────────────────────────

  function canSubmit(): boolean {
    if (!name.trim() || !level) return false;

    switch (activeTab) {
      case "link":
        return !!url.trim();
      case "pdf":
        return !!file;
      case "doc":
        return !!docContent.trim();
      case "voice":
        return voicePhase === "done" && !!transcript.trim();
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit() || saving) return;
    setSaving(true);

    try {
      const typeMap: Record<SourceTab, KnowledgeItem["type"]> = {
        link: "LINK",
        pdf: "PDF",
        doc: "DOCUMENT",
        voice: "VOICE",
      };

      const row: Record<string, unknown> = {
        org_id: orgId,
        title: name.trim(),
        description: description.trim(),
        type: typeMap[activeTab],
        priority: "RECOMMENDED",
        level,
        status: "provided",
        sort_order: existingCount + 1,
      };

      // Type-specific fields
      switch (activeTab) {
        case "link":
          row.provided_url = url.trim();
          break;
        case "pdf":
          row.provided_file = file!.name;
          break;
        case "doc":
          row.provided_text = docContent.trim();
          break;
        case "voice":
          row.provided_transcript = transcript.trim();
          break;
      }

      const { data, error } = await supabase
        .from("knowledge_items")
        .insert(row)
        .select()
        .single();

      if (error) throw new Error(error.message);

      onSourceAdded(data as KnowledgeItem);
      showToast("Source added!", "success");
      resetForm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-[94vw] max-w-[540px] flex-col overflow-hidden rounded-[16px] bg-bg shadow-lg"
        style={{ animation: "page-enter 250ms ease" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-card-border bg-bg px-6 py-5 rounded-t-[16px]">
          <div>
            <h2 className="font-display text-xl font-600">Add Source</h2>
            <p className="mt-0.5 text-[13px] text-text-muted">Add a reference to your knowledge base</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-card-border bg-card text-base text-text-muted transition-all hover:border-warn hover:bg-warn-light hover:text-warn"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Tabs */}
          <div className="flex overflow-hidden rounded-sm border border-card-border bg-card">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabSwitch(tab.key)}
                className={`flex flex-1 flex-col items-center gap-0.5 border-r border-card-border py-3 px-1.5 text-center transition-all last:border-r-0 ${
                  activeTab === tab.key
                    ? "bg-primary-light font-600 text-primary"
                    : "text-text-muted hover:bg-[#FDFBF8] hover:text-text"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[12px]">{tab.label}</span>
                <span className={`text-[10px] font-400 ${
                  activeTab === tab.key ? "text-primary/70" : "text-text-light"
                }`}>
                  {tab.hint}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-5">
            {activeTab === "link" && <LinkTab url={url} setUrl={setUrl} />}
            {activeTab === "pdf" && (
              <PdfTab
                file={file}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
                onRemoveFile={() => setFile(null)}
                onDrop={handleDrop}
              />
            )}
            {activeTab === "doc" && <DocTab content={docContent} setContent={setDocContent} />}
            {activeTab === "voice" && (
              <VoiceTab
                phase={voicePhase}
                isRecording={isRecording}
                duration={duration}
                finalDuration={finalDuration}
                transcript={transcript}
                setTranscript={setTranscript}
                speechSupported={speechSupported}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onReRecord={handleReRecord}
              />
            )}

            {/* Shared fields — show after type-specific content */}
            {/* For voice: only show after recording is done */}
            {(activeTab !== "voice" || voicePhase === "done") && (
              <div className="mt-4 space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-600 text-text">
                    Name
                    <span className="ml-1 text-[11px] font-400 text-text-light">
                      — {activeTab === "voice" ? "what were you talking about?" : "what should we call this?"}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      activeTab === "link" ? "e.g. Oregon DHS AFH Rules"
                        : activeTab === "pdf" ? "e.g. Employee Handbook 2024"
                        : activeTab === "doc" ? "e.g. Morning Routine Procedures"
                        : "e.g. Morning routine and medication process"
                    }
                    className="w-full rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-text-light focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-600 text-text">
                    Brief description
                    <span className="ml-1 text-[11px] font-400 text-text-light">optional</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      activeTab === "link" ? "e.g. Primary licensing rules for adult foster homes"
                        : activeTab === "pdf" ? "e.g. Staff policies, expectations, and procedures"
                        : activeTab === "doc" ? "e.g. Step-by-step morning care routine"
                        : "e.g. My daily morning process with residents"
                    }
                    className="w-full rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-text-light focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Level */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-600 text-text">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as Level)}
                    className="w-full rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                  >
                    <option value="" disabled>Select level...</option>
                    <option value="federal">Federal</option>
                    <option value="state">State</option>
                    <option value="county">County</option>
                    <option value="local">Local</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-card-border bg-bg px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-500 text-text-muted transition-colors hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit() || saving}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add to Knowledge Base"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab content sub-components
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helper text ──────────────────────────────────────────────────────────────

function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-sm bg-info-light px-3.5 py-2.5 text-[12px] leading-snug text-info">
      <span className="shrink-0 text-sm mt-px">💡</span>
      <span>{children}</span>
    </div>
  );
}

// ── Link Tab ─────────────────────────────────────────────────────────────────

function LinkTab({
  url,
  setUrl,
}: {
  url: string;
  setUrl: (v: string) => void;
}) {
  return (
    <div>
      <HelperText>
        Paste a link to a regulation, government site, training resource, or any webpage relevant to your business.
      </HelperText>
      <div>
        <label className="mb-1.5 block text-[13px] font-600 text-text">URL</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-text-light">🌐</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://oregon.gov/dhs/..."
            className="w-full rounded-sm border border-card-border bg-card py-2.5 pl-10 pr-3.5 text-sm text-text outline-none placeholder:text-text-light focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  );
}

// ── PDF Tab ──────────────────────────────────────────────────────────────────

function PdfTab({
  file,
  fileInputRef,
  onFileSelect,
  onRemoveFile,
  onDrop,
}: {
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (f: File | null) => void;
  onRemoveFile: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <HelperText>
        Upload your employee handbook, training materials, license copy, or any document you reference for your business.
      </HelperText>

      {!file ? (
        <div
          className="cursor-pointer rounded-[12px] border-2 border-dashed border-card-border bg-card px-5 py-8 text-center transition-all hover:border-primary hover:bg-primary-light"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-xl text-text-muted">
            ↑
          </div>
          <div className="text-sm font-500 text-text">
            Drag your file here or <span className="font-600 text-primary underline underline-offset-2">browse</span>
          </div>
          <div className="mt-1 text-[12px] text-text-light">PDF, DOC, or TXT · Max 10MB</div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-sm border border-card-border bg-card px-3.5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-warn-light text-base">
            📄
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[13px] font-600 text-text">{file.name}</div>
            <div className="text-[11px] text-text-light mt-0.5">{formatSize(file.size)}</div>
          </div>
          <button
            type="button"
            onClick={onRemoveFile}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-sm text-text-light transition-all hover:bg-warn-light hover:text-warn"
          >
            ✕
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ── Document Tab ─────────────────────────────────────────────────────────────

function DocTab({
  content,
  setContent,
}: {
  content: string;
  setContent: (v: string) => void;
}) {
  return (
    <div>
      <HelperText>
        Type or paste any text — notes about how you run things, policies, procedures, or anything the AI should know.
      </HelperText>
      <div>
        <label className="mb-1.5 block text-[13px] font-600 text-text">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type or paste your content here..."
          className="w-full resize-y rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-text outline-none placeholder:text-text-light focus:border-primary focus:ring-1 focus:ring-primary"
          style={{ minHeight: "140px" }}
        />
      </div>
    </div>
  );
}

// ── Voice Tab ────────────────────────────────────────────────────────────────

function VoiceTab({
  phase,
  isRecording,
  duration,
  finalDuration,
  transcript,
  setTranscript,
  speechSupported,
  onStart,
  onStop,
  onReRecord,
}: {
  phase: "idle" | "recording" | "done";
  isRecording: boolean;
  duration: number;
  finalDuration: number;
  transcript: string;
  setTranscript: (v: string) => void;
  speechSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  onReRecord: () => void;
}) {
  if (!speechSupported) {
    return (
      <div>
        <HelperText>
          Speech recognition is not supported in your browser. Please use Chrome for voice input.
        </HelperText>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div>
        <HelperText>
          Just talk about how you do things — explain it like you're training someone new. We'll write it down for you and save it.
        </HelperText>

        <div className="py-6 text-center">
          <button
            type="button"
            onClick={onStart}
            className="mx-auto mb-2.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-card-border bg-card text-[28px] transition-all hover:border-primary hover:bg-primary-light"
          >
            🎤
          </button>
          <div className="text-[13px] font-500 text-text-muted">Tap to start talking</div>
        </div>

        <div className="mt-1 text-center px-4">
          <div className="text-[13px] font-600 text-text">Ideas for what to share:</div>
          <p className="mt-1.5 text-[13px] italic leading-relaxed text-text-muted">
            "Here's how I give residents their morning meds..."
            <br />
            "When a new staff member starts, the first thing I show them is..."
            <br />
            "The way I handle family phone calls is..."
          </p>
        </div>
      </div>
    );
  }

  // ── Recording ───────────────────────────────────────────────────────────
  if (phase === "recording" && isRecording) {
    return (
      <div>
        <div className="py-6 text-center">
          <button
            type="button"
            onClick={onStop}
            className="pulse-record mx-auto mb-2.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-warn bg-warn-light text-[28px]"
          >
            ⏹
          </button>
          <div className="text-[13px] font-600 text-warn">Recording... tap to stop</div>
          <div className="mt-1.5 text-[22px] font-600 tabular-nums text-warn">
            {formatDuration(duration)}
          </div>
        </div>

        {/* Live transcript */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[13px] font-600 text-text">Live transcript</label>
            <span className="rounded-full bg-warn-light px-2.5 py-0.5 text-[11px] font-600 text-warn">
              ● Live
            </span>
          </div>
          <textarea
            readOnly
            value={transcript || "Listening..."}
            className="w-full resize-none rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-text opacity-80 outline-none"
            style={{ minHeight: "100px" }}
          />
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Audio playback bar (cosmetic) */}
      <div className="flex items-center gap-2.5 rounded-sm border border-card-border bg-card px-3.5 py-2.5">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white hover:bg-primary-hover"
        >
          ▶
        </button>
        <div className="flex-1 h-1 rounded-full bg-card-border">
          <div className="h-full w-[35%] rounded-full bg-primary" />
        </div>
        <span className="text-[12px] tabular-nums text-text-muted">
          {formatDuration(finalDuration)}
        </span>
      </div>

      {/* Editable transcript */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[13px] font-600 text-text">Transcript</label>
          <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-600 text-accent">
            Complete
          </span>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="w-full resize-y rounded-sm border border-card-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          style={{ minHeight: "120px" }}
        />
        <div className="mt-1 text-[11px] text-text-light">
          You can edit the transcript if anything was transcribed wrong
        </div>
      </div>

      {/* Re-record */}
      <div className="mt-1 text-center">
        <button
          type="button"
          onClick={onReRecord}
          className="text-[13px] text-text-muted underline underline-offset-2 hover:text-text"
        >
          Record again
        </button>
      </div>
    </div>
  );
}
