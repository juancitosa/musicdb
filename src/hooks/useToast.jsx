import { createContext, useContext, useMemo, useState } from "react";

import ToastViewport from "../components/ui/ToastViewport";

const ToastContext = createContext(undefined);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const value = useMemo(
    () => ({
      toast({ title, description, variant = "default", duration = 3200 }) {
        const id = crypto.randomUUID();
        const effectiveVariant = variant === "default" && title === "Spotify conectado" ? "spotify" : variant;
        const effectiveDuration = Math.min(duration ?? 3200, 3500);

        setToasts((currentToasts) => [...currentToasts, { id, title, description, variant: effectiveVariant, duration: effectiveDuration }]);
        window.setTimeout(() => {
          setToasts((currentToasts) => currentToasts.filter((toastItem) => toastItem.id !== id));
        }, effectiveDuration);
      },
      dismiss(id) {
        setToasts((currentToasts) => currentToasts.filter((toastItem) => toastItem.id !== id));
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={value.dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
