import { X } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/toast";

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg">
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                dismissToast(toast.id);
              }}
              className="shrink-0 rounded-lg px-2 py-1 font-bold text-accent-strong hover:bg-accent-dim"
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismissToast(toast.id)} className="shrink-0 rounded-full p-1 text-muted hover:text-fg" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
