import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Crown, Disc3, Heart, MessageSquareText, Sparkles, Star, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SectionHeader from "../components/shared/SectionHeader";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { fetchPublicProfileByUsername, followPublicProfile, getBadgeTierClassName, unfollowPublicProfile } from "../services/publicProfiles";

function AvatarDisplay({ profile, sizeClassName = "h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl" }) {
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${profile.avatarGradient} font-black text-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${sizeClassName}`}
    >
      {profile.avatarImage ? <img src={profile.avatarImage} alt={profile.displayName} className="h-full w-full object-cover" /> : initials}
    </div>
  );
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-center sm:text-left">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function ArtworkThumb({ image, alt }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-white/5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] sm:h-16 sm:w-16">
      {image ? <img src={image} alt={alt} className="h-full w-full object-cover" /> : null}
    </div>
  );
}

function RecentRatingCard({ entry }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <ArtworkThumb image={entry.artworkImage} alt={`Portada de ${entry.title}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {entry.entityType === "artist" ? "Artista" : "Album"}
            </p>
            <p className="mt-2 truncate text-base font-bold sm:text-lg">{entry.title}</p>
            <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-end text-primary sm:self-auto">
          <Star className="h-4 w-4 fill-current" />
          <span className="text-xl font-black">{entry.rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams();
  const { appToken, isLoggedIn, user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [selectedBadgeId, setSelectedBadgeId] = useState(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUnfollowConfirmOpen, setIsUnfollowConfirmOpen] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isMutatingFollow, setIsMutatingFollow] = useState(false);
  const initialBadgeId = profile?.badges.find((badge) => getBadgeDetailClassName(badge.tier))?.id ?? profile?.badges?.[0]?.id ?? null;
  const selectedBadge = useMemo(() => profile?.badges.find((badge) => badge.id === selectedBadgeId) ?? profile?.badges?.[0] ?? null, [profile, selectedBadgeId]);
  const recentRatings = profile?.recentRatings ?? [];
  const hasBadges = (profile?.badges?.length ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      setProfileError("");
      setProfile(null);

      try {
        const nextProfile = await fetchPublicProfileByUsername(username, appToken);

        if (!cancelled) {
          setProfile(nextProfile);
          setIsFollowing(Boolean(nextProfile?.isFollowing));
          setFollowersCount(Number(nextProfile?.stats.followers || 0));
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error?.message || "PUBLIC_PROFILE_ERROR");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [appToken, username]);

  useEffect(() => {
    setSelectedBadgeId(initialBadgeId);
  }, [initialBadgeId]);

  useEffect(() => {
    if (!isAvatarOpen && !isUnfollowConfirmOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAvatarOpen, isUnfollowConfirmOpen]);

  if (isLoadingProfile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-border/70 bg-card/80 p-8 text-center shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Perfil publico</p>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Cargando perfil...</h1>
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-border/70 bg-card/80 p-8 text-center shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Perfil publico</p>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">No encontramos ese perfil</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {profileError === "PUBLIC_PROFILE_BACKEND_UNAVAILABLE"
              ? "No pudimos conectar el perfil publico con el backend local."
              : "Ese username no existe o todavia no tiene perfil publico disponible."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </section>
      </div>
    );
  }

  async function handleFollow() {
    if (!isLoggedIn || !appToken) {
      toast({
        title: "Accion requerida",
        description: "Tenes que iniciar sesion para seguir perfiles.",
        variant: "destructive",
      });
      return;
    }

    if (profile.isOwnProfile) {
      return;
    }

    setIsMutatingFollow(true);

    try {
      const response = await followPublicProfile(profile.username, appToken);
      setIsFollowing(response.following);
      setFollowersCount(response.followersCount);
    } catch (error) {
      toast({
        title: "No pudimos seguir el perfil",
        description: error?.message === "FOLLOW_SELF_FORBIDDEN" ? "No podes seguir tu propio perfil." : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsMutatingFollow(false);
    }
  }

  async function handleUnfollow() {
    if (!isLoggedIn || !appToken) {
      setIsUnfollowConfirmOpen(false);
      return;
    }

    setIsMutatingFollow(true);

    try {
      const response = await unfollowPublicProfile(profile.username, appToken);
      setIsFollowing(response.following);
      setFollowersCount(response.followersCount);
      setIsUnfollowConfirmOpen(false);
    } catch {
      toast({
        title: "No pudimos dejar de seguir",
        description: "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsMutatingFollow(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md">Perfil publico</span>
        <a href="#actividad-publica" className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          Actividad
        </a>
      </div>

      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-[#08080c] shadow-lg shadow-black/10">
        <div className="absolute inset-x-0 top-0 h-44 overflow-hidden sm:h-56">
          {profile.bannerImage ? (
            <>
              <img src={profile.bannerImage} alt={`Banner de ${profile.displayName}`} className="absolute inset-0 h-full w-full object-cover object-center" />
              <div className={`absolute inset-0 bg-gradient-to-br ${profile.bannerGradient} opacity-65 mix-blend-screen`} />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${profile.bannerGradient}`} />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.06)_0%,rgba(8,8,12,0.14)_30%,rgba(8,8,12,0.55)_65%,rgba(8,8,12,0.96)_100%)]" />
        </div>

        <div className="relative flex flex-col gap-5 px-4 pt-20 pb-5 sm:px-6 sm:pt-24 sm:pb-8 md:flex-row md:items-start md:justify-between md:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <button
              type="button"
              onClick={() => setIsAvatarOpen(true)}
              className="group relative mx-auto rounded-full transition hover:scale-[1.02] md:mx-0"
              aria-label={`Ver avatar de ${profile.displayName}`}
            >
              <AvatarDisplay profile={profile} />
              <span className="absolute right-1 bottom-1 rounded-full border border-white/14 bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/82 opacity-0 transition group-hover:opacity-100">
                Ver
              </span>
            </button>
            <div className="min-w-0 text-center md:text-left">
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <h1 className={`text-3xl font-bold text-white sm:text-4xl ${profile.isPro ? "pro-username" : ""}`}>{profile.displayName}</h1>
                {profile.isPro ? (
                  <span className="pro-badge inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                    PRO <Star className="h-3.5 w-3.5 fill-current" />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-white/65">@{profile.username}</p>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/84 sm:text-base">{profile.bio}</p>

            </div>
          </div>

          <div className="md:pl-6">
            {!profile.isOwnProfile ? (
              <button
                type="button"
                onClick={() => {
                  if (isFollowing) {
                    setIsUnfollowConfirmOpen(true);
                    return;
                  }

                  handleFollow();
                }}
                disabled={isMutatingFollow}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition md:w-auto ${
                  isFollowing
                    ? "border-white/14 bg-white/8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] hover:bg-white/12"
                    : "border-primary/30 bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(124,58,237,0.28)] hover:bg-primary/90"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <UserRound className="h-4 w-4" />
                {isMutatingFollow ? "Procesando..." : isFollowing ? "Siguiendo" : "Seguir"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className={`mb-8 grid grid-cols-1 gap-4 ${hasBadges ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <StatCard label="Ratings" value={profile.stats.ratingsCount} />
        <StatCard label="Resenas" value={profile.stats.reviewsCount} />
        <StatCard label="Seguidores" value={followersCount} />
        {hasBadges ? <StatCard label="Medallas" value={profile.badges.length} /> : null}
      </section>

      <div className="space-y-8">
        {hasBadges ? (
          <section className="rounded-3xl border border-border bg-card p-4 shadow-lg shadow-black/5 sm:p-6">
            <SectionHeader
              icon={<Sparkles className="h-5 w-5 text-primary" />}
              title="Medallas del perfil"
              subtitle="Se muestran solo las medallas realmente desbloqueadas por este usuario."
            />
            <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
              <div className="flex flex-wrap gap-3">
                {profile.badges.map((badge) => (
                  <BadgeMedallion
                    key={badge.id}
                    badge={badge}
                    isActive={selectedBadge?.id === badge.id}
                    onClick={() => setSelectedBadgeId(badge.id)}
                  />
                ))}
              </div>
              {selectedBadge ? <BadgeDetailCard badge={selectedBadge} /> : null}
            </div>
          </section>
        ) : null}

        {recentRatings.length > 0 ? (
          <section id="actividad-publica" className="rounded-3xl border border-border bg-card p-4 shadow-lg shadow-black/5 sm:p-6">
            <SectionHeader
              icon={<Disc3 className="h-5 w-5 text-primary" />}
              title="Actividad reciente"
              subtitle="Muestra hasta los ultimos 3 ranks publicados por este perfil."
            />
            <div className="grid gap-4">
              {recentRatings.map((entry) => (
                <RecentRatingCard key={`${entry.entityType}-${entry.title}-${entry.subtitle}`} entry={entry} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <AnimatePresence>
        {isAvatarOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[240] bg-[rgba(3,4,10,0.42)] backdrop-blur-md"
            onClick={() => setIsAvatarOpen(false)}
          >
            <div className="flex min-h-screen items-center justify-center px-4 py-6">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full max-w-md rounded-[2rem] border border-white/14 bg-black/45 p-5 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto flex justify-center">
                  <AvatarDisplay profile={profile} sizeClassName="h-40 w-40 text-5xl sm:h-56 sm:w-56 sm:text-7xl" />
                </div>
                <p className="mt-5 text-xl font-bold text-white">{profile.displayName}</p>
                <button
                  type="button"
                  onClick={() => setIsAvatarOpen(false)}
                  className="mt-5 inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white/88 transition hover:bg-white/12"
                >
                  Cerrar
                </button>
              </motion.div>
            </div>
          </motion.div>
        ) : null}

        {isUnfollowConfirmOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[245] bg-[rgba(3,4,10,0.42)] backdrop-blur-md"
            onClick={() => setIsUnfollowConfirmOpen(false)}
          >
            <div className="flex min-h-screen items-center justify-center px-4 py-6">
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="w-full max-w-md rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/80">Siguiendo</p>
                <h2 className="mt-3 text-2xl font-black text-white">¿Realmente deseas dejar de seguir a {profile.displayName}?</h2>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsUnfollowConfirmOpen(false)}
                    disabled={isMutatingFollow}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/88 transition hover:bg-white/12"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleUnfollow}
                    disabled={isMutatingFollow}
                    className="inline-flex items-center justify-center rounded-full border border-red-400/20 bg-red-500/12 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/18"
                  >
                    {isMutatingFollow ? "Procesando..." : "Dejar de seguir"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
