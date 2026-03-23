async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function postAuthRequest(path, payload) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "APP_AUTH_ERROR");
  }

  return data;
}

export async function fetchSpotifyProfile(accessToken) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error("TOKEN_EXPIRED");
  }

  if (response.status === 403) {
    throw new Error("SPOTIFY_FORBIDDEN");
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

export function syncSpotifyUser(payload) {
  return postAuthRequest("/auth/spotify", payload);
}

export function registerLocalUser(payload) {
  return postAuthRequest("/auth/register", payload);
}

export function loginLocalUser(payload) {
  return postAuthRequest("/auth/login", payload);
}

export function resendVerificationEmail(payload) {
  return postAuthRequest("/auth/verify-email/resend", payload);
}

export function verifyEmailToken(payload) {
  return postAuthRequest("/auth/verify-email", payload);
}

export async function fetchAuthenticatedUser(token) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "APP_AUTH_ERROR");
  }

  return data?.user ?? null;
}
