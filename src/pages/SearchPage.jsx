import { motion } from "framer-motion";
import { AudioLines, ChevronLeft, ChevronRight, Disc3, Flame, Search, SearchX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { LocalAlbumCard, SpotifyAlbumCard } from "../components/shared/AlbumCard";
import { LocalArtistCard, SpotifyArtistCard } from "../components/shared/ArtistCard";
import PopularityBar from "../components/shared/PopularityBar";
import SkeletonCard from "../components/shared/SkeletonCard";
import { searchLocalCatalog } from "../services/catalog";
import { formatTrackDuration, getDiscoverArtists, getGlobalTrendingTracks, getImageUrl, searchAlbums, searchArtists } from "../services/spotify";

const DISCOVER_PAGE_SIZE = 3;

function DiscoverArtistCard({ artist }) {
  const isHotArtist = (artist.popularity ?? 0) > 90;

  return (
    <Link
      to={`/artist/${artist.id}`}
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-lg shadow-black/5 transition hover:-translate-y-1 hover:border-primary/30"
    >
      <div className="mb-4 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {getImageUrl(artist.images) ? <img src={getImageUrl(artist.images)} alt={artist.name} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold transition hover:text-primary">{artist.name}</p>
            {isHotArtist ? <Flame className="h-4 w-4 shrink-0 text-orange-400" /> : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{artist.genres?.[0] ? artist.genres[0] : "Spotify artist"}</p>
        </div>
      </div>
      <PopularityBar value={artist.popularity ?? 0} />
    </Link>
  );
}

function DiscoverArtistSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-secondary" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
        </div>
      </div>
      <div className="h-2 animate-pulse rounded-full bg-secondary" />
    </div>
  );
}

