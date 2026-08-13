import { AlertTriangle, Check, FolderPlus, LoaderCircle, Trash2, X } from "lucide-react";

export type ToastTone = "progress" | "success" | "error" | "delete" | "added";

export type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
};

export function ToastRegion({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <section className="toast-region" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <div className={`app-toast is-${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}>
          <span className="app-toast-icon" aria-hidden="true">{toastIcon(toast.tone)}</span>
          <span>{toast.message}</span>
          {toast.tone !== "progress" && (
            <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
              <X size={12} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function toastIcon(tone: ToastTone) {
  if (tone === "progress") return <LoaderCircle className="is-spinning" size={14} strokeWidth={1.8} />;
  if (tone === "error") return <AlertTriangle size={14} strokeWidth={1.8} />;
  if (tone === "delete") return <Trash2 size={14} strokeWidth={1.8} />;
  if (tone === "added") return <FolderPlus size={14} strokeWidth={1.8} />;
  return <Check size={14} strokeWidth={1.8} />;
}
