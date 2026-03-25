import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || "musicdb-local-dev-secret";
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const MERCADO_PAGO_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://musicdb.online";
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || process.env.BACKEND_PUBLIC_URL || "https://musicdb-backend.onrender.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_VERIFICATION_TTL_HOURS = Math.max(Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24), 1);
const PRO_SUBSCRIPTION_PLANS = {
  "1m": { price: 3500, months: 1, title: "MusicDB PRO - 1 mes" },
  "3m": { price: 9000, months: 3, title: "MusicDB PRO - 3 meses" },
  "6m": { price: 15000, months: 6, title: "MusicDB PRO - 6 meses" },
  "12m": { price: 24000, months: 12, title: "MusicDB PRO - 12 meses" },
};
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://musicdb.online",
  "https://www.musicdb.online",
]);
const VERCEL_APP_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

let cachedAppToken = null;
let supabaseAdmin = null;
let cachedUserTableColumns = null;
let mercadoPagoClient = null;
let mercadoPagoPaymentClient = null;
let resendClient = null;
const SPOTIFY_CACHE_TTL_MS = 5 * 60 * 1000;
const spotifyTopArtistsCache = Object.create(null);
const spotifyTopAlbumsCache = Object.create(null);
const spotifyArtistCache = Object.create(null);
const spotifyArtistAlbumsCache = Object.create(null);
const spotifyAlbumCache = Object.create(null);
const spotifyEnrichedRankingsCache = Object.create(null);

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

function isSpotifyRateLimitError(error) {
  return Number(error?.status || error?.statusCode) === 429;
}

function normalizeSpotifyError(error, fallbackCode = "SPOTIFY_REQUEST_FAILED", fallbackMessage = "Spotify request failed") {
  if (isSpotifyRateLimitError(error)) {
    return createHttpError(429, "SPOTIFY_RATE_LIMIT", "Spotify rate limit exceeded");
  }

  if (error?.status) {
    return error;
  }

  if (error?.statusCode) {
    return createHttpError(error.statusCode, error.code || fallbackCode, error.message || fallbackMessage);
  }

  return createHttpError(500, error?.code || fallbackCode, error?.message || fallbackMessage);
}

function sendSpotifyEndpointError(res, error) {
  const normalizedError = normalizeSpotifyError(error);

  if (normalizedError.status === 429) {
    return res.status(429).json({ error: "spotify_rate_limit" });
  }

  if (normalizedError.status >= 400 && normalizedError.status < 500 && normalizedError.status !== 429) {
    return res.status(normalizedError.status).json({ error: normalizedError.code || "spotify_request_error" });
  }

  return res.status(500).json({ error: "internal_error" });
}

function getSpotifyCacheEntry(cache, key, { allowStale = false } = {}) {
  const entry = cache[key];

  if (!entry) {
    return null;
  }

  if (!allowStale && Date.now() > entry.expiresAt) {
    return null;
  }

  return entry.value;
}

function setSpotifyCacheEntry(cache, key, value) {
  const currentEntry = cache[key] ?? {};
  cache[key] = {
    ...currentEntry,
    value,
    expiresAt: Date.now() + SPOTIFY_CACHE_TTL_MS,
    promise: null,
  };

  return value;
}

function setSpotifyCachePromise(cache, key, promise) {
  const currentEntry = cache[key] ?? {};
  cache[key] = {
    ...currentEntry,
    promise,
  };

  return promise;
}

function clearSpotifyCachePromise(cache, key, promise) {
  if (cache[key]?.promise === promise) {
    cache[key] = {
      ...cache[key],
      promise: null,
    };
  }
}

function invalidateCachedRankings(entityType) {
  Object.keys(spotifyEnrichedRankingsCache).forEach((cacheKey) => {
    if (cacheKey.startsWith(`rankings-enriched:${entityType}:`)) {
      delete spotifyEnrichedRankingsCache[cacheKey];
    }
  });
}

async function getCachedSpotifyResponse(cache, key, fetcher) {
  const freshValue = getSpotifyCacheEntry(cache, key);

  if (freshValue) {
    return freshValue;
  }

  const inFlightPromise = cache[key]?.promise;

  if (inFlightPromise) {
    return inFlightPromise;
  }

  const requestPromise = (async () => {
    try {
      const value = await fetcher();
      return setSpotifyCacheEntry(cache, key, value);
    } catch (error) {
      if (isSpotifyRateLimitError(error)) {
        const cachedValue = getSpotifyCacheEntry(cache, key, { allowStale: true });

        if (cachedValue) {
          return cachedValue;
        }
      }

      throw error;
    } finally {
      clearSpotifyCachePromise(cache, key, requestPromise);
    }
  })();

  setSpotifyCachePromise(cache, key, requestPromise);

  try {
    return await requestPromise;
  } catch (error) {
    throw error;
  }
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

function normalizeUsername(username) {
  if (typeof username !== "string") {
    return null;
  }

  const value = username.trim();
  return value || null;
}

function normalizePassword(password) {
  if (typeof password !== "string") {
    return null;
  }

  const value = password.trim();
  return value.length >= 6 ? value : null;
}

function normalizePhone(phone) {
  if (phone === undefined || phone === null || phone === "") {
    return null;
  }

  if (typeof phone !== "string") {
    return null;
  }

  const value = phone.trim();
  return value || null;
}

function normalizeAvatarUrl(avatarUrl) {
  if (typeof avatarUrl !== "string") {
    return null;
  }

  const value = avatarUrl.trim();
  return value || null;
}

function normalizeUrl(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\/+$/, "");
  return normalized || fallback;
}

function normalizeSubscriptionPlan(plan) {
  if (typeof plan !== "string") {
    return null;
  }

  const normalized = plan.trim().toLowerCase();
  return PRO_SUBSCRIPTION_PLANS[normalized] ? normalized : null;
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

function getMercadoPagoPaymentClient() {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    throw createHttpError(500, "MERCADO_PAGO_CONFIG_MISSING", "Mercado Pago access token is not configured");
  }

  if (!mercadoPagoClient) {
    mercadoPagoClient = new MercadoPagoConfig({
      accessToken: MERCADO_PAGO_ACCESS_TOKEN,
      options: {
        timeout: 5000,
      },
    });
  }

  if (!mercadoPagoPaymentClient) {
    mercadoPagoPaymentClient = new Payment(mercadoPagoClient);
  }

  return mercadoPagoPaymentClient;
}

function hasResendConfig() {
  return Boolean(RESEND_API_KEY);
}

