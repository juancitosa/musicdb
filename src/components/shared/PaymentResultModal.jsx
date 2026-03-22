import { AnimatePresence, motion } from "framer-motion";
import { Check, Star, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

function SuccessIcon() {
  return (
    <motion.div
      animate={{
        scale: [1, 1.08, 1],
        rotate: [0, -6, 6, 0],
      }}
      transition={{
        duration: 2.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/35 bg-amber-300/12 text-amber-200 shadow-[0_0_28px_rgba(245,158,11,0.18)]"
    >
      <Star className="h-6 w-6 fill-current" />
    </motion.div>
  );
}

function ErrorIcon() {
  return (
    <motion.div
      animate={{
        scale: [1, 1.06, 1],
        rotate: [0, -4, 4, 0],
      }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/35 bg-red-500/12 text-red-200 shadow-[0_0_28px_rgba(248,113,113,0.18)]"
    >
      <XCircle className="h-6 w-6" />
    </motion.div>
  );
}

export default function PaymentResultModal({ feedback, onClose }) {
  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [feedback, onClose]);

  if (!feedback || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[230] flex items-start justify-center overflow-y-auto bg-black/58 px-3 py-4 backdrop-blur-md sm:items-center sm:px-4"
      >
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={`relative my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/8 ${
            feedback.tone === "success"
              ? "border-amber-300/22 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_22%),linear-gradient(135deg,rgba(23,18,10,0.98),rgba(18,14,11,0.98),rgba(12,12,14,0.98))]"
              : "border-red-400/22 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.14),transparent_22%),linear-gradient(135deg,rgba(30,10,13,0.98),rgba(20,12,14,0.98),rgba(12,12,14,0.98))]"
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-4">
              {feedback.tone === "success" ? <SuccessIcon /> : <ErrorIcon />}
              <div>
                <h2 className={`text-2xl font-black ${feedback.tone === "success" ? "text-amber-100" : "text-red-100"}`}>
                  {feedback.title}
                </h2>
                {feedback.description ? (
                  <p className={`mt-2 text-sm ${feedback.tone === "success" ? "text-amber-50/82" : "text-red-50/82"}`}>
                    {feedback.description}
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/6 p-2 text-white/72 transition hover:bg-white/12 hover:text-white"
              aria-label="Cerrar mensaje"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {feedback.items?.length ? (
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <ul className="space-y-3">
                {feedback.items.map((item, index) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * index, duration: 0.22 }}
                    className="flex items-start gap-3 text-base text-amber-50/90"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.14, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.12 }}
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-300"
                    >
                      <Check className="h-4 w-4" />
                    </motion.span>
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-sm text-red-50/85">
                El pago no se realizó correctamente, intente nuevamente.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
