const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "c1f66adf91794dde89f087a84a559e3b";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

function getRedirectUri() {
  if (import.meta.env.VITE_SPOTIFY_REDIRECT_URI) {
    return import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  }

  const url = new URL(window.location.href);

  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.toString();
}

const REDIRECT_URI = getRedirectUri();
const TOKEN_KEY = "spotify_auth_session";
const CODE_VERIFIER_KEY = "spotify_code_verifier";
const SCOPES = [
  "user-top-read",
  "user-read-private",
  "user-read-email",
  "user-library-read",
];

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  return window.crypto.subtle.digest("SHA-256", data);
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getStoredSpotifySession() {
  try {
    const session = localStorage.getItem(TOKEN_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

export function setStoredSpotifySession(session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function clearStoredSpotifySession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CODE_VERIFIER_KEY);
}

export async function getSpotifyAuthorizationUrl() {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem(CODE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES.join(" "),
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function requestToken(params) {
  const isRefresh = params.grant_type === "refresh_token";
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${isRefresh ? "/auth/refresh" : "/auth/token"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error("SPOTIFY_BACKEND_UNAVAILABLE");
  }

  if (!response.ok) {
    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const errorCode = payload?.error?.code;

    if (response.status === 401) {
      throw new Error("SPOTIFY_TOKEN_UNAUTHORIZED");
    }

    if (errorCode) {
      throw new Error(errorCode);
    }

    throw new Error("SPOTIFY_TOKEN_ERROR");
  }

  return response.json();
}

function normalizeTokenResponse(data, refreshTokenFallback = "") {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshTokenFallback,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
  };
}

export async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error("MISSING_CODE_VERIFIER");
  }

  const data = await requestToken({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const session = normalizeTokenResponse(data);
  setStoredSpotifySession(session);
  localStorage.removeItem(CODE_VERIFIER_KEY);

  return session;
}

export async function refreshSpotifyToken(refreshToken) {
  const data = await requestToken({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const session = normalizeTokenResponse(data, refreshToken);
  setStoredSpotifySession(session);
  return session;
}

export function getSpotifyCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("code");
}

export function clearSpotifyCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