function getResendClient() {
  if (!hasResendConfig()) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function generateEmailVerificationToken() {
  return randomBytes(32).toString("hex");
}

function buildEmailVerificationUrl(token) {
  return `${normalizeUrl(PUBLIC_APP_URL, "https://musicdb.online")}/verify-email?token=${encodeURIComponent(token)}`;
}

function getEmailVerificationExpiryDate() {
  return new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

function mapUserRecord(user) {
  const proUntilDate =
    typeof user?.pro_until === "string" || user?.pro_until instanceof Date
      ? new Date(user.pro_until)
      : null;
  const isProActive = Boolean(proUntilDate && !Number.isNaN(proUntilDate.getTime()) && proUntilDate.getTime() > Date.now());

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    phone: user.phone ?? null,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    auth_provider: user.auth_provider,
    is_verified: Boolean(user.is_verified ?? user.auth_provider === "spotify"),
    verified_at: user.verified_at ?? null,
    is_pro: isProActive,
    pro_until: user.pro_until ?? null,
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

async function getUserTableColumns(supabase) {
  if (cachedUserTableColumns) {
    return cachedUserTableColumns;
  }

  const { data, error } = await supabase.from("users").select("*").limit(1);
  handleSupabaseError(error, "Failed to inspect users schema");

  const fallbackColumns = [
    "id",
    "email",
    "username",
    "display_name",
    "avatar_url",
    "auth_provider",
    "is_verified",
    "verified_at",
    "verification_sent_at",
    "created_at",
    "updated_at",
    "password_hash",
  ];

  cachedUserTableColumns = new Set(data?.[0] ? Object.keys(data[0]) : fallbackColumns);
  return cachedUserTableColumns;
}

function isProExpired(user) {
  if (!user?.pro_until) {
    return false;
  }

  const proUntilDate = new Date(user.pro_until);

  if (Number.isNaN(proUntilDate.getTime())) {
    return false;
  }

  return proUntilDate.getTime() <= Date.now();
}

async function syncExpiredProStatusIfNeeded(supabase, user, { includePasswordHash = false } = {}) {
  if (!user) {
    return null;
  }

  const userColumns = await getUserTableColumns(supabase);
  const hasIsProColumn = userColumns.has("is_pro");

  if (!hasIsProColumn || !user.is_pro || !isProExpired(user)) {
    return user;
  }

  const userSelect = await buildUserSelect(supabase, { includePasswordHash });
  const { data, error } = await supabase
    .from("users")
    .update({
      is_pro: false,
    })
    .eq("id", user.id)
    .select(userSelect)
    .single();

  handleSupabaseError(error, "Failed to expire PRO membership");

  console.log("[pro] Expired membership synchronized", {
    userId: user.id,
    pro_until: user.pro_until,
  });

  return data;
}

async function buildUserSelect(supabase, { includePasswordHash = false } = {}) {
  const columns = await getUserTableColumns(supabase);
  const selectedColumns = [
    "id",
    "email",
    "username",
    "display_name",
    "avatar_url",
    "auth_provider",
    "created_at",
    "updated_at",
  ];

  if (columns.has("phone")) {
    selectedColumns.push("phone");
  }

  if (columns.has("is_pro")) {
    selectedColumns.push("is_pro");
  }

  if (columns.has("pro_until")) {
    selectedColumns.push("pro_until");
  }

  if (columns.has("is_verified")) {
    selectedColumns.push("is_verified");
  }

  if (columns.has("verified_at")) {
    selectedColumns.push("verified_at");
  }

  if (columns.has("verification_sent_at")) {
    selectedColumns.push("verification_sent_at");
  }

  if (includePasswordHash && columns.has("password_hash")) {
    selectedColumns.push("password_hash");
  }

  return selectedColumns.join(", ");
}

async function getUserById(supabase, userId) {
  const userSelect = await buildUserSelect(supabase);
  const { data, error } = await supabase
    .from("users")
    .select(userSelect)
    .eq("id", userId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user");

  if (!data) {
    throw createHttpError(404, "USER_NOT_FOUND", "The related user was not found");
  }

  return syncExpiredProStatusIfNeeded(supabase, data);
}

async function getUserByEmail(supabase, email) {
  if (!email) {
    return null;
  }

  const userSelect = await buildUserSelect(supabase);
  const { data, error } = await supabase
    .from("users")
    .select(userSelect)
    .eq("email", email)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user by email");

  return syncExpiredProStatusIfNeeded(supabase, data);
}

async function getUserAuthByEmail(supabase, email) {
  if (!email) {
    return null;
  }

  const userSelect = await buildUserSelect(supabase, { includePasswordHash: true });
  const { data, error } = await supabase
    .from("users")
    .select(userSelect)
    .eq("email", email)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user credentials");

  return syncExpiredProStatusIfNeeded(supabase, data, { includePasswordHash: true });
}

function ensureVerificationColumnsExist(userColumns) {
  const requiredColumns = ["is_verified", "verified_at", "verification_sent_at"];
  const missingColumns = requiredColumns.filter((column) => !userColumns.has(column));

  if (missingColumns.length > 0) {
    throw createHttpError(
      500,
      "EMAIL_VERIFICATION_SCHEMA_MISSING",
      `Missing users columns for email verification: ${missingColumns.join(", ")}`,
    );
  }
}

function isMissingRelationError(error) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("relation") || error?.message?.toLowerCase().includes("does not exist");
}

async function deleteEmailVerificationTokensForUser(supabase, userId) {
  const { error } = await supabase.from("email_verification_tokens").delete().eq("user_id", userId);

  if (error) {
    console.error("[auth:verify-email:resend] Failed to clear previous email verification tokens", {
      userId,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown delete error",
    });
  }

  if (isMissingRelationError(error)) {
    throw createHttpError(
      500,
      "EMAIL_VERIFICATION_SCHEMA_MISSING",
      "Missing email_verification_tokens table required for email verification",
    );
  }

  handleSupabaseError(error, "Failed to clear email verification tokens");
}

async function createEmailVerificationToken(supabase, userId) {
  const token = generateEmailVerificationToken();
  const expiresAt = getEmailVerificationExpiryDate();

  console.log("[auth:register] Generating email verification token", {
    userId,
    expiresAt,
  });

  await deleteEmailVerificationTokensForUser(supabase, userId);

  const { error } = await supabase.from("email_verification_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[auth:register] Failed to insert email verification token", {
      userId,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown insert error",
    });
  }

  if (isMissingRelationError(error)) {
    throw createHttpError(
      500,
      "EMAIL_VERIFICATION_SCHEMA_MISSING",
      "Missing email_verification_tokens table required for email verification",
    );
  }

  handleSupabaseError(error, "Failed to create email verification token");

  console.log("[auth:register] Email verification token stored", {
    userId,
  });

  return {
    token,
    expiresAt,
  };
}

async function markVerificationEmailSent(supabase, userId) {
  const userColumns = await getUserTableColumns(supabase);
  ensureVerificationColumnsExist(userColumns);

  const { error } = await supabase
    .from("users")
    .update({
      verification_sent_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[auth:verify-email:resend] Failed to update verification_sent_at", {
      userId,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown update error",
    });
  }

  handleSupabaseError(error, "Failed to persist verification sent timestamp");
}

async function sendVerificationEmail({ email, username, token, expiresAt }) {
  const verificationLink = `https://musicdb.online/verify-email?token=${encodeURIComponent(token)}`;
  const expirationDate = new Date(expiresAt).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const resend = getResendClient();

  if (!resend) {
    console.log("[auth] Resend not configured, email verification link generated", {
      email,
      verificationLink,
      expiresAt,
    });

    return {
      delivered: false,
      verificationUrl: verificationLink,
    };
  }

  try {
    console.log("Enviando email...");
    if (!verificationLink) {
      throw new Error("verificationLink is not defined");
    }

    if (typeof email !== "string" || !email.trim()) {
      throw new Error("Recipient email is invalid");
    }

    const html = `<a href="${verificationLink}">Verificar cuenta</a>`;

    if (!html.trim()) {
      throw new Error("Email HTML content is empty");
    }
    const resendResult = await resend.emails.send({
      from: "[onboarding@resend.dev](mailto:onboarding@resend.dev)",
      to: email,
      subject: "Verifica tu cuenta",
      html: `<a href="${verificationLink}">Verificar cuenta</a>`,
    });
    console.log("Email enviado");
    console.log("[auth:email] resend.emails.send() response", resendResult);
  } catch (error) {
    console.error("[auth:email] resend.emails.send() full error", error);
    console.error("[auth:email] Failed to send verification email with Resend", {
      email,
      errorName: error?.name ?? "UnknownError",
      errorMessage: error?.message ?? "Unknown mail error",
      errorStack: error?.stack ?? null,
      errorDetails: error && typeof error === "object" ? { ...error } : error,
    });
    throw error;
  }

  return {
    delivered: true,
    verificationUrl: verificationLink,
  };
}

async function issueVerificationEmail(supabase, user) {
  const userColumns = await getUserTableColumns(supabase);
  ensureVerificationColumnsExist(userColumns);

  const isAlreadyVerified = Boolean(user?.is_verified ?? user?.auth_provider === "spotify");

  if (isAlreadyVerified) {
    return {
      alreadyVerified: true,
    };
  }

  const { token, expiresAt } = await createEmailVerificationToken(supabase, user.id);
  const verificationUrl = buildEmailVerificationUrl(token);
  const delivery = await sendVerificationEmail({
    email: user.email,
    username: user.username,
    token,
    expiresAt,
  });

  console.log("[auth:register] Verification link prepared", {
    userId: user.id,
    email: user.email,
    verificationUrl,
    delivery: delivery.delivered ? "smtp" : "logged",
  });

  await markVerificationEmailSent(supabase, user.id);

  return {
    alreadyVerified: false,
    expiresAt,
    delivery,
  };
}

async function getEmailVerificationRecordByToken(supabase, token) {
  const { data, error } = await supabase
    .from("email_verification_tokens")
    .select("user_id, token, expires_at, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[auth:verify-email] Failed to fetch email verification token", {
      token,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown select error",
    });
  }

  if (isMissingRelationError(error)) {
    throw createHttpError(
      500,
      "EMAIL_VERIFICATION_SCHEMA_MISSING",
      "Missing email_verification_tokens table required for email verification",
    );
  }

  handleSupabaseError(error, "Failed to fetch email verification token");
  return data;
}

