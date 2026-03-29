import { AnimatePresence, motion } from "framer-motion";
import { Medal, Sparkles } from "lucide-react";
import { useEffect } from "react";

const TIER_STYLES = {
  bronze: {
    shellClass: "achievement-unlock-shell--bronze border-[#c88a4d]/30 ring-[#f4d8bb]/8 bg-[linear-gradient(180deg,rgba(28,16,10,0.98),rgba(15,11,11,0.99))]",
    auraClass: "bg-[radial-gradient(circle_at_top,rgba(212,132,61,0.28),transparent_42%)]",
    medalClass: "achievement-medal-burst--bronze border-[#d39a62]/36 bg-[radial-gradient(circle_at_30%_28%,rgba(255,244,231,0.95),rgba(214,141,77,0.94),rgba(123,66,26,0.96))] text-[#4b2710] shadow-[0_0_44px_rgba(201,122,55,0.34)]",
    sparkleClass: "text-[#ffe4bf]",
    labelClass: "border-[#d39a62]/26 bg-[#a95f2e]/14 text-[#f0c79c]",
    eyebrowClass: "text-[#f0c79c]",
    bodyClass: "text-[#f7ebe0]/80",
    buttonClass: "border-[#d39a62]/34 bg-[linear-gradient(135deg,rgba(168,93,39,0.34),rgba(112,57,23,0.28))] text-[#fff1de] hover:bg-[linear-gradient(135deg,rgba(186,106,48,0.4),rgba(128,67,29,0.34))]",
  },
  silver: {
    shellClass: "achievement-unlock-shell--silver border-[#b7c3d4]/28 ring-white/8 bg-[linear-gradient(180deg,rgba(16,20,28,0.98),rgba(11,13,18,0.99))]",
    auraClass: "bg-[radial-gradient(circle_at_top,rgba(191,213,255,0.22),transparent_42%)]",
    medalClass: "achievement-medal-burst--silver border-[#d5e1f3]/34 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.96),rgba(191,201,220,0.95),rgba(94,108,130,0.96))] text-[#223046] shadow-[0_0_44px_rgba(167,190,226,0.26)]",
    sparkleClass: "text-[#eef6ff]",
    labelClass: "border-[#c5d3ea]/24 bg-[#7d8ea9]/14 text-[#dce6f7]",
    eyebrowClass: "text-[#dce6f7]",
    bodyClass: "text-[#eef2f8]/82",
    buttonClass: "border-[#c5d3ea]/24 bg-[linear-gradient(135deg,rgba(117,133,159,0.3),rgba(72,84,104,0.26))] text-[#f7fbff] hover:bg-[linear-gradient(135deg,rgba(129,146,175,0.36),rgba(81,94,117,0.32))]",
  },
  gold: {
    shellClass: "achievement-unlock-shell--gold border-[#f2cb7c]/30 ring-[#fff2cf]/10 bg-[linear-gradient(180deg,rgba(30,20,7,0.98),rgba(16,12,7,0.99))]",
    auraClass: "bg-[radial-gradient(circle_at_top,rgba(255,205,96,0.28),transparent_42%)]",
    medalClass: "achievement-medal-burst--gold border-[#f6d58d]/38 bg-[radial-gradient(circle_at_30%_28%,rgba(255,250,231,0.98),rgba(248,206,98,0.96),rgba(163,105,18,0.98))] text-[#4c3208] shadow-[0_0_54px_rgba(247,196,74,0.34)]",
    sparkleClass: "text-[#fff3ce]",
    labelClass: "border-[#f2cb7c]/28 bg-[#d0942e]/16 text-[#ffe6aa]",
    eyebrowClass: "text-[#ffe6aa]",
    bodyClass: "text-[#fff4df]/82",
    buttonClass: "border-[#f2cb7c]/34 bg-[linear-gradient(135deg,rgba(210,147,36,0.34),rgba(137,88,17,0.3))] text-[#fff6e6] hover:bg-[linear-gradient(135deg,rgba(225,162,47,0.42),rgba(155,99,20,0.34))]",
  },
};

export default function AchievementUnlockModal({
  isOpen,
  onClose,
  title = "Primer voto",
  message = "Votaste por primera vez a un artista o album. Puedes ver esta medalla en tu perfil.",
  tier = "bronze",
  tierLabel = "Medalla de bronce",
}) {
  const palette = TIER_STYLES[tier] ?? TIER_STYLES.bronze;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[260] bg-[rgba(9,5,3,0.62)] backdrop-blur-md"
          onClick={onClose}
        >
          <div className="flex min-h-screen items-center justify-center px-4 py-6">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.24, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className={`achievement-unlock-shell relative w-full max-w-lg overflow-hidden rounded-[2rem] border p-6 text-center shadow-[0_40px_140px_rgba(0,0,0,0.52)] ring-1 sm:p-8 ${palette.shellClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`pointer-events-none absolute inset-0 ${palette.auraClass}`} />
              {tier === "gold" ? <div className="achievement-gold-explosion pointer-events-none absolute inset-0" /> : null}
              <motion.div
                initial={{ opacity: 0, scale: 0.2, rotate: -6 }}
                animate={{ opacity: 1, scale: [0.2, 1.12, 1], rotate: [0, 4, 0] }}
                exit={{ opacity: 0, scale: 0.8, y: -14 }}
                transition={{ duration: 0.42, delay: 0.04, times: [0, 0.76, 1], ease: [0.16, 1, 0.3, 1] }}
                className={`achievement-medal-burst relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border ${palette.medalClass}`}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12, delay: 0.24 }}
                  className="flex items-center justify-center"
                >
                  <Medal className="h-11 w-11" />
                  <Sparkles className={`absolute -top-2 -right-1 h-5 w-5 ${palette.sparkleClass}`} />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.42, ease: "easeOut" }}
                className="relative"
              >
                <div className={`mt-6 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] ${palette.labelClass}`}>
                  {tierLabel}
                </div>
                <p className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] ${palette.eyebrowClass}`}>Logro completado!</p>
                <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">{title}</h2>
                <p className={`mx-auto mt-4 max-w-md text-sm leading-relaxed sm:text-base ${palette.bodyClass}`}>{message}</p>
              </motion.div>

              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.54, ease: "easeOut" }}
                onClick={onClose}
                className={`mt-7 inline-flex min-w-40 items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition ${palette.buttonClass}`}
              >
                Aceptar
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