function TrendingTrackRow({ track, index }) {
  const topRankClass =
    index === 0
      ? "bg-yellow-500/18 text-yellow-200 ring-1 ring-yellow-400/35"
      : index === 1
        ? "bg-slate-200/15 text-slate-100 ring-1 ring-slate-300/30"
        : index === 2
          ? "bg-orange-700/18 text-orange-100 ring-1 ring-orange-400/30"
          : "bg-primary/12 text-primary";

  return (
    <Link
      to={track.album?.id ? `/album/${track.album.id}` : "/search"}
      className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40"
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${topRankClass}`}>
          {track._rank ?? index + 1}
        </span>
      </div>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {getImageUrl(track.album?.images) ? <img src={getImageUrl(track.album?.images)} alt={track.name} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold transition group-hover:text-primary">{track.name}</p>
        <p className="truncate text-sm text-muted-foreground">{track.artists?.map((artist) => artist.name).join(", ")}</p>
      </div>
      <span className="hidden text-sm text-muted-foreground sm:block">{track.duration_ms ? formatTrackDuration(track.duration_ms) : ""}</span>
    </Link>
  );
}

function TrendingTrackSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="h-10 w-10 animate-pulse rounded-full bg-secondary" />
      <div className="h-14 w-14 animate-pulse rounded-xl bg-secondary" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("all");
  const [spotifyArtists, setSpotifyArtists] = useState([]);
  const [spotifyAlbums, setSpotifyAlbums] = useState([]);
  const [localArtists, setLocalArtists] = useState([]);
  const [localAlbums, setLocalAlbums] = useState([]);
  const [discoverArtists, setDiscoverArtists] = useState([]);
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [artistCarouselIndex, setArtistCarouselIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [error, setError] = useState(null);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async (nextQuery) => {
    if (!nextQuery.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const [artists, albums] = await Promise.all([searchArtists(nextQuery, null, 20), searchAlbums(nextQuery, null, 20)]);

      setSpotifyArtists(artists);
      setSpotifyAlbums(albums);
      setLocalArtists([]);
      setLocalAlbums([]);
    } catch {
      const fallback = searchLocalCatalog(nextQuery);
      setLocalArtists(fallback.artists);
      setLocalAlbums(fallback.albums);
      setSpotifyArtists([]);
      setSpotifyAlbums([]);
      setError("Spotify no respondio. Mostrando resultados limitados.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      runSearch(initialQuery);
    } else {
      setHasSearched(false);
    }
  }, [initialQuery, runSearch]);

  useEffect(() => {
    if (initialQuery) {
      return;
    }

    let cancelled = false;

    async function loadDiscovery() {
      setIsLoadingDiscovery(true);
      setDiscoveryError(null);

      try {
        const [artists, tracks] = await Promise.all([getDiscoverArtists(null, 30, 50), getGlobalTrendingTracks(10)]);

        if (cancelled) {
          return;
        }

        setDiscoverArtists(artists);
        setTrendingTracks(tracks);
        setArtistCarouselIndex(0);
      } catch {
        if (!cancelled) {
          setDiscoverArtists([]);
          setTrendingTracks([]);
          setDiscoveryError("No pudimos cargar el modo explorar en este momento.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDiscovery(false);
        }
      }
    }

    loadDiscovery();

    return () => {
      cancelled = true;
    };
  }, [initialQuery]);

  function handleSearch(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    setSearchParams(trimmedQuery ? { q: trimmedQuery } : {});

    if (!trimmedQuery) {
      setHasSearched(false);
      setSpotifyArtists([]);
      setSpotifyAlbums([]);
      setLocalArtists([]);
      setLocalAlbums([]);
      return;
    }

    runSearch(trimmedQuery);
  }

  const usingLocalResults = spotifyArtists.length + spotifyAlbums.length === 0;
  const visibleArtists = filter === "albums" ? [] : usingLocalResults ? localArtists : spotifyArtists;
  const visibleAlbums = filter === "artists" ? [] : usingLocalResults ? localAlbums : spotifyAlbums;
  const hasResults = visibleArtists.length > 0 || visibleAlbums.length > 0;
  const maxArtistCarouselIndex = Math.max(discoverArtists.length - DISCOVER_PAGE_SIZE, 0);
  const visibleDiscoverArtists = discoverArtists.slice(artistCarouselIndex, artistCarouselIndex + DISCOVER_PAGE_SIZE);

  return (
    <div className="animate-in px-4 py-8 duration-300 sm:px-6 lg:px-8">
      <div className="relative mx-auto mb-10 max-w-3xl">
        <form onSubmit={handleSearch}>
          <Search className="pointer-events-none absolute top-1/2 left-6 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder=""
            className="w-full rounded-2xl border-2 border-border/50 bg-card py-5 pr-24 pl-16 text-xl font-medium shadow-lg shadow-black/5 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 md:pr-28 md:text-2xl"
          />
          {query.trim() ? (
            <button type="submit" className="absolute inset-y-0 right-4 text-sm font-medium text-primary hover:underline">
              Buscar
            </button>
          ) : null}
        </form>
      </div>

      {hasSearched ? (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {[
            { id: "all", label: "Todos" },
            { id: "artists", label: `Artistas (${visibleArtists.length})` },
            { id: "albums", label: `Albumes (${visibleAlbums.length})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-6 py-2 text-sm font-medium transition ${
                filter === item.id ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-10">
          <div>
            <div className="mb-6 h-8 w-32 animate-pulse rounded-lg bg-secondary" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="py-10 text-center text-destructive">{error}</div> : null}

      {!isLoading && !hasSearched ? (
        <div className="space-y-12">
          <div className="py-6 text-center">
            <Disc3 className="mx-auto mb-4 h-16 w-16 text-primary/30" />
            <p className="text-xl text-muted-foreground">Encuentra tus artistas y albumes favoritos.</p>
          </div>

          {discoveryError ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-5 text-center text-destructive">{discoveryError}</div> : null}

          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Artistas para explorar</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setArtistCarouselIndex((current) => Math.max(current - DISCOVER_PAGE_SIZE, 0))}
                  disabled={artistCarouselIndex === 0}
                  className="rounded-full border border-border/60 bg-card p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Ver artistas anteriores"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setArtistCarouselIndex((current) => Math.min(current + DISCOVER_PAGE_SIZE, maxArtistCarouselIndex))}
                  disabled={artistCarouselIndex >= maxArtistCarouselIndex}
                  className="rounded-full border border-border/60 bg-card p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Ver mas artistas"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isLoadingDiscovery ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <DiscoverArtistSkeleton key={index} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {visibleDiscoverArtists.map((artist) => (
                  <DiscoverArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            )}
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <AudioLines className="h-6 w-6 text-primary" />
                Canciones en tendencia
              </h2>
            </div>

            {isLoadingDiscovery ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <TrendingTrackSkeleton key={index} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {trendingTracks.map((track, index) => (
                  <TrendingTrackRow key={`${track.id}-${index}`} track={track} index={index} />
                ))}
              </div>
            )}
          </motion.section>
        </div>
      ) : null}

      {!isLoading && hasSearched && !hasResults && !error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <SearchX className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold">Sin resultados</h3>
          <p className="text-muted-foreground">No encontramos nada para "{query}". Prueba con otros terminos.</p>
        </div>
      ) : null}

      {!isLoading && hasResults ? (
        <div className="space-y-12">
          {visibleArtists.length > 0 ? (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="mb-6 text-2xl font-bold">Artistas</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
                {usingLocalResults
                  ? visibleArtists.map((artist) => <LocalArtistCard key={artist.id} artist={artist} />)
                  : visibleArtists.map((artist) => <SpotifyArtistCard key={artist.id} artist={artist} />)}
              </div>
            </motion.section>
          ) : null}

          {visibleAlbums.length > 0 ? (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="mb-6 text-2xl font-bold">Albumes</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 sm:gap-6">
                {usingLocalResults
                  ? visibleAlbums.map((album) => <LocalAlbumCard key={album.id} album={album} compact />)
                  : visibleAlbums.map((album) => <SpotifyAlbumCard key={album.id} album={album} />)}
              </div>
            </motion.section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
