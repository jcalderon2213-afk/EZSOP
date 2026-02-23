import { useCallback, useEffect, useRef, useState } from "react";

// ── Browser Speech API detection ─────────────────────────────────────────────

const SpeechRecognitionCtor =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, unknown>).webkitSpeechRecognition ??
      (window as unknown as Record<string, unknown>).SpeechRecognition)
    : null;

const speechSupported = !!SpeechRecognitionCtor;

// ── Types ────────────────────────────────────────────────────────────────────

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  duration: number;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
  isSupported: boolean;
  formatDuration: (seconds: number) => string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export default function useSpeechRecognition(
  onTranscript: (chunk: string) => void,
): UseSpeechRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep callback ref in sync so speech handler always uses latest
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped
        }
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!SpeechRecognitionCtor) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionCtor as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;
    setDuration(0);
    setIsRecording(true);

    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    recognition.onresult = (event: {
      resultIndex: number;
      results: {
        length: number;
        [key: number]: { isFinal: boolean; [key: number]: { transcript: string } };
      };
    }) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onTranscriptRef.current(result[0].transcript);
        }
      }
    };

    recognition.onerror = () => {
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecording((current) => {
        if (current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
        return false;
      });
      recognitionRef.current = null;
    };

    recognition.start();
  }, []);

  const stopRecording = useCallback(() => {
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

    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    toggleRecording,
    isSupported: speechSupported,
    formatDuration,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
