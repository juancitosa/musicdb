export async function fetchSpotifyProfile(accessToken) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error("TOKEN_EXPIRED");
  }

  if (!response.ok) {
    throw new Error("SPOTIFY_PROFILE_ERROR");
  }

  const profile = await response.json();

  return {
    spotify_user_id: profile.id,
    email: profile.email ?? "",
    display_name: profile.display_name ?? profile.email ?? "Spotify User",
    avatar_url: profile.images?.[0]?.url ?? "",
  };
}

export async function syncSpotifyUser(payload) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/auth/spotify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorCode = data?.error?.code;
    throw new Error(errorCode || "APP_AUTH_ERROR");
  }

  return data;
}
