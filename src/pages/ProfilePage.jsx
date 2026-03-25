import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Disc3, Flame, LoaderCircle, Search, Star, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";

import SectionHeader from "../components/shared/SectionHeader";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { useToast } from "../hooks/useToast";
import { getMockAlbum, getMockArtist } from "../services/catalog";
import { fetchSupabaseProfile, updateAuthenticatedPassword, updateAuthenticatedProfile, updateSupabaseProfile, uploadProfileAvatar } from "../services/appAuth";
import { getMyRatings } from "../services/ratingHistory";
import {
  formatTrackDuration,
  getAlbumById,
  getArtistById,
  getImageUrl,
  getTopAlbumsFromTopTracks,
  getTopArtists,
  getTopTracks,
} from "../services/spotify";

const filters = [
  { key: "all", label: "Todo" },
  { key: "artist", label: "Artistas" },
  { key: "album", label: "Álbumes" },
];

const statsRangeOptions = [
  { key: "short_term", label: "Hace 4 semanas" },
  { key: "medium_term", label: "Hace 6 meses" },
  { key: "long_term", label: "Hace 1 año" },
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
      subtitle: entity?.genres?.slice(0, 2).join(" • ") || "Artista",
      image: getImageUrl(entity?.images),
      href: `/artist/${rating.entity_id}`,
      ratingValue: rating.rating_value,
      updatedAt: rating.updated_at,
      isHydrated: Boolean(entity),
    };
  }

  return {
    id: rating.id ?? `${rating.entity_type}-${rating.entity_id}`,
    entityType: "album",
    entityId: rating.entity_id,
    title: entity?.name ?? "Álbum no disponible",
    subtitle: `${entity?.artists?.[0]?.name ?? "Álbum"}${entity?.release_date ? ` • ${String(entity.release_date).slice(0, 4)}` : ""}`,
    image: getImageUrl(entity?.images),
    href: `/album/${rating.entity_id}`,
    ratingValue: rating.rating_value,
    updatedAt: rating.updated_at,
    isHydrated: Boolean(entity),
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
            {entry.entityType === "artist" ? "Artista" : "Álbum"}
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
    ? "Inicia sesión con Spotify para habilitar tus estadísticas personales."
    : "Hazte MusicDB PRO para desbloquear tus tops personales.";

  return (
    <section className="rounded-[1.8rem] border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),linear-gradient(135deg,rgba(14,14,16,0.98),rgba(24,19,14,0.96),rgba(12,12,14,0.98))] p-6 shadow-[0_24px_60px_-36px_rgba(245,158,11,0.5)] sm:p-8">
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100">
        <Star className="h-3.5 w-3.5 fill-current" />
        Spotify + PRO
      </span>
      <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">Tus estadísticas personales viven acá</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/72 sm:text-base">{message}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Artistas más escuchados</p>
          <p className="mt-3 text-sm text-white/68">Tu ranking personal de artistas favoritos en Spotify.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Álbumes más escuchados</p>
          <p className="mt-3 text-sm text-white/68">Los álbumes que más giraron en tu historial reciente.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">Canciones más escuchadas</p>
          <p className="mt-3 text-sm text-white/68">Tus temas favoritos según tu cuenta conectada.</p>
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
    <section className="rounded-[1.8rem] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)] ring-1 ring-white/8 backdrop-blur-2xl">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptySpotifyState({ message }) {
  return <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">{message}</div>;
}

function ProfileSectionTabs() {
  const items = [
    { to: "/profile", label: "Mi perfil" },
    { to: "/profile/stats", label: "Mis estadísticas" },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/profile"}
          className={({ isActive }) =>
            `rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

function mapProfileUpdateError(errorCode) {
  switch (errorCode) {
    case "USERNAME_ALREADY_EXISTS":
      return "Ese nombre de usuario ya esta en uso.";
    default:
      return "No pudimos guardar los cambios del perfil.";
  }
}

function LocalProfileSettings({
  avatarUrl,
  form,
  onAvatarChange,
  onAvatarUpload,
  onChange,
  onClose,
  onSubmit,
  pendingAvatarName,
  saveError,
  isUploadingAvatar,
  isSaving,
  isSpotifyUser,
}) {
  if (isSpotifyUser) {
    return (
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] p-6 pr-16 shadow-[0_30px_120px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-3xl sm:p-7 sm:pr-18">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition hover:bg-white/12 hover:text-foreground"
          aria-label="Cerrar editor de perfil"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-xl font-bold">Datos de acceso</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta cuenta se autentica con Spotify, por eso no puede cambiar nombre de usuario, contrasena ni telefono desde MusicDB.
        </p>
      </section>
    );
  }

  return (
    <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-3xl sm:p-7">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition hover:bg-white/12 hover:text-foreground"
        aria-label="Cerrar editor de perfil"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-14">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">Editar perfil</p>
          <h2 className="mt-2 text-2xl font-black text-foreground sm:text-[2rem]">Datos de acceso</h2>
          <p className="mt-2 text-sm text-muted-foreground">Puedes cambiar tu nombre de usuario, agregar o editar tu telefono y actualizar la contrasena.</p>
        </div>
        <div className="mt-4">
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-[1.6rem] border border-white/10 bg-black/18 p-4 sm:flex-row sm:items-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-secondary/80 sm:mx-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar del perfil" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-center text-sm font-semibold text-foreground sm:text-left">Foto de perfil</p>
          <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground sm:text-left">Sube una imagen JPG o PNG. Maximo 5 MB.</p>
          {pendingAvatarName ? <p className="mt-2 text-center text-xs font-medium text-primary sm:text-left">Preview lista: {pendingAvatarName}</p> : null}
        </div>

        <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/16 sm:w-auto">
          Elegir foto
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onAvatarChange} disabled={isUploadingAvatar} />
        </label>

        <Button
          type="button"
          size="lg"
          onClick={onAvatarUpload}
          className="w-full justify-center rounded-full px-5 sm:w-auto"
          disabled={!pendingAvatarName || isUploadingAvatar}
        >
          {isUploadingAvatar ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Subiendo...
            </span>
          ) : (
            "Guardar foto"
          )}
        </Button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Nombre de usuario</label>
          <input
            type="text"
            value={form.username}
            onChange={(event) => onChange("username", event.target.value)}
            autoComplete="username"
            className="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="Tu nombre en MusicDB"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Telefono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            autoComplete="tel"
            className="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="+54 11 1234 5678"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-foreground">Nueva contrasena</label>
          <input
            type="password"
            value={form.password}
            onChange={(event) => onChange("password", event.target.value)}
            autoComplete="new-password"
            className="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="Deja este campo vacio si no quieres cambiarla"
          />
          <p className="mt-2 text-xs text-muted-foreground">Si escribes una nueva contrasena, debe tener al menos 6 caracteres.</p>
        </div>

        {saveError ? <p className="md:col-span-2 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">{saveError}</p> : null}

        <div className="md:col-span-2 flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="w-full border border-white/10 bg-white/6 text-foreground hover:bg-white/10 sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" className="w-full justify-center rounded-full px-6 sm:w-auto" disabled={isSaving}>
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Guardando cambios...
              </span>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ProfileOverview({
  filteredEntries,
  hasSpotifyFeatures,
  historyEntries,
  historyError,
  historyFilter,
  isLoadingHistory,
  proUntilLabel,
  searchOpen,
  searchTerm,
  setHistoryFilter,
  setSearchOpen,
  setSearchTerm,
  spotifyUser,
  user,
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Estado de sesión</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p><span className="font-semibold">Proveedor:</span> {user?.authProvider === "spotify" ? "Spotify + MusicDB" : "MusicDB"}</p>
            <p><span className="font-semibold">Spotify:</span> {hasSpotifyFeatures ? `Conectado como ${spotifyUser?.name ?? "usuario"}` : "No conectado"}</p>
            <p><span className="font-semibold">MusicDB PRO:</span> {user?.isPro ? "Activo" : "No activo"}</p>
            {user?.isPro && proUntilLabel ? <p><span className="font-semibold">Miembro PRO hasta:</span> {proUntilLabel}</p> : null}
            <p><span className="font-semibold">User ID:</span> {user?.id ?? "No disponible"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Historial de ratings</h2>
              <p className="mt-2 text-sm text-muted-foreground">Revisa y filtra tus votos de artistas y álbumes desde tu perfil.</p>
            </div>

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
                  historyFilter === filter.key ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
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
          <EmptySpotifyState message="Cargando tu historial de ratings..." />
        ) : historyError ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-destructive">{historyError}</div>
        ) : filteredEntries.length > 0 ? (
          <div className="space-y-3">
            {filteredEntries.some((entry) => !entry.isHydrated) ? (
              <div className="overflow-hidden rounded-2xl border border-amber-300/14 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">Sincronizando historial</p>
                    <p className="mt-1 text-sm text-muted-foreground">Vamos completando nombres e imagenes a medida que llegan.</p>
                  </div>
                  <div className="text-right text-xs text-amber-100/85">
                    {filteredEntries.filter((entry) => entry.isHydrated).length}/{filteredEntries.length}
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.max(
                        (filteredEntries.filter((entry) => entry.isHydrated).length / Math.max(filteredEntries.length, 1)) * 100,
                        8,
                      )}%`,
                    }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(245,158,11,0.78),rgba(255,255,255,0.88))]"
                  />
                </div>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {filteredEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <RatingHistoryCard entry={entry} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptySpotifyState
            message={historyEntries.length > 0 ? "No hay resultados para ese filtro." : "Todavía no registraste ratings. Cuando puntúes artistas o álbumes, van a aparecer acá."}
          />
        )}
      </section>
    </>
  );
}

