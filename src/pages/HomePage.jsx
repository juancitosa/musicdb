import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, ChevronLeft, ChevronRight, Disc3, Flame, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SpotifyAlbumCard } from "../components/shared/AlbumCard";
import { SpotifyArtistCard } from "../components/shared/ArtistCard";
import SectionHeader from "../components/shared/SectionHeader";
import SkeletonCard from "../components/shared/SkeletonCard";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { useTheme } from "../hooks/useTheme";
import { formatTrackDuration, getCurrentlyPlayingTrack, getFeaturedArtists, getFeaturedNewReleases, getImageUrl, getTopAlbumsFromTopTracks, getTopArtists, getTopTracks } from "../services/spotify";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const podiumClasses = [
  "bg-linear-to-br from-yellow-500/30 via-amber-400/18 to-card border-yellow-400/50 shadow-[0_18px_40px_rgba(250,204,21,0.16)]",
  "bg-linear-to-br from-slate-200/22 via-zinc-300/12 to-card border-slate-300/45 shadow-[0_18px_40px_rgba(226,232,240,0.12)]",
  "bg-linear-to-br from-orange-700/32 via-amber-700/14 to-card border-orange-500/45 shadow-[0_18px_40px_rgba(194,120,57,0.18)]",
];

const trackRangeOptions = [
  { key: "short_term", label: "Ultimas 4 semanas" },
  { key: "medium_term", label: "Ultimos 6 meses" },
  { key: "long_term", label: "Ultimo año" },
];

const trackRangeFallbacks = {
  short_term: ["short_term", "medium_term", "long_term"],
  medium_term: ["medium_term", "short_term", "long_term"],
  long_term: ["long_term", "medium_term", "short_term"],
};

