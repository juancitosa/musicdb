import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);
const VERCEL_APP_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

let cachedAppToken = null;
let supabaseAdmin = null;

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin) || VERCEL_APP_ORIGIN_PATTERN.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true,
  }),
);

app.use(express.json());

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail || null;
}

function normalizeDisplayName(displayName, fallback = "Spotify User") {
  if (typeof displayName !== "string") {
    return fallback;
  }

  const value = displayName.trim();
  return value || fallback;
}

function normalizeAvatarUrl(avatarUrl) {
  if (typeof avatarUrl !== "string") {
    return null;
  }

  const value = avatarUrl.trim();
  return value || null;
}

function normalizeEntityType(entityType) {
  if (typeof entityType !== "string") {
    return null;
  }

  const value = entityType.trim().toLowerCase();
  return value === "artist" || value === "album" ? value : null;
}

function normalizeEntityId(entityId) {
  if (typeof entityId !== "string" && typeof entityId !== "number") {
    return null;
  }

  const value = String(entityId).trim();
  return value || null;
}

function normalizeUserId(userId) {
  if (typeof userId !== "string") {
    return null;
  }

  const value = userId.trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return null;
  }

  return value;
}

function normalizeRatingValue(ratingValue) {
  const numericValue = Number(ratingValue);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (numericValue < 1 || numericValue > 10) {
    return null;
  }

  return Number(numericValue.toFixed(2));
}

function normalizeReviewText(reviewText) {
  if (typeof reviewText !== "string") {
    return null;
  }

  const value = reviewText.trim();
  return value || null;
}

function normalizeReviewId(reviewId) {
  return normalizeUserId(reviewId);
}

function sanitizeUsername(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 24) || "spotify-user";
}

function ensureSpotifyCredentials() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw createHttpError(500, "SPOTIFY_CONFIG_MISSING", "Spotify credentials are not configured");
  }
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw createHttpError(500, "SUPABASE_CONFIG_MISSING", "Supabase credentials are not configured");
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

function mapUserRecord(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    auth_provider: user.auth_provider,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function isNotFoundError(error) {
  return error?.code === "PGRST116";
}

function handleSupabaseError(error, fallbackMessage = "Supabase request failed") {
  if (!error) {
    return;
  }

  if (isNotFoundError(error)) {
    return;
  }

  throw createHttpError(500, "SUPABASE_QUERY_ERROR", error.message || fallbackMessage);
}

function isAggregatesDisabledError(error) {
  return error?.code === "PGRST123";
}

async function getUserById(supabase, userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, username, display_name, avatar_url, auth_provider, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user");

  if (!data) {
    throw createHttpError(404, "USER_NOT_FOUND", "The related user was not found");
  }

  return data;
}

async function getUserByEmail(supabase, email) {
  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, email, username, display_name, avatar_url, auth_provider, created_at, updated_at")
    .eq("email", email)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user by email");

  return data;
}

async function getSpotifyAccountBySpotifyUserId(supabase, spotifyUserId) {
  const { data, error } = await supabase
    .from("spotify_accounts")
    .select("user_id, spotify_user_id")
    .eq("spotify_user_id", spotifyUserId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch spotify account");

  return data;
}

async function buildUniqueUsername(supabase, seed) {
  const baseUsername = sanitizeUsername(seed);

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseUsername : `${baseUsername}-${index + 1}`;
    const { data, error } = await supabase.from("users").select("id").eq("username", candidate).maybeSingle();

    handleSupabaseError(error, "Failed to validate username uniqueness");

    if (!data) {
      return candidate;
    }
  }

  return `${baseUsername}-${randomUUID().slice(0, 8)}`;
}

async function createUserFromSpotifyProfile(supabase, { email, displayName, avatarUrl }) {
  const username = await buildUniqueUsername(supabase, displayName);
  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
      auth_provider: "spotify",
    })
    .select("id, email, username, display_name, avatar_url, auth_provider, created_at, updated_at")
    .single();

  handleSupabaseError(error, "Failed to create user");

  return data;
}

