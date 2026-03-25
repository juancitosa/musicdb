import { Check, Crown, Gem, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PaymentResultModal from "../components/shared/PaymentResultModal";
import PricingModal from "../components/shared/PricingModal";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";

const freeFeatures = [
  "Puntuar artistas y álbumes",
  "Ver rankings",
  "Buscar en el catálogo",
  "Crear reviews",
  "10 ranks por dia como maximo",
  "10 reseñas por día como máximo",
];
const proFeatures = [
  "Todo lo anterior",
  "Badge PRO con estrella",
  "Nombre dorado en reviews",
  "Prioridad en rankings",
  "Reviews destacadas",
  "Mis estadísticas de Spotify",
  "Filtros de tops por 4 semanas, 6 meses y 1 año",
  "Escuchando ahora en la burbuja del perfil",
  "Reseñas y puntuaciones ilimitadas",
  "Acceso a funciones exclusivas",
];

const benefitCards = [
  {
    icon: <Star className="h-5 w-5" />,
    title: "Username dorado + estrella",
    description: "Tu nombre se destaca con acabado dorado y el icono PRO en reviews y perfil.",
  },
  {
    icon: <Crown className="h-5 w-5" />,
    title: "Mayor visibilidad",
    description: "Tus aportes tienen presencia premium dentro del ecosistema MusicDB.",
  },
  {
    icon: <Gem className="h-5 w-5" />,
    title: "Reviews destacadas",
    description: "Tus reviews se muestran con un estilo especial para resaltar tu suscripcion.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Funciones exclusivas",
    description: "Espacio reservado para perks y herramientas premium que iremos sumando.",
  },
  {
    icon: <Crown className="h-5 w-5" />,
    title: "Sin límites diarios",
    description: "Los usuarios PRO tienen reseñas y puntuaciones ilimitadas durante toda su suscripción.",
  },
  {
    icon: <Gem className="h-5 w-5" />,
    title: "Estadísticas Spotify PRO",
    description: "Desbloquea tops personales de artistas, álbumes y canciones con filtros por período.",
  },
];

const pricingPlans = [
  { id: "1m", label: "1 Mes", price: 10, months: 1, discountLabel: "-", isRecommended: false },
  { id: "3m", label: "3 Meses", price: 9000, months: 3, discountLabel: "~15% off", isRecommended: false },
  { id: "6m", label: "6 Meses", price: 15000, months: 6, discountLabel: "~28% off", isRecommended: true },
  { id: "12m", label: "12 Meses", price: 24000, months: 12, discountLabel: "~43% off", isRecommended: false },
];

function FeatureList({ items, accent = "text-foreground" }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 ${accent}`}>
            <Check className="h-3.5 w-3.5" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProPage() {
  const { user, appToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPro = Boolean(user?.isPro);
  const [isCreatingPreference, setIsCreatingPreference] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const paymentStatus = searchParams.get("payment");
  const paymentFeedback = useMemo(() => {
    if (paymentStatus === "success") {
      return {
        tone: "success",
        title: "Bienvenido a Music PRO",
        description: "Tus beneficios:",
        items: [
          "Username en dorado con estrella.",
          "Mayor visibilidad en rankings.",
          "Reviews destacadas.",
          "Reseñas y puntuaciones ilimitadas.",
          "Estadísticas personales de Spotify.",
        ],
      };
    }

    if (paymentStatus === "failure" || paymentStatus === "pending") {
      return {
        tone: "error",
        title: "El pago no se realizó correctamente, intente nuevamente",
        description: "",
        items: [],
      };
    }

    return null;
  }, [paymentStatus]);

  const handleProClick = async () => {
    if (!user || !appToken) {
      navigate("/login", {
        state: {
          openAuthDialog: true,
          redirectTo: "/pro",
        },
      });
      return;
    }

    setIsPricingOpen(true);
  };

  const handlePlanSelection = async (planId) => {
    console.log("[MusicDB PRO] Starting payment preference request", { plan: planId });
    setIsCreatingPreference(true);
    setSelectedPlan(planId);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/payments/create-preference`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(appToken ? { Authorization: `Bearer ${appToken}` } : {}),
        },
        body: JSON.stringify({
          plan: planId,
        }),
      });

      const rawResponse = await res.text();
      let data = null;

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        data = {
          raw: rawResponse,
        };
      }

      console.log("[MusicDB PRO] Payment preference response:", data);

      if (!res.ok) {
        console.error("[MusicDB PRO] Payment preference request failed:", {
          status: res.status,
          data,
        });
        return;
      }

      if (data.init_point) {
        setIsPricingOpen(false);
        window.location.href = data.init_point;
        return;
      }

      console.error("[MusicDB PRO] No init_point received");
    } catch (err) {
      console.error("[MusicDB PRO] Error creating payment:", err);
    } finally {
      setIsCreatingPreference(false);
      setSelectedPlan("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PaymentResultModal
        feedback={paymentFeedback}
        onClose={() => navigate("/pro", { replace: true })}
      />

      <PricingModal
        isOpen={isPricingOpen}
        plans={pricingPlans}
        isLoading={isCreatingPreference}
        selectedPlan={selectedPlan}
        onClose={() => {
          if (!isCreatingPreference) {
            setIsPricingOpen(false);
          }
        }}
        onSelectPlan={handlePlanSelection}
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,rgba(7,7,9,0.96),rgba(19,16,12,0.94),rgba(10,10,12,0.98))] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.32)] sm:p-12">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
            <Star className="h-3.5 w-3.5 fill-current" />
            Premium
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">MusicDB PRO</h1>
          <p className="mt-4 max-w-2xl text-base text-white/72 sm:text-lg">
            Lleva tu experiencia musical al siguiente nivel.
          </p>
          <p className="mt-2 text-sm font-medium text-amber-200/78">
            Todos los precios y divisas mostrados en MusicDB PRO están expresados en ARS.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {isPro ? (
              <>
                <div className="pro-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
                  Ya sos usuario PRO <Star className="h-4 w-4 fill-current" />
                </div>
                <Button type="button" size="lg" disabled className="rounded-full bg-white/10 text-white hover:bg-white/10">
                  Suscripcion activa
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={handleProClick}
                disabled={isCreatingPreference}
                className="rounded-full border border-amber-300/40 bg-amber-300/12 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.12)] transition hover:bg-amber-300/18"
              >
                {isCreatingPreference ? "Redirigiendo..." : "Hacerme PRO"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Beneficios</h2>
          <p className="mt-2 text-sm text-muted-foreground">Una capa premium sobria, visible y pensada para destacar tu presencia en MusicDB.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {benefitCards.map((benefit) => (
            <article
              key={benefit.title}
              className="rounded-[1.6rem] border border-amber-300/14 bg-[linear-gradient(180deg,rgba(16,16,18,0.96),rgba(24,22,18,0.96))] p-6 shadow-[0_20px_40px_-32px_rgba(245,158,11,0.4)]"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-300/10 text-amber-200">
                {benefit.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/68">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.8rem] border border-border bg-card p-6 shadow-lg shadow-black/5">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold">FREE</h2>
              <p className="text-sm text-muted-foreground">Tu acceso base a MusicDB</p>
            </div>
          </div>
          <FeatureList items={freeFeatures} />
        </article>

        <article className="rounded-[1.8rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(12,12,14,0.98),rgba(20,17,13,0.98))] p-6 shadow-[0_22px_48px_-30px_rgba(245,158,11,0.45)]">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">PRO</h2>
              <p className="text-sm text-white/62">Tu presencia premium dentro de la comunidad</p>
            </div>
          </div>
          <FeatureList items={proFeatures} accent="text-amber-200" />
        </article>
      </section>

      <section className="mt-10 rounded-[1.8rem] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(14,14,16,0.97),rgba(26,21,16,0.96))] p-7 text-center shadow-[0_24px_60px_-34px_rgba(245,158,11,0.4)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-200/78">Upgrade</p>
        <h2 className="mt-3 text-3xl font-black text-white">Haz que tu perfil se vea premium</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/68 sm:text-base">
          MusicDB PRO es la forma de destacar tu identidad musical en la app. Por ahora el flujo de pagos es placeholder, pero la experiencia visual ya está lista.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-xs font-medium uppercase tracking-[0.18em] text-amber-200/72">
          Todos los importes están expresados en ARS
        </p>
        <div className="mt-6">
          {isPro ? (
            <div className="pro-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
              Ya sos usuario PRO <Star className="h-4 w-4 fill-current" />
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={handleProClick}
              disabled={isCreatingPreference}
              className="rounded-full border border-amber-300/40 bg-amber-300/12 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.12)] transition hover:bg-amber-300/18"
            >
              {isCreatingPreference ? "Redirigiendo..." : "Hacerme PRO"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

