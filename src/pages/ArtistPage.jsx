import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Disc3, ExternalLink, Flame, Gem, Heart, MessageSquareText, Music4, Star, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LocalAlbumCard, SpotifyAlbumCard } from "../components/shared/AlbumCard";
import AuthRestrictionMessage from "../components/shared/AuthRestrictionMessage";
import PopularityBar from "../components/shared/PopularityBar";
import RatingStars from "../components/shared/RatingStars";
import SkeletonCard from "../components/shared/SkeletonCard";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { getMockArtist, getMockArtistAlbums } from "../services/catalog";
import { DEFAULT_RATINGS_SUMMARY, getRankings, getRatings, getUserRating, submitRating } from "../services/ratingHistory";
import { createReview, deleteReview, getReviews } from "../services/reviewHistory";
import { formatTrackDuration, getArtistAlbums, getArtistById, getImageUrl, getLikedTracksByArtist } from "../services/spotify";

const releaseFilters = [
  { key: "all", label: "Todo" },
  { key: "album", label: "Albumes" },
  { key: "single", label: "Sencillos" },
  { key: "compilation", label: "Recopilatorios" },
];

function getReleaseType(album) {
  return album.album_group || album.album_type || "album";
}

function sortAlbumsByDate(items) {
  return [...items].sort((left, right) => new Date(right.release_date || 0) - new Date(left.release_date || 0));
}

function formatSavedDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatReviewDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const ARTIST_RANKING_LIMIT = 10;

function getArtistRankingBadge(position) {
  if (position === 1) {
    return {
      wrapperClass:
        "border-cyan-200/60 bg-[linear-gradient(135deg,rgba(190,244,255,0.32),rgba(188,126,255,0.22),rgba(255,255,255,0.08))] shadow-[0_0_24px_rgba(163,230,255,0.28)]",
      numberClass: "ranking-diamond-text",
      iconClass: "text-cyan-100 drop-shadow-[0_0_10px_rgba(190,244,255,0.65)]",
    };
  }

  if (position === 2) {
    return {
      wrapperClass: "border-slate-200/45 bg-[linear-gradient(135deg,rgba(226,232,240,0.24),rgba(148,163,184,0.16),rgba(255,255,255,0.06))]",
      numberClass: "text-slate-100 drop-shadow-[0_0_10px_rgba(226,232,240,0.35)]",
      iconClass: "text-slate-200",
    };
  }

  if (position === 3) {
    return {
      wrapperClass: "border-amber-700/55 bg-[linear-gradient(135deg,rgba(180,83,9,0.28),rgba(217,119,6,0.18),rgba(255,255,255,0.05))]",
      numberClass: "text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]",
      iconClass: "text-amber-300",
    };
  }

  return {
    wrapperClass: "border-white/10 bg-black/30",
    numberClass: "text-white",
    iconClass: "text-orange-300",
  };
}