async function ensureSpotifyAccountRecord(supabase, payload) {
  const { error } = await supabase.from("spotify_accounts").insert(payload);
  handleSupabaseError(error, "Failed to create spotify account");
}

async function updateUserForSpotify(supabase, user, { displayName, avatarUrl }) {
  const nextAuthProvider =
    user.auth_provider && user.auth_provider !== "spotify" ? "hybrid" : "spotify";

  const { data, error } = await supabase
    .from("users")
    .update({
      display_name: displayName,
      avatar_url: avatarUrl,
      auth_provider: nextAuthProvider,
    })
    .eq("id", user.id)
    .select("id, email, username, display_name, avatar_url, auth_provider, created_at, updated_at")
    .single();

  handleSupabaseError(error, "Failed to update user");

  return data;
}

async function upsertUserRating(supabase, { userId, entityType, entityId, ratingValue }) {
  const { data, error } = await supabase
    .from("ratings")
    .upsert(
      {
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        rating_value: ratingValue,
      },
      {
        onConflict: "user_id,entity_type,entity_id",
      },
    )
    .select("id, user_id, entity_type, entity_id, rating_value, created_at, updated_at")
    .single();

  handleSupabaseError(error, "Failed to save rating");

  return data;
}

async function getEntityRatingsSummary(supabase, { entityType, entityId }) {
  const { data, error } = await supabase
    .from("ratings")
    .select("rating_value")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  handleSupabaseError(error, "Failed to fetch ratings summary");

  const ratings = data ?? [];
  const totalVotes = ratings.length;
  const totalRating = ratings.reduce((sum, entry) => sum + Number(entry.rating_value || 0), 0);

  return {
    entity_type: entityType,
    entity_id: entityId,
    average_rating: totalVotes > 0 ? Number((totalRating / totalVotes).toFixed(2)) : 0,
    ratings_count: totalVotes,
  };
}

async function getUserRatingRecord(supabase, { userId, entityType, entityId }) {
  const { data, error } = await supabase
    .from("ratings")
    .select("rating_value")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user rating");

  return {
    rating_value: data?.rating_value ?? null,
  };
}

async function getRankingsFallback(supabase, entityType) {
  const { data, error } = await supabase
    .from("ratings")
    .select("entity_id, rating_value")
    .eq("entity_type", entityType);

  handleSupabaseError(error, "Failed to fetch ratings for ranking");

  const aggregateMap = new Map();

  for (const row of data ?? []) {
    const current = aggregateMap.get(row.entity_id);

    if (!current) {
      aggregateMap.set(row.entity_id, {
        entity_id: row.entity_id,
        total: Number(row.rating_value || 0),
        ratings_count: 1,
      });
      continue;
    }

    aggregateMap.set(row.entity_id, {
      ...current,
      total: current.total + Number(row.rating_value || 0),
      ratings_count: current.ratings_count + 1,
    });
  }

  return Array.from(aggregateMap.values())
    .map((entry) => ({
      entity_id: entry.entity_id,
      average_rating: Number((entry.total / entry.ratings_count).toFixed(2)),
      ratings_count: entry.ratings_count,
    }))
    .sort((left, right) => {
      if (right.average_rating !== left.average_rating) {
        return right.average_rating - left.average_rating;
      }

      return right.ratings_count - left.ratings_count;
    })
    .slice(0, 20);
}

async function getRankingsSummary(supabase, entityType) {
  const { data, error } = await supabase
    .from("ratings")
    .select("entity_id, average_rating:rating_value.avg(), ratings_count:count()")
    .eq("entity_type", entityType);

  if (error && isAggregatesDisabledError(error)) {
    return getRankingsFallback(supabase, entityType);
  }

  handleSupabaseError(error, "Failed to fetch rankings summary");

  return (data ?? [])
    .map((entry) => ({
      entity_id: entry.entity_id,
      average_rating: Number(Number(entry.average_rating || 0).toFixed(2)),
      ratings_count: Number(entry.ratings_count || 0),
    }))
    .sort((left, right) => {
      if (right.average_rating !== left.average_rating) {
        return right.average_rating - left.average_rating;
      }

      return right.ratings_count - left.ratings_count;
    })
    .slice(0, 20);
}

