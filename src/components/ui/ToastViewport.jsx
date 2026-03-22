import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-auto relative"
          >
            {toast.variant === "spotify" ? (
              <>
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <filter id="spotify-toast-neon" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="1.6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <motion.rect
                    x="0.75"
                    y="0.75"
                    width="98.5"
                    height="98.5"
                    rx="8"
                    ry="8"
                    fill="none"
                    stroke="rgba(186, 126, 255, 1)"
                    strokeWidth="0.72"
                    strokeLinecap="round"
                    filter="url(#spotify-toast-neon)"
                    style={{ dropShadow: "0 0 8px rgba(188, 120, 255, 0.98)" }}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: (toast.duration ?? 3000) / 1000, ease: "linear" }}
                  />
                </svg>
                <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{toast.title}</p>
                      {toast.description ? <p className="mt-1 text-sm opacity-80">{toast.description}</p> : null}
                    </div>
                    <button onClick={() => onDismiss(toast.id)} className="opacity-70 transition hover:opacity-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div
                className={`rounded-2xl border p-4 shadow-2xl ${
                  toast.variant === "destructive"
                    ? "border-destructive/40 bg-destructive text-destructive-foreground"
                    : "border-border bg-card text-card-foreground"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{toast.title}</p>
                    {toast.description ? <p className="mt-1 text-sm opacity-80">{toast.description}</p> : null}
                  </div>
                  <button onClick={() => onDismiss(toast.id)} className="opacity-70 transition hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
