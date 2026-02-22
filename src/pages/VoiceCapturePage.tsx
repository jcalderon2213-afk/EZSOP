import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";
import BuildStepper from "../components/BuildStepper";

// ── Styles ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// ── Speech API check ──────────────────────────────────────────────────────────

const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as unknown as Record<string, unknown>).webkitSpeechRecognition ??
      (window as unknown as Record<string, unknown>).SpeechRecognition
    : null;

const speechSupported = !!SpeechRecognition;

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceCapturePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sopTitle, setSopTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Text content
  const [text, setText] = useState("");

  // Recording state
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef(text);

  // Keep textRef in sync so speech callbacks read latest value
  useEffect(() => {
    textRef.current = text;
  }, [text]);

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
        logger.error("voice_capture_fetch_error", { message: error.message });
      } else {
        setSopTitle(data.title);
      }
      setLoading(false);
    }

    fetchSOP();

    // Restore from localStorage
    const stored = localStorage.getItem(`sop-voice-${id}`);
    if (stored) {
      setText(stored);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // ── Speech recognition ──────────────────────────────────────────────────

  function startRecording() {
    if (!SpeechRecognition) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;
    setDuration(0);
    setRecording(true);

    logger.info("voice_capture_start", { sopId: id });

    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const chunk = result[0].transcript;
          setText((prev) => {
            const separator = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
            return prev + separator + chunk;
          });
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      logger.error("voice_capture_error", { sopId: id, error: event.error });
      stopRecording();
    };

    recognition.onend = () => {
      // Auto-stopped (e.g. silence timeout)
      setRecording((current) => {
        if (current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          logger.info("voice_capture_stop", { sopId: id });
        }
        return false;
      });
      recognitionRef.current = null;
    };

    recognition.start();
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRecording(false);
    logger.info("voice_capture_stop", { sopId: id, duration });
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── Save & navigate ─────────────────────────────────────────────────────

  function handleContinue() {
    if (text.trim()) {
      localStorage.setItem(`sop-voice-${id}`, text.trim());
    }

    logger.info("voice_capture_saved", {
      sopId: id,
      charCount: text.trim().length,
    });

    navigate(`/sops/${id}/build/transcript`);
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
        to={`/sops/${id}/build/context`}
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Context
      </Link>

      <h1 className="mt-4 font-display text-2xl font-600">
        {sopTitle || "Voice Capture"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Describe your process by typing or speaking.
      </p>

      <div className="mt-6 max-w-[700px]">
        <BuildStepper currentStep={1} />

        {/* ── Main card ──────────────────────────────────────────────── */}
        <div className="rounded border border-card-border bg-card p-6 shadow">
          <h2 className="text-sm font-600 text-text">Process Description</h2>
          <p className="mt-1 text-xs text-text-muted">
            Type your process description or use the microphone to dictate it.
          </p>

          <textarea
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass + " mt-4 resize-y"}
            placeholder="Describe how this process works step by step..."
          />

          {/* Controls */}
          <div className="mt-4 flex items-center gap-3">
            {speechSupported ? (
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-500 transition-colors ${
                  recording
                    ? "bg-warn text-white pulse-record"
                    : "border border-card-border bg-card text-text-muted hover:text-text"
                }`}
              >
                {/* Microphone icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="1" width="6" height="9" rx="3" />
                  <path d="M2 7a6 6 0 0 0 12 0" />
                  <line x1="8" y1="13" x2="8" y2="15" />
                  <line x1="5" y1="15" x2="11" y2="15" />
                </svg>
                {recording ? `Stop Recording (${formatDuration(duration)})` : "Start Recording"}
              </button>
            ) : (
              <p className="text-xs text-text-muted">
                Voice input not supported in this browser.
              </p>
            )}

            {text && (
              <button
                type="button"
                onClick={() => setText("")}
                className="text-sm text-text-muted transition-colors hover:text-warn"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            to={`/sops/${id}/build/transcript`}
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
