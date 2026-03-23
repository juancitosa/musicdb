import { Disc3, ExternalLink, ListMusic, Play, Star, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AuthRestrictionMessage from "../components/shared/AuthRestrictionMessage";
import PopularityBar from "../components/shared/PopularityBar";
import RatingStars from "../components/shared/RatingStars";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { getMockAlbum, getMockAlbumTracks, getMockArtist } from "../services/catalog";
import { DEFAULT_RATINGS_SUMMARY, getRatings, getUserRating, submitRating } from "../services/ratingHistory";
import { createReview, deleteReview, getReviews } from "../services/reviewHistory";
import { formatTrackDuration, getAlbumById, getImageUrl } from "../services/spotify";

function formatReviewDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function AlbumPage() {
  const { id } = useParams();
  const { isLoggedIn, user, appToken } = useAuth();
  const { toast } = useToast();
  const [album, setAlbum] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLocal, setIsLocal] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingsSummary, setRatingsSummary] = useState(DEFAULT_RATINGS_SUMMARY);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);
  const [ratingsError, setRatingsError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const canInteract = isLoggedIn;
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    async function loadAlbum() {
      if (!id) return;

      const localAlbum = getMockAlbum(id);
      if (localAlbum) {
        setAlbum(localAlbum);
        setIsLocal(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsLocal(false);

      try {
        const albumResponse = await getAlbumById(id);
        setAlbum(albumResponse);
      } catch {
        setAlbum(null);
        setError("No se pudo cargar el album.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAlbum();
  }, [id]);

  useEffect(() => {
    if (!album) {
      setRatingsSummary(DEFAULT_RATINGS_SUMMARY);
      setRatingsError("");
      return;
    }

    let cancelled = false;

    async function loadRatings() {
      setIsLoadingRatings(true);
      setRatingsError("");

      try {
        const summary = await getRatings("album", String(album.id));

        if (!cancelled) {
          setRatingsSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setRatingsSummary(DEFAULT_RATINGS_SUMMARY);
          setRatingsError("No pudimos cargar los ratings de MusicDB.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRatings(false);
        }
      }
    }

    loadRatings();

    return () => {
      cancelled = true;
    };
  }, [album]);

  useEffect(() => {
    if (!album || !currentUserId) {
      setUserRating(0);
      return;
    }

    let cancelled = false;

    async function loadUserRating() {
      try {
        const response = await getUserRating(appToken, "album", String(album.id));

        if (!cancelled) {
          setUserRating(response.rating_value ?? 0);
        }
      } catch {
        if (!cancelled) {
          setUserRating(0);
        }
      }
    }

    loadUserRating();

    return () => {
      cancelled = true;
    };
  }, [album, appToken, currentUserId]);

  useEffect(() => {
    if (!album) {
      setReviews([]);
      setReviewError("");
      return;
    }

    let cancelled = false;

    async function loadReviews() {
      setIsLoadingReviews(true);
      setReviewError("");

      try {
        const nextReviews = await getReviews("album", String(album.id));

        if (!cancelled) {
          setReviews(nextReviews);
        }
      } catch {
        if (!cancelled) {
          setReviews([]);
          setReviewError("No pudimos cargar las reseñas.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReviews(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [album]);

  const localArtist = isLocal && album ? getMockArtist(album.artistId) : null;
  const localTracks = isLocal && album ? getMockAlbumTracks(album.id) : [];
  const cover = album ? (isLocal ? album.coverArt : getImageUrl(album.images)) : "";
  const releaseYear = album ? (isLocal ? album.year : album.release_date?.split("-")[0]) : "";
  const primaryArtist = album ? (isLocal ? localArtist : album.artists?.[0]) : null;

  async function handleRateAlbum(nextRating) {
    if (!album || !currentUserId || !appToken) {
      throw new Error("RATING_AUTH_REQUIRED");
    }

    setIsSubmittingRating(true);
    setRatingsError("");

    try {
      const response = await submitRating({
        session_token: appToken,
        entity_type: "album",
        entity_id: String(album.id),
        rating_value: nextRating,
      });

      setUserRating(nextRating);
      setRatingsSummary(response.summary ?? DEFAULT_RATINGS_SUMMARY);
      if (response?.usage && !response.usage.is_pro && response.usage.remaining?.ratings !== null) {
        toast({
          title: "Puntuación guardada",
          description: `Te quedan ${response.usage.remaining.ratings} ranks hoy.`,
        });
      }
    } catch (ratingError) {
      if (ratingError?.message === "DAILY_RATING_LIMIT_REACHED") {
        setRatingsError("Alcanzaste el límite de 10 ranks en 24 horas. Hazte PRO para desbloquear más.");
      } else {
        setRatingsError("No pudimos guardar tu voto. Intenta nuevamente.");
      }
      throw ratingError;
    } finally {
      setIsSubmittingRating(false);
    }
  }

  async function handleSubmitReview(event) {
    event.preventDefault();

    if (!reviewText.trim() || !canInteract || !album || !currentUserId || !appToken) {
      return;
    }

    setIsSubmittingReview(true);
    setReviewError("");

    try {
      const response = await createReview({
        session_token: appToken,
        entity_type: "album",
        entity_id: String(album.id),
        review_text: reviewText.trim(),
        rating_value: userRating || null,
      });

      const nextReviews = await getReviews("album", String(album.id));
      setReviews(nextReviews);
      setReviewText("");
      if (response?.usage && !response.usage.is_pro && response.usage.remaining?.reviews !== null) {
        toast({
          title: "Reseña guardada",
          description: `Te quedan ${response.usage.remaining.reviews} reseñas hoy.`,
        });
      }
    } catch (reviewRequestError) {
      if (reviewRequestError?.message === "REVIEW_ALREADY_EXISTS") {
        setReviewError("Ya dejaste una reseña para este álbum.");
      } else if (reviewRequestError?.message === "DAILY_REVIEW_LIMIT_REACHED") {
        setReviewError("Alcanzaste el límite de 10 reseñas en 24 horas. Hazte PRO para desbloquear más.");
      } else {
        setReviewError("No pudimos guardar la reseña. Intenta nuevamente.");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!currentUserId || !reviewId || !appToken) {
      return;
    }

    setDeletingReviewId(reviewId);
    setReviewError("");

    try {
      await deleteReview(reviewId, appToken);
      setReviews((currentReviews) => currentReviews.filter((review) => review.id !== reviewId));
    } catch {
      setReviewError("No pudimos eliminar la reseña.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-8 md:flex-row">
          <div className="aspect-square w-full rounded-2xl bg-secondary md:w-[280px]" />
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-4 w-16 rounded bg-secondary" />
            <div className="h-10 w-3/4 rounded bg-secondary" />
            <div className="h-6 w-1/2 rounded bg-secondary" />
            <div className="h-24 w-full rounded-2xl bg-secondary" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 rounded-xl bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (!album || error) {
    return (
      <div className="px-4 py-20 text-center">
        <Play className="mx-auto mb-4 h-16 w-16 text-primary/30" />
        <h2 className="mb-2 text-2xl font-bold">Álbum no encontrado</h2>
        <p className="text-muted-foreground">{error || "No se pudo cargar este álbum."}</p>
      </div>
    );
  }

  const totalDuration = isLocal ? null : Math.floor((album.tracks?.items ?? []).reduce((sum, track) => sum + track.duration_ms, 0) / 60000);

  return (
    <div className="mx-auto max-w-6xl animate-in px-4 py-8 duration-500 sm:px-6 lg:px-8">
      <div className="mb-14 flex flex-col items-start gap-8 md:flex-row md:gap-12">
        <div className="group w-full max-w-[280px] shrink-0">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/5 shadow-2xl shadow-black/30">
            <img src={cover} alt={isLocal ? album.title : album.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center pt-0 md:pt-4">
          <div className="mb-2 text-sm font-bold uppercase tracking-widest text-primary">
            {isLocal ? "Álbum" : album.album_type === "single" ? "Single" : "Álbum"}
          </div>
          <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">{isLocal ? album.title : album.name}</h1>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {primaryArtist ? (
              <Link to={`/artist/${primaryArtist.id}`} className="font-semibold text-foreground transition hover:text-primary">
                {primaryArtist.name}
              </Link>
            ) : null}
            <span>·</span>
            <span>{releaseYear}</span>
            <span>·</span>
            <span>{isLocal ? album.trackCount : album.total_tracks} canciones</span>
            {!isLocal && totalDuration ? (
              <>
                <span>·</span>
                <span>{totalDuration} min</span>
              </>
            ) : null}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(isLocal ? [album.genre] : album.genres ?? []).map((genre) => (
              <span key={genre} className="rounded-full bg-secondary px-3 py-1 text-xs capitalize">
                {genre}
              </span>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col">
              <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isLocal ? "Calificación" : "Popularidad"}</span>
              {isLocal ? (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-bold">{album.rating}</span>
                  <span className="text-sm text-muted-foreground">/10</span>
                </div>
              ) : (
                <PopularityBar value={album.popularity || 0} />
              )}
            </div>

            <div className="hidden h-10 w-px bg-border sm:block" />

            <div className="flex flex-col">
              <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating en MusicDB</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="text-xl font-bold">
                    {isLoadingRatings ? "..." : ratingsSummary.ratings_count > 0 ? ratingsSummary.average_rating.toFixed(1) : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{ratingsSummary.ratings_count} votos</span>
                </div>
              </div>
              {ratingsError ? <p className="mt-2 text-xs text-destructive">{ratingsError}</p> : null}
            </div>

            <div className="hidden h-10 w-px bg-border sm:block" />

            <div className="flex flex-col">
              <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu puntuacion</span>
              {canInteract ? (
                <RatingStars initialRating={userRating} onRate={handleRateAlbum} max={10} size="sm" disabled={isSubmittingRating || !currentUserId} />
              ) : (
                <AuthRestrictionMessage />
              )}
              {isSubmittingRating ? <p className="mt-2 text-xs text-muted-foreground">Guardando tu voto...</p> : null}
            </div>
          </div>

          {!isLocal ? (
            <a
              href={album.external_urls?.spotify}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Escuchar en Spotify
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center space-x-2 border-b border-border px-4 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="w-8 text-center">#</span>
            <span className="flex-1">Titulo</span>
            <ListMusic className="h-4 w-4" />
          </div>

          <div className="space-y-1">
            {(isLocal ? localTracks : album.tracks?.items ?? []).map((track, index) => (
              <div key={track.id || `${track.name}-${index}`} className="group flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 transition hover:bg-secondary">
                <div className="w-8 text-center text-sm text-muted-foreground group-hover:hidden">{isLocal ? track.trackNumber : track.track_number}</div>
                <Play className="hidden h-4 w-4 shrink-0 text-primary group-hover:block" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium transition group-hover:text-primary">{track.title || track.name}</p>
                  {!isLocal && track.artists?.length > 1 ? (
                    <p className="truncate text-xs text-muted-foreground">{track.artists.map((artist) => artist.name).join(", ")}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-sm text-muted-foreground">{isLocal ? track.duration : formatTrackDuration(track.duration_ms)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-6 flex items-center text-xl font-bold">
              <Disc3 className="mr-2 h-5 w-5 text-primary" />
              Reseñas
            </h3>

            {canInteract ? (
              <form onSubmit={handleSubmitReview} className="mb-8 space-y-4">
                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="¿Qué te pareció el álbum?"
                  className="w-full resize-none rounded-xl border-2 border-border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <Button type="submit" disabled={!reviewText.trim() || isSubmittingReview} className="w-full rounded-lg">
                  {isSubmittingReview ? "Publicando..." : "Publicar reseña"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Podés enviar la reseña con o sin rating. Si ya votaste, se guarda junto con tu comentario.
                </p>
                {reviewError ? <p className="text-center text-xs text-destructive">{reviewError}</p> : null}
              </form>
            ) : (
              <div className="mb-6 rounded-xl border border-border bg-secondary/50 p-4 text-center">
                <p className="mb-2 text-sm text-muted-foreground">Inicia sesión para dejar una reseña y puntuar.</p>
                <AuthRestrictionMessage />
              </div>
            )}

            <div className="space-y-6">
              {isLoadingReviews ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Cargando reseñas...
                </div>
              ) : reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className={`rounded-2xl border border-transparent pb-6 last:border-0 last:pb-0 ${review.is_pro ? "pro-review-card px-4 pt-4" : ""}`}>
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <span className={`font-semibold ${review.is_pro ? "pro-username" : ""}`}>
                          {review.username}
                        </span>
                        {review.is_pro ? <Star className="ml-2 inline h-4 w-4 fill-current pro-username" /> : null}
                        <span className="ml-2 text-xs text-muted-foreground">{formatReviewDate(review.created_at)}</span>
                      </div>
                      {review.user_id === currentUserId ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={deletingReviewId === review.id}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-wait disabled:opacity-60"
                          aria-label="Eliminar reseña"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {review.rating_value ? (
                      <div className="mb-2 origin-left scale-75">
                        <RatingStars initialRating={review.rating_value} readonly max={10} size="sm" />
                      </div>
                    ) : null}
                    <p className="text-sm leading-relaxed text-muted-foreground">{review.review_text}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Todavía no hay reseñas reales para este álbum.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

