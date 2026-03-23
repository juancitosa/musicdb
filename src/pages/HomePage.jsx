import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Disc3, Flame, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SpotifyAlbumCard } from "../components/shared/AlbumCard";
import { SpotifyArtistCard } from "../components/shared/ArtistCard";
import SectionHeader from "../components/shared/SectionHeader";
import SkeletonCard from "../components/shared/SkeletonCard";
import { useTheme } from "../hooks/useTheme";
import { getFeaturedArtists, getFeaturedNewReleases, getImageUrl } from "../services/spotify";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function HomePage() {
  const { theme } = useTheme();
  const [topArtists, setTopArtists] = useState([]);
  const [featuredAlbums, setFeaturedAlbums] = useState([]);
  const [newReleasesPage, setNewReleasesPage] = useState(0);
  const [newReleasesDirection, setNewReleasesDirection] = useState(1);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      setLoadingSections(true);
      setNewReleasesPage(0);

      try {
        const [artistsResponse, albumResponse] = await Promise.all([
          getFeaturedArtists(),
          getFeaturedNewReleases(null, 50),
        ]);

        if (cancelled) {
          return;
        }

        setTopArtists((artistsResponse ?? []).slice(0, 10));
        setFeaturedAlbums(albumResponse ?? []);
      } catch {
        if (!cancelled) {
          setTopArtists([]);
          setFeaturedAlbums([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSections(false);
        }
      }
    }

    loadHome();

    return () => {
      cancelled = true;
    };
  }, []);

  const featuredArtist = topArtists[0] ?? null;
  const newReleasesPageSize = 5;
  const newReleasesPageCount = Math.max(Math.ceil(featuredAlbums.length / newReleasesPageSize), 1);
  const visibleAlbums = featuredAlbums.slice(newReleasesPage * newReleasesPageSize, newReleasesPage * newReleasesPageSize + newReleasesPageSize);

  useEffect(() => {
    if (featuredAlbums.length <= newReleasesPageSize) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNewReleasesDirection(1);
      setNewReleasesPage((current) => (current + 1) % newReleasesPageCount);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [featuredAlbums.length, newReleasesPageCount]);

  useEffect(() => {
    if (newReleasesPage >= newReleasesPageCount) {
      setNewReleasesPage(0);
    }
  }, [newReleasesPage, newReleasesPageCount]);

  function renderAlbumCard(album) {
    return (
      <motion.div key={album.id} variants={itemVariants}>
        <SpotifyAlbumCard album={album} />
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
                Artista destacado
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

      <div className="space-y-16 px-4 sm:px-6 lg:px-8">
        {topArtists.length > 0 ? (
          <section>
            <SectionHeader
              icon={<Flame className="h-6 w-6 text-primary" />}
              title="Artistas Populares"
              subtitle="Descubrí artistas populares del catálogo de Spotify"
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
          <div className="mb-6 flex items-center justify-between gap-4">
            <SectionHeader icon={<Disc3 className="h-6 w-6 text-primary" />} title="Nuevos Lanzamientos" subtitle="Los álbumes más recientes del catálogo" />
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
                  aria-label="Ver más lanzamientos"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
          {loadingSections ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : featuredAlbums.length > 0 ? (
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
                  {visibleAlbums.map((album) => renderAlbumCard(album))}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/50 py-12 text-center text-muted-foreground">
              No encontramos lanzamientos de 2026 en adelante para mostrar ahora mismo.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
