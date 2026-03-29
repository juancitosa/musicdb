import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Check, Clock3, Crown, Disc3, Eye, EyeOff, Flame, Heart, LoaderCircle, MessageSquareText, Search, Sparkles, Star, UserRound, Users, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";

import SectionHeader from "../components/shared/SectionHeader";
import SpotifyConnectButton from "../components/shared/SpotifyConnectButton";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { useToast } from "../hooks/useToast";
import { getMockAlbum, getMockArtist } from "../services/catalog";
import { fetchSupabaseProfile, updateAuthenticatedPassword, updateAuthenticatedProfile, uploadProfileAvatar, uploadProfileBanner, verifyCurrentAuthenticatedPassword } from "../services/appAuth";
import { getMyRatings } from "../services/ratingHistory";
import { fetchMyAchievements, fetchMyFollowers, fetchMyFollowing } from "../services/social";
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

function getBadgeIcon(iconName) {
  switch (iconName) {
    case "message":
      return MessageSquareText;
    case "spark":
      return Sparkles;
    case "heart":
      return Heart;
    case "crown":
      return Crown;
    case "clock":
      return Clock3;
    default:
      return Star;
  }
}

function getBadgeTierClassName(tier) {
  switch (tier) {
    case "pro":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "diamond":
      return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
    case "gold":
      return "border-yellow-300/30 bg-yellow-300/10 text-yellow-100";
    case "silver":
      return "border-slate-300/30 bg-slate-300/10 text-slate-100";
    default:
      return "border-orange-300/30 bg-orange-300/10 text-orange-100";
  }
}

function getBadgeDetailClassName(tier) {
  if (tier === "diamond") {
    return "badge-detail-diamond";
  }

  if (tier === "pro") {
    return "badge-detail-pro";
  }

  if (tier === "gold") {
    return "badge-detail-gold";
  }

  return "";
}