function StatsRangeFilter({ selectedRange, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {statsRangeOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
            selectedRange === option.key
              ? "border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "border-white/12 bg-white/6 text-muted-foreground hover:border-primary/20 hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProfileStats({
  hasSpotifyStatsAccess,
  isLoadingSpotifyStats,
  isSpotifyUser,
  navigate,
  selectedRange,
  setSelectedRange,
  spotifyTopAlbums,
  spotifyTopArtists,
  spotifyTopTracks,
}) {
  if (!hasSpotifyStatsAccess) {
    return <SpotifyFeatureLock isSpotifyUser={isSpotifyUser} onUnlock={() => navigate("/pro")} />;
  }

  return (
    <div>
      <StatsRangeFilter selectedRange={selectedRange} onChange={setSelectedRange} />
      <div className="grid gap-6 xl:grid-cols-3">
        <SpotifyStatCard icon={<Flame className="h-6 w-6 text-primary" />} title="Artistas más escuchados" subtitle="Tus artistas más reproducidos según Spotify">
          {isLoadingSpotifyStats ? (
            <EmptySpotifyState message="Cargando tus artistas favoritos..." />
          ) : spotifyTopArtists.length > 0 ? (
            <div className="space-y-3">
              {spotifyTopArtists.map((artist, index) => (
                <Link key={artist.id} to={`/artist/${artist.id}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 transition hover:border-primary/35 hover:bg-secondary/30">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">{index + 1}</span>
                  <img src={getImageUrl(artist.images)} alt={artist.name} className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{artist.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{artist.genres?.slice(0, 2).join(" • ") || "Artista"}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptySpotifyState message="Spotify no devolvió artistas para tu top actual." />
          )}
        </SpotifyStatCard>

        <SpotifyStatCard icon={<Disc3 className="h-6 w-6 text-primary" />} title="Álbumes más escuchados" subtitle="Construido a partir de tus canciones más escuchadas">
          {isLoadingSpotifyStats ? (
            <EmptySpotifyState message="Cargando tus álbumes más escuchados..." />
          ) : spotifyTopAlbums.length > 0 ? (
            <div className="space-y-3">
              {spotifyTopAlbums.map((album, index) => (
                <Link key={album.id} to={`/album/${album.id}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 transition hover:border-primary/35 hover:bg-secondary/30">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">{index + 1}</span>
                  <img src={getImageUrl(album.images)} alt={album.name} className="h-12 w-12 rounded-2xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{album.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{album.artists?.map((artist) => artist.name).join(", ") || "Álbum"}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptySpotifyState message="Todavía no pudimos construir un top de álbumes para esta cuenta." />
          )}
        </SpotifyStatCard>

        <SpotifyStatCard icon={<AudioLines className="h-6 w-6 text-primary" />} title="Canciones más escuchadas" subtitle="Tus temas más reproducidos en Spotify">
          {isLoadingSpotifyStats ? (
            <EmptySpotifyState message="Cargando tus canciones favoritas..." />
          ) : spotifyTopTracks.length > 0 ? (
            <div className="space-y-3">
              {spotifyTopTracks.map((track, index) => (
                <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">{index + 1}</span>
                  <img src={getImageUrl(track.album?.images)} alt={track.album?.name ?? track.name} className="h-12 w-12 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{track.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{track.artists?.map((artist) => artist.name).join(", ")}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTrackDuration(track.duration_ms ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptySpotifyState message="Spotify no devolvió canciones para tu top actual." />
          )}
        </SpotifyStatCard>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { isLoggedIn, user, appToken, isSpotifyUser, setAuthenticatedUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isSpotifyConnected, isLoadingSpotify, spotifyToken, spotifyUser } = useSpotifyAuth();
  const profileUser = isSpotifyUser ? (spotifyUser ?? user) : user;
  const hasSpotifyFeatures = isSpotifyUser && isSpotifyConnected;
  const hasSpotifyStatsAccess = hasSpotifyFeatures && Boolean(user?.isPro) && Boolean(spotifyToken);
  const isStatsView = location.pathname === "/profile/stats";
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyEntries, setHistoryEntries] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [spotifyTopArtists, setSpotifyTopArtists] = useState([]);
  const [spotifyTopAlbums, setSpotifyTopAlbums] = useState([]);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
  const [statsRange, setStatsRange] = useState("medium_term");
  const [isLoadingSpotifyStats, setIsLoadingSpotifyStats] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username ?? "",
    phone: user?.phone ?? "",
    password: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState("");
  const proUntilLabel = user?.isPro ? formatProUntil(user?.proUntil) : "";

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) {
        URL.revokeObjectURL(pendingAvatarPreview);
      }
    };
  }, [pendingAvatarPreview]);

  useEffect(() => {
    setProfileForm((current) => ({
      username: user?.username ?? current.username ?? "",
      phone: user?.phone ?? "",
      password: "",
    }));
  }, [user?.phone, user?.username]);

  useEffect(() => {
    if (!isEditProfileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditProfileOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadSupabaseProfile() {
      if (!user?.id || isSpotifyUser) {
        return;
      }

      try {
        const profile = await fetchSupabaseProfile(user.id);

        if (cancelled || !profile) {
          return;
        }

        const nextUsername = user.username?.trim() || profile.username || "";
        const nextPhone = user.phone?.trim() || profile.phone || "";
        const nextAvatar = user.avatar?.trim() || profile.avatar_url || "";

        if (nextUsername === (user.username ?? "") && nextPhone === (user.phone ?? "") && nextAvatar === (user.avatar ?? "")) {
          return;
        }

        setAuthenticatedUser({
          ...user,
          username: nextUsername,
          phone: nextPhone,
          avatar_url: nextAvatar,
          avatar: nextAvatar,
          display_name: nextUsername,
          displayName: nextUsername,
          name: nextUsername,
        });
      } catch {
        if (!cancelled) {
          setProfileSaveError("No pudimos cargar tu perfil desde Supabase.");
        }
      }
    }

    loadSupabaseProfile();

    return () => {
      cancelled = true;
    };
  }, [isSpotifyUser, setAuthenticatedUser, user?.avatar, user?.id, user?.phone, user?.username]);

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

        if (!cancelled) {
          setHistoryEntries(ratings.map((rating) => normalizeRatingEntry(rating, null)));
          setIsLoadingHistory(false);
        }

        for (const rating of ratings) {
          try {
            const entity = await getEntityDetails(rating);

            if (cancelled) {
              return;
            }

            const hydratedEntry = normalizeRatingEntry(rating, entity);
            setHistoryEntries((currentEntries) =>
              currentEntries.map((entry) => (entry.id === hydratedEntry.id ? hydratedEntry : entry)),
            );
          } catch {
            if (cancelled) {
              return;
            }
          }
        }
      } catch {
        if (!cancelled) {
          setHistoryEntries([]);
          setHistoryError("No se pudo cargar tu historial de ratings.");
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
        return;
      }

      setIsLoadingSpotifyStats(true);

      try {
        const [artistsResponse, albumsResponse, tracksResponse] = await Promise.all([
          getTopArtists(spotifyToken, 10, statsRange),
          getTopAlbumsFromTopTracks(spotifyToken, 10, 50, statsRange),
          getTopTracks(spotifyToken, 10, statsRange),
        ]);

        if (cancelled) {
          return;
        }

        setSpotifyTopArtists(artistsResponse?.items ?? []);
        setSpotifyTopAlbums(albumsResponse ?? []);
        setSpotifyTopTracks(tracksResponse?.items ?? []);
      } catch {
        if (!cancelled) {
          setSpotifyTopArtists([]);
          setSpotifyTopAlbums([]);
          setSpotifyTopTracks([]);
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
  }, [hasSpotifyStatsAccess, spotifyToken, statsRange]);

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

  function setProfileFormField(field, value) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearPendingAvatarSelection() {
    setPendingAvatarFile(null);
    setPendingAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return "";
    });
  }

  function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !user) {
      return;
    }

    if (isSpotifyUser) {
      setProfileSaveError("Las cuentas iniciadas con Spotify no pueden editar estos datos.");
      return;
    }

    if (!file.type?.startsWith("image/")) {
      alert("Solo imágenes");
      setProfileSaveError("Solo puedes subir imagenes JPG o PNG.");
      return;
    }

    setProfileSaveError("");
    setPendingAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
    setPendingAvatarFile(file);
  }

  async function handleAvatarUpload() {
    if (!pendingAvatarFile || !user) {
      return;
    }

    setIsUploadingAvatar(true);
    setProfileSaveError("");

    try {
      const response = await uploadProfileAvatar(user.id, pendingAvatarFile, appToken);
      const nextAvatar = response?.user?.avatar_url ?? response?.profile?.avatar_url ?? response?.publicUrl ?? "";

      setAuthenticatedUser({
        ...user,
        avatar_url: nextAvatar,
        avatar: nextAvatar,
      });
      clearPendingAvatarSelection();

      toast({
        title: "Foto actualizada",
        description: "Tu nueva foto de perfil ya esta guardada.",
      });
    } catch (error) {
      if (error?.message === "INVALID_AVATAR_TYPE") {
        setProfileSaveError("Solo puedes subir imagenes JPG o PNG.");
      } else {
        setProfileSaveError("No pudimos subir tu foto de perfil.");
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSubmitProfile(event) {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (isSpotifyUser) {
      setProfileSaveError("Las cuentas iniciadas con Spotify no pueden editar estos datos.");
      return;
    }

    setIsSavingProfile(true);
    setProfileSaveError("");

    const trimmedUsername = profileForm.username.trim();
    const trimmedPhone = profileForm.phone.trim();
    const trimmedPassword = profileForm.password.trim();

    if (!trimmedUsername) {
      setProfileSaveError("El nombre de usuario no puede quedar vacio.");
      setIsSavingProfile(false);
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      setProfileSaveError("La contrasena nueva debe tener al menos 6 caracteres.");
      setIsSavingProfile(false);
      return;
    }

    try {
      const profile = await updateSupabaseProfile(user.id, {
        username: trimmedUsername,
        phone: trimmedPhone,
      });
      const backendUser = await updateAuthenticatedProfile(appToken, {
        username: trimmedUsername,
        phone: trimmedPhone,
      });

      if (trimmedPassword) {
        await updateAuthenticatedPassword(trimmedPassword);
      }

      setAuthenticatedUser({
        ...user,
        username: backendUser?.username ?? profile?.username ?? trimmedUsername,
        phone: backendUser?.phone ?? profile?.phone ?? trimmedPhone,
        avatar_url: backendUser?.avatar_url ?? profile?.avatar_url ?? user.avatar ?? "",
        avatar: backendUser?.avatar_url ?? profile?.avatar_url ?? user.avatar ?? "",
        display_name: backendUser?.display_name ?? profile?.username ?? trimmedUsername,
        displayName: backendUser?.display_name ?? profile?.username ?? trimmedUsername,
        name: backendUser?.display_name ?? profile?.username ?? trimmedUsername,
      });
      setProfileForm((current) => ({
        ...current,
        username: backendUser?.username ?? profile?.username ?? trimmedUsername,
        phone: backendUser?.phone ?? profile?.phone ?? trimmedPhone,
        password: "",
      }));

      toast({
        title: "Perfil actualizado",
        description: trimmedPassword
          ? "Guardamos tu usuario, telefono y nueva contrasena."
          : "Tus datos de perfil ya fueron actualizados.",
      });
      clearPendingAvatarSelection();
      setIsEditProfileOpen(false);
    } catch (error) {
      setProfileSaveError(mapProfileUpdateError(error?.message));
    } finally {
      setIsSavingProfile(false);
    }
  }

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
      <ProfileSectionTabs />

      <div className="mb-8 rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
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

          <div className="md:pl-6">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setIsEditProfileOpen(true)}
              className="w-full rounded-full border border-white/10 bg-white/6 px-5 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl hover:bg-white/12 md:w-auto"
            >
              Editar perfil
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditProfileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] overflow-y-auto bg-[rgba(3,4,10,0.42)] px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
            onClick={() => setIsEditProfileOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto flex min-h-full w-full max-w-2xl items-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto sm:max-h-[calc(100vh-3rem)]">
                <LocalProfileSettings
                  avatarUrl={pendingAvatarPreview || user?.avatar}
                  form={profileForm}
                  onAvatarChange={handleAvatarFileChange}
                  onAvatarUpload={handleAvatarUpload}
                  onChange={setProfileFormField}
                  onClose={() => {
                    clearPendingAvatarSelection();
                    setIsEditProfileOpen(false);
                  }}
                  onSubmit={handleSubmitProfile}
                  pendingAvatarName={pendingAvatarFile?.name ?? ""}
                  saveError={profileSaveError}
                  isUploadingAvatar={isUploadingAvatar}
                  isSaving={isSavingProfile}
                  isSpotifyUser={isSpotifyUser}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isStatsView ? (
        <ProfileStats
          hasSpotifyStatsAccess={hasSpotifyStatsAccess}
          isLoadingSpotifyStats={isLoadingSpotifyStats}
          isSpotifyUser={isSpotifyUser}
          navigate={navigate}
          selectedRange={statsRange}
          setSelectedRange={setStatsRange}
          spotifyTopAlbums={spotifyTopAlbums}
          spotifyTopArtists={spotifyTopArtists}
          spotifyTopTracks={spotifyTopTracks}
        />
      ) : (
        <ProfileOverview
          filteredEntries={filteredEntries}
          hasSpotifyFeatures={hasSpotifyFeatures}
          historyEntries={historyEntries}
          historyError={historyError}
          historyFilter={historyFilter}
          isLoadingHistory={isLoadingHistory}
          proUntilLabel={proUntilLabel}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          setHistoryFilter={setHistoryFilter}
          setSearchOpen={setSearchOpen}
          setSearchTerm={setSearchTerm}
          spotifyUser={spotifyUser}
          user={user}
        />
      )}
    </div>
  );
}

