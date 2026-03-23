import { getSupabaseClient } from "../lib/supabase";

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

function mapSupabaseUser(user) {
  if (!user) {
    return null;
  }

  const username =
    user.user_metadata?.username ??
    user.user_metadata?.user_name ??
    user.email?.split("@")[0] ??
    "";

  return {
    id: user.id,
    email: user.email ?? "",
    username,
    phone: user.phone ?? "",
    display_name: user.user_metadata?.display_name ?? username ?? "MusicDB User",
    auth_provider: "local",
    avatar_url: user.user_metadata?.avatar_url ?? "",
    is_verified: Boolean(user.email_confirmed_at),
    verified_at: user.email_confirmed_at ?? null,
    name: user.user_metadata?.display_name ?? username ?? "MusicDB User",
  };
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

export async function registerLocalUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data;
}

export async function loginLocalUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const code = (error.code || "").toLowerCase();

    if (message.includes("email not confirmed") || code === "email_not_confirmed") {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    throw new Error("LOCAL_LOGIN_INVALID");
  }

  return {
    token: data.session?.access_token ?? null,
    user: mapSupabaseUser(data.user),
  };
}

export function resendVerificationEmail(payload) {
  return postAuthRequest("/auth/verify-email/resend", payload);
}

export async function verifyEmailToken(token) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
  } catch {
    throw new Error("APP_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "APP_AUTH_ERROR");
  }

  return data;
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

export async function fetchSupabaseProfile(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data ?? null;
}

export async function updateSupabaseProfile(userId, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: payload.username,
      phone: payload.phone,
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    const message = (error.message || "").toLowerCase();

    if (message.includes("duplicate") || message.includes("unique")) {
      throw new Error("USERNAME_ALREADY_EXISTS");
    }

    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data;
}

export async function updateAuthenticatedPassword(password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data;
}
