import clsx from "clsx";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";

export default function RatingStars({
  initialRating = 0,
  readonly = false,
  onRate,
  max = 5,
  size = "default",
  disabled = false,
}) {
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [hovered, setHovered] = useState(0);
  const [rating, setRating] = useState(initialRating);
  const canRate = isLoggedIn;
  const iconClassName = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  async function handleRate(nextRating) {
    if (readonly || disabled) {
      return;
    }

    if (!canRate) {
      toast({
        title: "Accion requerida",
        description: "Debes iniciar sesion para puntuar",
        variant: "destructive",
      });
      return;
    }

    try {
      setRating(nextRating);
      await onRate?.(nextRating);
      toast({
        title: "Puntuacion guardada",
        description: `Has calificado con ${nextRating}/${max}`,
      });
    } catch {
      setRating(initialRating);
      toast({
        title: "No se pudo guardar la puntuacion",
        description: "Revisa tu conexion e intenta nuevamente",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: max }, (_, index) => index + 1).map((star) => {
        const active = hovered ? star <= hovered : star <= Math.round(rating);

        return (
          <button
            key={star}
            type="button"
            disabled={readonly || disabled}
            onMouseEnter={() => !readonly && !disabled && setHovered(star)}
            onClick={() => handleRate(star)}
            className={clsx("transition-transform", !readonly && !disabled && "hover:scale-125", disabled && "cursor-wait opacity-60")}
          >
            <Star
              className={clsx(
                `${iconClassName} transition-colors`,
                active ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