async function markUserEmailAsVerified(supabase, userId) {
  const userColumns = await getUserTableColumns(supabase);
  ensureVerificationColumnsExist(userColumns);
  const userSelect = await buildUserSelect(supabase);
  const payload = {
    is_verified: true,
    verified_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select(userSelect)
    .single();

  if (error) {
    console.error("[auth:verify-email] Failed to update user as verified", {
      userId,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown update error",
    });
  }

  handleSupabaseError(error, "Failed to verify user email");
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
  const userColumns = await getUserTableColumns(supabase);
  const userSelect = await buildUserSelect(supabase);
  const payload = {
    email,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
    auth_provider: "spotify",
  };

  if (userColumns.has("is_verified")) {
    payload.is_verified = true;
  }

  if (userColumns.has("verified_at")) {
    payload.verified_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("users")
    .insert(payload)
    .select(userSelect)
    .single();

  handleSupabaseError(error, "Failed to create user");

  return data;
}

async function ensureSpotifyAccountRecord(supabase, payload) {
  const { error } = await supabase.from("spotify_accounts").insert(payload);
  handleSupabaseError(error, "Failed to create spotify account");
}

async function updateUserForSpotify(supabase, user, { displayName, avatarUrl }) {
  const userColumns = await getUserTableColumns(supabase);
  const userSelect = await buildUserSelect(supabase);
  const payload = {
    display_name: displayName,
    avatar_url: avatarUrl,
    auth_provider: "spotify",
  };

  if (userColumns.has("is_verified")) {
    payload.is_verified = true;
  }

  if (userColumns.has("verified_at")) {
    payload.verified_at = user?.verified_at ?? new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", user.id)
    .select(userSelect)
    .single();

  handleSupabaseError(error, "Failed to update user");

  return data;
}

function createAppSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      auth_provider: user.auth_provider,
      email: user.email ?? "",
      username: user.username ?? "",
    },
    APP_JWT_SECRET,
    { expiresIn: "30d" },
  );
}

