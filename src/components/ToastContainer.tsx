interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  exiting: boolean;
}

const ACCENT_COLORS: Record<Toast["type"], string> = {
  success: "var(--color-accent)",
  error: "var(--color-warn)",
  warning: "#D4A017",
  info: "var(--color-info)",
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex min-w-[320px] max-w-[480px] items-start gap-3 rounded-sm bg-card px-4 py-3 shadow-lg ${
            toast.exiting ? "toast-exit" : "toast-enter"
          }`}
          style={{ borderLeft: `4px solid ${ACCENT_COLORS[toast.type]}` }}
        >
          <p className="flex-1 text-sm text-text">{toast.message}</p>
          <button
            type="button"
            onClick={() => onClose(toast.id)}
            className="shrink-0 text-text-light transition-colors hover:text-text"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
