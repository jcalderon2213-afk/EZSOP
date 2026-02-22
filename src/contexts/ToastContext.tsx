import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import ToastContainer from "../components/ToastContainer";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

const AUTO_DISMISS_MS = 4000;
const EXIT_ANIMATION_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const startExit = useCallback((id: string) => {
    // Clear any existing timer for this toast
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);

    // Mark as exiting (triggers fade-out animation)
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));

    // Remove after exit animation completes
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, EXIT_ANIMATION_MS);
    timersRef.current.set(id, timer);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      const id = `toast-${++nextId}`;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

      // Schedule auto-dismiss
      const timer = setTimeout(() => startExit(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [startExit],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={startExit} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
