import { Star, UserRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

export default function UserPreviewModal({ isOpen, isLoading, user, onClose }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 backdrop-blur-3xl ${
          user?.is_pro
            ? "border-amber-300/40 ring-amber-200/18 shadow-[0_0_38px_rgba(245,158,11,0.22),0_30px_120px_rgba(0,0,0,0.45)]"
            : "border-white/14 ring-white/10"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/24 text-white/72 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar preview de usuario"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative h-36 overflow-hidden border-b border-white/10 bg-black/25">
          {user?.banner_url ? (
            <>
              <img src={user.banner_url} alt={`Banner de ${user.username}`} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,10,0.08),rgba(7,7,10,0.48),rgba(7,7,10,0.82))]" />
            </>
          ) : (
            <div
              className={`h-full w-full ${
                user?.is_pro
                  ? "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_30%),linear-gradient(135deg,rgba(24,18,8,0.98),rgba(18,15,12,0.92),rgba(14,12,8,0.98))]"
                  : "bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_28%),linear-gradient(135deg,rgba(18,18,24,0.98),rgba(14,14,18,0.94),rgba(10,10,14,0.98))]"
              }`}
            />
          )}
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-black/40 ${
                user?.is_pro
                  ? "border-amber-300/70 shadow-[0_0_26px_rgba(245,158,11,0.34)]"
                  : "border-white/18"
              }`}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user?.username || "Usuario"} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-9 w-9 text-white/60" />
              )}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`truncate text-2xl font-black text-white ${user?.is_pro ? "pro-username" : ""}`}>
                  {isLoading ? "Cargando..." : user?.username || "Usuario"}
                </h3>
                {user?.is_pro ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                    PRO <Star className="h-3.5 w-3.5 fill-current text-amber-300" />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-white/64">
                {isLoading
                  ? "Cargando perfil..."
                  : user?.is_pro
                    ? "Miembro MusicDB PRO"
                    : "Miembro MusicDB"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
