import { Disc3, Medal, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getRankings } from "../services/ratingHistory";
import { getAlbumById, getArtistById } from "../services/spotify";

const filters = [
  { key: "album", label: "Album", icon: Disc3 },
  { key: "artist", label: "Artista", icon: Mic2 },
];

const podiumStyles = [
  "border-yellow-400/50 bg-linear-to-r from-yellow-500/20 via-amber-400/10 to-card",
  "border-slate-300/45 bg-linear-to-r from-slate-200/18 via-zinc-200/10 to-card",
  "border-orange-500/45 bg-linear-to-r from-orange-700/18 via-amber-700/10 to-card",
];

function normalizeRankingEntry(entityType, ranking, entity) {
  if (entityType === "artist") {
    return {
      entityType,
      entityId: ranking.entity_id,
      title: entity.name,
      subtitle: entity.genres?.slice(0, 2).join(" · ") || "Artista",
      image: entity.images?.[0]?.url ?? "",
      href: `/artist/${entity.id}`,
      average: ranking.average_rating,
      count: ranking.ratings_count,
    };
  }

  return {
    entityType,
    entityId: ranking.entity_id,
    title: entity.name,
    subtitle: `${entity.artists?.[0]?.name ?? "Album"}${entity.release_date ? ` · ${entity.release_date.slice(0, 4)}` : ""}`,
    image: entity.images?.[0]?.url ?? "",
    href: `/album/${entity.id}`,
    average: ranking.average_rating,
    count: ranking.ratings_count,
  };
}

function RankingSection({ filter }) {
  const Icon = filter.icon;
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRankings() {
      setIsLoading(true);
      setError("");

      try {
        const rankings = await getRankings(filter.key);
        const hydratedEntries = await Promise.all(
          rankings.map(async (ranking) => {
            const entity =
              filter.key === "artist"
                ? await getArtistById(ranking.entity_id)
                : await getAlbumById(ranking.entity_id);

            return normalizeRankingEntry(filter.key, ranking, entity);
          }),
        );

        if (!cancelled) {
          setEntries(hydratedEntries);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError("No se pudo cargar este ranking.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRankings();

    return () => {
      cancelled = true;
    };
  }, [filter.key]);

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/5">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{filter.label}</h2>
            <p className="text-sm text-muted-foreground">Top 20 por promedio de usuarios</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          Cargando ranking...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <Link
              key={`${entry.entityType}-${entry.entityId}`}
              to={entry.href}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:border-primary/40 hover:bg-secondary/30 ${
                index < 3 ? podiumStyles[index] : "border-border/70 bg-background/60"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/75 text-sm font-bold text-white shadow-lg">
                {index + 1}
              </div>

              {entry.image ? (
                <img
                  src={entry.image}
                  alt={entry.title}
                  className={`h-16 w-16 shrink-0 object-cover ${entry.entityType === "artist" ? "rounded-full" : "rounded-2xl"}`}
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{entry.title}</p>
                <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-2xl font-black">{entry.average.toFixed(1)}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">/10 · {entry.count} ratings</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          Todavia no hay ratings suficientes para armar este top.
        </div>
      )}
    </section>
  );
}

export default function DBRankingPage() {
  return (
    <div className="mx-auto max-w-6xl animate-in px-4 py-8 duration-500 sm:px-6 lg:px-8">
      <div className="mb-10 rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-400/35 bg-linear-to-br from-yellow-500/25 via-amber-400/15 to-card text-yellow-100 shadow-lg shadow-yellow-500/10">
            <Medal className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-yellow-200/80">DBRanking</p>
            <h1 className="text-4xl font-black tracking-tight">Top MusicDB</h1>
          </div>
        </div>

        <p className="max-w-2xl text-sm text-muted-foreground">
          Ranking global basado en el promedio real de ratings de usuarios de MusicDB. Mostramos hasta 20 posiciones para artistas y albumes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {filters.map((filter) => (
          <RankingSection key={filter.key} filter={filter} />
        ))}
      </div>
    </div>
  );
}
