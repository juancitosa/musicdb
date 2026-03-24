import { Check, Crown, Star, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import Button from "../ui/Button";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthlyEquivalent(price, months) {
  return formatCurrency(Math.round(price / months));
}

export default function PricingModal({
  isOpen,
  plans,
  isLoading,
  selectedPlan,
  onClose,
  onSelectPlan,
}) {
  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/62 px-3 py-4 backdrop-blur-md sm:items-center sm:px-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative my-auto w-full max-w-5xl overflow-hidden rounded-[2rem] border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_20%),linear-gradient(135deg,rgba(10,10,12,0.98),rgba(22,17,12,0.98),rgba(11,11,13,0.98))] shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/8">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-8 sm:py-7">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              MusicDB PRO
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Elige tu plan premium</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/68 sm:text-base">
              Desbloquea reseñas y puntuaciones ilimitadas, nombre dorado, estadísticas Spotify PRO y una presencia mucho más premium dentro de MusicDB.
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-200/72">
              Todos los importes están expresados en ARS
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/6 p-2 text-white/72 transition hover:bg-white/12 hover:text-white"
            aria-label="Cerrar selector de planes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;

            return (
              <article
                key={plan.id}
                className={`relative flex h-full flex-col overflow-hidden rounded-[1.7rem] border p-5 transition ${
                  plan.isRecommended
                    ? "border-amber-300/34 bg-[linear-gradient(180deg,rgba(30,23,12,0.98),rgba(17,14,12,0.98))] shadow-[0_24px_50px_-34px_rgba(245,158,11,0.8)]"
                    : "border-white/8 bg-[linear-gradient(180deg,rgba(18,18,20,0.98),rgba(12,12,14,0.98))] shadow-[0_18px_42px_-34px_rgba(0,0,0,0.85)]"
                }`}
              >
                {plan.isRecommended ? (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full border border-amber-300/24 bg-amber-300/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                    <Star className="h-3 w-3 fill-current" />
                    Recomendado
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/46">{plan.label}</p>
                  <h3 className="mt-3 text-3xl font-black text-white">{formatCurrency(plan.price)}</h3>
                  <p className="mt-2 text-sm text-white/64">{formatMonthlyEquivalent(plan.price, plan.months)} por mes</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/88">
                    {plan.discountLabel === "-" ? "Sin descuento" : plan.discountLabel}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-white/78">
                    <Check className="h-4 w-4 text-amber-200" />
                    <span>{plan.months} {plan.months === 1 ? "mes" : "meses"} de MusicDB PRO</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/78">
                    <Check className="h-4 w-4 text-amber-200" />
                    <span>Reseñas y puntuaciones ilimitadas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/78">
                    <Check className="h-4 w-4 text-amber-200" />
                    <span>Nombre dorado y reviews destacadas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/78">
                    <Check className="h-4 w-4 text-amber-200" />
                    <span>Estadísticas Spotify y tops filtrables</span>
                  </div>
                </div>

                <div className="mt-8">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => onSelectPlan(plan.id)}
                    disabled={isLoading}
                    className={`w-full justify-center rounded-full border text-white ${
                      plan.isRecommended
                        ? "border-amber-300/50 bg-amber-300/12 shadow-[0_0_24px_rgba(245,158,11,0.16)] hover:bg-amber-300/18"
                        : "border-white/12 bg-white/6 hover:bg-white/10"
                    }`}
                  >
                    {isLoading && isSelected ? "Redirigiendo..." : "Elegir plan"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

