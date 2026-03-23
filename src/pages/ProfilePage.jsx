import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Disc3, Flame, Play, Search, Star, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import SectionHeader from "../components/shared/SectionHeader";
import Button from "../components/ui/Button";
import { getMockAlbum, getMockArtist } from "../services/catalog";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { getMyRatings } from "../services/ratingHistory";
import {
  formatTrackDuration,
  getAlbumById,
  getArtistById,
  getCurrentlyPlayingTrack,
  getImageUrl,
  getTopAlbumsFromTopTracks,
  getTopArtists,
  getTopTracks,
} from "../services/spotify";

const filters = [
  { key: "all", label: "Todo" },
  { key: "artist", label: "Artistas" },
  { key: "album", label: "Albumes" },
];

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatProUntil(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function getEntityDetails(rating) {
  if (rating.entity_type === "artist") {
    const localArtist = getMockArtist(rating.entity_id);

    if (localArtist) {
      return {
        name: localArtist.name,
        genres: [localArtist.genre],
        images: localArtist.image ? [{ url: localArtist.image }] : [],
      };
    }

    return getArtistById(rating.entity_id);
  }

  const localAlbum = getMockAlbum(rating.entity_id);

  if (localAlbum) {
    return {
      name: localAlbum.title,
      artists: localAlbum.artist ? [{ name: localAlbum.artist }] : [],
      release_date: localAlbum.year ? `${localAlbum.year}` : "",
      images: localAlbum.coverArt ? [{ url: localAlbum.coverArt }] : [],
    };
  }

  return getAlbumById(rating.entity_id);
}

function normalizeRatingEntry(rating, entity) {
  if (rating.entity_type === "artist") {
    return {
      id: rating.id ?? `${rating.entity_type}-${rating.entity_id}`,
      entityType: "artist",
      entityId: rating.entity_id,
      title: entity?.name ?? "Artista no disponible",
      subtitle: entity?.genres?.slice(0, 2).join(" · ") || "Artista",
      image: getImageUrl(entity?.images),
      href: `/artist/${rating.entity_id}`,
      ratingValue: rating.rating_value,
      updatedAt: rating.updated_at,
    };
  }

  return {
    id: rating.id ?? `${rating.entity_type}-${rating.entity_id}`,
    entityType: "album",
    entityId: rating.entity_id,
    title: entity?.name ?? "Album no disponible",
    subtitle: `${entity?.artists?.[0]?.name ?? "Album"}${entity?.release_date ? ` · ${String(entity.release_date).slice(0, 4)}` : ""}`,
    image: getImageUrl(entity?.images),
    href: `/album/${rating.entity_id}`,
    ratingValue: rating.rating_value,
    updatedAt: rating.updated_at,
  };
}

function RatingHistoryCard({ entry }) {
  return (
    <Link
      to={entry.href}
      className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 transition hover:border-primary/40 hover:bg-secondary/30"
    >
      {entry.image ? (
        <img
          src={entry.image}
          alt={entry.title}
          className={`h-16 w-16 shrink-0 object-cover ${entry.entityType === "artist" ? "rounded-full" : "rounded-2xl"}`}
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Disc3 className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.entityType === "artist" ? "Artista" : "Album"}
          </span>
        </div>
        <p className="truncate text-lg font-semibold">{entry.title}</p>
        <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
      </div>

      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1 text-primary">
          <Star className="h-4 w-4 fill-current" />
          <span className="text-2xl font-black">{entry.ratingValue.toFixed(1)}</span>
        </div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">/10</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.updatedAt)}</p>
      </div>
    </Link>
  );
}

function SpotifyFeatureLock({ isSpotifyUser, onUnlock }) {
  const message = !isSpotifyUser
    ? "Inicia sesion con Spotify para habilitar tus estadisticas personales."
    : "Hazte MusicDB PRO para desbloquear tus tops personales y el escuchando ahora.";

  return (
    <section className="rounded-[1.8rem] border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),linear-gradient(135deg,rgba(14,14,16,0.98),rgba(24,19,14,0.96),rgba(12,12,14,0.98))] p-6 shadow-[0_24px_60px_-36px_rgba(245,158,11,0.5)] sm:p-8">
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100">
        <Star className="h-3.5 w-3.5 fill-current" />
        Spotify + PRO
      </span>
      <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">Tus estadisticas personales viven aca</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/72 sm:text-base">
        {message}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Artistas mas escuchados</p>
          <p className="mt-3 text-sm text-white/68">Tu ranking personal de artistas favoritos en Spotify.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Albumes mas escuchados</p>
          <p className="mt-3 text-sm text-white/68">Los albumes que mas giraron en tu historial reciente.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Escuchando ahora</p>
          <p className="mt-3 text-sm text-white/68">Ve lo que esta sonando en este momento desde tu cuenta.</p>
        </div>
      </div>
      <div className="mt-6">
        <Button
          type="button"
          size="lg"
          onClick={onUnlock}
          className="rounded-full border border-amber-300/40 bg-amber-300/12 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.12)] transition hover:bg-amber-300/18"
        >
          Pagar PRO para desbloquear
        </Button>
      </div>
    </section>
  );
}

function SpotifyStatCard({ title, subtitle, icon, children }) {
  return (
    <section className="rounded-[1.8rem] border border-border bg-card p-6 shadow-lg shadow-black/5">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptySpotifyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const { isLoggedIn, user, appToken, isSpotifyUser } = useAuth();
  const navigate = useNavigate();
  const { isSpotifyConnected, isLoadingSpotify, spotifyToken, spotifyUser } = useSpotifyAuth();
  const profileUser = spotifyUser ?? user;
  const hasSpotifyFeatures = isSpotifyUser && isSpotifyConnected;
  const hasSpotifyStatsAccess = hasSpotifyFeatures && Boolean(user?.isPro) && Boolean(spotifyToken);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyEntries, setHistoryEntries] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [spotifyTopArtists, setSpotifyTopArtists] = useState([]);
  const [spotifyTopAlbums, setSpotifyTopAlbums] = useState([]);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [displayedProgressMs, setDisplayedProgressMs] = useState(0);
  const [isLoadingSpotifyStats, setIsLoadingSpotifyStats] = useState(false);
  const proUntilLabel = user?.isPro ? formatProUntil(user?.proUntil) : "";

  useEffect(() => {
    let cancelled = false;

    async function loadRatingsHistory() {
      if (!appToken) {
        if (!cancelled) {
          setHistoryEntries([]);
        }
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError("");

      try {
        const ratings = await getMyRatings(appToken);
        const hydratedEntries = await Promise.all(
          ratings.map(async (rating) => {
            const entity = await getEntityDetails(rating);
            return normalizeRatingEntry(rating, entity);
          }),
        );

        if (!cancelled) {
          setHistoryEntries(hydratedEntries);
        }
      } catch {
        if (!cancelled) {
          setHistoryEntries([]);
          setHistoryError("No se pudo cargar tu historial de ratings.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadRatingsHistory();

    return () => {
      cancelled = true;
    };
  }, [appToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadSpotifyStats() {
      if (!hasSpotifyStatsAccess) {
        setSpotifyTopArtists([]);
        setSpotifyTopAlbums([]);
        setSpotifyTopTracks([]);
        setCurrentlyPlaying(null);
        setDisplayedProgressMs(0);
        return;
      }

      setIsLoadingSpotifyStats(true);

      try {
        const [artistsResponse, albumsResponse, tracksResponse, playback] = await Promise.all([
          getTopArtists(spotifyToken, 6),
          getTopAlbumsFromTopTracks(spotifyToken, 6, 30),
          getTopTracks(spotifyToken, 6, "medium_term"),
          getCurrentlyPlayingTrack(spotifyToken),
        ]);

        if (cancelled) {
          return;
        }

        setSpotifyTopArtists(artistsResponse?.items ?? []);
        setSpotifyTopAlbums(albumsResponse ?? []);
        setSpotifyTopTracks(tracksResponse?.items ?? []);

        const nextPlayback = playback?.is_playing && playback?.item ? playback : null;
        setCurrentlyPlaying(nextPlayback);
        setDisplayedProgressMs(nextPlayback?.progress_ms ?? 0);
      } catch {
        if (!cancelled) {
          setSpotifyTopArtists([]);
          setSpotifyTopAlbums([]);
          setSpotifyTopTracks([]);
          setCurrentlyPlaying(null);
          setDisplayedProgressMs(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSpotifyStats(false);
        }
      }
    }

    loadSpotifyStats();

    return () => {
      cancelled = true;
    };
  }, [hasSpotifyStatsAccess, spotifyToken]);

  useEffect(() => {
    if (!hasSpotifyStatsAccess) {
      return undefined;
    }

    let cancelled = false;

    async function refreshPlayback() {
      try {
        const playback = await getCurrentlyPlayingTrack(spotifyToken);

        if (cancelled) {
          return;
        }

        const nextPlayback = playback?.is_playing && playback?.item ? playback : null;
        setCurrentlyPlaying(nextPlayback);
        setDisplayedProgressMs(nextPlayback?.progress_ms ?? 0);
      } catch {
        if (!cancelled) {
          setCurrentlyPlaying(null);
          setDisplayedProgressMs(0);
        }
      }
    }

    const intervalId = window.setInterval(refreshPlayback, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasSpotifyStatsAccess, spotifyToken]);

  useEffect(() => {
    if (!currentlyPlaying?.is_playing || !currentlyPlaying?.item?.duration_ms) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDisplayedProgressMs((current) => Math.min(current + 1000, currentlyPlaying.item.duration_ms));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentlyPlaying]);

  const filteredEntries = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return historyEntries.filter((entry) => {
      const matchesFilter = historyFilter === "all" || entry.entityType === historyFilter;
      const matchesSearch =
        !normalizedTerm ||
        entry.title.toLowerCase().includes(normalizedTerm) ||
        entry.subtitle.toLowerCase().includes(normalizedTerm);

      return matchesFilter && matchesSearch;
    });
  }, [historyEntries, historyFilter, searchTerm]);
  const currentTrack = currentlyPlaying?.item ?? null;
  const currentTrackProgress = currentTrack?.duration_ms
    ? Math.min((displayedProgressMs / currentTrack.duration_ms) * 100, 100)
    : 0;

  if (isLoadingSpotify && !profileUser) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 animate-pulse rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-24 w-24 rounded-full bg-secondary" />
            <div className="space-y-3">
              <div className="h-4 w-28 rounded bg-secondary" />
              <div className="h-10 w-56 rounded bg-secondary" />
              <div className="h-4 w-44 rounded bg-secondary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
            {profileUser?.avatar ? (
              <img src={profileUser.avatar} alt={profileUser.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              <UserRound className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-primary">
              {hasSpotifyFeatures ? "Perfil con Spotify" : user?.authProvider === "local" ? "Cuenta MusicDB" : "Perfil de usuario"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className={`text-4xl font-bold ${user?.isPro ? "pro-username" : ""}`}>{profileUser?.name}</h1>
              {user?.isPro ? (
                <span className="pro-badge inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  PRO <Star className="h-3.5 w-3.5 fill-current" />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-muted-foreground">{profileUser?.email || "Sin email visible"}</p>
            {user?.isPro && proUntilLabel ? (
              <p className="mt-2 text-sm font-medium text-amber-200">
                Miembro PRO hasta: <span className="text-amber-100">{proUntilLabel}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Estado de sesion</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="font-semibold">Proveedor:</span> {user?.authProvider === "spotify" ? "Spotify + MusicDB" : "MusicDB"}
            </p>
            <p>
              <span className="font-semibold">Spotify:</span> {hasSpotifyFeatures ? `Conectado como ${spotifyUser?.name ?? "usuario"}` : "No conectado"}
            </p>
            <p>
              <span className="font-semibold">MusicDB PRO:</span> {user?.isPro ? "Activo" : "No activo"}
            </p>
            {user?.isPro && proUntilLabel ? (
              <p>
                <span className="font-semibold">Miembro PRO hasta:</span> {proUntilLabel}
              </p>
            ) : null}
            <p>
              <span className="font-semibold">User ID:</span> {user?.id ?? "No disponible"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Historial de ratings</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Revisa y filtra tus votos de artistas y albumes desde tu perfil.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  if (searchOpen) {
                    setSearchTerm("");
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                aria-label="Buscar en historial"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {searchOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar artista o album..."
                    className="w-full rounded-2xl border border-border bg-background py-3 pr-12 pl-11 text-sm outline-none transition focus:border-primary"
                  />
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      aria-label="Limpiar busqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-5 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setHistoryFilter(filter.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  historyFilter === filter.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/5">
        {isLoadingHistory ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
            Cargando tu historial de ratings...
          </div>
        ) : historyError ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-destructive">
            {historyError}
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <RatingHistoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
            {historyEntries.length > 0
              ? "No hay resultados para ese filtro."
              : "Todavia no registraste ratings. Cuando puntues artistas o albumes, van a aparecer aca."}
          </div>
        )}
      </section>

      <div className="mt-8">
        {hasSpotifyStatsAccess ? (
          <div className="space-y-6">
            <section className="rounded-[1.8rem] border border-border bg-card p-6 shadow-lg shadow-black/5">
              <SectionHeader
                icon={<Play className="h-6 w-6 text-primary fill-current" />}
                title="Escuchando ahora"
                subtitle="Lo que esta reproduciendose en este momento en tu cuenta de Spotify"
              />
              <div className="mt-6">
                {isLoadingSpotifyStats ? (
                  <EmptySpotifyState message="Cargando reproduccion actual..." />
                ) : currentTrack ? (
                  <div className="rounded-[1.6rem] border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="flex items-center gap-4">
                      <img
                        src={getImageUrl(currentTrack.album?.images)}
                        alt={currentTrack.album?.name ?? currentTrack.name}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Spotify Live</p>
                        <h3 className="mt-2 truncate text-xl font-bold">{currentTrack.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {currentTrack.artists?.map((artist) => artist.name).join(", ")}
                        </p>
                        <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {currentTrack.album?.name ?? "Spotify"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${currentTrackProgress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatTrackDuration(displayedProgressMs)}</span>
                        <span>{formatTrackDuration(currentTrack.duration_ms ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptySpotifyState message="No hay una reproduccion activa en Spotify en este momento." />
                )}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <SpotifyStatCard
                icon={<Flame className="h-6 w-6 text-primary" />}
                title="Artistas mas escuchados"
                subtitle="Tus artistas mas reproducidos segun Spotify"
              >
                {isLoadingSpotifyStats ? (
                  <EmptySpotifyState message="Cargando tus artistas favoritos..." />
                ) : spotifyTopArtists.length > 0 ? (
                  <div className="space-y-3">
                    {spotifyTopArtists.map((artist, index) => (
                      <Link
                        key={artist.id}
                        to={`/artist/${artist.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 transition hover:border-primary/35 hover:bg-secondary/30"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <img
                          src={getImageUrl(artist.images)}
                          alt={artist.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{artist.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {artist.genres?.slice(0, 2).join(" • ") || "Artista"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptySpotifyState message="Spotify no devolvio artistas para tu top actual." />
                )}
              </SpotifyStatCard>

              <SpotifyStatCard
                icon={<Disc3 className="h-6 w-6 text-primary" />}
                title="Albumes mas escuchados"
                subtitle="Construido a partir de tus canciones mas escuchadas"
              >
                {isLoadingSpotifyStats ? (
                  <EmptySpotifyState message="Cargando tus albumes mas escuchados..." />
                ) : spotifyTopAlbums.length > 0 ? (
                  <div className="space-y-3">
                    {spotifyTopAlbums.map((album, index) => (
                      <Link
                        key={album.id}
                        to={`/album/${album.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 transition hover:border-primary/35 hover:bg-secondary/30"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <img
                          src={getImageUrl(album.images)}
                          alt={album.name}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{album.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {album.artists?.map((artist) => artist.name).join(", ") || "Album"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptySpotifyState message="Todavia no pudimos construir un top de albumes para esta cuenta." />
                )}
              </SpotifyStatCard>

              <SpotifyStatCard
                icon={<AudioLines className="h-6 w-6 text-primary" />}
                title="Canciones mas escuchadas"
                subtitle="Tus temas mas reproducidos en Spotify"
              >
                {isLoadingSpotifyStats ? (
                  <EmptySpotifyState message="Cargando tus canciones favoritas..." />
                ) : spotifyTopTracks.length > 0 ? (
                  <div className="space-y-3">
                    {spotifyTopTracks.map((track, index) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <img
                          src={getImageUrl(track.album?.images)}
                          alt={track.album?.name ?? track.name}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{track.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {track.artists?.map((artist) => artist.name).join(", ")}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTrackDuration(track.duration_ms ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySpotifyState message="Spotify no devolvio canciones para tu top actual." />
                )}
              </SpotifyStatCard>
            </div>
          </div>
        ) : (
          <SpotifyFeatureLock
            isSpotifyUser={isSpotifyUser}
            onUnlock={() => navigate("/pro")}
          />
        )}
      </div>
    </div>
  );
}