export default function ArtistPage() {
  const { id } = useParams();
  const { isLoggedIn, user } = useAuth();
  const { isSpotifyConnected, spotifyToken } = useSpotifyAuth();
  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [isLoadingLikedTracks, setIsLoadingLikedTracks] = useState(false);
  const [likedTracksError, setLikedTracksError] = useState("");
  const [showLikedTracks, setShowLikedTracks] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLocal, setIsLocal] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingsSummary, setRatingsSummary] = useState(DEFAULT_RATINGS_SUMMARY);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);
  const [ratingsError, setRatingsError] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviews, setReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [releaseFilter, setReleaseFilter] = useState("all");
  const [artistRankingPosition, setArtistRankingPosition] = useState(null);
  const canInteract = isLoggedIn || isSpotifyConnected;
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    async function loadArtist() {
      if (!id) return;

      const localArtist = getMockArtist(id);
      if (localArtist) {
        setArtist(localArtist);
        setAlbums(getMockArtistAlbums(id));
        setLikedTracks([]);
        setLikedTracksError("");
        setIsLocal(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setIsLocal(false);

      try {
        const [artistResponse, albumsResponse] = await Promise.all([getArtistById(id), getArtistAlbums(id)]);
        setArtist(artistResponse);
        setAlbums(sortAlbumsByDate(albumsResponse.items ?? []));
      } catch {
        setArtist(null);
        setAlbums([]);
        setError("No se pudo cargar el perfil del artista.");
      } finally {
        setIsLoading(false);
      }
    }

    loadArtist();
  }, [id]);

  useEffect(() => {
    async function loadLikedTracks() {
      if (!id || isLocal || !isSpotifyConnected || !spotifyToken) {
        setLikedTracks([]);
        setLikedTracksError("");
        setShowLikedTracks(false);
        return;
      }

      setIsLoadingLikedTracks(true);
      setLikedTracksError("");

      try {
        const response = await getLikedTracksByArtist(spotifyToken, id);
        setLikedTracks(response.items ?? []);
      } catch {
        setLikedTracks([]);
        setLikedTracksError("Reconecta Spotify para ver tus canciones guardadas de este artista.");
      } finally {
        setIsLoadingLikedTracks(false);
      }
    }

    loadLikedTracks();
  }, [id, isLocal, isSpotifyConnected, spotifyToken]);

  useEffect(() => {
    if (!artist) {
      setRatingsSummary(DEFAULT_RATINGS_SUMMARY);
      setRatingsError("");
      return;
    }

    let cancelled = false;

    async function loadRatings() {
      setIsLoadingRatings(true);
      setRatingsError("");

      try {
        const summary = await getRatings("artist", String(artist.id));

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
  }, [artist]);

  useEffect(() => {
    if (!artist || isLocal) {
      setArtistRankingPosition(null);
      return;
    }

    let cancelled = false;

    async function loadArtistRanking() {
      try {
        const rankings = await getRankings("artist", ARTIST_RANKING_LIMIT);
        const position = rankings.findIndex((entry) => String(entry.entity_id) === String(artist.id));

        if (!cancelled) {
          setArtistRankingPosition(position >= 0 ? position + 1 : null);
        }
      } catch {
        if (!cancelled) {
          setArtistRankingPosition(null);
        }
      }
    }

    loadArtistRanking();

    return () => {
      cancelled = true;
    };
  }, [artist, isLocal]);

  useEffect(() => {
    if (!artist || !currentUserId) {
      setUserRating(0);
      return;
    }

    let cancelled = false;

    async function loadUserRating() {
      try {
        const response = await getUserRating(spotifyToken, "artist", String(artist.id));

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
  }, [artist, currentUserId, spotifyToken]);

  useEffect(() => {
    if (!artist) {
      setReviews([]);
      setReviewError("");
      return;
    }

    let cancelled = false;

    async function loadReviews() {
      setIsLoadingReviews(true);
      setReviewError("");

      try {
        const nextReviews = await getReviews("artist", String(artist.id));

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
  }, [artist]);

  if (isLoading) {
    return (
      <div className="animate-in pb-12 duration-300">
        <div className="relative mx-4 mt-4 h-[40vh] min-h-[320px] animate-pulse rounded-3xl bg-secondary sm:mx-6 lg:mx-8" />
        <div className="mt-12 grid grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-4 rounded bg-secondary" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="mb-6 h-8 w-48 rounded bg-secondary" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!artist || error) {
    return (
      <div className="px-4 py-20 text-center">
        <Disc3 className="mx-auto mb-4 h-16 w-16 text-primary/30" />
        <h2 className="mb-2 text-2xl font-bold">Artista no encontrado</h2>
        <p className="text-muted-foreground">{error || "No se pudo cargar este artista."}</p>
      </div>
    );
  }

  const image = isLocal ? artist.image : getImageUrl(artist.images, getImageUrl(albums?.[0]?.images));
  const genres = isLocal ? [artist.genre] : artist.genres ?? [];
  const followers = isLocal ? artist.followers : artist.followers?.total ?? 0;
  const popularity = artist.popularity ?? 0;
  const filteredAlbums = albums.filter((album) => releaseFilter === "all" || getReleaseType(album) === releaseFilter);
  const likedSongsCount = likedTracks.length;
  const rankingBadge = artistRankingPosition ? getArtistRankingBadge(artistRankingPosition) : null;

  async function handleRateArtist(nextRating) {
    if (!artist || !currentUserId || !spotifyToken) {
      throw new Error("RATING_AUTH_REQUIRED");
    }

    setIsSubmittingRating(true);
    setRatingsError("");

    try {
      const response = await submitRating({
        spotify_token: spotifyToken,
        entity_type: "artist",
        entity_id: String(artist.id),
        rating_value: nextRating,
      });

      setUserRating(nextRating);
      setRatingsSummary(response.summary ?? DEFAULT_RATINGS_SUMMARY);
    } catch (ratingError) {
      setRatingsError("No pudimos guardar tu voto. Intentá nuevamente.");
      throw ratingError;
    } finally {
      setIsSubmittingRating(false);
    }
  }

  async function handleSubmitReview(event) {
    event.preventDefault();

    if (!reviewText.trim() || !canInteract || !artist || !currentUserId || !spotifyToken) {
      return;
    }

    setIsSubmittingReview(true);
    setReviewError("");

    try {
      await createReview({
        spotify_token: spotifyToken,
        entity_type: "artist",
        entity_id: String(artist.id),
        review_text: reviewText.trim(),
        rating_value: userRating || null,
      });

      const nextReviews = await getReviews("artist", String(artist.id));
      setReviews(nextReviews);
      setReviewText("");
    } catch (reviewRequestError) {
      if (reviewRequestError?.message === "REVIEW_ALREADY_EXISTS") {
        setReviewError("Ya dejaste una reseña para este artista.");
      } else {
        setReviewError("No pudimos guardar la reseña. Intentá nuevamente.");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!currentUserId || !reviewId || !spotifyToken) {
      return;
    }

    setDeletingReviewId(reviewId);
    setReviewError("");

    try {
      await deleteReview(reviewId, spotifyToken);
      setReviews((currentReviews) => currentReviews.filter((review) => review.id !== reviewId));
    } catch {
      setReviewError("No pudimos eliminar la reseña.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  return (
    <div className="animate-in pb-12 duration-500">
      <div className="relative mx-4 mt-4 h-[40vh] min-h-[350px] overflow-hidden rounded-3xl shadow-2xl sm:mx-6 lg:mx-8">
        <div className="absolute inset-0">
          <img src={image} alt={artist.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="absolute right-0 bottom-0 left-0 flex flex-col items-end justify-between gap-6 p-8 md:flex-row md:p-12">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {genres.slice(0, 3).map((genre) => (
                <span key={genre} className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 capitalize">
                  {genre}
                </span>
              ))}
            </div>
            <h1 className="text-5xl font-black leading-tight text-white md:text-7xl">{artist.name}</h1>
          </div>

          <div className="flex flex-wrap gap-4 text-white/90">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
              <Users className="mb-1 h-6 w-6 text-primary" />
              <span className="block text-xl font-bold">{(followers / 1e6).toFixed(1)}M</span>
              <span className="text-xs uppercase tracking-wider text-white/60">Seguidores</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
              <Disc3 className="mb-1 h-6 w-6 text-primary" />
              <span className="block text-xl font-bold">{popularity}</span>
              <span className="text-xs uppercase tracking-wider text-white/60">Popular.</span>
            </div>
            {artistRankingPosition ? (
              <div className={`rounded-xl border p-4 backdrop-blur-md ${rankingBadge.wrapperClass}`}>
                <Flame className={`mb-1 h-6 w-6 ${rankingBadge.iconClass}`} />
                <span className={`block text-xl font-black ${rankingBadge.numberClass}`}>#{artistRankingPosition}</span>
                <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-white/70">
                  {artistRankingPosition === 1 ? <Gem className="h-3.5 w-3.5" /> : null}
                  DBRanking
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/5">
            <h3 className="mb-5 text-xl font-bold">Informacion</h3>

            {genres.length > 0 ? (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isLocal ? "Genero" : "Generos"}</p>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <span key={genre} className="rounded-full bg-secondary px-2.5 py-1 text-xs capitalize">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {isLocal ? (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pais</p>
                <p className="text-sm font-medium">{artist.country}</p>
              </div>
            ) : null}

            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popularidad</p>
              <PopularityBar value={popularity} />
            </div>

            <div className="mb-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating en MusicDB</p>
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

            <div className="mb-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu puntuacion</p>
              {canInteract ? (
                <RatingStars initialRating={userRating} onRate={handleRateArtist} max={10} size="sm" disabled={isSubmittingRating || !currentUserId} />
              ) : (
                <AuthRestrictionMessage />
              )}
              {isSubmittingRating ? <p className="mt-2 text-xs text-muted-foreground">Guardando tu voto...</p> : null}
            </div>

            <div className="mb-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seguidores</p>
              <p className="font-semibold">{followers.toLocaleString()}</p>
            </div>

            {isLocal ? (
              <div className="rounded-xl border border-border bg-secondary/50 p-3 text-sm leading-relaxed text-muted-foreground">
                {artist.bio}
              </div>
            ) : (
              <a
                href={artist.external_urls?.spotify}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Abrir en Spotify
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </section>

          {!isLocal && isSpotifyConnected ? (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-lg shadow-black/5">
              <button type="button" onClick={() => setShowLikedTracks((current) => !current)} className="flex w-full items-center gap-4 text-left">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                  <img src={image} alt={artist.name} className="h-full w-full object-cover" />
                  <div className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30">
                    <Heart className="h-4 w-4 fill-current" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold leading-tight">{isLoadingLikedTracks ? "Cargando..." : `Te gustan ${likedSongsCount} canciones`}</p>
                  <p className="mt-1 truncate text-lg text-muted-foreground">De {artist.name}</p>
                </div>
                <div className="shrink-0 text-muted-foreground">{showLikedTracks ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
              </button>

              {showLikedTracks ? (
                <div className="mt-4 border-t border-border pt-4">
                  {likedTracksError ? (
                    <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">{likedTracksError}</div>
                  ) : likedSongsCount > 0 ? (
                    <div className="space-y-1">
                      {likedTracks.map((item, index) => (
                        <div key={`${item.track?.id || item.added_at}-${index}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-secondary">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </div>
                          <img src={getImageUrl(item.track?.album?.images)} alt={item.track?.album?.name || item.track?.name} className="h-12 w-12 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.track?.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.track?.album?.name}
                              {item.added_at ? ` · Guardada el ${formatSavedDate(item.added_at)}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-sm text-muted-foreground">{item.track?.duration_ms ? formatTrackDuration(item.track.duration_ms) : ""}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                      No tenes canciones guardadas de este artista todavia.
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/5">
            <h3 className="mb-6 flex items-center text-xl font-bold">
              <MessageSquareText className="mr-2 h-5 w-5 text-primary" />
              Reseñas
            </h3>

            {canInteract ? (
              <form onSubmit={handleSubmitReview} className="mb-8 space-y-4">
                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="¿Que te parece este artista?"
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
                <p className="mb-2 text-sm text-muted-foreground">Inicia sesion o conecta Spotify para dejar una reseña y puntuar.</p>
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
                  <div key={review.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <span className="font-semibold">{review.username}</span>
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
                  Todavia no hay reseñas reales para este artista.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Disc3 className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold">Discografia</h2>
              <span className="ml-1 text-sm text-muted-foreground">{filteredAlbums.length} lanzamientos</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {releaseFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setReleaseFilter(filter.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    releaseFilter === filter.key
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAlbums.length > 0 ? (
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {filteredAlbums.map((album) => (
                <motion.div key={album.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                  {isLocal ? <LocalAlbumCard album={album} compact /> : <SpotifyAlbumCard album={album} />}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/50 py-12 text-center text-muted-foreground">
              <Music4 className="mx-auto mb-3 h-8 w-8 text-primary/50" />
              No hay lanzamientos para este filtro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