async function getExistingReview(supabase, { userId, entityType, entityId }) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id, entity_type, entity_id, review_text, rating_value, created_at, updated_at")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch existing review");

  return data;
}

async function createReview(supabase, { userId, entityType, entityId, reviewText, ratingValue }) {
  const payload = {
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    review_text: reviewText,
  };

  if (ratingValue !== null) {
    payload.rating_value = ratingValue;
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select("id, user_id, entity_type, entity_id, review_text, rating_value, created_at, updated_at")
    .single();

  handleSupabaseError(error, "Failed to create review");

  return data;
}

async function getReviewsForEntityFromDb(supabase, { entityType, entityId }) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id, review_text, rating_value, created_at, users(username)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  handleSupabaseError(error, "Failed to fetch reviews");

  return (data ?? []).map((review) => ({
    id: review.id,
    user_id: review.user_id,
    username: review.users?.username ?? "Usuario",
    review_text: review.review_text,
    rating_value: review.rating_value,
    created_at: review.created_at,
  }));
}

async function getReviewById(supabase, reviewId) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch review");

  if (!data) {
    throw createHttpError(404, "REVIEW_NOT_FOUND", "Review not found");
  }

  return data;
}

async function deleteReviewById(supabase, reviewId) {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  handleSupabaseError(error, "Failed to delete review");
}

async function getAppAccessToken() {
  ensureSpotifyCredentials();

  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - 60_000) {
    return cachedAppToken.accessToken;
  }

  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw createHttpError(response.status, "SPOTIFY_TOKEN_ERROR", "Failed to get Spotify app token");
  }

  const data = await response.json();
  cachedAppToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedAppToken.accessToken;
}

async function requestSpotifyToken(params) {
  ensureSpotifyCredentials();

  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const message = await response.text();
    throw createHttpError(response.status, "SPOTIFY_TOKEN_EXCHANGE_ERROR", message || "Failed to exchange Spotify token");
  }

  return response.json();
}

function getUserAccessToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw createHttpError(401, "SPOTIFY_AUTH_REQUIRED", "Missing Spotify user token");
  }

  return authHeader.slice("Bearer ".length);
}

