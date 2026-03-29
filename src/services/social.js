async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchSocialList(path, token) {
  if (!token) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "SOCIAL_LIST_ERROR");
  }

  return (data?.users ?? []).map((user) => ({
    id: user.id,
    username: user.username ?? "",
    displayName: user.display_name ?? user.username ?? "Usuario",
    avatarUrl: user.avatar_url ?? "",
    isPro: Boolean(user.is_pro),
  }));
}

export function fetchMyFollowers(token) {
  return fetchSocialList("/users/me/followers", token);
}

export function fetchMyFollowing(token) {
  return fetchSocialList("/users/me/following", token);
}

export async function fetchMyAchievements(token) {
  if (!token) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/users/me/achievements`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "ACHIEVEMENTS_FETCH_ERROR");
  }

  return Array.isArray(data?.achievements) ? data.achievements : [];
}
