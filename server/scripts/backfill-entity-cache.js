import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_MS = 2000;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeArgs(argv) {
  const args = {
    entityType: "all",
    batchSize: DEFAULT_BATCH_SIZE,
    delayMs: DEFAULT_DELAY_MS,
    limit: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--type=")) {
      args.entityType = arg.slice("--type=".length);
    } else if (arg.startsWith("--batch=")) {
      args.batchSize = Math.max(Number(arg.slice("--batch=".length)) || DEFAULT_BATCH_SIZE, 1);
    } else if (arg.startsWith("--delay=")) {
      args.delayMs = Math.max(Number(arg.slice("--delay=".length)) || DEFAULT_DELAY_MS, 0);
    } else if (arg.startsWith("--limit=")) {
      const parsedLimit = Number(arg.slice("--limit=".length));
      args.limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
    }
  }

  return args;
}

async function getAppAccessToken() {
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
    throw new Error(`Spotify token error: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function spotifyRequest(path, token, query = {}) {
  const url = new URL(`${SPOTIFY_API_BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error(`Spotify request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function buildEntityCachePayload({ entityType, entityId, payload, name, imageUrl, subtitle, popularity, releaseDate }) {
  return {
    entity_type: entityType,
    entity_id: String(entityId),
    source: "spotify",
    payload_json: payload,
    image_url: imageUrl ?? null,
    name: name ?? null,
    subtitle: subtitle ?? null,
    popularity: Number.isFinite(Number(popularity)) ? Number(popularity) : null,
    release_date: typeof releaseDate === "string" && releaseDate.trim() ? releaseDate.trim() : null,
    updated_at: new Date().toISOString(),
  };
}

function buildArtistPayload(artist) {
  return buildEntityCachePayload({
    entityType: "artist",
    entityId: artist.id,
    payload: artist,
    name: artist.name ?? null,
    imageUrl: artist.images?.[0]?.url ?? null,
    subtitle: artist.genres?.slice(0, 2).join(" · ") || "Artista",
    popularity: artist.popularity ?? null,
    releaseDate: null,
  });
}

function buildAlbumPayload(album) {
  return buildEntityCachePayload({
    entityType: "album",
    entityId: album.id,
    payload: album,
    name: album.name ?? null,
    imageUrl: album.images?.[0]?.url ?? null,
    subtitle: `${album.artists?.[0]?.name ?? "Album"}${album.release_date ? ` · ${String(album.release_date).slice(0, 4)}` : ""}`,
    popularity: album.popularity ?? null,
    releaseDate: album.release_date ?? null,
  });
}

async function getDistinctRatedEntityIds(supabase, entityType) {
  const { data, error } = await supabase
    .from("ratings")
    .select("entity_id")
    .eq("entity_type", entityType);

  if (error) {
    throw new Error(`Failed to read ratings for ${entityType}: ${error.message || error.code}`);
  }

  return [...new Set((data ?? []).map((row) => String(row.entity_id)).filter(Boolean))];
}

async function getCachedEntityIds(supabase, entityType) {
  const { data, error } = await supabase
    .from("entity_cache")
    .select("entity_id")
    .eq("entity_type", entityType);

  if (error) {
    throw new Error(`Failed to read entity_cache for ${entityType}: ${error.message || error.code}`);
  }

  return new Set((data ?? []).map((row) => String(row.entity_id)).filter(Boolean));
}

async function upsertEntityCache(supabase, payloads) {
  if (payloads.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("entity_cache")
    .upsert(payloads, { onConflict: "entity_type,entity_id" });

  if (error) {
    throw new Error(`Failed to upsert entity_cache: ${error.message || error.code}`);
  }
}

function chunk(items, size) {
  const batches = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

async function backfillArtists(supabase, token, ids, batchSize, delayMs) {
  const batches = chunk(ids, batchSize);
  let saved = 0;

  for (const [index, batch] of batches.entries()) {
    console.log(`[backfill] artists batch ${index + 1}/${batches.length} (${batch.length} ids)`);

    const data = await spotifyRequest("/artists", token, {
      ids: batch.join(","),
    });

    const payloads = (data.artists ?? []).filter((artist) => artist?.id).map(buildArtistPayload);
    await upsertEntityCache(supabase, payloads);
    saved += payloads.length;

    if (index < batches.length - 1) {
      await delay(delayMs);
    }
  }

  return saved;
}

async function backfillAlbums(supabase, token, ids, batchSize, delayMs) {
  const batches = chunk(ids, batchSize);
  let saved = 0;

  for (const [index, batch] of batches.entries()) {
    console.log(`[backfill] albums batch ${index + 1}/${batches.length} (${batch.length} ids)`);

    const data = await spotifyRequest("/albums", token, {
      ids: batch.join(","),
      market: "US",
    });

    const payloads = (data.albums ?? []).filter((album) => album?.id).map(buildAlbumPayload);
    await upsertEntityCache(supabase, payloads);
    saved += payloads.length;

    if (index < batches.length - 1) {
      await delay(delayMs);
    }
  }

  return saved;
}

async function main() {
  requireEnv("SUPABASE_URL", SUPABASE_URL);
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  requireEnv("SPOTIFY_CLIENT_ID", SPOTIFY_CLIENT_ID);
  requireEnv("SPOTIFY_CLIENT_SECRET", SPOTIFY_CLIENT_SECRET);

  const args = normalizeArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const token = await getAppAccessToken();
  const shouldRunArtists = args.entityType === "all" || args.entityType === "artist";
  const shouldRunAlbums = args.entityType === "all" || args.entityType === "album";

  if (!shouldRunArtists && !shouldRunAlbums) {
    throw new Error('Invalid --type value. Use "artist", "album", or "all".');
  }

  if (shouldRunArtists) {
    const ratedArtistIds = await getDistinctRatedEntityIds(supabase, "artist");
    const cachedArtistIds = await getCachedEntityIds(supabase, "artist");
    const missingArtistIds = ratedArtistIds.filter((entityId) => !cachedArtistIds.has(entityId));
    const artistIdsToFetch = args.limit ? missingArtistIds.slice(0, args.limit) : missingArtistIds;

    console.log(`[backfill] missing artists: ${artistIdsToFetch.length}`);

    if (artistIdsToFetch.length > 0) {
      const savedArtists = await backfillArtists(supabase, token, artistIdsToFetch, args.batchSize, args.delayMs);
      console.log(`[backfill] saved artists: ${savedArtists}`);
    }
  }

  if (shouldRunAlbums) {
    const ratedAlbumIds = await getDistinctRatedEntityIds(supabase, "album");
    const cachedAlbumIds = await getCachedEntityIds(supabase, "album");
    const missingAlbumIds = ratedAlbumIds.filter((entityId) => !cachedAlbumIds.has(entityId));
    const albumIdsToFetch = args.limit ? missingAlbumIds.slice(0, args.limit) : missingAlbumIds;

    console.log(`[backfill] missing albums: ${albumIdsToFetch.length}`);

    if (albumIdsToFetch.length > 0) {
      const savedAlbums = await backfillAlbums(supabase, token, albumIdsToFetch, args.batchSize, args.delayMs);
      console.log(`[backfill] saved albums: ${savedAlbums}`);
    }
  }

  console.log("[backfill] completed");
}

main().catch((error) => {
  if (Number(error?.status) === 429) {
    console.error("[backfill] stopped because Spotify returned 429. Wait and retry later.");
    process.exitCode = 1;
    return;
  }

  console.error("[backfill] failed", error?.message || error);
  process.exitCode = 1;
});
