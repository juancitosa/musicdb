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

async function patchAuthenticatedRequest(path, token, payload) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

  const metadataUsername = typeof user.user_metadata?.username === "string" ? user.user_metadata.username.trim() : "";
  const fallbackUsername = metadataUsername || user.email?.split("@")[0] || "";

  return {
    id: user.id,
    email: user.email ?? "",
    username: metadataUsername,
    phone: user.phone ?? "",
    display_name: fallbackUsername || "MusicDB User",
    auth_provider: "local",
    avatar_url: user.user_metadata?.avatar_url ?? "",
    banner_url: user.user_metadata?.banner_url ?? "",
    is_admin: Boolean(user.user_metadata?.is_admin),
    is_verified: Boolean(user.email_confirmed_at),
    verified_at: user.email_confirmed_at ?? null,
    name: fallbackUsername || "MusicDB User",
  };
}

function sanitizeCredentials(payload = {}) {
  return {
    ...payload,
    email: payload.email?.trim().toLowerCase() ?? "",
    password: payload.password?.trim() ?? "",
    username: payload.username?.trim() ?? "",
  };
}

function isNotFoundError(error) {
  return error?.code === "PGRST116";
}

async function findUserRecord(supabase, column, value) {
  if (!value) {
    return null;
  }

  const { data, error } = await supabase.from("users").select("*").eq(column, value).maybeSingle();

  if (error && !isNotFoundError(error)) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data ?? null;
}

async function findProfileRecord(supabase, profileId) {
  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();

  if (error && !isNotFoundError(error)) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data ?? null;
}

function mapUsersTableError(error) {
  const message = (error?.message || "").toLowerCase();

  if (message.includes("username")) {
    return "USERNAME_ALREADY_EXISTS";
  }

  if (message.includes("email")) {
    return "EMAIL_ALREADY_EXISTS";
  }

  return error?.message || "APP_AUTH_ERROR";
}

async function ensureUserTableRecord(supabase, authUser, payload = {}) {
  if (!authUser?.id || !authUser?.email) {
    throw new Error("No se pudo crear la cuenta");
  }

  const email = payload.email?.trim().toLowerCase() || authUser.email?.trim().toLowerCase() || "";
  const existingById = await findUserRecord(supabase, "id", authUser.id);
  const existingByEmail = await findUserRecord(supabase, "email", email);
  const requestedUsername = payload.username?.trim() || "";
  const metadataUsername = authUser.user_metadata?.username?.trim() || "";
  const username = requestedUsername || existingById?.username || metadataUsername || "";
  const displayName = username || email.split("@")[0] || "MusicDB User";

  if (existingByEmail && existingByEmail.id !== authUser.id) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  if (username) {
    const existingByUsername = await findUserRecord(supabase, "username", username);

    if (existingByUsername && existingByUsername.id !== authUser.id) {
      throw new Error("USERNAME_ALREADY_EXISTS");
    }
  }

  if (existingById) {
    const nextPayload = {};

    if (!existingById.email && email) {
      nextPayload.email = email;
    }

    if (username && existingById.username !== username) {
      nextPayload.username = username;
    }

    if (!existingById.display_name && displayName) {
      nextPayload.display_name = displayName;
    }

    if (!existingById.auth_provider) {
      nextPayload.auth_provider = "local";
    }

    if (existingById.is_verified === null || existingById.is_verified === undefined) {
      nextPayload.is_verified = Boolean(authUser.email_confirmed_at);
    }

    if (!existingById.verified_at && authUser.email_confirmed_at) {
      nextPayload.verified_at = authUser.email_confirmed_at;
    }

    if (!Object.keys(nextPayload).length) {
      return existingById;
    }

    const { data, error } = await supabase.from("users").update(nextPayload).eq("id", authUser.id).select("*").single();

    if (error) {
      throw new Error(mapUsersTableError(error));
    }

    return data;
  }

  const insertPayload = {
    id: authUser.id,
    email,
    created_at: new Date().toISOString(),
    display_name: displayName,
    auth_provider: "local",
    is_verified: Boolean(authUser.email_confirmed_at),
    verified_at: authUser.email_confirmed_at ?? null,
  };

  if (username) {
    insertPayload.username = username;
  }

  const { data, error } = await supabase.from("users").insert(insertPayload).select("*").single();

  if (error) {
    throw new Error(mapUsersTableError(error));
  }

  return data;
}

async function ensureProfileRecord(supabase, authUser, payload = {}) {
  if (!authUser?.id) {
    return null;
  }

  const existingProfile = await findProfileRecord(supabase, authUser.id);
  const requestedUsername = payload.username?.trim() || "";
  const metadataUsername = authUser.user_metadata?.username?.trim() || "";
  const username = requestedUsername || existingProfile?.username || metadataUsername || "";

  if (existingProfile) {
    const nextPayload = {};

    if (username && existingProfile.username !== username) {
      nextPayload.username = username;
    }

    if (!existingProfile.phone) {
      nextPayload.phone = "";
    }

    if (!existingProfile.avatar_url) {
      nextPayload.avatar_url = "";
    }

    if (!existingProfile.banner_url) {
      nextPayload.banner_url = "";
    }

    if (existingProfile.is_admin === null || existingProfile.is_admin === undefined) {
      nextPayload.is_admin = false;
    }

    if (!Object.keys(nextPayload).length) {
      return existingProfile;
    }

    const { data, error } = await supabase.from("profiles").update(nextPayload).eq("id", authUser.id).select("*").single();

    if (error) {
      console.error(error);
      return existingProfile;
    }

    return data;
  }

  const { data, error } = await supabase.from("profiles").insert({
    id: authUser.id,
    username: username || "usuario",
    phone: "",
    avatar_url: "",
    banner_url: "",
    created_at: new Date().toISOString(),
    is_admin: false,
  }).select("*").single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function fetchSpotifyProfile(accessToken) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new Error("SPOTIFY_BACKEND_UNAVAILABLE");
  }

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