export default function HomePage() {
  const { isSpotifyConnected, isLoadingSpotify, spotifyToken } = useSpotifyAuth();
  const { theme } = useTheme();
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [resolvedTopTracksRange, setResolvedTopTracksRange] = useState("medium_term");
  const [featuredAlbums, setFeaturedAlbums] = useState([]);
  const [showAllTopAlbums, setShowAllTopAlbums] = useState(false);
  const [newReleasesPage, setNewReleasesPage] = useState(0);
  const [newReleasesDirection, setNewReleasesDirection] = useState(1);
  const [topTracksRange, setTopTracksRange] = useState("medium_term");
  const [loadingSections, setLoadingSections] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [displayedProgressMs, setDisplayedProgressMs] = useState(0);
  const [isNowPlayingExpanded, setIsNowPlayingExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollIntervalId = null;

    async function loadCurrentlyPlaying() {
      if (!isSpotifyConnected || !spotifyToken) {
        setCurrentlyPlaying(null);
        setDisplayedProgressMs(0);
        return;
      }

      try {
        const playback = await getCurrentlyPlayingTrack(spotifyToken);

        if (!cancelled) {
          const nextPlayback = playback?.is_playing && playback?.item ? playback : null;
          setCurrentlyPlaying(nextPlayback);
          setDisplayedProgressMs(nextPlayback?.progress_ms ?? 0);
        }
      } catch {
        if (!cancelled) {
          setCurrentlyPlaying(null);
          setDisplayedProgressMs(0);
        }
      }
    }

    loadCurrentlyPlaying();
    pollIntervalId = window.setInterval(loadCurrentlyPlaying, 5000);

    return () => {
      cancelled = true;
      if (pollIntervalId) {
        window.clearInterval(pollIntervalId);
      }
    };
  }, [isSpotifyConnected, spotifyToken]);

  useEffect(() => {
    if (!currentlyPlaying?.is_playing || !currentlyPlaying?.item?.duration_ms) {
      return undefined;
    }

    const progressIntervalId = window.setInterval(() => {
      setDisplayedProgressMs((current) => Math.min(current + 1000, currentlyPlaying.item.duration_ms));
    }, 1000);

    return () => {
      window.clearInterval(progressIntervalId);
    };
  }, [currentlyPlaying]);

  useEffect(() => {
    async function loadHome() {
      if (isLoadingSpotify) {
        return;
      }

      setLoadingSections(true);
      setShowAllTopAlbums(false);
      setNewReleasesPage(0);

      try {
        const [publicArtists, albumResponse] = await Promise.all([
          isSpotifyConnected && spotifyToken ? getTopArtists(spotifyToken, 10) : getFeaturedArtists(),
          isSpotifyConnected && spotifyToken ? getTopAlbumsFromTopTracks(spotifyToken, 30, 50) : getFeaturedNewReleases(null, 50),
        ]);

        setTopArtists((publicArtists.items ?? publicArtists ?? []).slice(0, 10));
        setFeaturedAlbums(albumResponse ?? []);
      } catch {
        setTopArtists([]);
        setFeaturedAlbums([]);
      }

      if (!isSpotifyConnected || !spotifyToken) {
        setTopTracks([]);
        setResolvedTopTracksRange("medium_term");
        setLoadingSections(false);
        return;
      }

      try {
        const uniqueTracks = new Map();
        let resolvedRange = topTracksRange;

        for (const range of trackRangeFallbacks[topTracksRange] ?? ["medium_term"]) {
          const tracksResponse = await getTopTracks(spotifyToken, 10, range);
          const nextTracks = tracksResponse.items ?? [];

          if (nextTracks.length > 0) {
            if (uniqueTracks.size === 0) {
              resolvedRange = range;
            }

            nextTracks.forEach((track) => {
              if (track?.id && !uniqueTracks.has(track.id)) {
                uniqueTracks.set(track.id, track);
              }
            });
          }

          if (uniqueTracks.size >= 10) {
            break;
          }
        }

        const resolvedTracks = Array.from(uniqueTracks.values()).slice(0, 10);

        if (resolvedTracks.length > 0) {
          setTopTracks(resolvedTracks);
          setResolvedTopTracksRange(resolvedRange);
        }
      } catch {
        // Keep the last successful list instead of leaving the section empty.
      } finally {
        setLoadingSections(false);
      }
    }

    loadHome();
  }, [isLoadingSpotify, isSpotifyConnected, spotifyToken, topTracksRange]);

  const featuredArtist = topArtists[0] ?? null;
  const currentlyPlayingTrack = currentlyPlaying?.item ?? null;
  const currentlyPlayingProgress = currentlyPlayingTrack?.duration_ms
    ? Math.min((displayedProgressMs / currentlyPlayingTrack.duration_ms) * 100, 100)
    : 0;
  const newReleasesPageSize = 5;
  const newReleasesPageCount = Math.max(Math.ceil(featuredAlbums.length / newReleasesPageSize), 1);
  const visibleAlbums = isSpotifyConnected
    ? featuredAlbums.slice(0, 5)
    : featuredAlbums.slice(newReleasesPage * newReleasesPageSize, newReleasesPage * newReleasesPageSize + newReleasesPageSize);
  const extraTopAlbums = isSpotifyConnected ? featuredAlbums.slice(5, 30) : [];

  useEffect(() => {
    if (isSpotifyConnected || featuredAlbums.length <= newReleasesPageSize) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNewReleasesDirection(1);
      setNewReleasesPage((current) => (current + 1) % newReleasesPageCount);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [featuredAlbums.length, isSpotifyConnected, newReleasesPageCount]);

  useEffect(() => {
    if (newReleasesPage >= newReleasesPageCount) {
      setNewReleasesPage(0);
    }
  }, [newReleasesPage, newReleasesPageCount]);

  function renderAlbumCard(album, rank) {
    if (!isSpotifyConnected) {
      return (
        <motion.div key={album.id} variants={itemVariants}>
          <SpotifyAlbumCard album={album} />
        </motion.div>
      );
    }

    const isPodium = rank <= 3;
    const podiumClass = isPodium ? podiumClasses[rank - 1] : "bg-card border-border/60";

    return (
      <motion.div key={album.id} variants={itemVariants} className="relative">
        <div className={`rounded-[1.35rem] border p-1 ${podiumClass}`}>
          <div className="pointer-events-none absolute top-4 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-sm font-bold text-white shadow-lg">
            {rank}
          </div>
          <SpotifyAlbumCard album={album} />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="animate-in pb-12 duration-500">
      <section className="relative mx-4 mt-4 mb-16 flex min-h-[400px] items-end overflow-hidden rounded-3xl shadow-2xl sm:mx-6 lg:mx-8">
        {featuredArtist ? (
          <>
            <div className="absolute inset-0">
              <img src={getImageUrl(featuredArtist.images)} alt={featuredArtist.name} className="h-full w-full object-cover" />
              {theme === "dark" ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-white/10" />
                </>
              )}
            </div>
            <div className="relative flex max-w-2xl flex-col items-start px-6 py-16 sm:py-20 lg:px-12 lg:py-24">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/20 px-3 py-1 text-sm font-medium text-primary backdrop-blur-md">
                <Flame className="h-4 w-4" />
                {isSpotifyConnected ? "Tu artista favorito" : "Artista destacado"}
              </span>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-7xl">
                {featuredArtist.name}
              </motion.h1>
              <div className="mb-6 flex flex-wrap gap-2">
                {(featuredArtist.genres ?? []).slice(0, 3).map((genre) => (
                  <span key={genre} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize text-white/80 backdrop-blur-sm">
                    {genre}
                  </span>
                ))}
              </div>
              <Link
                to={`/artist/${featuredArtist.id}`}
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-105 hover:bg-primary/90"
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Ver perfil
              </Link>
            </div>
          </>
        ) : (
          <div className="h-full min-h-[400px] w-full animate-pulse rounded-3xl bg-secondary" />
        )}
      </section>

      {currentlyPlayingTrack ? (
        <section className="mx-4 -mt-8 mb-12 sm:mx-6 lg:mx-8">
          <motion.div
            layout
            onMouseEnter={() => setIsNowPlayingExpanded(true)}
            onMouseLeave={() => setIsNowPlayingExpanded(false)}
            animate={{
              width: isNowPlayingExpanded ? "100%" : "50%",
            }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-3 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-4 max-md:w-full"
          >
            <motion.div layout className="flex items-center gap-3">
              <motion.img
                layout
                src={getImageUrl(currentlyPlayingTrack.album?.images)}
                alt={currentlyPlayingTrack.album?.name ?? currentlyPlayingTrack.name}
                className={`shrink-0 rounded-2xl object-cover ${isNowPlayingExpanded ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : "h-10 w-10 sm:h-12 sm:w-12"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:text-[11px]">Escuchando ahora</p>
                <p className={`truncate font-semibold ${isNowPlayingExpanded ? "mt-1 text-base sm:text-lg" : "mt-0.5 text-sm sm:text-base"}`}>
                  {currentlyPlayingTrack.name}
                </p>
                <motion.p
                  animate={{
                    opacity: isNowPlayingExpanded ? 1 : 0.78,
                  }}
                  className={`truncate text-muted-foreground ${isNowPlayingExpanded ? "text-sm" : "text-xs"}`}
                >
                  {currentlyPlayingTrack.artists?.map((artist) => artist.name).join(", ")}
                </motion.p>
              </div>
              <motion.div
                animate={{
                  opacity: isNowPlayingExpanded ? 1 : 0,
                  width: isNowPlayingExpanded ? "auto" : 0,
                }}
                className="hidden shrink-0 overflow-hidden text-right sm:block"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Duracion</p>
                <p className="mt-1 font-semibold">{formatTrackDuration(currentlyPlayingTrack.duration_ms ?? 0)}</p>
              </motion.div>
            </motion.div>

            <motion.div
              layout
              animate={{
                marginTop: isNowPlayingExpanded ? 16 : 10,
              }}
            >
              <div className={`overflow-hidden rounded-full bg-secondary ${isNowPlayingExpanded ? "h-2" : "h-1.5"}`}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${currentlyPlayingProgress}%` }} />
              </div>
              <motion.div
                animate={{
                  opacity: isNowPlayingExpanded ? 1 : 0.82,
                }}
                className="mt-2 flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>{formatTrackDuration(displayedProgressMs)}</span>
                <span>{isNowPlayingExpanded ? currentlyPlayingTrack.album?.name ?? "Spotify" : formatTrackDuration(currentlyPlayingTrack.duration_ms ?? 0)}</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>
      ) : null}

      <div className="space-y-16 px-4 sm:px-6 lg:px-8">
        {topArtists.length > 0 ? (
          <section>
            <SectionHeader
              icon={<Flame className="h-6 w-6 text-primary" />}
              title={isSpotifyConnected ? "Tus Artistas Favoritos" : "Artistas Populares"}
              subtitle={isSpotifyConnected ? "Tus artistas más escuchados en Spotify" : "Descubrí artistas populares del catálogo de Spotify"}
            />
            {loadingSections ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
                {topArtists.map((artist) => (
                  <motion.div key={artist.id} variants={itemVariants}>
                    <SpotifyArtistCard artist={artist} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        ) : (
          <section>
            <SectionHeader icon={<Flame className="h-6 w-6 text-primary" />} title="Artistas Populares" subtitle="No pudimos cargar artistas desde Spotify en este momento" />
            <div className="rounded-2xl border border-dashed border-border bg-secondary/50 py-12 text-center text-muted-foreground">
              No se pudieron cargar artistas desde Spotify.
            </div>
          </section>
        )}

        <section>
          {isSpotifyConnected ? (
            <SectionHeader
              icon={<Disc3 className="h-6 w-6 text-primary" />}
              title="Tus Albumes Mas Escuchados"
              subtitle="Top personal armado con tus canciones mas escuchadas en Spotify"
            />
          ) : (
            <div className="mb-6 flex items-center justify-between gap-4">
              <SectionHeader icon={<Disc3 className="h-6 w-6 text-primary" />} title="Nuevos Lanzamientos" subtitle="Los albumes mas recientes del catalogo" />
              {featuredAlbums.length > newReleasesPageSize ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewReleasesDirection(-1);
                      setNewReleasesPage((current) => (current === 0 ? newReleasesPageCount - 1 : current - 1));
                    }}
                    className="rounded-full border border-border/60 bg-card p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                    aria-label="Ver lanzamientos anteriores"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewReleasesDirection(1);
                      setNewReleasesPage((current) => (current + 1) % newReleasesPageCount);
                    }}
                    className="rounded-full border border-border/60 bg-card p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                    aria-label="Ver mas lanzamientos"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
          {loadingSections ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : featuredAlbums.length > 0 ? (
            <>
              {isSpotifyConnected ? (
                <motion.div variants={containerVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
                  {visibleAlbums.map((album, index) => renderAlbumCard(album, index + 1))}
                </motion.div>
              ) : (
                <div className="relative overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`new-release-page-${newReleasesPage}`}
                      custom={newReleasesDirection}
                      initial={{ opacity: 0, x: newReleasesDirection > 0 ? 60 : -60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: newReleasesDirection > 0 ? -60 : 60 }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6"
                    >
                      {visibleAlbums.map((album, index) => renderAlbumCard(album, index + 1))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {isSpotifyConnected && showAllTopAlbums && extraTopAlbums.length > 0 ? (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-100px" }}
                  className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 sm:gap-6"
                >
                  {extraTopAlbums.map((album, index) => renderAlbumCard(album, index + 6))}
                </motion.div>
              ) : null}

              {isSpotifyConnected && featuredAlbums.length > 5 ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllTopAlbums((current) => !current)}
                    className="rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary/80"
                  >
                    {showAllTopAlbums ? "Ver menos" : "Ver mas"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/50 py-12 text-center text-muted-foreground">
              No encontramos lanzamientos de 2026 en adelante para mostrar ahora mismo.
            </div>
          )}
        </section>

        {isSpotifyConnected && topTracks.length > 0 ? (
          <section>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <SectionHeader icon={<AudioLines className="h-6 w-6 text-primary" />} title="Tus Canciones Mas Escuchadas" subtitle="Tu musica favorita segun el periodo que elijas" />
                {resolvedTopTracksRange !== topTracksRange ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Spotify no devolvio canciones para ese periodo y te mostramos el rango mas cercano disponible.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {trackRangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTopTracksRange(option.key)}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                      topTracksRange === option.key
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {topTracks.map((track, index) => (
                <div key={track.id} className="group flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-secondary sm:gap-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold transition group-hover:hidden ${
                      index === 0
                        ? "bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-400/40"
                        : index === 1
                          ? "bg-slate-200/15 text-slate-100 ring-1 ring-slate-300/35"
                          : index === 2
                            ? "bg-orange-700/20 text-orange-100 ring-1 ring-orange-400/35"
                            : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Play className="hidden h-4 w-4 text-primary group-hover:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium transition group-hover:text-primary">{track.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{track.artists.map((artist) => artist.name).join(", ")}</p>
                  </div>
                  <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:block">{track.album?.name}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
