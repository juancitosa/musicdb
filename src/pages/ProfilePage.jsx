import { AnimatePresence, motion } from "framer-motion";
import { Disc3, Search, Star, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { getMockAlbum, getMockArtist } from "../services/catalog";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { getMyRatings } from "../services/ratingHistory";
import { getAlbumById, getArtistById, getImageUrl } from "../services/spotify";

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

export default function ProfilePage() {
  const { isLoggedIn, user, appToken, isSpotifyUser } = useAuth();
  const { isSpotifyConnected, isLoadingSpotify, spotifyUser } = useSpotifyAuth();
  const profileUser = spotifyUser ?? user;
  const hasSpotifyFeatures = isSpotifyUser && isSpotifyConnected;
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyEntries, setHistoryEntries] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

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
            <h1 className="text-4xl font-bold">{profileUser?.name}</h1>
            <p className="mt-1 text-muted-foreground">{profileUser?.email || "Sin email visible"}</p>
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
    </div>
  );
}