export function syncSpotifyUser(accessToken) {
  return postAuthRequest("/auth/spotify", {
    access_token: accessToken,
  });
}

export async function registerLocalUser(payload) {
  const sanitizedPayload = sanitizeCredentials(payload);
  const supabase = getSupabaseClient();
  const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: sanitizedPayload.email,
    password: sanitizedPayload.password,
    options: {
      emailRedirectTo,
      data: {
        username: sanitizedPayload.username || undefined,
      },
    },
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const code = (error.code || "").toLowerCase();

    if (error.status === 429) {
      throw new Error("TOO_MANY_SIGNUP_ATTEMPTS");
    }

    if (message.includes("already registered") || code === "user_already_exists") {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  const user = data?.user ? mapSupabaseUser(data.user) : { email: sanitizedPayload.email };

  return {
    user,
    requires_email_verification: true,
    verification_email_sent: true,
    verification_delivery: "supabase",
  };
}

export async function loginLocalUser(payload) {
  const sanitizedPayload = sanitizeCredentials(payload);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: sanitizedPayload.email,
    password: sanitizedPayload.password,
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const code = (error.code || "").toLowerCase();

    if (message.includes("email not confirmed") || code === "email_not_confirmed") {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials") ||
      code === "invalid_credentials"
    ) {
      throw new Error("LOCAL_LOGIN_INVALID");
    }

    throw new Error(error.message || "LOCAL_LOGIN_INVALID");
  }

  if (!data?.session?.access_token) {
    throw new Error("APP_AUTH_ERROR");
  }

  const backendUser = await fetchAuthenticatedUser(data.session.access_token).catch(() => null);
  const authUser = mapSupabaseUser(data.user);

  return {
    token: data.session.access_token,
    user: backendUser ?? authUser,
  };
}

export async function fetchLocalSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data?.session ?? null;
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

  return mapSupabaseUser(user);
}

export function resendVerificationEmail(payload) {
  const supabase = getSupabaseClient();
  const email = payload?.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return Promise.reject(new Error("INVALID_EMAIL_VERIFICATION_RESEND_PAYLOAD"));
  }

  const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;

  return supabase.auth
    .resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo,
      },
    })
    .then(({ error }) => {
      if (error) {
        throw new Error(error.message || "APP_AUTH_ERROR");
      }

      return {
        success: true,
        verification_delivery: "supabase",
      };
    });
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

  if (error && !isNotFoundError(error)) {
    throw new Error(error.message || "APP_AUTH_ERROR");
  }

  return data ?? null;
}

export async function fetchCurrentUserByEmail(email) {
  if (!email) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();

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

  if (payload.banner_url !== undefined) {
    updatePayload.banner_url = payload.banner_url;
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

export async function updateAuthenticatedProfile(sessionToken, payload) {
  if (!sessionToken) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  const response = await patchAuthenticatedRequest("/auth/profile", sessionToken, payload);
  return response?.user ?? null;
}

export async function uploadProfileAvatar(userId, file, sessionToken) {
  const supabase = getSupabaseClient();

  if (!file) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("INVALID_AVATAR_TYPE");
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("UPLOAD ERROR:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const publicUrl = data?.publicUrl ?? "";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      avatar_url: publicUrl,
    }, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (profileError) {
    throw new Error(profileError.message || "APP_AUTH_ERROR");
  }

  let user = null;

  if (sessionToken && publicUrl) {
    const response = await patchAuthenticatedRequest("/auth/profile", sessionToken, {
      avatar_url: publicUrl,
    });
    user = response?.user ?? null;
  }

  return {
    path: filePath,
    publicUrl,
    profile,
    user,
  };
}

export async function uploadProfileBanner(userId, file, sessionToken) {
  const supabase = getSupabaseClient();

  if (!file) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("INVALID_BANNER_TYPE");
  }

  if (file.size > 7 * 1024 * 1024) {
    throw new Error("INVALID_BANNER_SIZE");
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/banner-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("BANNER UPLOAD ERROR:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const publicUrl = data?.publicUrl ?? "";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      banner_url: publicUrl,
    }, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (profileError) {
    throw new Error(profileError.message || "APP_AUTH_ERROR");
  }

  let user = null;

  if (sessionToken && publicUrl) {
    const response = await patchAuthenticatedRequest("/auth/profile", sessionToken, {
      banner_url: publicUrl,
    });
    user = response?.user ?? null;
  }

  return {
    path: filePath,
    publicUrl,
    profile,
    user,
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

export async function verifyCurrentAuthenticatedPassword(email, password) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("CURRENT_PASSWORD_INVALID");
  }

  return true;
}
