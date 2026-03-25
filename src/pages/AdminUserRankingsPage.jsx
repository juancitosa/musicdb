import { ArrowLeft, Disc3, LoaderCircle, ShieldAlert, Star, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { getSupabaseClient } from "../lib/supabase";
import { getMockAlbum, getMockArtist } from "../services/catalog";
import { getAlbumById, getArtistById, getImageUrl } from "../services/spotify";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
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
      id: rating.id,
      entityType: "artist",
      title: entity?.name ?? "Artista no disponible",
      subtitle: entity?.genres?.slice(0, 2).join(" - ") || "Artista",
      image: getImageUrl(entity?.images),
      href: `/artist/${rating.entity_id}`,
      ratingValue: Number(rating.rating_value ?? 0),
      updatedAt: rating.updated_at,
    };
  }

  return {
    id: rating.id,
    entityType: "album",
    title: entity?.name ?? "Album no disponible",
    subtitle: `${entity?.artists?.[0]?.name ?? "Album"}${entity?.release_date ? ` - ${String(entity.release_date).slice(0, 4)}` : ""}`,
    image: getImageUrl(entity?.images),
    href: `/album/${rating.entity_id}`,
    ratingValue: Number(rating.rating_value ?? 0),
    updatedAt: rating.updated_at,
  };
}

export default function AdminUserRankingsPage() {
  const { userId } = useParams();
  const { isLoading, isLoggedIn, currentUser, isCurrentUserLoading } = useAuth();
  const [userRecord, setUserRecord] = useState(null);
  const [entries, setEntries] = useState([]);
  const [isFetchingEntries, setIsFetchingEntries] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCurrentUserLoading || !currentUser?.isAdmin || !userId) {
      return;
    }

    let cancelled = false;

    async function loadRankings() {
      setIsFetchingEntries(true);
      setError("");

      try {
        const supabase = getSupabaseClient();
        const [{ data: userData, error: userError }, { data: ratingsData, error: ratingsError }] = await Promise.all([
          supabase.from("users").select("*").eq("id", userId).single(),
          supabase.from("ratings").select("id, entity_type, entity_id, rating_value, updated_at").eq("user_id", userId).order("rating_value", { ascending: false }).limit(30),
        ]);

        if (userError) {
          throw userError;
        }

        if (ratingsError) {
          throw ratingsError;
        }

        const hydratedEntries = (
          await Promise.all(
            (ratingsData ?? []).map(async (rating) => {
              try {
                const entity = await getEntityDetails(rating);
                return normalizeRatingEntry(rating, entity);
              } catch {
                return normalizeRatingEntry(rating, null);
              }
            }),
          )
        ).filter(Boolean);

        if (!cancelled) {
          setUserRecord(userData ?? null);
          setEntries(hydratedEntries);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No pudimos cargar los rankings del usuario.");
        }
      } finally {
        if (!cancelled) {
          setIsFetchingEntries(false);
        }
      }
    }

    loadRankings();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.isAdmin, isCurrentUserLoading, userId]);

  const groupedEntries = useMemo(
    () => ({
      artists: entries.filter((entry) => entry.entityType === "artist"),
      albums: entries.filter((entry) => entry.entityType === "album"),
    }),
    [entries],
  );

  if (isLoading || isCurrentUserLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          Validando acceso...
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
        <Link
          to={`/admin/users/${userId}/profile`}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
        >
          Ver perfil
        </Link>
      </div>

      <section className="rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.04),rgba(15,23,42,0.08))] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
          <ShieldAlert className="h-3.5 w-3.5" />
          Rankings del usuario
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {userRecord?.avatar_url ? (
            <img src={userRecord.avatar_url} alt={userRecord?.username || "Usuario"} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <UserRound className="h-6 w-6" />
            </div>
          )}
          <h1 className="text-3xl font-black text-foreground">{userRecord?.username || "Usuario"}</h1>
          {userRecord?.is_pro ? <Star className="h-4 w-4 fill-[#facc15] text-[#facc15]" /> : null}
        </div>

        {isFetchingEntries ? (
          <div className="mt-8 flex min-h-48 items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
            <span className="flex items-center gap-3">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Cargando rankings...
            </span>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-red-500/20 bg-red-500/6 px-5 py-4 text-sm text-red-200">{error}</div>
        ) : entries.length === 0 ? (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-border bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
            Este usuario todavia no tiene rankings personales para mostrar.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {[{ title: "Artistas", items: groupedEntries.artists }, { title: "Albums", items: groupedEntries.albums }].map((group) => (
              <section key={group.title} className="rounded-[1.75rem] border border-border bg-card/80 p-6">
                <h2 className="text-xl font-bold text-foreground">{group.title}</h2>
                <div className="mt-5 space-y-3">
                  {group.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                      No hay elementos en esta categoria.
                    </div>
                  ) : (
                    group.items.map((entry, index) => (
                      <Link
                        key={entry.id}
                        to={entry.href}
                        className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 transition hover:border-primary/40 hover:bg-secondary/30"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        {entry.image ? (
                          <img
                            src={entry.image}
                            alt={entry.title}
                            className={`h-14 w-14 shrink-0 object-cover ${entry.entityType === "artist" ? "rounded-full" : "rounded-2xl"}`}
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                            <Disc3 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground">{entry.title}</p>
                          <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Actualizado {formatDate(entry.updatedAt)}</p>
                        </div>
                        <div className="shrink-0 text-right text-primary">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-current" />
                            <span className="text-lg font-black">{entry.ratingValue.toFixed(1)}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