function verifyAppSessionToken(token) {
  return jwt.verify(token, APP_JWT_SECRET);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

async function resolveAuthenticatedUserFromToken(token) {
  if (!token) {
    throw createHttpError(401, "APP_AUTH_REQUIRED", "Authentication is required");
  }

  try {
    const payload = verifyAppSessionToken(token);
    const userId = normalizeUserId(payload?.sub);

    if (!userId) {
      throw createHttpError(401, "APP_AUTH_INVALID", "Invalid session token");
    }

    return { userId, provider: "app" };
  } catch (jwtError) {
    try {
      const supabase = getSupabaseAdmin();
      const {
        data: { user: supabaseUser } = {},
        error: supabaseAuthError,
      } = await supabase.auth.getUser(token);

      if (supabaseAuthError) {
        throw supabaseAuthError;
      }

      const email = normalizeEmail(supabaseUser?.email);

      if (email) {
        const localUser = await getUserByEmail(supabase, email);

        if (localUser?.id) {
          return { userId: localUser.id, provider: "local" };
        }
      }
    } catch (supabaseError) {
      // Ignore and continue with Spotify fallback below.
    }

    try {
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

      return { userId: spotifyAccount.user_id, provider: "spotify", spotifyUserId };
    } catch (spotifyError) {
      if (jwtError?.status) {
        throw jwtError;
      }

      throw spotifyError?.status
        ? normalizeSpotifyError(spotifyError, "SPOTIFY_AUTH_INVALID", "Spotify authentication failed")
        : createHttpError(401, "APP_AUTH_INVALID", "Authentication failed");
    }
  }
}

async function authenticateAppUser(req, _res, next) {
  try {
    const token = getBearerToken(req);
    const auth = await resolveAuthenticatedUserFromToken(token);
    const supabase = getSupabaseAdmin();
    const user = await getUserById(supabase, auth.userId);
    req.user_id = auth.userId;
    req.auth_provider = auth.provider;
    req.spotify_user_id = auth.spotifyUserId ?? null;
    req.current_user = user;
    next();
  } catch (error) {
    next(error?.status ? error : createHttpError(401, "APP_AUTH_INVALID", "Authentication failed"));
  }
}

async function ensureUserUniqueness(supabase, { email, username }) {
  const [{ data: emailMatch, error: emailError }, { data: usernameMatch, error: usernameError }] = await Promise.all([
    supabase.from("users").select("id").eq("email", email).maybeSingle(),
    supabase.from("users").select("id").eq("username", username).maybeSingle(),
  ]);

  handleSupabaseError(emailError, "Failed to validate email uniqueness");
  handleSupabaseError(usernameError, "Failed to validate username uniqueness");

  const duplicatedEmail = Boolean(emailMatch?.id);
  const duplicatedUsername = Boolean(usernameMatch?.id);

  if (duplicatedEmail) {
    throw createHttpError(409, "EMAIL_ALREADY_EXISTS", "There is already an account with that email");
  }

  if (duplicatedUsername) {
    throw createHttpError(409, "USERNAME_ALREADY_EXISTS", "That username is already in use");
  }
}

async function createLocalUser(supabase, { email, username, password, phone }) {
  await ensureUserUniqueness(supabase, { email, username });

  const hashedPassword = await bcrypt.hash(password, 10);
  const userColumns = await getUserTableColumns(supabase);
  ensureVerificationColumnsExist(userColumns);
  const userSelect = await buildUserSelect(supabase);
  const payload = {
    email,
    username,
    password_hash: hashedPassword,
    display_name: username,
    auth_provider: "local",
    is_verified: false,
    verified_at: null,
    verification_sent_at: null,
  };

  if (phone && userColumns.has("phone")) {
    payload.phone = phone;
  }

  console.log("[auth:register] Creating local user", {
    email,
    username,
    hasPhone: Boolean(phone),
  });

  const { data, error } = await supabase
    .from("users")
    .insert(payload)
    .select(userSelect)
    .single();

  if (error?.message?.includes("phone")) {
    console.warn("[auth:register] Retrying user creation without phone column", {
      email,
      username,
    });

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("users")
      .insert({
        email,
        username,
        password_hash: hashedPassword,
        display_name: username,
        auth_provider: "local",
        is_verified: false,
        verified_at: null,
        verification_sent_at: null,
      })
      .select(userSelect)
      .single();

    if (fallbackError) {
      console.error("[auth:register] Fallback local user insert failed", {
        email,
        username,
        errorCode: fallbackError.code ?? null,
        errorMessage: fallbackError.message ?? "Unknown insert error",
      });
    }

    handleSupabaseError(fallbackError, "Failed to create local user");
    console.log("[auth:register] Local user created via fallback insert", {
      userId: fallbackData?.id ?? null,
      email,
    });
    return fallbackData;
  }

  if (error) {
    console.error("[auth:register] Local user insert failed", {
      email,
      username,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown insert error",
    });
  }

  handleSupabaseError(error, "Failed to create local user");

  console.log("[auth:register] Local user created", {
    userId: data?.id ?? null,
    email,
    isVerified: data?.is_verified ?? null,
  });

  return data;
}

async function updateUserProStatus(supabase, userId, nextProUntil) {
  const userSelect = await buildUserSelect(supabase);
  const payload = {
    pro_until: nextProUntil,
  };

  const userColumns = await getUserTableColumns(supabase);

  if (userColumns.has("is_pro")) {
    payload.is_pro = true;
  }

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select(userSelect)
    .single();

  handleSupabaseError(error, "Failed to update PRO status");
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
    .select("id, rating_value")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  handleSupabaseError(error, "Failed to fetch user rating");

  return {
    id: data?.id ?? null,
    rating_value: data?.rating_value ?? null,
  };
}

async function getRatingsHistoryForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("ratings")
    .select("id, entity_type, entity_id, rating_value, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  handleSupabaseError(error, "Failed to fetch user ratings history");

  return (data ?? []).map((rating) => ({
    id: rating.id,
    entity_type: rating.entity_type,
    entity_id: rating.entity_id,
    rating_value: Number(rating.rating_value ?? 0),
    created_at: rating.created_at,
    updated_at: rating.updated_at,
  }));
}

function isUserPro(user) {
  return Boolean(mapUserRecord(user).is_pro);
}

async function getUserReviewsCountLast24Hours(supabase, userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  handleSupabaseError(error, "Failed to count recent reviews");
  return Number(count || 0);
}

async function getUserRatingsCountLast24Hours(supabase, userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ratings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("updated_at", since);

  handleSupabaseError(error, "Failed to count recent ratings");
  return Number(count || 0);
}

async function enforceDailyUsageLimit(supabase, user, type, options = {}) {
  if (!user?.id || isUserPro(user)) {
    return;
  }

  if (type === "review") {
    const reviewsCount = await getUserReviewsCountLast24Hours(supabase, user.id);

    if (reviewsCount >= 10) {
      throw createHttpError(
        429,
        "DAILY_REVIEW_LIMIT_REACHED",
        "Alcanzaste el limite de 10 resenas en 24 horas. Vuelve a intentarlo mas tarde o hazte PRO.",
      );
    }

    return;
  }

  if (type === "rating") {
    if (options.isNewRating === false) {
      return;
    }

    const ratingsCount = await getUserRatingsCountLast24Hours(supabase, user.id);

    if (ratingsCount >= 10) {
      throw createHttpError(
        429,
        "DAILY_RATING_LIMIT_REACHED",
        "Alcanzaste el limite de 10 puntuaciones en 24 horas. Vuelve a intentarlo mas tarde o hazte PRO.",
      );
    }
  }
}

async function getDailyUsageStatus(supabase, user) {
  if (!user?.id) {
    return null;
  }

  if (isUserPro(user)) {
    return {
      is_pro: true,
      limits: {
        ratings_per_24h: null,
        reviews_per_24h: null,
      },
      remaining: {
        ratings: null,
        reviews: null,
      },
    };
  }

  const [ratingsCount, reviewsCount] = await Promise.all([
    getUserRatingsCountLast24Hours(supabase, user.id),
    getUserReviewsCountLast24Hours(supabase, user.id),
  ]);

  return {
    is_pro: false,
    limits: {
      ratings_per_24h: 10,
      reviews_per_24h: 10,
    },
    remaining: {
      ratings: Math.max(10 - ratingsCount, 0),
      reviews: Math.max(10 - reviewsCount, 0),
    },
  };
}

async function getRankingsFallback(supabase, entityType, limit = 10) {
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
    .slice(0, limit);
}

async function getRankingsSummary(supabase, entityType, limit = 10) {
  const { data, error } = await supabase
    .from("ratings")
    .select("entity_id, average_rating:rating_value.avg(), ratings_count:count()")
    .eq("entity_type", entityType);

  if (error && isAggregatesDisabledError(error)) {
    return getRankingsFallback(supabase, entityType, limit);
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
    .slice(0, limit);
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
  const userColumns = await getUserTableColumns(supabase);
  const reviewUserFields = ["username"];

  if (userColumns.has("avatar_url")) {
    reviewUserFields.push("avatar_url");
  }

  if (userColumns.has("is_pro")) {
    reviewUserFields.push("is_pro");
  }

  if (userColumns.has("pro_until")) {
    reviewUserFields.push("pro_until");
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(`id, user_id, review_text, rating_value, created_at, users(${reviewUserFields.join(",")})`)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  handleSupabaseError(error, "Failed to fetch reviews");

  return (data ?? []).map((review) => ({
    id: review.id,
    user_id: review.user_id,
    username: review.users?.username ?? "Usuario",
    avatar_url: review.users?.avatar_url ?? "",
    is_pro: mapUserRecord(review.users ?? {}).is_pro,
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
  try {
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
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_TOKEN_ERROR", "Failed to get Spotify app token");
  }
}

async function requestSpotifyToken(params) {
  try {
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
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_TOKEN_EXCHANGE_ERROR", "Failed to exchange Spotify token");
  }
}

function getUserAccessToken(req) {
  const token = getBearerToken(req);

  if (!token) {
    throw createHttpError(401, "SPOTIFY_AUTH_REQUIRED", "Missing Spotify user token");
  }

  return token;
}

function buildSpotifyCacheKey(prefix, token, params = {}) {
  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

  return `${prefix}:${token}:${normalizedParams}`;
}

function normalizeReleaseDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
}

function buildEntityCacheUpsertPayload({ entityType, entityId, payload, name, imageUrl, subtitle, popularity, releaseDate }) {
  return {
    entity_type: entityType,
    entity_id: entityId,
    source: "spotify",
    payload_json: payload,
    image_url: imageUrl ?? null,
    name: name ?? null,
    subtitle: subtitle ?? null,
    popularity: Number.isFinite(Number(popularity)) ? Number(popularity) : null,
    release_date: normalizeReleaseDate(releaseDate),
    updated_at: new Date().toISOString(),
  };
}

async function readEntityCacheRecord(supabase, entityType, entityId) {
  const { data, error } = await supabase
    .from("entity_cache")
    .select("entity_type, entity_id, payload_json, image_url, name, subtitle, popularity, release_date, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (isMissingRelationError(error) || isNotFoundError(error)) {
    return null;
  }

  handleSupabaseError(error, "Failed to read entity cache");
  return data ?? null;
}

async function upsertEntityCacheRecord(supabase, payload) {
  const { error } = await supabase
    .from("entity_cache")
    .upsert(payload, { onConflict: "entity_type,entity_id" });

  if (isMissingRelationError(error)) {
    return;
  }

  if (error) {
    console.error("[entity-cache] upsert failed", {
      entityType: payload.entity_type,
      entityId: payload.entity_id,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown upsert error",
    });
  }
}

async function upsertEntityCacheRecords(supabase, payloads = []) {
  if (payloads.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("entity_cache")
    .upsert(payloads, { onConflict: "entity_type,entity_id" });

  if (isMissingRelationError(error)) {
    return;
  }

  if (error) {
    console.error("[entity-cache] batch upsert failed", {
      count: payloads.length,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? "Unknown batch upsert error",
    });
  }
}

function buildArtistCachePayload(artist) {
  return buildEntityCacheUpsertPayload({
    entityType: "artist",
    entityId: String(artist.id),
    payload: artist,
    name: artist.name ?? null,
    imageUrl: artist.images?.[0]?.url ?? null,
    subtitle: artist.genres?.slice(0, 2).join(" · ") || "Artista",
    popularity: artist.popularity ?? null,
    releaseDate: null,
  });
}

function buildAlbumCachePayload(album) {
  return buildEntityCacheUpsertPayload({
    entityType: "album",
    entityId: String(album.id),
    payload: album,
    name: album.name ?? null,
    imageUrl: album.images?.[0]?.url ?? null,
    subtitle: `${album.artists?.[0]?.name ?? "Album"}${album.release_date ? ` · ${String(album.release_date).slice(0, 4)}` : ""}`,
    popularity: album.popularity ?? null,
    releaseDate: album.release_date ?? null,
  });
}

function buildArtistAlbumsCachePayload(artistId, response) {
  return buildEntityCacheUpsertPayload({
    entityType: "artist_albums",
    entityId: String(artistId),
    payload: response,
    name: null,
    imageUrl: null,
    subtitle: null,
    popularity: null,
    releaseDate: null,
  });
}

function mapEntityCacheRecordToArtist(record, fallbackId) {
  const payload = record?.payload_json;

  if (payload && typeof payload === "object") {
    return payload;
  }

  return {
    id: fallbackId,
    name: record?.name ?? "Artista no disponible",
    genres: record?.subtitle ? record.subtitle.split(" · ").filter(Boolean) : [],
    images: record?.image_url ? [{ url: record.image_url }] : [],
    followers: { total: 0 },
    popularity: record?.popularity ?? 0,
    external_urls: {},
  };
}

function mapEntityCacheRecordToAlbum(record, fallbackId) {
  const payload = record?.payload_json;

  if (payload && typeof payload === "object") {
    return payload;
  }

  return {
    id: fallbackId,
    name: record?.name ?? "Album no disponible",
    artists: record?.subtitle ? [{ name: record.subtitle.split(" · ")[0] || "Album" }] : [{ name: "Album" }],
    images: record?.image_url ? [{ url: record.image_url }] : [],
    release_date: record?.release_date ?? "",
    tracks: { items: [] },
    external_urls: {},
  };
}

function mapEntityCacheRecordToArtistAlbums(record) {
  const payload = record?.payload_json;

  if (payload && typeof payload === "object") {
    return payload;
  }

  return {
    items: [],
    total: 0,
  };
}

async function spotifyRequest(path, { token, query } = {}) {
  try {
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

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const message = await response.text();
      throw createHttpError(response.status, "SPOTIFY_API_ERROR", message || `Spotify request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_API_ERROR", "Spotify request failed");
  }
}

function parseSpotifyEmbedState(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

  if (!match?.[1]) {
    throw createHttpError(502, "SPOTIFY_EMBED_PARSE_ERROR", "Could not parse Spotify embed payload");
  }

  return JSON.parse(match[1]);
}

async function getGlobalTrendingTracks(limit = 10) {
  try {
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

    return limitedTracks
      .map((track, index) => {
        const trackId = track.uri?.split(":").pop();

        if (!trackId) {
          return null;
        }

        return {
          id: trackId || randomUUID(),
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
          _rank: index + 1,
          album: {
            id: playlistId,
            name: entity?.title ?? "Top 50 - Global",
            images: [],
          },
        };
      })
      .filter(Boolean);
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_TRENDING_UNAVAILABLE", "Spotify trending playlist is unavailable");
  }
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
    next(normalizeSpotifyError(error, "SPOTIFY_AUTH_INVALID", "Spotify authentication failed"));
  }
}

async function getAllArtistAlbums(artistId, token, query = {}) {
  try {
    const limit = Math.min(Number(query.limit) || 50, 50);
    const data = await spotifyRequest(`/artists/${artistId}/albums`, {
      token,
      query: {
        include_groups: query.include_groups || "album,single",
        market: query.market || "US",
        limit,
        offset: Number(query.offset) || 0,
      },
    });

    const uniqueAlbums = new Map();

    (data.items ?? []).forEach((album) => {
      const key = `${album.name}-${album.album_group}-${album.release_date}`;

      if (!uniqueAlbums.has(key)) {
        uniqueAlbums.set(key, album);
      }
    });

    return {
      ...data,
      items: Array.from(uniqueAlbums.values()),
      total: data.total ?? uniqueAlbums.size,
    };
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_API_ERROR", "Failed to fetch artist albums");
  }
}

async function getSavedTracksByArtist(token, artistId, query = {}) {
  try {
    const limit = Math.min(Number(query.limit) || 50, 50);
    const data = await spotifyRequest("/me/tracks", {
      token,
      query: {
        limit,
        offset: Number(query.offset) || 0,
        market: query.market || "US",
      },
    });

    const filteredItems = (data.items ?? []).filter((item) =>
      item.track?.artists?.some((artist) => artist.id === artistId),
    );

    return {
      ...data,
      items: filteredItems,
      total: filteredItems.length,
    };
  } catch (error) {
    throw normalizeSpotifyError(error, "SPOTIFY_API_ERROR", "Failed to fetch saved tracks");
  }
}

async function getArtistsByIds(token, artistIds = []) {
  const normalizedIds = [...new Set((artistIds ?? []).map((artistId) => normalizeEntityId(artistId)).filter(Boolean))];

  if (normalizedIds.length === 0) {
    return [];
  }

  const cachedArtists = new Map();
  const missingIds = [];

  normalizedIds.forEach((artistId) => {
    const cacheKey = buildSpotifyCacheKey("artist", artistId, { market: "US" });
    const cachedArtist = getSpotifyCacheEntry(spotifyArtistCache, cacheKey, { allowStale: true });

    if (cachedArtist) {
      cachedArtists.set(artistId, cachedArtist);
      return;
    }

    missingIds.push(artistId);
  });

  if (missingIds.length > 0) {
    const data = await spotifyRequest("/artists", {
      token,
      query: {
        ids: missingIds.join(","),
      },
    });

    const supabase = getSupabaseAdmin();
    const cachePayloads = [];

    (data?.artists ?? []).forEach((artist) => {
      if (!artist?.id) {
        return;
      }

      const cacheKey = buildSpotifyCacheKey("artist", artist.id, { market: "US" });
      cachedArtists.set(artist.id, setSpotifyCacheEntry(spotifyArtistCache, cacheKey, artist));
      cachePayloads.push(buildArtistCachePayload(artist));
    });

    await upsertEntityCacheRecords(supabase, cachePayloads);
  }

  return normalizedIds.map((artistId) => cachedArtists.get(artistId)).filter(Boolean);
}

async function getAlbumsByIds(token, albumIds = [], market = "US") {
  const normalizedIds = [...new Set((albumIds ?? []).map((albumId) => normalizeEntityId(albumId)).filter(Boolean))];

  if (normalizedIds.length === 0) {
    return [];
  }

  const cachedAlbums = new Map();
  const missingIds = [];

  normalizedIds.forEach((albumId) => {
    const cacheKey = buildSpotifyCacheKey("album", albumId, { market });
    const cachedAlbum = getSpotifyCacheEntry(spotifyAlbumCache, cacheKey, { allowStale: true });

    if (cachedAlbum) {
      cachedAlbums.set(albumId, cachedAlbum);
      return;
    }

    missingIds.push(albumId);
  });

  if (missingIds.length > 0) {
    const data = await spotifyRequest("/albums", {
      token,
      query: {
        ids: missingIds.join(","),
        market,
      },
    });

    const supabase = getSupabaseAdmin();
    const cachePayloads = [];

    (data?.albums ?? []).forEach((album) => {
      if (!album?.id) {
        return;
      }

      const cacheKey = buildSpotifyCacheKey("album", album.id, { market });
      cachedAlbums.set(album.id, setSpotifyCacheEntry(spotifyAlbumCache, cacheKey, album));
      cachePayloads.push(buildAlbumCachePayload(album));
    });

    await upsertEntityCacheRecords(supabase, cachePayloads);
  }

  return normalizedIds.map((albumId) => cachedAlbums.get(albumId)).filter(Boolean);
}

function buildEnrichedRankingEntry(entityType, ranking, entity) {
  if (entityType === "artist") {
    return {
      entity_id: ranking.entity_id,
      average_rating: ranking.average_rating,
      ratings_count: ranking.ratings_count,
      name: entity?.name ?? "Artista no disponible",
      subtitle: entity?.genres?.slice(0, 2).join(" · ") || "Artista",
      image: entity?.images?.[0]?.url ?? "",
      href: `/artist/${entity?.id ?? ranking.entity_id}`,
    };
  }

  return {
    entity_id: ranking.entity_id,
    average_rating: ranking.average_rating,
    ratings_count: ranking.ratings_count,
    name: entity?.name ?? "Album no disponible",
    subtitle: `${entity?.artists?.[0]?.name ?? "Album"}${entity?.release_date ? ` · ${String(entity.release_date).slice(0, 4)}` : ""}`,
    image: entity?.images?.[0]?.url ?? "",
    href: `/album/${entity?.id ?? ranking.entity_id}`,
  };
}

function buildFallbackRankingEntity(entityType, entityId) {
  if (entityType === "artist") {
    const cacheKey = buildSpotifyCacheKey("artist", entityId, { market: "US" });
    const cachedArtist = getSpotifyCacheEntry(spotifyArtistCache, cacheKey, { allowStale: true });
    if (cachedArtist) {
      return cachedArtist;
    }

    return null;
  }

  const cacheKey = buildSpotifyCacheKey("album", entityId, { market: "US" });
  const cachedAlbum = getSpotifyCacheEntry(spotifyAlbumCache, cacheKey, { allowStale: true });
  if (cachedAlbum) {
    return cachedAlbum;
  }

  return null;
}

async function getFallbackEnrichedRankings(supabase, entityType, limit = 10) {
  const rankings = await getRankingsSummary(supabase, entityType, limit);

  const enrichedEntries = [];

  for (const ranking of rankings) {
    const entityId = String(ranking.entity_id);
    let entity = buildFallbackRankingEntity(entityType, entityId);

    if (!entity) {
      const record = await readEntityCacheRecord(supabase, entityType, entityId);
      entity =
        entityType === "artist"
          ? mapEntityCacheRecordToArtist(record, entityId)
          : mapEntityCacheRecordToAlbum(record, entityId);
    }

    enrichedEntries.push(buildEnrichedRankingEntry(entityType, ranking, entity));
  }

  return enrichedEntries;
}

async function getEnrichedRankings(supabase, entityType, limit = 10) {
  const rankings = await getRankingsSummary(supabase, entityType, limit);

  if (rankings.length === 0) {
    return [];
  }

  const token = await getAppAccessToken();

  if (entityType === "artist") {
    const artists = await getArtistsByIds(token, rankings.map((entry) => entry.entity_id));
    const artistMap = new Map(artists.map((artist) => [String(artist.id), artist]));

    return rankings.map((ranking) => buildEnrichedRankingEntry(entityType, ranking, artistMap.get(String(ranking.entity_id))));
  }

  const albums = await getAlbumsByIds(token, rankings.map((entry) => entry.entity_id), "US");
  const albumMap = new Map(albums.map((album) => [String(album.id), album]));

  return rankings.map((ranking) => buildEnrichedRankingEntry(entityType, ranking, albumMap.get(String(ranking.entity_id))));
}

function buildTopAlbumsFromTracksResponse(data, maxAlbums = 10) {
  const items = data?.items ?? [];
  const albumMap = new Map();

  items.forEach((track, index) => {
    const album = track.album;

    if (!album?.id || album.album_type !== "album") {
      return;
    }

    const weight = items.length - index;
    const currentAlbum = albumMap.get(album.id);

    if (!currentAlbum) {
      albumMap.set(album.id, {
        ...album,
        _score: weight,
        _trackCount: 1,
      });
      return;
    }

    albumMap.set(album.id, {
      ...currentAlbum,
      _score: currentAlbum._score + weight,
      _trackCount: currentAlbum._trackCount + 1,
    });
  });

  return {
    items: Array.from(albumMap.values())
      .sort((left, right) => {
        if (right._score !== left._score) {
          return right._score - left._score;
        }

        return right._trackCount - left._trackCount;
      })
      .slice(0, Math.min(Number(maxAlbums) || 10, 30)),
  };
}

async function createMercadoPagoPreference({ user, plan }) {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    throw createHttpError(500, "MERCADO_PAGO_CONFIG_MISSING", "Mercado Pago access token is not configured");
  }

  const normalizedPlan = normalizeSubscriptionPlan(plan);

  if (!normalizedPlan) {
    throw createHttpError(400, "INVALID_PRO_PLAN", "A valid PRO subscription plan is required");
  }

  const selectedPlan = PRO_SUBSCRIPTION_PLANS[normalizedPlan];
  const appUrl = normalizeUrl(PUBLIC_APP_URL, "https://musicdb.online");
  const apiUrl = normalizeUrl(PUBLIC_API_URL, "https://musicdb-backend.onrender.com");
  const requestBody = {
    items: [
      {
        title: selectedPlan.title,
        description: `Suscripcion MusicDB PRO por ${selectedPlan.months} ${selectedPlan.months === 1 ? "mes" : "meses"}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: selectedPlan.price,
      },
    ],
    external_reference: user.id,
    metadata: {
      user_id: user.id,
      plan: normalizedPlan,
      months: selectedPlan.months,
      username: user.username ?? "",
      email: user.email ?? "",
    },
    payer: user.email
      ? {
          email: user.email,
        }
      : undefined,
    back_urls: {
      success: `${appUrl}/pro?payment=success`,
      failure: `${appUrl}/pro?payment=failure`,
      pending: `${appUrl}/pro?payment=pending`,
    },
    notification_url: `${apiUrl}/api/payments/webhook`,
    auto_return: "approved",
    statement_descriptor: "MUSICDB PRO",
  };

  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const rawBody = await response.text();
  let data = null;

  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw createHttpError(
      502,
      "MERCADO_PAGO_PREFERENCE_ERROR",
      data?.message || data?.error || "Failed to create Mercado Pago preference",
    );
  }

  if (!data?.init_point) {
    throw createHttpError(502, "MERCADO_PAGO_INIT_POINT_MISSING", "Mercado Pago did not return init_point");
  }

  return data;
}

function extractMercadoPagoPaymentId(req) {
  const candidates = [
    req.body?.data?.id,
    req.body?.id,
    req.query?.["data.id"],
    req.query?.id,
  ];

  const typeCandidate = req.body?.type || req.body?.topic || req.query?.type || req.query?.topic || null;

  const paymentId = candidates.find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");

  return {
    paymentId: paymentId ? String(paymentId).trim() : null,
    topic: typeof typeCandidate === "string" ? typeCandidate.trim().toLowerCase() : null,
  };
}

function isApprovedMercadoPagoPayment(payment) {
  return payment?.status === "approved";
}

function normalizePurchasedMonths(value) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function getSubscriptionMonthsFromPayment(payment) {
  const metadataPlan = normalizeSubscriptionPlan(payment?.metadata?.plan);

  if (metadataPlan) {
    return PRO_SUBSCRIPTION_PLANS[metadataPlan].months;
  }

  const metadataMonths = normalizePurchasedMonths(payment?.metadata?.months);

  if (metadataMonths) {
    return metadataMonths;
  }

  return 1;
}

function buildNextProUntil(currentProUntil, months = 1) {
  const currentTimestamp = currentProUntil ? new Date(currentProUntil).getTime() : NaN;
  const baseTime = Number.isFinite(currentTimestamp) && currentTimestamp > Date.now() ? currentTimestamp : Date.now();
  const daysToAdd = months === 12 ? 365 : months * 30;
  return new Date(baseTime + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
}

async function activateProFromMercadoPagoPayment(paymentId) {
  const paymentClient = getMercadoPagoPaymentClient();
  const payment = await paymentClient.get({
    id: paymentId,
  });

  console.log("[payments:webhook] Mercado Pago payment fetched", {
    paymentId,
    status: payment?.status,
    external_reference: payment?.external_reference,
    metadata_user_id: payment?.metadata?.user_id ?? null,
  });

  if (!isApprovedMercadoPagoPayment(payment)) {
    return {
      acknowledged: true,
      approved: false,
      payment,
    };
  }

  const userId = normalizeUserId(payment?.metadata?.user_id || payment?.external_reference);
  const purchasedMonths = getSubscriptionMonthsFromPayment(payment);

  if (!userId) {
    throw createHttpError(400, "MERCADO_PAGO_USER_ID_MISSING", "Approved payment is missing a valid user_id");
  }

  const supabase = getSupabaseAdmin();
  const currentUser = await getUserById(supabase, userId);
  const nextProUntil = buildNextProUntil(currentUser?.pro_until, purchasedMonths);
  const updatedUser = await updateUserProStatus(supabase, userId, nextProUntil);

  console.log("[payments:webhook] PRO activated", {
    userId,
    paymentId,
    months: purchasedMonths,
    pro_until: nextProUntil,
  });

  return {
    acknowledged: true,
    approved: true,
    payment,
    user: mapUserRecord(updatedUser),
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

async function handleLocalRegister(req, res) {
  const email = normalizeEmail(req.body.email);
  const username = normalizeUsername(req.body.username);
  const password = normalizePassword(req.body.password);
  const phone = normalizePhone(req.body.phone);

  if (!email || !username || !password) {
    throw createHttpError(400, "INVALID_REGISTER_PAYLOAD", "email, username and password are required");
  }

  const supabase = getSupabaseAdmin();
  const user = await createLocalUser(supabase, {
    email,
    username,
    password,
    phone,
  });

  if (!user?.id) {
    console.error("[auth:register] User insert returned no UUID", {
      email,
      username,
      userId: user?.id ?? null,
    });
    throw createHttpError(500, "REGISTER_USER_ID_MISSING", "User was created without a valid id");
  }

  console.log("[auth:register] Using user UUID for verification token", {
    userId: user.id,
    email,
  });

  const verification = await issueVerificationEmail(supabase, user);

  res.status(201).json({
    message: "Revisa tu email para verificar la cuenta",
    user: mapUserRecord(user),
    requires_email_verification: true,
    verification_email_sent: true,
    verification_expires_at: verification.expiresAt ?? null,
    verification_delivery: verification.delivery?.delivered ? "smtp" : "logged",
    verification_url: verification.delivery?.delivered ? null : verification.delivery?.verificationUrl ?? null,
  });
}

async function handleResendVerificationEmail(req, res) {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email invalido",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const userSelect = await buildUserSelect(supabase);
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(userSelect)
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("[auth:verify-email:resend] Failed to fetch user by email", {
        email,
        errorCode: userError.code ?? null,
        errorMessage: userError.message ?? "Unknown select error",
      });

      return res.status(500).json({
        success: false,
        error: "Error buscando usuario",
      });
    }

    if (!user?.id) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    if (user.auth_provider !== "local") {
      return res.status(400).json({
        success: false,
        error: "La cuenta no admite verificacion por email",
      });
    }

    if (user.is_verified) {
      return res.json({
        success: true,
      });
    }

    console.log("[auth:verify-email:resend] Resending verification email", {
      userId: user.id,
      email,
    });

    const { token, expiresAt } = await createEmailVerificationToken(supabase, user.id);
    const delivery = await sendVerificationEmail({
      email: user.email,
      username: user.username,
      token,
      expiresAt,
    });

    await markVerificationEmailSent(supabase, user.id);

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error("[auth:verify-email:resend] Resend verification failed", {
      email,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? "Unknown resend error",
    });

    return res.status(500).json({
      success: false,
      error: "Error enviando email",
    });
  }
}

app.get(
  "/api/search/artists",
  asyncRoute(async (req, res) => {
    try {
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
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.post(
  "/api/payments/create-preference",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const currentUser = req.current_user;
    const plan = normalizeSubscriptionPlan(req.body?.plan);

    if (!currentUser?.id) {
      throw createHttpError(401, "APP_AUTH_REQUIRED", "Authentication is required");
    }

    if (!plan) {
      throw createHttpError(400, "INVALID_PRO_PLAN", "A valid PRO subscription plan is required");
    }

    const preference = await createMercadoPagoPreference({
      user: currentUser,
      plan,
    });

    res.status(201).json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point ?? null,
    });
  }),
);

app.post(
  "/api/payments/webhook",
  asyncRoute(async (req, res) => {
    const { paymentId, topic } = extractMercadoPagoPaymentId(req);

    console.log("[payments:webhook] Notification received", {
      topic,
      paymentId,
      body: req.body,
      query: req.query,
    });

    if (topic && topic !== "payment") {
      res.status(200).json({
        received: true,
        ignored: true,
        reason: `Unsupported topic: ${topic}`,
      });
      return;
    }

    if (!paymentId) {
      throw createHttpError(400, "MERCADO_PAGO_PAYMENT_ID_MISSING", "Mercado Pago webhook is missing payment id");
    }

    const result = await activateProFromMercadoPagoPayment(paymentId);

    res.status(200).json({
      received: true,
      approved: result.approved,
      user_id: result.user?.id ?? null,
      pro_until: result.user?.pro_until ?? null,
    });
  }),
);

app.post(
  "/api/auth/register",
  asyncRoute(handleLocalRegister),
);

app.post(
  "/api/register",
  asyncRoute(handleLocalRegister),
);

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : null;

    if (!email || !password) {
      throw createHttpError(400, "INVALID_LOGIN_PAYLOAD", "email and password are required");
    }

    const supabase = getSupabaseAdmin();
    const user = await getUserAuthByEmail(supabase, email);
    const userColumns = await getUserTableColumns(supabase);

    if (!user?.password_hash) {
      throw createHttpError(401, "LOCAL_LOGIN_INVALID", "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw createHttpError(401, "LOCAL_LOGIN_INVALID", "Invalid email or password");
    }

    if (userColumns.has("is_verified") && !user.is_verified) {
      throw createHttpError(403, "EMAIL_NOT_VERIFIED", "Email verification is required before logging in");
    }

    res.json({
      user: mapUserRecord(user),
      token: createAppSessionToken(user),
    });
  }),
);

app.get("/api/auth/verify-email", async (req, res) => {
  const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";

  if (!token) {
    res.status(400).json({
      success: false,
      error: "Falta el token de verificacion",
    });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const verificationRecord = await getEmailVerificationRecordByToken(supabase, token);

    if (!verificationRecord) {
      res.status(404).json({
        success: false,
        error: "El token de verificacion no existe",
      });
      return;
    }

    const userId = normalizeUserId(verificationRecord.user_id);

    if (!userId) {
      console.error("[auth:verify-email] Invalid UUID in email verification token", {
        token,
        userId: verificationRecord.user_id ?? null,
      });
      res.status(500).json({
        success: false,
        error: "El token tiene un user_id invalido",
      });
      return;
    }

    const expiresAt = new Date(verificationRecord.expires_at);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        error: "El token de verificacion esta expirado",
      });
      return;
    }

    await markUserEmailAsVerified(supabase, userId);
    await deleteEmailVerificationTokensForUser(supabase, userId);

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("[auth:verify-email] Verification failed", {
      token,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? "Unknown verification error",
    });

    res.status(error?.status || 500).json({
      success: false,
      error: error?.message || "No pudimos verificar el email",
    });
  }
});

