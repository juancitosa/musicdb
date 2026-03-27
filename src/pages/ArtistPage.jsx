import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Disc3, ExternalLink, Flame, Gem, Heart, MessageCircle, MessageSquareText, Music4, Star, Trash2, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LocalAlbumCard, SpotifyAlbumCard } from "../components/shared/AlbumCard";
import AuthRestrictionMessage from "../components/shared/AuthRestrictionMessage";
import PopularityBar from "../components/shared/PopularityBar";
import RatingStars from "../components/shared/RatingStars";
import SkeletonCard from "../components/shared/SkeletonCard";
import UserPreviewModal from "../components/shared/UserPreviewModal";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { useToast } from "../hooks/useToast";
import { getMockArtist, getMockArtistAlbums } from "../services/catalog";
import { DEFAULT_RATINGS_SUMMARY, getRankings, getRatings, getUserRating, submitRating } from "../services/ratingHistory";
import { createReview, createReviewReply, deleteReview, deleteReviewReply, fetchPublicUserPreview, getReviews, toggleReviewLike } from "../services/reviewHistory";
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
  const { hasActiveSession, isLoggedIn, user, appToken, isSpotifyUser } = useAuth();
  const { isSpotifyConnected, spotifyToken } = useSpotifyAuth();
  const { toast } = useToast();
  const hasSpotifyFeatures = isSpotifyUser && isSpotifyConnected && Boolean(spotifyToken);
  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [likedTracksTotal, setLikedTracksTotal] = useState(0);
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
  const [deletingReplyId, setDeletingReplyId] = useState(null);
  const [submittingReplyForReviewId, setSubmittingReplyForReviewId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [expandedReplyComposerId, setExpandedReplyComposerId] = useState(null);
  const [togglingLikeReviewId, setTogglingLikeReviewId] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [releaseFilter, setReleaseFilter] = useState("all");
  const [artistRankingPosition, setArtistRankingPosition] = useState(null);
  const canInteract = hasActiveSession && isLoggedIn;
  const currentUserId = user?.id ?? null;

  async function reloadReviews(nextArtist = artist) {
    if (!nextArtist) {
      setReviews([]);
      return;
    }

    const nextReviews = await getReviews("artist", String(nextArtist.id), appToken);
    setReviews(nextReviews);
  }

  useEffect(() => {
    async function loadArtist() {
      if (!id) return;

      const localArtist = getMockArtist(id);
      if (localArtist) {
        setArtist(localArtist);
        setAlbums(getMockArtistAlbums(id));
        setLikedTracks([]);
        setLikedTracksTotal(0);
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
      if (!id || isLocal || !hasSpotifyFeatures) {
        setLikedTracks([]);
        setLikedTracksTotal(0);
        setLikedTracksError("");
        setShowLikedTracks(false);
        return;
      }

      setIsLoadingLikedTracks(true);
      setLikedTracksError("");

      try {
        const response = await getLikedTracksByArtist(spotifyToken, id);
        setLikedTracks(response.items ?? []);
        setLikedTracksTotal(Number(response.total) || 0);
      } catch {
        setLikedTracks([]);
        setLikedTracksTotal(0);
        setLikedTracksError("Reconecta Spotify para ver tus canciones guardadas de este artista.");
      } finally {
        setIsLoadingLikedTracks(false);
      }
    }

    loadLikedTracks();
  }, [hasSpotifyFeatures, id, isLocal, spotifyToken]);

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
  }, [artist, appToken]);

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
        const response = await getUserRating(appToken, "artist", String(artist.id));

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
  }, [appToken, artist, currentUserId]);

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
        const nextReviews = await getReviews("artist", String(artist.id), appToken);

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
        <div className="relative mx-4 mt-4 h-[38vh] min-h-[280px] animate-pulse rounded-3xl bg-secondary sm:mx-6 sm:min-h-[320px] lg:mx-8" />
        <div className="mt-10 grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-4 rounded bg-secondary" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="mb-6 h-8 w-48 rounded bg-secondary" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
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
  const likedSongsCount = likedTracksTotal;
  const rankingBadge = artistRankingPosition ? getArtistRankingBadge(artistRankingPosition) : null;

  async function handleRateArtist(nextRating) {
    if (!hasActiveSession || !artist || !currentUserId || !appToken) {
      setRatingsError("Tenes que iniciar sesion");
      throw new Error("AUTH_REQUIRED");
    }

    setIsSubmittingRating(true);
    setRatingsError("");

    try {
      const response = await submitRating({
        session_token: appToken,
        entity_type: "artist",
        entity_id: String(artist.id),
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
      } else if (ratingError?.message !== "AUTH_REQUIRED") {
        setRatingsError("No pudimos guardar tu voto. Intenta nuevamente.");
      }
      throw ratingError;
    } finally {
      setIsSubmittingRating(false);
    }
  }

  async function handleSubmitReview(event) {
    event.preventDefault();

    if (!canInteract || !artist || !currentUserId || !appToken) {
      setReviewError("Tenes que iniciar sesion");
      return;
    }

    if (!reviewText.trim()) {
      return;
    }

    setIsSubmittingReview(true);
    setReviewError("");

    try {
      const response = await createReview({
        session_token: appToken,
        entity_type: "artist",
        entity_id: String(artist.id),
        review_text: reviewText.trim(),
        rating_value: userRating || null,
      });

      await reloadReviews();
      setReviewText("");
      if (response?.usage && !response.usage.is_pro && response.usage.remaining?.reviews !== null) {
        toast({
          title: "Reseña guardada",
          description: `Te quedan ${response.usage.remaining.reviews} reseñas hoy.`,
        });
      }
    } catch (reviewRequestError) {
      if (reviewRequestError?.message === "REVIEW_ALREADY_EXISTS") {
        setReviewError("Ya dejaste una reseña para este artista.");
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
    if (!canInteract || !currentUserId || !reviewId || !appToken) {
      setReviewError("Tenes que iniciar sesion");
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

  async function handleToggleReviewLike(reviewId) {
    if (!canInteract || !reviewId || !appToken) {
      setReviewError("Tenes que iniciar sesion");
      return;
    }

    setTogglingLikeReviewId(reviewId);
    setReviewError("");

    try {
      const nextState = await toggleReviewLike(reviewId, appToken);
      setReviews((currentReviews) =>
        currentReviews.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                likes_count: nextState.likes_count,
                liked_by_me: nextState.liked_by_me,
              }
            : review,
        ),
      );
    } catch {
      setReviewError("No pudimos actualizar el like. Intenta nuevamente.");
    } finally {
      setTogglingLikeReviewId(null);
    }
  }

  function handleReplyDraftChange(reviewId, value) {
    setReplyDrafts((currentDrafts) => ({
      ...currentDrafts,
      [reviewId]: value,
    }));
  }

  async function handleSubmitReviewReply(reviewId) {
    if (!canInteract || !reviewId || !appToken) {
      setReviewError("Tenes que iniciar sesion");
      return;
    }

    const draft = replyDrafts[reviewId]?.trim() ?? "";

    if (!draft) {
      return;
    }

    setSubmittingReplyForReviewId(reviewId);
    setReviewError("");

    try {
      const response = await createReviewReply({
        review_id: reviewId,
        reply_text: draft,
        session_token: appToken,
      });

      await reloadReviews();
      setReplyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [reviewId]: "",
      }));
      setExpandedReplyComposerId(reviewId);

      if (response?.usage && !response.usage.is_pro && response.usage.remaining?.reviews !== null) {
        toast({
          title: "Respuesta guardada",
          description: `Te quedan ${response.usage.remaining.reviews} reseñas hoy.`,
        });
      }
    } catch (replyError) {
      if (replyError?.message === "DAILY_REVIEW_LIMIT_REACHED") {
        setReviewError("Alcanzaste el límite de 10 reseñas/respuestas en 24 horas. Hazte PRO para desbloquear más.");
      } else {
        setReviewError("No pudimos guardar la respuesta. Intenta nuevamente.");
      }
    } finally {
      setSubmittingReplyForReviewId(null);
    }
  }

  async function handleDeleteReviewReply(replyId) {
    if (!canInteract || !replyId || !appToken) {
      setReviewError("Tenes que iniciar sesion");
      return;
    }

    setDeletingReplyId(replyId);
    setReviewError("");

    try {
      await deleteReviewReply(replyId, appToken);
      setReviews((currentReviews) =>
        currentReviews.map((review) => ({
          ...review,
          replies: review.replies.filter((reply) => reply.id !== replyId),
        })),
      );
    } catch {
      setReviewError("No pudimos eliminar la respuesta.");
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function handleOpenUserPreview(review) {
    if (!review?.user_id) {
      return;
    }

    setIsPreviewOpen(true);
    setIsPreviewLoading(true);
    setPreviewUser({
      id: review.user_id,
      username: review.username,
      avatar_url: review.avatar_url,
      banner_url: "",
      is_pro: review.is_pro,
    });

    try {
      const nextUser = await fetchPublicUserPreview(review.user_id);
      setPreviewUser(nextUser);
    } catch {
      setPreviewUser({
        id: review.user_id,
        username: review.username,
        avatar_url: review.avatar_url,
        banner_url: "",
        is_pro: review.is_pro,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }

  return (
    <div className="animate-in pb-12 duration-500">
      <div className="relative mx-4 mt-4 h-[42vh] min-h-[320px] overflow-hidden rounded-3xl shadow-2xl sm:mx-6 sm:min-h-[350px] lg:mx-8">
        <div className="absolute inset-0">
          <img src={image} alt={artist.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="absolute right-0 bottom-0 left-0 flex flex-col items-start justify-between gap-6 p-5 sm:p-8 md:flex-row md:items-end md:p-12">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap gap-2">
              {genres.slice(0, 3).map((genre) => (
                <span key={genre} className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 capitalize">
                  {genre}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl md:text-7xl">{artist.name}</h1>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 text-white/90 sm:flex sm:w-auto sm:flex-wrap sm:gap-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md sm:p-4">
              <Users className="mb-1 h-6 w-6 text-primary" />
              <span className="block text-xl font-bold">{(followers / 1e6).toFixed(1)}M</span>
              <span className="text-xs uppercase tracking-wider text-white/60">Seguidores</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md sm:p-4">
              <Disc3 className="mb-1 h-6 w-6 text-primary" />
              <span className="block text-xl font-bold">{popularity}</span>
              <span className="text-xs uppercase tracking-wider text-white/60">Popular.</span>
            </div>
            {artistRankingPosition ? (
              <div className={`col-span-2 rounded-xl border p-3 backdrop-blur-md sm:col-span-1 sm:p-4 ${rankingBadge.wrapperClass}`}>
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

      <div className="mt-10 grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">
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

          {!isLocal && hasSpotifyFeatures ? (
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
                  placeholder="¿Qué te parece este artista?"
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
                  <div key={review.id} className={`rounded-2xl border p-4 ${review.is_pro ? "pro-review-card" : "border-border/70 bg-background/50"}`}>
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => handleOpenUserPreview(review)}
                        className="flex min-w-0 cursor-pointer items-start gap-3 text-left transition hover:opacity-90"
                      >
                        {review.avatar_url ? (
                          <img src={review.avatar_url} alt={review.username} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
                            {(review.username ?? "").trim() ? (review.username ?? "U").charAt(0).toUpperCase() : <UserRound className="h-4 w-4" />}
                          </div>
                        )}
                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`font-semibold ${review.is_pro ? "pro-username" : ""}`}>{review.username}</span>
                            {review.is_pro ? <Star className="h-4 w-4 fill-current pro-username" /> : null}
                            <span className="text-xs text-muted-foreground">{formatReviewDate(review.created_at)}</span>
                          </div>
                        </div>
                      </button>
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
                      <div className="mb-3 origin-left scale-75">
                        <RatingStars initialRating={review.rating_value} readonly max={10} size="sm" />
                      </div>
                    ) : null}
                    <p className="text-sm leading-relaxed text-muted-foreground">{review.review_text}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
                      <button
                        type="button"
                        onClick={() => handleToggleReviewLike(review.id)}
                        disabled={togglingLikeReviewId === review.id}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          review.liked_by_me
                            ? "border-rose-300/40 bg-rose-500/10 text-rose-200"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        } disabled:cursor-wait disabled:opacity-60`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${review.liked_by_me ? "fill-current" : ""}`} />
                        <span>{review.likes_count} Me gusta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedReplyComposerId((current) => (current === review.id ? null : review.id))}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Responder</span>
                      </button>
                      {review.replies.length > 0 ? <span className="text-xs text-muted-foreground">{review.replies.length} respuestas</span> : null}
                    </div>

                    {review.replies.length > 0 ? (
                      <div className="mt-4 space-y-3 border-l border-border/80 pl-4">
                        {review.replies.map((reply) => (
                          <div key={reply.id} className="rounded-xl border border-border/60 bg-black/10 p-3">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => handleOpenUserPreview(reply)}
                                className="flex min-w-0 items-start gap-3 text-left transition hover:opacity-90"
                              >
                                {reply.avatar_url ? (
                                  <img src={reply.avatar_url} alt={reply.username} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                                    {(reply.username ?? "").trim() ? (reply.username ?? "U").charAt(0).toUpperCase() : <UserRound className="h-3.5 w-3.5" />}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className={`text-sm font-semibold ${reply.is_pro ? "pro-username" : ""}`}>{reply.username}</span>
                                    {reply.is_pro ? <Star className="h-3.5 w-3.5 fill-current pro-username" /> : null}
                                    <span className="text-[11px] text-muted-foreground">{formatReviewDate(reply.created_at)}</span>
                                  </div>
                                </div>
                              </button>
                              {reply.user_id === currentUserId ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReviewReply(reply.id)}
                                  disabled={deletingReplyId === reply.id}
                                  className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-wait disabled:opacity-60"
                                  aria-label="Eliminar respuesta"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground">{reply.reply_text}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {expandedReplyComposerId === review.id ? (
                      <div className="mt-4 space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
                        <textarea
                          rows={3}
                          value={replyDrafts[review.id] ?? ""}
                          onChange={(event) => handleReplyDraftChange(review.id, event.target.value)}
                          placeholder="Responder esta reseña..."
                          className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">Si no sos PRO, esta respuesta consume 1 crédito de reseñas.</p>
                          <Button
                            type="button"
                            onClick={() => handleSubmitReviewReply(review.id)}
                            disabled={!String(replyDrafts[review.id] ?? "").trim() || submittingReplyForReviewId === review.id}
                            className="rounded-lg"
                          >
                            {submittingReplyForReviewId === review.id ? "Respondiendo..." : "Publicar respuesta"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Todavía no hay reseñas reales para este artista.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Disc3 className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold sm:text-3xl">Discografia</h2>
              <span className="text-sm text-muted-foreground">{filteredAlbums.length} lanzamientos</span>
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
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
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
      <UserPreviewModal
        isOpen={isPreviewOpen}
        isLoading={isPreviewLoading}
        user={previewUser}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewUser(null);
        }}
      />
    </div>
  );
}

