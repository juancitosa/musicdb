const AVATAR_GRADIENTS = [
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-cyan-500 via-sky-500 to-blue-600",
  "from-amber-500 via-orange-500 to-red-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-pink-500 via-rose-500 to-orange-400",
];

const BANNER_GRADIENTS = [
  "from-[#2a1a42] via-[#1a1430] to-[#0f0c18]",
  "from-[#101f2a] via-[#0b1622] to-[#090d14]",
  "from-[#2a180d] via-[#17100e] to-[#0d0a09]",
  "from-[#12251e] via-[#0d1715] to-[#090d0c]",
  "from-[#2b1422] via-[#1a1020] to-[#0d0a12]",
];

const ACHIEVEMENT_BADGE_CATALOG = {
  first_rating: {
    id: "first_rating",
    name: "Primer voto",
    description: "Califico su primer artista o album en MusicDB.",
    tier: "bronze",
    icon: "star",
  },
  critic_voice: {
    id: "critic_voice",
    name: "Voz critica",
    description: "Publico su primera resena dentro de MusicDB.",
    tier: "silver",
    icon: "message",
  },
  golden_circle: {
    id: "golden_circle",
    name: "Circulo dorado",
    description: "Supero los 50 ranks totales dentro de la comunidad.",
    tier: "gold",
    icon: "spark",
  },
};

function hashString(value = "") {
  return Array.from(String(value)).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

function pickGradient(value, options) {
  const index = hashString(value) % options.length;
  return options[index];
}

function hasActiveProMembership(profile) {
  if (!profile?.isPro) {
    return false;
  }

  if (!profile?.proUntil) {
    return true;
  }

  const proUntilDate = new Date(profile.proUntil);

  if (Number.isNaN(proUntilDate.getTime())) {
    return false;
  }

  return proUntilDate.getTime() > Date.now();
}

function buildBadges(profile, achievements = []) {
  const realAchievements = (achievements ?? [])
    .map((achievement) => {
      const catalogEntry = ACHIEVEMENT_BADGE_CATALOG[achievement?.key];

      if (!catalogEntry) {
        return null;
      }

      return {
        ...catalogEntry,
        unlockedAt: achievement?.unlocked_at ?? null,
      };
    })
    .filter(Boolean);

  if (!hasActiveProMembership(profile)) {
    return realAchievements;
  }

  return [
    ...realAchievements,
    {
      id: "pro_member",
      name: "Music PRO",
      description: "Perfil con membresia PRO activa.",
      tier: "pro",
      icon: "crown",
      unlockedAt: profile.proUntil || null,
    },
  ];
}

function mapRecentRating(entry = {}) {
  return {
    entityType: entry.entity_type === "artist" ? "artist" : "album",
    title: entry.entity_name || entry.entity_id || "Sin titulo",
    subtitle: entry.entity_subtitle || (entry.entity_type === "artist" ? "Artista" : "Album"),
    rating: Number(entry.rating_value || 0),
    artworkImage: entry.artwork_url || "",
  };
}

function normalizePublicProfile(user) {
  const normalizedProfile = {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username || "Usuario",
    bio: user.bio || "Este perfil todavia no agrego una bio.",
    isPro: Boolean(user.is_pro),
    proUntil: user.pro_until || null,
    isFollowing: Boolean(user.is_following),
    isOwnProfile: Boolean(user.is_own_profile),
    joinedAt: user.joined_at || null,
    avatarImage: user.avatar_url || "",
    bannerImage: user.banner_url || "",
    avatarGradient: pickGradient(user.username || user.display_name, AVATAR_GRADIENTS),
    bannerGradient: pickGradient(user.username || user.display_name, BANNER_GRADIENTS),
    stats: {
      ratingsCount: Number(user.stats?.ratings_count || 0),
      reviewsCount: Number(user.stats?.reviews_count || 0),
      likesReceived: Number(user.stats?.likes_received || 0),
      followers: Number(user.stats?.followers_count || 0),
      following: Number(user.stats?.following_count || 0),
    },
    recentRatings: Array.isArray(user.recent_ratings) ? user.recent_ratings.map(mapRecentRating) : [],
    achievements: Array.isArray(user.achievements) ? user.achievements : [],
  };

  return {
    ...normalizedProfile,
    isPro: hasActiveProMembership(normalizedProfile),
    badges: buildBadges(normalizedProfile, normalizedProfile.achievements),
  };
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchPublicProfileByUsername(username, token = null) {
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername) {
    return null;
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/users/public/${encodeURIComponent(normalizedUsername)}`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    });
  } catch {
    throw new Error("PUBLIC_PROFILE_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(data?.error?.code || "PUBLIC_PROFILE_ERROR");
  }

  return normalizePublicProfile(data?.user ?? null);
}

async function mutateFollow(username, token, method) {
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername || !token) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/users/public/${encodeURIComponent(normalizedUsername)}/follow`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("PUBLIC_PROFILE_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "PUBLIC_PROFILE_FOLLOW_ERROR");
  }

  return {
    following: Boolean(data?.following),
    followersCount: Number(data?.followers_count || 0),
  };
}

export function followPublicProfile(username, token) {
  return mutateFollow(username, token, "POST");
}

export function unfollowPublicProfile(username, token) {
  return mutateFollow(username, token, "DELETE");
}

export function getBadgeTierClassName(tier) {
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
