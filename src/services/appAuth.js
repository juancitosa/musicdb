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

  const fallbackUsername = user.email?.split("@")[0] ?? "";

  return {
    id: user.id,
    email: user.email ?? "",
    username: "",
    phone: user.phone ?? "",
    display_name: fallbackUsername || "MusicDB User",
    auth_provider: "local",
    avatar_url: user.user_metadata?.avatar_url ?? "",
    is_verified: Boolean(user.email_confirmed_at),
    verified_at: user.email_confirmed_at ?? null,
    name: fallbackUsername || "MusicDB User",
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

  const authUser = mapSupabaseUser(data.user);
  const profile = authUser?.id ? await fetchSupabaseProfile(authUser.id).catch(() => null) : null;
  const resolvedUsername = profile?.username ?? authUser?.username ?? "";
  const resolvedAvatar = profile?.avatar_url ?? authUser?.avatar_url ?? "";

  return {
    token: data.session?.access_token ?? null,
    user: {
      ...authUser,
      username: resolvedUsername,
      phone: profile?.phone ?? authUser?.phone ?? "",
      avatar_url: resolvedAvatar,
      display_name: resolvedUsername || authUser?.display_name || "MusicDB User",
      name: resolvedUsername || authUser?.name || "MusicDB User",
    },
  };
}

export async function fetchLocalSupabaseUser(token) {
  const supabase = getSupabaseClient();
  const {
    data: { user } = {},
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message || "LOCAL_AUTH_USER_NOT_FOUND");
  }

  const authUser = mapSupabaseUser(user);
  const profile = authUser?.id ? await fetchSupabaseProfile(authUser.id).catch(() => null) : null;
  const resolvedUsername = profile?.username ?? "";
  const resolvedAvatar = profile?.avatar_url ?? authUser?.avatar_url ?? "";

  return {
    ...authUser,
    username: resolvedUsername,
    phone: profile?.phone ?? authUser?.phone ?? "",
    avatar_url: resolvedAvatar,
    display_name: resolvedUsername || authUser?.display_name || "MusicDB User",
    name: resolvedUsername || authUser?.name || "MusicDB User",
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
  const updatePayload = {
    id: userId,
  };

  if (payload.username !== undefined) {
    updatePayload.username = payload.username;
  }

  if (payload.phone !== undefined) {
    updatePayload.phone = payload.phone;
  }

  if (payload.avatar_url !== undefined) {
    updatePayload.avatar_url = payload.avatar_url;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(updatePayload, {
      onConflict: "id",
    })
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

export async function uploadProfileAvatar(userId, file) {
  const supabase = getSupabaseClient();
  const allowedTypes = ["image/jpeg", "image/png"];
  const fileExt = String(file?.name || "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();

  if (!allowedTypes.includes(file?.type) || !["jpg", "png"].includes(fileExt)) {
    throw new Error("INVALID_AVATAR_TYPE");
  }

  const filePath = `${userId}/avatar.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "APP_AUTH_ERROR");
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      avatar_url: data?.publicUrl ?? "",
    }, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (profileError) {
    throw new Error(profileError.message || "APP_AUTH_ERROR");
  }

  return {
    path: filePath,
    publicUrl: data?.publicUrl ?? "",
    profile,
  };
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