app.post(
  "/api/auth/verify-email/resend",
  asyncRoute(handleResendVerificationEmail),
);

app.get(
  "/api/auth/me",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);

    if (!userId) {
      throw createHttpError(400, "INVALID_AUTH_ME_QUERY", "valid user_id is required");
    }

    const supabase = getSupabaseAdmin();
    const user = await getUserById(supabase, userId);
    res.json({ user: mapUserRecord(user) });
  }),
);

app.patch(
  "/api/auth/profile",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const username = normalizeUsername(req.body?.username);
    const phone = normalizePhone(req.body?.phone);
    const avatarUrl = normalizeAvatarUrl(req.body?.avatar_url);

    if (!userId) {
      throw createHttpError(400, "INVALID_PROFILE_UPDATE", "valid user_id is required");
    }

    if (req.body?.username !== undefined && !username) {
      throw createHttpError(400, "INVALID_PROFILE_UPDATE", "username is required");
    }

    if (req.body?.phone !== undefined && req.body?.phone !== "" && phone === null) {
      throw createHttpError(400, "INVALID_PROFILE_UPDATE", "phone must be a valid string");
    }

    if (req.body?.avatar_url !== undefined && !avatarUrl) {
      throw createHttpError(400, "INVALID_PROFILE_UPDATE", "avatar_url must be a valid URL");
    }

    const supabase = getSupabaseAdmin();
    const userColumns = await getUserTableColumns(supabase);
    const updatePayload = {};

    if (req.body?.username !== undefined) {
      const { data: existingUsername, error: usernameError } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .neq("id", userId)
        .maybeSingle();

      handleSupabaseError(usernameError, "Failed to validate username uniqueness");

      if (existingUsername?.id) {
        throw createHttpError(409, "USERNAME_ALREADY_EXISTS", "That username is already in use");
      }

      updatePayload.username = username;
      updatePayload.display_name = username;
    }

    if (req.body?.phone !== undefined && userColumns.has("phone")) {
      updatePayload.phone = phone;
    }

    if (req.body?.avatar_url !== undefined) {
      updatePayload.avatar_url = avatarUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw createHttpError(400, "INVALID_PROFILE_UPDATE", "No supported profile fields were provided");
    }

    const userSelect = await buildUserSelect(supabase);
    const { data, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .select(userSelect)
      .single();

    handleSupabaseError(error, "Failed to update authenticated profile");

    res.json({
      user: mapUserRecord(data),
    });
  }),
);