function BadgeMedallion({ badge, isActive, onClick }) {
  const Icon = getBadgeIcon(badge.icon);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${
        isActive
          ? `${getBadgeTierClassName(badge.tier)} shadow-[0_0_28px_rgba(255,255,255,0.12)]`
          : "border-white/14 bg-white/7 text-white/82 hover:border-white/24 hover:bg-white/12"
      }`}
      aria-label={badge.name}
      title={badge.name}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function BadgeDetailCard({ badge }) {
  return (
    <div
      className={`badge-detail-glow flex min-h-[156px] flex-col rounded-2xl border px-4 py-4 sm:h-[148px] ${getBadgeTierClassName(badge.tier)} ${getBadgeDetailClassName(badge.tier)}`}
    >
      <div className="grid min-h-[58px] grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-current/70">Medalla seleccionada</p>
          <p className="mt-2 min-h-[40px] text-base font-bold leading-5">{badge.name}</p>
        </div>
        <span className="mt-0.5 w-fit rounded-full border border-current/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-current/70">
          {badge.tier}
        </span>
      </div>
      <div className="mt-3 min-h-[52px]">
        <p className="text-sm leading-relaxed text-current/80">{badge.description}</p>
      </div>
    </div>
  );
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

function SpotifyFeatureLock({ isSpotifyUser, isPro, onUnlock }) {
  const buttonLabel = !isSpotifyUser && isPro ? "Conectarse a Spotify" : "Pagar PRO para desbloquear";
  const showSpotifyButton = !isSpotifyUser && isPro;
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
        {showSpotifyButton ? (
          <SpotifyConnectButton type="button" size="lg" onClick={onUnlock} className="justify-center px-6">
            Continuar con Spotify
          </SpotifyConnectButton>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onUnlock}
            className="rounded-full border border-amber-300/40 bg-amber-300/12 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.12)] transition hover:bg-amber-300/18"
          >
            {buttonLabel}
          </Button>
        )}
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

function mapPasswordUpdateError(errorCode) {
  switch (errorCode) {
    case "CURRENT_PASSWORD_INVALID":
      return "La contrasena actual no es correcta.";
    default:
      return "No pudimos cambiar la contrasena.";
  }
}

function PreviewGrid({ imageUrl, zoom = 1, offsetX = 0, offsetY = 0, shape = "square", aspectClassName = "" }) {

  return (
    <div className={`relative overflow-hidden border border-white/12 bg-black/30 ${shape === "circle" ? "rounded-full" : "rounded-[1.2rem]"} ${aspectClassName}`}>
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: `${Math.max(zoom, 1) * 100}%`,
            backgroundPosition: `${50 + offsetX * 50}% ${50 + offsetY * 50}%`,
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:22px_22px]" />
      <div className="absolute inset-0 ring-1 ring-white/8" />
    </div>
  );
}

async function renderZoomedImageFile(file, zoom, offsetX, offsetY, outputWidth, outputHeight) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("IMAGE_PROCESSING_FAILED");
    }

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const targetAspect = outputWidth / outputHeight;
    const imageAspect = imageWidth / imageHeight;

    let baseCropWidth = imageWidth;
    let baseCropHeight = imageHeight;

    if (imageAspect > targetAspect) {
      baseCropWidth = imageHeight * targetAspect;
    } else {
      baseCropHeight = imageWidth / targetAspect;
    }

    const safeZoom = Math.max(1, Number(zoom) || 1);
    const sourceWidth = baseCropWidth / safeZoom;
    const sourceHeight = baseCropHeight / safeZoom;
    const maxOffsetX = (baseCropWidth - sourceWidth) / 2;
    const maxOffsetY = (baseCropHeight - sourceHeight) / 2;
    const safeOffsetX = Math.max(-1, Math.min(1, Number(offsetX) || 0));
    const safeOffsetY = Math.max(-1, Math.min(1, Number(offsetY) || 0));
    const sourceX = (imageWidth - sourceWidth) / 2 + maxOffsetX * safeOffsetX;
    const sourceY = (imageHeight - sourceHeight) / 2 + maxOffsetY * safeOffsetY;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/png";
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }

        reject(new Error("IMAGE_PROCESSING_FAILED"));
      }, mimeType, mimeType === "image/jpeg" ? 0.92 : undefined);
    });

    return new File([blob], file.name, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function LocalProfileSettings({
  avatarUrl,
  bannerPreviewUrl,
  avatarZoom,
  bannerZoom,
  avatarOffsetX,
  avatarOffsetY,
  bannerOffsetX,
  bannerOffsetY,
  form,
  onAvatarChange,
  onAvatarUpload,
  onBannerUpload,
  onOpenBannerPicker,
  onSetAvatarZoom,
  onSetBannerZoom,
  onSetAvatarOffsetX,
  onSetAvatarOffsetY,
  onSetBannerOffsetX,
  onSetBannerOffsetY,
  onChange,
  onClose,
  onSubmit,
  pendingAvatarName,
  pendingBannerName,
  saveError,
  saveStatus,
  isUploadingAvatar,
  isUploadingBanner,
  isPro,
  isSaving,
  isSpotifyUser,
  onOpenPasswordModal,
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
          <p className="mt-2 text-sm text-muted-foreground">Puedes cambiar tu nombre de usuario, agregar o editar tu telefono desde este panel.</p>
        </div>
        <div className="mt-4">
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-[1.6rem] border border-white/10 bg-black/18 p-4 sm:flex-row sm:items-center">
        <div className="mx-auto sm:mx-0">
          {avatarUrl ? (
            <PreviewGrid imageUrl={avatarUrl} zoom={avatarZoom} offsetX={avatarOffsetX} offsetY={avatarOffsetY} shape="circle" aspectClassName="h-20 w-20" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-secondary/80">
              <UserRound className="h-8 w-8 text-muted-foreground" />
            </div>
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

      {pendingAvatarName ? (
        <div className="mt-3 rounded-[1.6rem] border border-white/10 bg-black/14 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Previsualizacion de avatar</p>
              <p className="mt-1 text-xs text-muted-foreground">La grilla muestra como va a quedar centrado al guardar.</p>
            </div>
            <span className="text-xs font-medium text-white/70">{avatarZoom.toFixed(1)}x</span>
          </div>

          <div className="mt-4 flex justify-center">
            <PreviewGrid imageUrl={avatarUrl} zoom={avatarZoom} offsetX={avatarOffsetX} offsetY={avatarOffsetY} shape="circle" aspectClassName="h-32 w-32" />
          </div>

          <div className="mt-4 space-y-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/58">Zoom avatar</label>
            <input
              type="range"
              min="1"
              max="2.8"
              step="0.1"
              value={avatarZoom}
              onChange={(event) => onSetAvatarZoom(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-violet-400"
            />

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/58">Mover horizontal</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={avatarOffsetX}
                onChange={(event) => onSetAvatarOffsetX(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-violet-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/58">Mover vertical</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={avatarOffsetY}
                onChange={(event) => onSetAvatarOffsetY(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-violet-400"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),linear-gradient(135deg,rgba(18,14,8,0.96),rgba(12,10,7,0.94),rgba(20,15,10,0.98))] p-4 shadow-[0_0_28px_rgba(245,158,11,0.12)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-20 w-full overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/30 sm:w-48">
            {bannerPreviewUrl ? (
              <PreviewGrid imageUrl={bannerPreviewUrl} zoom={bannerZoom} offsetX={bannerOffsetX} offsetY={bannerOffsetY} aspectClassName="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.02),rgba(245,158,11,0.08))] text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/70">
                Banner PRO
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-100">
              <Star className="h-4 w-4 fill-current text-amber-300" />
              Banner de perfil PRO
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-50/72">Sube una imagen JPG, PNG o WEBP. Maximo 7 MB.</p>
            {pendingBannerName ? <p className="mt-2 text-xs font-medium text-amber-200">Preview lista: {pendingBannerName}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onOpenBannerPicker}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/50 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.04))] px-5 py-2.5 text-sm font-semibold text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:border-amber-200/75 hover:bg-[linear-gradient(135deg,rgba(245,158,11,0.24),rgba(255,255,255,0.06))] hover:shadow-[0_0_30px_rgba(245,158,11,0.32)] sm:w-auto"
          >
            <Star className="h-4 w-4 fill-current text-amber-300" />
            Editar banner
          </button>

          <Button
            type="button"
            size="lg"
            onClick={onBannerUpload}
            className="w-full justify-center rounded-full px-5 sm:w-auto"
            disabled={!pendingBannerName || isUploadingBanner || !isPro}
          >
            {isUploadingBanner ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Subiendo banner...
              </span>
            ) : (
              "Guardar banner"
            )}
          </Button>
        </div>

        {pendingBannerName ? (
          <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-50">Previsualizacion de banner</p>
                <p className="mt-1 text-xs text-amber-50/64">Se guarda centrado, con recorte controlado y sin pasarse del borde visible.</p>
              </div>
              <span className="text-xs font-medium text-amber-100/78">{bannerZoom.toFixed(1)}x</span>
            </div>

            <div className="mt-4">
              <PreviewGrid imageUrl={bannerPreviewUrl} zoom={bannerZoom} offsetX={bannerOffsetX} offsetY={bannerOffsetY} aspectClassName="aspect-[3.2/1] w-full" />
            </div>

            <div className="mt-4 space-y-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/58">Zoom banner</label>
              <input
                type="range"
                min="1"
                max="2.8"
                step="0.1"
                value={bannerZoom}
                onChange={(event) => onSetBannerZoom(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-amber-300"
              />

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/58">Mover horizontal</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={bannerOffsetX}
                  onChange={(event) => onSetBannerOffsetX(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-amber-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/58">Mover vertical</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={bannerOffsetY}
                  onChange={(event) => onSetBannerOffsetY(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/14 accent-amber-300"
                />
              </div>
            </div>
          </div>
        ) : null}
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

        <div className="md:col-span-2 flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="rounded-full border border-white/10 bg-white/6 text-foreground hover:bg-white/10"
            onClick={onOpenPasswordModal}
          >
            Cambiar contrasena
          </Button>
        </div>

        {saveStatus?.type === "success" ? (
          <div className="md:col-span-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/16 text-emerald-200">
                <Check className="h-4 w-4" />
              </span>
              <span>{saveStatus.message}</span>
            </div>
          </div>
        ) : null}
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

function LocalPasswordSettings({
  form,
  onChange,
  onClose,
  onSubmit,
  saveError,
  saveStatus,
  isSaving,
}) {
  const [visibleFields, setVisibleFields] = useState({
    currentPassword: false,
    newPassword: false,
    repeatPassword: false,
  });

  function togglePasswordVisibility(field) {
    setVisibleFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function renderPasswordField(field, label, autoComplete, placeholder) {
    const isVisible = visibleFields[field];

    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
        <div className="relative">
          <input
            type={isVisible ? "text" : "password"}
            value={form[field]}
            onChange={(event) => onChange(field, event.target.value)}
            autoComplete={autoComplete}
            className="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3 pr-12 text-sm outline-none transition focus:border-primary"
            placeholder={placeholder}
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility(field)}
            className="absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            aria-label={isVisible ? "Ocultar contrasena" : "Mostrar contrasena"}
            aria-pressed={isVisible}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-3xl sm:p-7">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition hover:bg-white/12 hover:text-foreground"
        aria-label="Cerrar editor de contrasena"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">Seguridad</p>
        <h2 className="mt-2 text-2xl font-black text-foreground sm:text-[2rem]">Cambiar contrasena</h2>
        <p className="mt-2 text-sm text-muted-foreground">Confirma tu contrasena actual y elige una nueva clave para tu cuenta MusicDB.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {renderPasswordField("currentPassword", "Contrasena actual", "current-password", "Tu contrasena actual")}

        {renderPasswordField("newPassword", "Nueva contrasena", "new-password", "Minimo 6 caracteres")}

        {renderPasswordField("repeatPassword", "Repetir nueva contrasena", "new-password", "Repite la nueva contrasena")}

        {saveStatus?.type === "success" ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <span className="inline-flex items-center gap-2 font-medium">
              <Check className="h-4 w-4" />
              Contrasena cambiada correctamente.
            </span>
          </div>
        ) : null}

        {saveStatus?.type === "error" ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <span className="inline-flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" />
              La contrasena no pudo cambiarse en este momento, intenta mas tarde.
            </span>
          </div>
        ) : null}

        {saveError ? <p className="rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">{saveError}</p> : null}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="w-full border border-white/10 bg-white/6 text-foreground hover:bg-white/10 sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" className="w-full justify-center rounded-full px-6 sm:w-auto" disabled={isSaving}>
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Guardando...
              </span>
            ) : (
              "Guardar contrasena"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ProfileOverview({
  filteredEntries,
  followers,
  following,
  hasSpotifyFeatures,
  historyEntries,
  historyError,
  historyFilter,
  isLoadingAchievements,
  isLoadingHistory,
  isLoadingSocial,
  isSocialModalOpen,
  openSocialModal,
  profileBadges,
  proUntilLabel,
  searchOpen,
  searchTerm,
  selectedBadge,
  setSelectedBadgeId,
  socialListType,
  socialSearchTerm,
  setHistoryFilter,
  setSearchOpen,
  setSearchTerm,
  setSocialSearchTerm,
  spotifyUser,
  user,
}) {
  const socialSource = socialListType === "following" ? following : followers;
  const normalizedSocialTerm = socialSearchTerm.trim().toLowerCase();
  const filteredSocialUsers = socialSource.filter((entry) => {
    if (!normalizedSocialTerm) {
      return true;
    }

    return entry.displayName.toLowerCase().includes(normalizedSocialTerm) || entry.username.toLowerCase().includes(normalizedSocialTerm);
  });

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

      <section className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Medallas del perfil</h2>
            <p className="mt-2 text-sm text-muted-foreground">Se muestran solo los logros reales que ya desbloqueaste.</p>
          </div>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>

        {isLoadingAchievements ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
            Cargando medallas...
          </div>
        ) : profileBadges.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-wrap gap-3">
              {profileBadges.map((badge) => (
                <BadgeMedallion
                  key={badge.key}
                  badge={badge}
                  isActive={selectedBadge?.key === badge.key}
                  onClick={() => setSelectedBadgeId(badge.key)}
                />
              ))}
            </div>
            {selectedBadge ? <BadgeDetailCard badge={selectedBadge} /> : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
            Todavia no desbloqueaste medallas en tu perfil.
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Relaciones sociales</h2>
            <p className="mt-2 text-sm text-muted-foreground">Mira a quien sigues y quien te sigue dentro de MusicDB.</p>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openSocialModal("followers")}
            className="rounded-2xl border border-border/70 bg-background/70 p-4 text-left transition hover:border-primary/35 hover:bg-secondary/30"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Seguidores</p>
            <p className="mt-3 text-3xl font-black">{followers.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Ver quienes siguen tu perfil.</p>
          </button>

          <button
            type="button"
            onClick={() => openSocialModal("following")}
            className="rounded-2xl border border-border/70 bg-background/70 p-4 text-left transition hover:border-primary/35 hover:bg-secondary/30"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Seguidos</p>
            <p className="mt-3 text-3xl font-black">{following.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Ver los perfiles que sigues.</p>
          </button>
        </div>
      </section>

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

      <AnimatePresence>
        {isSocialModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[230] overflow-y-auto bg-[rgba(3,4,10,0.42)] px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
            onClick={() => openSocialModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto flex min-h-full w-full max-w-xl items-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-full rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-3xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">
                      {socialListType === "following" ? "Seguidos" : "Seguidores"}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-foreground">
                      {socialListType === "following" ? "Perfiles que sigues" : "Personas que te siguen"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSocialModal(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition hover:bg-white/12 hover:text-foreground"
                    aria-label="Cerrar lista social"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative mt-5">
                  <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={socialSearchTerm}
                    onChange={(event) => setSocialSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre o @usuario..."
                    className="w-full rounded-2xl border border-white/10 bg-black/18 py-3 pr-4 pl-11 text-sm outline-none transition focus:border-primary"
                  />
                </div>

                <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                  {isLoadingSocial ? (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
                      Cargando relaciones...
                    </div>
                  ) : filteredSocialUsers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
                      {normalizedSocialTerm ? "No encontramos usuarios para esa busqueda." : "Todavia no hay perfiles en esta lista."}
                    </div>
                  ) : (
                    filteredSocialUsers.map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/u/${entry.username}`}
                        onClick={() => openSocialModal(null)}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-3 transition hover:border-primary/30 hover:bg-white/8"
                      >
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary">
                          {entry.avatarUrl ? (
                            <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <UserRound className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">{entry.displayName}</p>
                            {entry.isPro ? <Star className="h-3.5 w-3.5 fill-current text-amber-200" /> : null}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">@{entry.username}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  isPro,
  navigate,
  onConnectSpotify,
  selectedRange,
  setSelectedRange,
  spotifyTopAlbums,
  spotifyTopArtists,
  spotifyTopTracks,
}) {
  if (!hasSpotifyStatsAccess) {
    return <SpotifyFeatureLock isSpotifyUser={isSpotifyUser} isPro={isPro} onUnlock={!isSpotifyUser && isPro ? onConnectSpotify : () => navigate("/pro")} />;
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
  const { isSpotifyConnected, isLoadingSpotify, spotifyToken, spotifyUser, connectSpotify } = useSpotifyAuth();
  const profileUser = isSpotifyUser ? (spotifyUser ?? user) : user;
  const hasSpotifyFeatures = isSpotifyUser && isSpotifyConnected;
  const hasSpotifyStatsAccess = hasSpotifyFeatures && Boolean(user?.isPro) && Boolean(spotifyToken);
  const isStatsView = location.pathname === "/profile/stats";
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [socialListType, setSocialListType] = useState("followers");
  const [socialSearchTerm, setSocialSearchTerm] = useState("");
  const [selectedBadgeId, setSelectedBadgeId] = useState(null);
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
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    repeatPassword: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSpotifyNoticeOpen, setIsSpotifyNoticeOpen] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaveStatus, setProfileSaveStatus] = useState(null);
  const [passwordSaveError, setPasswordSaveError] = useState("");
  const [passwordSaveStatus, setPasswordSaveStatus] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState("");
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [pendingBannerPreview, setPendingBannerPreview] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [bannerZoom, setBannerZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [bannerOffsetX, setBannerOffsetX] = useState(0);
  const [bannerOffsetY, setBannerOffsetY] = useState(0);
  const bannerInputRef = useRef(null);
  const proUntilLabel = user?.isPro ? formatProUntil(user?.proUntil) : "";
  const profileBadges = useMemo(() => {
    const realAchievements = Array.isArray(achievements) ? achievements : [];

    if (!user?.isPro) {
      return realAchievements;
    }

    return [
      ...realAchievements,
      {
        key: "pro_member",
        name: "Music PRO",
        description: "Perfil con membresia PRO activa.",
        tier: "pro",
        icon: "crown",
        unlocked_at: user?.proUntil ?? null,
      },
    ];
  }, [achievements, user?.isPro, user?.proUntil]);
  const initialBadgeId = profileBadges.find((badge) => getBadgeDetailClassName(badge.tier))?.key ?? profileBadges?.[0]?.key ?? null;
  const selectedBadge = useMemo(() => profileBadges.find((badge) => badge.key === selectedBadgeId) ?? profileBadges?.[0] ?? null, [profileBadges, selectedBadgeId]);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) {
        URL.revokeObjectURL(pendingAvatarPreview);
      }

      if (pendingBannerPreview) {
        URL.revokeObjectURL(pendingBannerPreview);
      }
    };
  }, [pendingAvatarPreview, pendingBannerPreview]);

  useEffect(() => {
    setProfileForm((current) => ({
      username: user?.username ?? current.username ?? "",
      phone: user?.phone ?? "",
    }));
  }, [user?.phone, user?.username]);

  function setPasswordFormField(field, value) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetPasswordForm() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      repeatPassword: "",
    });
    setPasswordSaveError("");
    setPasswordSaveStatus(null);
  }

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
    if (!isSocialModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSocialModalOpen]);

  useEffect(() => {
    if (!appToken) {
      setFollowers([]);
      setFollowing([]);
      return;
    }

    let cancelled = false;

    async function loadSocialLists() {
      setIsLoadingSocial(true);

      try {
        const [nextFollowers, nextFollowing] = await Promise.all([fetchMyFollowers(appToken), fetchMyFollowing(appToken)]);

        if (!cancelled) {
          setFollowers(nextFollowers);
          setFollowing(nextFollowing);
        }
      } catch {
        if (!cancelled) {
          setFollowers([]);
          setFollowing([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSocial(false);
        }
      }
    }

    loadSocialLists();

    return () => {
      cancelled = true;
    };
  }, [appToken]);

  useEffect(() => {
    if (!appToken) {
      setAchievements([]);
      return;
    }

    let cancelled = false;

    async function loadAchievements() {
      setIsLoadingAchievements(true);

      try {
        const nextAchievements = await fetchMyAchievements(appToken);

        if (!cancelled) {
          setAchievements(nextAchievements);
        }
      } catch {
        if (!cancelled) {
          setAchievements([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAchievements(false);
        }
      }
    }

    loadAchievements();

    return () => {
      cancelled = true;
    };
  }, [appToken]);

  useEffect(() => {
    setSelectedBadgeId(initialBadgeId);
  }, [initialBadgeId]);

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
        const nextBanner = user.banner?.trim() || profile.banner_url || "";

        if (
          nextUsername === (user.username ?? "") &&
          nextPhone === (user.phone ?? "") &&
          nextAvatar === (user.avatar ?? "") &&
          nextBanner === (user.banner ?? "")
        ) {
          return;
        }

        setAuthenticatedUser({
          ...user,
          username: nextUsername,
          phone: nextPhone,
          avatar_url: nextAvatar,
          avatar: nextAvatar,
          banner_url: nextBanner,
          banner: nextBanner,
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
  }, [isSpotifyUser, setAuthenticatedUser, user?.avatar, user?.banner, user?.id, user?.phone, user?.username]);

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
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
    setPendingAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return "";
    });
  }

  function clearPendingBannerSelection() {
    setPendingBannerFile(null);
    setBannerZoom(1);
    setBannerOffsetX(0);
    setBannerOffsetY(0);
    setPendingBannerPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return "";
    });
  }

  function closeEditProfileModal() {
    clearPendingAvatarSelection();
    clearPendingBannerSelection();
    setIsEditProfileOpen(false);
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
    setProfileSaveStatus(null);
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
    setPendingAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
    setPendingAvatarFile(file);
  }

  function handleOpenBannerPicker() {
    if (!user) {
      return;
    }

    if (!user.isPro) {
      closeEditProfileModal();
      navigate("/pro");
      return;
    }

    setProfileSaveError("");
    setProfileSaveStatus(null);
    bannerInputRef.current?.click();
  }

  function handleBannerFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) {
      return;
    }

    if (isSpotifyUser) {
      setProfileSaveError("Las cuentas iniciadas con Spotify no pueden editar estos datos.");
      return;
    }

    if (!user.isPro) {
      closeEditProfileModal();
      navigate("/pro");
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setProfileSaveError("Solo puedes subir banners JPG, PNG o WEBP.");
      return;
    }

    if (file.size > 7 * 1024 * 1024) {
      setProfileSaveError("El banner no puede superar los 7 MB.");
      return;
    }

    setProfileSaveError("");
    setProfileSaveStatus(null);
    setBannerZoom(1);
    setBannerOffsetX(0);
    setBannerOffsetY(0);
    setPendingBannerPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
    setPendingBannerFile(file);
  }

  async function handleAvatarUpload() {
    if (!pendingAvatarFile || !user) {
      return;
    }

    setIsUploadingAvatar(true);
    setProfileSaveError("");
    setProfileSaveStatus(null);

    try {
      const processedAvatarFile = await renderZoomedImageFile(pendingAvatarFile, avatarZoom, avatarOffsetX, avatarOffsetY, 512, 512);
      const response = await uploadProfileAvatar(user.id, processedAvatarFile, appToken);
      const nextAvatar = response?.user?.avatar_url ?? response?.publicUrl ?? "";

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
      } else if (error?.message === "INVALID_AVATAR_SIZE") {
        setProfileSaveError("La foto de perfil no puede superar los 5 MB.");
      } else {
        setProfileSaveError("No pudimos subir tu foto de perfil.");
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleBannerUpload() {
    if (!pendingBannerFile || !user) {
      return;
    }

    if (!user.isPro) {
      closeEditProfileModal();
      navigate("/pro");
      return;
    }

    setIsUploadingBanner(true);
    setProfileSaveError("");
    setProfileSaveStatus(null);

    try {
      const processedBannerFile = await renderZoomedImageFile(pendingBannerFile, bannerZoom, bannerOffsetX, bannerOffsetY, 1600, 500);
      const response = await uploadProfileBanner(user.id, processedBannerFile, appToken);
      const nextBanner = response?.user?.banner_url ?? response?.publicUrl ?? "";

      setAuthenticatedUser({
        ...user,
        banner_url: nextBanner,
        banner: nextBanner,
      });
      clearPendingBannerSelection();
      setProfileSaveStatus({
        type: "success",
        message: "Banner colocado correctamente.",
      });

      toast({
        title: "Banner actualizado",
        description: "Tu nuevo banner PRO ya esta guardado.",
      });
    } catch (error) {
      if (error?.message === "INVALID_BANNER_TYPE") {
        setProfileSaveError("Solo puedes subir banners JPG, PNG o WEBP.");
      } else if (error?.message === "INVALID_BANNER_SIZE") {
        setProfileSaveError("El banner no puede superar los 7 MB.");
      } else {
        setProfileSaveError("No pudimos subir tu banner en este momento.");
      }
    } finally {
      setIsUploadingBanner(false);
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
    setProfileSaveStatus(null);

    const trimmedUsername = profileForm.username.trim();
    const trimmedPhone = profileForm.phone.trim();
    if (!trimmedUsername) {
      setProfileSaveError("El nombre de usuario no puede quedar vacio.");
      setIsSavingProfile(false);
      return;
    }

    try {
      const backendUser = await updateAuthenticatedProfile(appToken, {
        username: trimmedUsername,
        phone: trimmedPhone,
      });

      setAuthenticatedUser({
        ...user,
        username: backendUser?.username ?? trimmedUsername,
        phone: backendUser?.phone ?? trimmedPhone,
        avatar_url: backendUser?.avatar_url ?? user.avatar ?? "",
        avatar: backendUser?.avatar_url ?? user.avatar ?? "",
        banner_url: backendUser?.banner_url ?? user.banner ?? "",
        banner: backendUser?.banner_url ?? user.banner ?? "",
        display_name: backendUser?.display_name ?? trimmedUsername,
        displayName: backendUser?.display_name ?? trimmedUsername,
        name: backendUser?.display_name ?? trimmedUsername,
      });
      setProfileForm((current) => ({
        ...current,
        username: backendUser?.username ?? trimmedUsername,
        phone: backendUser?.phone ?? trimmedPhone,
      }));

      toast({
        title: "Perfil actualizado",
        description: "Tus datos de perfil ya fueron actualizados.",
      });
      closeEditProfileModal();
    } catch (error) {
      setProfileSaveError(mapProfileUpdateError(error?.message));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSubmitPassword(event) {
    event.preventDefault();

    if (!user?.email) {
      return;
    }

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const repeatPassword = passwordForm.repeatPassword.trim();

    if (!currentPassword || !newPassword || !repeatPassword) {
      setPasswordSaveError("Completa todos los campos de contrasena.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordSaveError("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== repeatPassword) {
      setPasswordSaveError("La nueva contrasena y su repeticion no coinciden.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordSaveError("La nueva contrasena no puede ser igual a la actual.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordSaveError("");
    setPasswordSaveStatus(null);

    try {
      await verifyCurrentAuthenticatedPassword(user.email, currentPassword);
      await updateAuthenticatedPassword(newPassword);
      setPasswordSaveStatus({ type: "success" });
      toast({
        title: "Contrasena actualizada",
        description: "Tu nueva contrasena ya quedo guardada.",
      });
      window.setTimeout(() => {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          repeatPassword: "",
        });
        setPasswordSaveStatus(null);
        setIsPasswordModalOpen(false);
        closeEditProfileModal();
      }, 3000);
    } catch (error) {
      setPasswordSaveError(mapPasswordUpdateError(error?.message));
      setPasswordSaveStatus({ type: "error" });
    } finally {
      setIsSavingPassword(false);
    }
  }

  function openSocialModal(type) {
    if (!type) {
      setIsSocialModalOpen(false);
      setSocialSearchTerm("");
      return;
    }

    setSocialListType(type);
    setSocialSearchTerm("");
    setIsSocialModalOpen(true);
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

      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
        {profileUser?.banner ? (
          <>
            <img src={profileUser.banner} alt={`Banner de ${profileUser?.name ?? "MusicDB"}`} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.18),rgba(8,8,12,0.72),rgba(8,8,12,0.92))]" />
          </>
        ) : null}
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
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
            onClick={closeEditProfileModal}
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
                  bannerPreviewUrl={pendingBannerPreview || user?.banner}
                  avatarZoom={avatarZoom}
                  bannerZoom={bannerZoom}
                  avatarOffsetX={avatarOffsetX}
                  avatarOffsetY={avatarOffsetY}
                  bannerOffsetX={bannerOffsetX}
                  bannerOffsetY={bannerOffsetY}
                  form={profileForm}
                  onAvatarChange={handleAvatarFileChange}
                  onAvatarUpload={handleAvatarUpload}
                  onBannerUpload={handleBannerUpload}
                  onOpenBannerPicker={handleOpenBannerPicker}
                  onSetAvatarZoom={setAvatarZoom}
                  onSetBannerZoom={setBannerZoom}
                  onSetAvatarOffsetX={setAvatarOffsetX}
                  onSetAvatarOffsetY={setAvatarOffsetY}
                  onSetBannerOffsetX={setBannerOffsetX}
                  onSetBannerOffsetY={setBannerOffsetY}
                  onChange={setProfileFormField}
                  onClose={closeEditProfileModal}
                  onSubmit={handleSubmitProfile}
                  pendingAvatarName={pendingAvatarFile?.name ?? ""}
                  pendingBannerName={pendingBannerFile?.name ?? ""}
                  saveError={profileSaveError}
                  saveStatus={profileSaveStatus}
                  isUploadingAvatar={isUploadingAvatar}
                  isUploadingBanner={isUploadingBanner}
                  isPro={Boolean(user?.isPro)}
                  isSaving={isSavingProfile}
                  isSpotifyUser={isSpotifyUser}
                  onOpenPasswordModal={() => {
                    setPasswordSaveError("");
                    setIsPasswordModalOpen(true);
                  }}
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleBannerFileChange}
                  disabled={isUploadingBanner}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isPasswordModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[230] overflow-y-auto bg-[rgba(3,4,10,0.42)] px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
            onClick={() => {
              resetPasswordForm();
              setIsPasswordModalOpen(false);
            }}
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
                <LocalPasswordSettings
                  form={passwordForm}
                  onChange={setPasswordFormField}
                  onClose={() => {
                    resetPasswordForm();
                    setIsPasswordModalOpen(false);
                  }}
                  onSubmit={handleSubmitPassword}
                  saveError={passwordSaveError}
                  saveStatus={passwordSaveStatus}
                  isSaving={isSavingPassword}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isSpotifyNoticeOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[230] overflow-y-auto bg-[rgba(3,4,10,0.42)] px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
            onClick={() => setIsSpotifyNoticeOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mx-auto flex min-h-full w-full max-w-lg items-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-full rounded-[1.75rem] border border-white/18 bg-white/12 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/12 backdrop-blur-3xl sm:p-6">
                <div className="rounded-[1.35rem] border border-white/12 bg-black/18 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Antes de iniciar sesion</p>
                  <p className="mt-3 text-base font-semibold leading-relaxed text-white/92 sm:text-lg">
                    MusicDB aun esta en fase Beta, por lo que solo usuarios registrados en la whitelist de MusicDB pueden iniciar sesion con Spotify.
                  </p>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="border border-white/14 bg-white/8 text-white hover:bg-white/12"
                    onClick={() => setIsSpotifyNoticeOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <SpotifyConnectButton
                    onClick={async () => {
                      setIsSpotifyNoticeOpen(false);
                      await connectSpotify({ forcePrompt: true });
                    }}
                    disabled={isLoadingSpotify}
                    size="lg"
                    className="justify-center px-6"
                  >
                    {isLoadingSpotify ? "Conectando..." : "Iniciar sesion con Spotify"}
                  </SpotifyConnectButton>
                </div>
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
          isPro={Boolean(user?.isPro)}
          navigate={navigate}
          onConnectSpotify={() => setIsSpotifyNoticeOpen(true)}
          selectedRange={statsRange}
          setSelectedRange={setStatsRange}
          spotifyTopAlbums={spotifyTopAlbums}
          spotifyTopArtists={spotifyTopArtists}
          spotifyTopTracks={spotifyTopTracks}
        />
      ) : (
        <ProfileOverview
          filteredEntries={filteredEntries}
          followers={followers}
          following={following}
          hasSpotifyFeatures={hasSpotifyFeatures}
          historyEntries={historyEntries}
          historyError={historyError}
          historyFilter={historyFilter}
          isLoadingAchievements={isLoadingAchievements}
          isLoadingSocial={isLoadingSocial}
          isLoadingHistory={isLoadingHistory}
          isSocialModalOpen={isSocialModalOpen}
          openSocialModal={openSocialModal}
          profileBadges={profileBadges}
          proUntilLabel={proUntilLabel}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          selectedBadge={selectedBadge}
          setSelectedBadgeId={setSelectedBadgeId}
          socialListType={socialListType}
          socialSearchTerm={socialSearchTerm}
          setHistoryFilter={setHistoryFilter}
          setSearchOpen={setSearchOpen}
          setSearchTerm={setSearchTerm}
          setSocialSearchTerm={setSocialSearchTerm}
          spotifyUser={spotifyUser}
          user={user}
        />
      )}
    </div>
  );
}