async function spotifyRequest(path, { token, query } = {}) {
  const url = new URL(`${SPOTIFY_API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw createHttpError(response.status, "SPOTIFY_API_ERROR", message || `Spotify request failed with status ${response.status}`);
  }

  return response.json();
}

function parseSpotifyEmbedState(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

  if (!match?.[1]) {
    throw createHttpError(502, "SPOTIFY_EMBED_PARSE_ERROR", "Could not parse Spotify embed payload");
  }

  return JSON.parse(match[1]);
}

async function getGlobalTrendingTracks(limit = 10) {
  const playlistId = "37i9dQZEVXbMDoHDwVN2tF";
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`);

  if (!response.ok) {
    throw createHttpError(response.status, "SPOTIFY_TRENDING_UNAVAILABLE", "Spotify trending playlist is unavailable");
  }

  const html = await response.text();
  const payload = parseSpotifyEmbedState(html);
  const entity = payload?.props?.pageProps?.state?.data?.entity;
  const tracks = entity?.trackList ?? [];
  const limitedTracks = tracks.slice(0, Math.min(Number(limit) || 10, 50));
  const token = await getAppAccessToken();
  const enrichedTracks = await Promise.all(
    limitedTracks.map(async (track) => {
      const trackId = track.uri?.split(":").pop();

      if (!trackId) {
        return null;
      }

      let oEmbedThumbnailUrl = null;

      try {
        const oEmbedResponse = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`);
        if (oEmbedResponse.ok) {
          const oEmbedData = await oEmbedResponse.json();
          oEmbedThumbnailUrl = oEmbedData?.thumbnail_url ?? null;
        }
      } catch {
        oEmbedThumbnailUrl = null;
      }

      try {
        const spotifyTrack = await spotifyRequest(`/tracks/${trackId}`, {
          token,
          query: {
            market: "US",
          },
        });

        return {
          id: spotifyTrack.id,
          name: spotifyTrack.name,
          artists: (spotifyTrack.artists ?? []).map((artist) => ({
            id: artist.id,
            name: artist.name,
          })),
          duration_ms: spotifyTrack.duration_ms ?? track.duration ?? null,
          preview_url: spotifyTrack.preview_url ?? track.audioPreview?.url ?? null,
          album: {
            id: spotifyTrack.album?.id ?? playlistId,
            name: spotifyTrack.album?.name ?? entity?.title ?? "Top 50 - Global",
            images:
              spotifyTrack.album?.images?.length > 0
                ? spotifyTrack.album.images
                : oEmbedThumbnailUrl
                  ? [{ url: oEmbedThumbnailUrl }]
                  : [],
          },
        };
      } catch {
        return {
          id: trackId,
          name: track.title,
          artists: String(track.subtitle || "")
            .split(",")
            .map((name) => name.replace(/\u00a0/g, " ").trim())
            .filter(Boolean)
            .map((name, artistIndex) => ({
              id: `${track.uid || track.uri || "artist"}-${artistIndex}`,
              name,
            })),
          duration_ms: track.duration ?? null,
          preview_url: track.audioPreview?.url ?? null,
          album: {
            id: playlistId,
            name: entity?.title ?? "Top 50 - Global",
            images: oEmbedThumbnailUrl ? [{ url: oEmbedThumbnailUrl }] : [],
          },
        };
      }
    }),
  );

  return enrichedTracks.filter(Boolean).map((track, index) => ({
    id: track.id ?? randomUUID(),
    name: track.name,
    artists: track.artists,
    duration_ms: track.duration_ms,
    preview_url: track.preview_url,
    _rank: index + 1,
    album: track.album,
  }));
}

async function authenticateSpotifyUser(req, _res, next) {
  try {
    const token = getUserAccessToken(req);
    const spotifyProfile = await spotifyRequest("/me", { token });
    const spotifyUserId = normalizeEntityId(spotifyProfile?.id);

    if (!spotifyUserId) {
      throw createHttpError(401, "SPOTIFY_AUTH_INVALID", "Invalid Spotify user profile");
    }

    const supabase = getSupabaseAdmin();
    const spotifyAccount = await getSpotifyAccountBySpotifyUserId(supabase, spotifyUserId);

    if (!spotifyAccount?.user_id) {
      throw createHttpError(401, "SPOTIFY_ACCOUNT_NOT_LINKED", "Spotify account is not linked to an app user");
    }

    req.user_id = spotifyAccount.user_id;
    req.spotify_user_id = spotifyUserId;
    next();
  } catch (error) {
    next(error?.status ? error : createHttpError(401, "SPOTIFY_AUTH_INVALID", "Spotify authentication failed"));
  }
}

async function getAllArtistAlbums(artistId, token, query = {}) {
  const collectedItems = [];
  let offset = 0;
  const limit = Math.min(Number(query.limit) || 50, 50);
  let total = Infinity;

  while (offset < total) {
    const data = await spotifyRequest(`/artists/${artistId}/albums`, {
      token,
      query: {
        include_groups: query.include_groups || "album,single",
        market: query.market || "US",
        limit,
        offset,
      },
    });

    collectedItems.push(...(data.items ?? []));
    total = data.total ?? collectedItems.length;
    offset += limit;

    if (!data.next) {
      break;
    }
  }

  const uniqueAlbums = new Map();

  collectedItems.forEach((album) => {
    const key = `${album.name}-${album.album_group}-${album.release_date}`;

    if (!uniqueAlbums.has(key)) {
      uniqueAlbums.set(key, album);
    }
  });

  return {
    items: Array.from(uniqueAlbums.values()),
    total: uniqueAlbums.size,
  };
}

async function getSavedTracksByArtist(token, artistId, query = {}) {
  const collectedItems = [];
  let offset = 0;
  const limit = Math.min(Number(query.limit) || 50, 50);
  let total = Infinity;

  while (offset < total) {
    const data = await spotifyRequest("/me/tracks", {
      token,
      query: {
        limit,
        offset,
        market: query.market || "US",
      },
    });

    collectedItems.push(...(data.items ?? []));
    total = data.total ?? collectedItems.length;
    offset += limit;

    if (!data.next) {
      break;
    }
  }

  const filteredItems = collectedItems.filter((item) =>
    item.track?.artists?.some((artist) => artist.id === artistId),
  );

  return {
    href: null,
    items: filteredItems,
    limit,
    next: null,
    offset: 0,
    previous: null,
    total: filteredItems.length,
  };
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

app.get(
  "/api/search/artists",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest("/search", {
      token,
      query: {
        q: req.query.q,
        type: "artist",
        limit: req.query.limit || 20,
      },
    });
    res.json(data);
  }),
);

app.post(
  "/api/auth/token",
  asyncRoute(async (req, res) => {
    const data = await requestSpotifyToken({
      grant_type: "authorization_code",
      code: req.body.code,
      redirect_uri: req.body.redirect_uri,
      code_verifier: req.body.code_verifier,
    });
    res.json(data);
  }),
);

app.post(
  "/api/auth/refresh",
  asyncRoute(async (req, res) => {
    const data = await requestSpotifyToken({
      grant_type: "refresh_token",
      refresh_token: req.body.refresh_token,
    });
    res.json(data);
  }),
);

app.post(
  "/api/auth/spotify",
  asyncRoute(async (req, res) => {
    console.log("SPOTIFY AUTH HIT");

    const spotifyUserId = typeof req.body.spotify_user_id === "string" ? req.body.spotify_user_id.trim() : "";
    const email = normalizeEmail(req.body.email);
    const displayName = normalizeDisplayName(req.body.display_name, email || "Spotify User");
    const avatarUrl = normalizeAvatarUrl(req.body.avatar_url);

    if (!spotifyUserId) {
      throw createHttpError(400, "INVALID_SPOTIFY_AUTH_PAYLOAD", "spotify_user_id is required");
    }

    const supabase = getSupabaseAdmin();
    const { data: existingAccount, error: existingAccountError } = await supabase
      .from("spotify_accounts")
      .select("user_id")
      .eq("spotify_user_id", spotifyUserId)
      .maybeSingle();

    handleSupabaseError(existingAccountError, "Failed to fetch spotify account");

    if (existingAccount?.user_id) {
      const user = await getUserById(supabase, existingAccount.user_id);
      res.json({ user: mapUserRecord(user) });
      return;
    }

    let user = await getUserByEmail(supabase, email);

    if (user) {
      user = await updateUserForSpotify(supabase, user, { displayName, avatarUrl });
    } else {
      user = await createUserFromSpotifyProfile(supabase, {
        email,
        displayName,
        avatarUrl,
      });
    }

    await ensureSpotifyAccountRecord(supabase, {
      user_id: user.id,
      spotify_user_id: spotifyUserId,
      spotify_email: email,
      spotify_display_name: displayName,
      spotify_avatar_url: avatarUrl,
    });

    res.status(201).json({ user: mapUserRecord(user) });
  }),
);

app.post(
  "/api/ratings",
  authenticateSpotifyUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const entityType = normalizeEntityType(req.body.entity_type);
    const entityId = normalizeEntityId(req.body.entity_id);
    const ratingValue = normalizeRatingValue(req.body.rating_value);

    if (!userId || !entityType || !entityId || ratingValue === null) {
      throw createHttpError(
        400,
        "INVALID_RATING_PAYLOAD",
        "entity_type, entity_id and rating_value between 1 and 10 are required",
      );
    }

    const supabase = getSupabaseAdmin();
    await getUserById(supabase, userId);

    const rating = await upsertUserRating(supabase, {
      userId,
      entityType,
      entityId,
      ratingValue,
    });

    const summary = await getEntityRatingsSummary(supabase, {
      entityType,
      entityId,
    });

    res.status(200).json({
      rating,
      summary,
    });
  }),
);

app.get(
  "/api/ratings/:entity_type/:entity_id",
  asyncRoute(async (req, res) => {
    const entityType = normalizeEntityType(req.params.entity_type);
    const entityId = normalizeEntityId(req.params.entity_id);

    if (!entityType || !entityId) {
      throw createHttpError(
        400,
        "INVALID_RATING_QUERY",
        "entity_type must be artist or album and entity_id is required",
      );
    }

    const supabase = getSupabaseAdmin();
    const summary = await getEntityRatingsSummary(supabase, {
      entityType,
      entityId,
    });

    res.json(summary);
  }),
);

app.get(
  "/api/ratings/me/:entity_type/:entity_id",
  authenticateSpotifyUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const entityType = normalizeEntityType(req.params.entity_type);
    const entityId = normalizeEntityId(req.params.entity_id);

    if (!userId || !entityType || !entityId) {
      throw createHttpError(
        400,
        "INVALID_MY_RATING_QUERY",
        "valid entity_type and entity_id are required",
      );
    }

    const supabase = getSupabaseAdmin();
    const rating = await getUserRatingRecord(supabase, {
      userId,
      entityType,
      entityId,
    });

    res.json(rating);
  }),
);

app.get(
  "/api/rankings/:entity_type",
  asyncRoute(async (req, res) => {
    const entityType = normalizeEntityType(req.params.entity_type);

    if (!entityType) {
      throw createHttpError(400, "INVALID_RANKING_QUERY", "entity_type must be artist or album");
    }

    const supabase = getSupabaseAdmin();
    const rankings = await getRankingsSummary(supabase, entityType);

    res.json(rankings);
  }),
);

app.post(
  "/api/reviews",
  authenticateSpotifyUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const entityType = normalizeEntityType(req.body.entity_type);
    const entityId = normalizeEntityId(req.body.entity_id);
    const reviewText = normalizeReviewText(req.body.review_text);
    const ratingValue =
      req.body.rating_value === undefined || req.body.rating_value === null
        ? null
        : normalizeRatingValue(req.body.rating_value);

    if (!userId || !entityType || !entityId || !reviewText || (req.body.rating_value != null && ratingValue === null)) {
      throw createHttpError(
        400,
        "INVALID_REVIEW_PAYLOAD",
        "entity_type, entity_id and review_text are required; rating_value must be between 1 and 10",
      );
    }

    const supabase = getSupabaseAdmin();
    await getUserById(supabase, userId);

    const existingReview = await getExistingReview(supabase, {
      userId,
      entityType,
      entityId,
    });

    if (existingReview) {
      throw createHttpError(409, "REVIEW_ALREADY_EXISTS", "Only one review per user and entity is allowed");
    }

    const review = await createReview(supabase, {
      userId,
      entityType,
      entityId,
      reviewText,
      ratingValue,
    });

    res.status(201).json({ review });
  }),
);

app.get(
  "/api/reviews/:entity_type/:entity_id",
  asyncRoute(async (req, res) => {
    const entityType = normalizeEntityType(req.params.entity_type);
    const entityId = normalizeEntityId(req.params.entity_id);

    if (!entityType || !entityId) {
      throw createHttpError(
        400,
        "INVALID_REVIEW_QUERY",
        "entity_type must be artist or album and entity_id is required",
      );
    }

    const supabase = getSupabaseAdmin();
    const reviews = await getReviewsForEntityFromDb(supabase, {
      entityType,
      entityId,
    });

    res.json({ reviews });
  }),
);

app.delete(
  "/api/reviews/:review_id",
  authenticateSpotifyUser,
  asyncRoute(async (req, res) => {
    const reviewId = normalizeReviewId(req.params.review_id);
    const userId = normalizeUserId(req.user_id);

    if (!reviewId || !userId) {
      throw createHttpError(400, "INVALID_REVIEW_DELETE", "review_id is required");
    }

    const supabase = getSupabaseAdmin();
    const review = await getReviewById(supabase, reviewId);

    if (review.user_id !== userId) {
      throw createHttpError(403, "REVIEW_FORBIDDEN", "You can only delete your own review");
    }

    await deleteReviewById(supabase, reviewId);

    res.status(204).send();
  }),
);

app.get(
  "/api/search/albums",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest("/search", {
      token,
      query: {
        q: req.query.q,
        type: "album",
        limit: req.query.limit || 20,
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/search/playlists",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest("/search", {
      token,
      query: {
        q: req.query.q,
        type: "playlist",
        limit: req.query.limit || 20,
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/search",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest("/search", {
      token,
      query: {
        q: req.query.q,
        type: "artist,album",
        limit: req.query.limit || 20,
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/playlists/:id/tracks",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest(`/playlists/${req.params.id}/tracks`, {
      token,
      query: {
        limit: req.query.limit || 50,
        market: req.query.market || "US",
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/artist/:id",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest(`/artists/${req.params.id}`, { token });
    res.json(data);
  }),
);

app.get(
  "/api/artist/:id/albums",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await getAllArtistAlbums(req.params.id, token, req.query);
    res.json(data);
  }),
);

app.get(
  "/api/album/:id",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest(`/albums/${req.params.id}`, {
      token,
      query: {
        market: req.query.market || "US",
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/new-releases",
  asyncRoute(async (req, res) => {
    const token = await getAppAccessToken();
    const data = await spotifyRequest("/browse/new-releases", {
      token,
      query: {
        limit: req.query.limit || 12,
        country: req.query.country || "US",
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/trending/global",
  asyncRoute(async (req, res) => {
    const tracks = await getGlobalTrendingTracks(req.query.limit || 10);
    res.json({ tracks });
  }),
);

app.get(
  "/api/me",
  asyncRoute(async (req, res) => {
    const token = getUserAccessToken(req);
    const data = await spotifyRequest("/me", { token });
    res.json(data);
  }),
);

app.get(
  "/api/me/top-artists",
  asyncRoute(async (req, res) => {
    const token = getUserAccessToken(req);
    const data = await spotifyRequest("/me/top/artists", {
      token,
      query: {
        limit: req.query.limit || 10,
        time_range: req.query.time_range || "medium_term",
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/me/top-tracks",
  asyncRoute(async (req, res) => {
    const token = getUserAccessToken(req);
    const data = await spotifyRequest("/me/top/tracks", {
      token,
      query: {
        limit: req.query.limit || 10,
        time_range: req.query.time_range || "medium_term",
      },
    });
    res.json(data);
  }),
);

app.get(
  "/api/me/liked-tracks/by-artist/:artistId",
  asyncRoute(async (req, res) => {
    const token = getUserAccessToken(req);
    const data = await getSavedTracksByArtist(token, req.params.artistId, req.query);
    res.json(data);
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const statusCode = [400, 401, 403, 404, 409, 429].includes(status) ? status : status >= 400 && status < 600 ? status : 500;

  console.error("[spotify-backend]", error.code || "INTERNAL_SERVER_ERROR", error.message);

  res.status(statusCode).json({
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message:
        statusCode === 401
          ? "Spotify authorization failed"
          : statusCode === 403
            ? "Spotify access forbidden"
            : statusCode === 404
              ? error.message || "Resource not found"
              : statusCode === 429
                ? "Spotify rate limit exceeded"
                : error.message || "Unexpected server error",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Spotify backend listening on http://localhost:${PORT}`);
});