app.post(
  "/api/auth/token",
  asyncRoute(async (req, res) => {
    try {
      const data = await requestSpotifyToken({
        grant_type: "authorization_code",
        code: req.body.code,
        redirect_uri: req.body.redirect_uri,
        code_verifier: req.body.code_verifier,
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.post(
  "/api/auth/refresh",
  asyncRoute(async (req, res) => {
    try {
      const data = await requestSpotifyToken({
        grant_type: "refresh_token",
        refresh_token: req.body.refresh_token,
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
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
      res.json({ user: mapUserRecord(user), token: createAppSessionToken(user) });
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

    res.status(201).json({ user: mapUserRecord(user), token: createAppSessionToken(user) });
  }),
);

app.post(
  "/api/ratings",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const currentUser = req.current_user;
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
    const existingRating = await getUserRatingRecord(supabase, {
      userId,
      entityType,
      entityId,
    });

    await enforceDailyUsageLimit(supabase, currentUser, "rating", {
      isNewRating: !existingRating.id,
    });

    const rating = await upsertUserRating(supabase, {
      userId,
      entityType,
      entityId,
      ratingValue,
    });

    invalidateCachedRankings(entityType);

    const summary = await getEntityRatingsSummary(supabase, {
      entityType,
      entityId,
    });
    const usage = await getDailyUsageStatus(supabase, currentUser);

    res.status(200).json({
      rating,
      summary,
      usage,
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
  authenticateAppUser,
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
  "/api/ratings/me",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);

    if (!userId) {
      throw createHttpError(400, "INVALID_MY_RATINGS_QUERY", "valid user_id is required");
    }

    const supabase = getSupabaseAdmin();
    const ratings = await getRatingsHistoryForUser(supabase, userId);

    res.json({ ratings });
  }),
);

app.get(
    "/api/rankings/:entity_type",
  asyncRoute(async (req, res) => {
      const entityType = normalizeEntityType(req.params.entity_type);
      const requestedLimit = Number(req.query.limit);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 10;

      if (!entityType) {
        throw createHttpError(400, "INVALID_RANKING_QUERY", "entity_type must be artist or album");
      }

      const supabase = getSupabaseAdmin();
      const rankings = await getRankingsSummary(supabase, entityType, limit);

      res.json(rankings);
    }),
  );

app.post(
  "/api/reviews",
  authenticateAppUser,
  asyncRoute(async (req, res) => {
    const userId = normalizeUserId(req.user_id);
    const currentUser = req.current_user;
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
    await enforceDailyUsageLimit(supabase, currentUser, "review");

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

    const usage = await getDailyUsageStatus(supabase, currentUser);

    res.status(201).json({ review, usage });
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
  authenticateAppUser,
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
  "/api/rankings/:entity_type/enriched",
  asyncRoute(async (req, res) => {
    const entityType = normalizeEntityType(req.params.entity_type);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);

    try {
      if (!entityType) {
        throw createHttpError(400, "INVALID_ENTITY_TYPE", "entity_type must be artist or album");
      }

      const supabase = getSupabaseAdmin();
      const cacheKey = buildSpotifyCacheKey("rankings-enriched", entityType, { limit });
      const rankings = await getCachedSpotifyResponse(spotifyEnrichedRankingsCache, cacheKey, async () =>
        getEnrichedRankings(supabase, entityType, limit),
      );

      res.json(rankings);
    } catch (error) {
      const supabase = getSupabaseAdmin();

      if (isSpotifyRateLimitError(error)) {
        const cacheKey = buildSpotifyCacheKey("rankings-enriched", entityType, { limit });
        const cachedRankings = getSpotifyCacheEntry(spotifyEnrichedRankingsCache, cacheKey, { allowStale: true });

        if (cachedRankings) {
          return res.json(cachedRankings);
        }

        const fallbackRankings = await getFallbackEnrichedRankings(supabase, entityType, limit);
        return res.json(fallbackRankings);
      }

      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/search/albums",
  asyncRoute(async (req, res) => {
    try {
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
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/search/playlists",
  asyncRoute(async (req, res) => {
    try {
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
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/search",
  asyncRoute(async (req, res) => {
    try {
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
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/playlists/:id/tracks",
  asyncRoute(async (req, res) => {
    try {
      const token = await getAppAccessToken();
      const data = await spotifyRequest(`/playlists/${req.params.id}/tracks`, {
        token,
        query: {
          limit: req.query.limit || 50,
          market: req.query.market || "US",
        },
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/artist/:id",
  asyncRoute(async (req, res) => {
    const artistId = normalizeEntityId(req.params.id);

    try {
      if (!artistId) {
        throw createHttpError(400, "INVALID_ARTIST_ID", "artist id is required");
      }

      const token = await getAppAccessToken();
      const cacheKey = buildSpotifyCacheKey("artist", artistId, {
        market: req.query.market || "US",
      });
      const data = await getCachedSpotifyResponse(spotifyArtistCache, cacheKey, async () =>
        spotifyRequest(`/artists/${artistId}`, { token }),
      );
      await upsertEntityCacheRecord(getSupabaseAdmin(), buildArtistCachePayload(data));
      res.json(data);
    } catch (error) {
      if (isSpotifyRateLimitError(error) && artistId) {
        const record = await readEntityCacheRecord(getSupabaseAdmin(), "artist", artistId);

        if (record) {
          return res.json(mapEntityCacheRecordToArtist(record, artistId));
        }
      }

      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/artist/:id/albums",
  asyncRoute(async (req, res) => {
    const artistId = normalizeEntityId(req.params.id);

    try {
      if (!artistId) {
        throw createHttpError(400, "INVALID_ARTIST_ID", "artist id is required");
      }

      const token = await getAppAccessToken();
      const normalizedQuery = {
        include_groups: req.query.include_groups || "album,single",
        limit: Math.min(Number(req.query.limit) || 50, 50),
        market: req.query.market || "US",
        offset: Number(req.query.offset) || 0,
      };
      const cacheKey = buildSpotifyCacheKey("artist-albums", artistId, normalizedQuery);
      const data = await getCachedSpotifyResponse(spotifyArtistAlbumsCache, cacheKey, async () =>
        getAllArtistAlbums(artistId, token, normalizedQuery),
      );
      const supabase = getSupabaseAdmin();
      await upsertEntityCacheRecord(supabase, buildArtistAlbumsCachePayload(artistId, data));
      await upsertEntityCacheRecords(
        supabase,
        (data.items ?? []).filter((album) => album?.id).map((album) => buildAlbumCachePayload(album)),
      );
      res.json(data);
    } catch (error) {
      if (isSpotifyRateLimitError(error) && artistId) {
        const record = await readEntityCacheRecord(getSupabaseAdmin(), "artist_albums", artistId);

        if (record) {
          return res.json(mapEntityCacheRecordToArtistAlbums(record));
        }
      }

      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/album/:id",
  asyncRoute(async (req, res) => {
    const albumId = normalizeEntityId(req.params.id);

    try {
      if (!albumId) {
        throw createHttpError(400, "INVALID_ALBUM_ID", "album id is required");
      }

      const token = await getAppAccessToken();
      const normalizedQuery = {
        market: req.query.market || "US",
      };
      const cacheKey = buildSpotifyCacheKey("album", albumId, normalizedQuery);
      const data = await getCachedSpotifyResponse(spotifyAlbumCache, cacheKey, async () =>
        spotifyRequest(`/albums/${albumId}`, {
          token,
          query: normalizedQuery,
        }),
      );
      await upsertEntityCacheRecord(getSupabaseAdmin(), buildAlbumCachePayload(data));
      res.json(data);
    } catch (error) {
      if (isSpotifyRateLimitError(error) && albumId) {
        const record = await readEntityCacheRecord(getSupabaseAdmin(), "album", albumId);

        if (record) {
          return res.json(mapEntityCacheRecordToAlbum(record, albumId));
        }
      }

      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/new-releases",
  asyncRoute(async (req, res) => {
    try {
      const token = await getAppAccessToken();
      const data = await spotifyRequest("/browse/new-releases", {
        token,
        query: {
          limit: req.query.limit || 12,
          country: req.query.country || "US",
        },
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/trending/global",
  asyncRoute(async (req, res) => {
    try {
      const tracks = await getGlobalTrendingTracks(req.query.limit || 10);
      res.json({ tracks });
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/top-artists",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const timeRange = req.query.time_range || "medium_term";
      const cacheKey = buildSpotifyCacheKey("top-artists", token, {
        limit,
        time_range: timeRange,
      });

      const data = await getCachedSpotifyResponse(spotifyTopArtistsCache, cacheKey, async () =>
        spotifyRequest("/me/top/artists", {
          token,
          query: {
            limit,
            time_range: timeRange,
          },
        }),
      );

      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/top-albums",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const maxAlbums = Math.min(Number(req.query.limit) || 10, 30);
      const trackLimit = Math.min(Number(req.query.track_limit) || 50, 50);
      const timeRange = req.query.time_range || "medium_term";
      const cacheKey = buildSpotifyCacheKey("top-albums", token, {
        limit: maxAlbums,
        time_range: timeRange,
        track_limit: trackLimit,
      });

      const data = await getCachedSpotifyResponse(spotifyTopAlbumsCache, cacheKey, async () => {
        const topTracks = await spotifyRequest("/me/top/tracks", {
          token,
          query: {
            limit: trackLimit,
            time_range: timeRange,
          },
        });

        return buildTopAlbumsFromTracksResponse(topTracks, maxAlbums);
      });

      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/me",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const data = await spotifyRequest("/me", { token });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/me/top-artists",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const data = await spotifyRequest("/me/top/artists", {
        token,
        query: {
          limit: req.query.limit || 10,
          time_range: req.query.time_range || "medium_term",
        },
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/me/top-tracks",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const data = await spotifyRequest("/me/top/tracks", {
        token,
        query: {
          limit: req.query.limit || 10,
          time_range: req.query.time_range || "medium_term",
        },
      });
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/me/player/currently-playing",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const data = await spotifyRequest("/me/player/currently-playing", { token });

      if (!data) {
        res.status(204).send();
        return;
      }

      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get(
  "/api/me/liked-tracks/by-artist/:artistId",
  asyncRoute(async (req, res) => {
    try {
      const token = getUserAccessToken(req);
      const data = await getSavedTracksByArtist(token, req.params.artistId, req.query);
      res.json(data);
    } catch (error) {
      return sendSpotifyEndpointError(res, error);
    }
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const statusCode = [400, 401, 403, 404, 409, 429].includes(status) ? status : status >= 400 && status < 600 ? status : 500;

  console.error("[spotify-backend]", error.code || "INTERNAL_SERVER_ERROR", error.message);

  if (statusCode === 429 && (error.code === "SPOTIFY_RATE_LIMIT" || error.code === "SPOTIFY_API_ERROR" || isSpotifyRateLimitError(error))) {
    res.status(429).json({ error: "spotify_rate_limit" });
    return;
  }

  res.status(statusCode).json({
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message:
        statusCode === 401
          ? error.message || "Authentication failed"
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



