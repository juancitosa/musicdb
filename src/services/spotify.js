import { clearStoredSpotifySession } from "./spotifyAuth";

const ENTITY_REQUEST_DELAY_MS = 400;
let entityRequestQueue = Promise.resolve();

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function enqueueEntityRequest(task) {
  const nextRequest = entityRequestQueue.then(async () => {
    try {
      return await task();
    } finally {
      await delay(ENTITY_REQUEST_DELAY_MS);
    }
  });

  entityRequestQueue = nextRequest.catch(() => undefined);
  return nextRequest;
}

async function apiFetch(path, { token, query } = {}) {
  const url = new URL(`${import.meta.env.VITE_API_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401 && token) {
    clearStoredSpotifySession();
    throw new Error("TOKEN_EXPIRED");
  }

  if (response.status === 403 && token) {
    throw new Error("SPOTIFY_FORBIDDEN");
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getImageUrl(images, fallback = "") {
  return images?.[0]?.url ?? fallback;
}

function getReleaseYear(album) {
  return Number.parseInt(album?.release_date?.slice(0, 4) ?? "", 10);
}

function sortAlbumsByNewest(left, right) {
  const leftDate = Date.parse(left?.release_date ?? "") || 0;
  const rightDate = Date.parse(right?.release_date ?? "") || 0;

  if (rightDate !== leftDate) {
    return rightDate - leftDate;
  }

  return (left?.name ?? "").localeCompare(right?.name ?? "");
}

export function formatTrackDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function searchSpotify(query, _token, limit = 20) {
  return apiFetch("/search", {
    query: {
      q: query,
      limit,
    },
  });
}

export async function searchArtists(query, _token, limit = 20) {
  const result = await apiFetch("/search/artists", {
    query: {
      q: query,
      limit,
    },
  });
  return result.artists?.items ?? [];
}

export async function searchAlbums(query, _token, limit = 20) {
  const result = await apiFetch("/search/albums", {
    query: {
      q: query,
      limit,
    },
  });
  return result.albums?.items ?? [];
}

export async function searchPlaylists(query, _token, limit = 20) {
  const result = await apiFetch("/search/playlists", {
    query: {
      q: query,
      limit,
    },
  });
  return result.playlists?.items ?? [];
}

export function getCurrentUser(token) {
  return apiFetch("/me", { token });
}

export function getTopArtists(token, limit = 10, timeRange = "medium_term") {
  return apiFetch("/top-artists", {
    token,
    query: {
      limit,
      time_range: timeRange,
    },
  });
}

export function getTopTracks(token, limit = 10, timeRange = "medium_term") {
  return apiFetch("/me/top-tracks", {
    token,
    query: {
      limit,
      time_range: timeRange,
    },
  });
}

export async function getTopAlbums(token, limit = 10, trackLimit = 50, timeRange = "medium_term") {
  const response = await apiFetch("/top-albums", {
    token,
    query: {
      limit,
      track_limit: trackLimit,
      time_range: timeRange,
    },
  });

  return response.items ?? [];
}

export async function getCurrentlyPlayingTrack(token) {
  try {
    return await apiFetch("/me/player/currently-playing", { token });
  } catch (error) {
    if (
      error?.message === "SPOTIFY_EMPTY_RESPONSE" ||
      error?.message === "Spotify API error: 204" ||
      error?.message === "SPOTIFY_FORBIDDEN"
    ) {
      return null;
    }

    throw error;
  }
}

export function getNewReleases(_token, limit = 12) {
  return apiFetch("/new-releases", {
    query: {
      limit,
      country: "US",
    },
  });
}

export function getArtist(artistId) {
  return enqueueEntityRequest(() => apiFetch(`/artist/${artistId}`));
}

export const getArtistById = getArtist;

export function getArtistAlbums(artistId) {
  return apiFetch(`/artist/${artistId}/albums`, {
    query: {
      include_groups: "album,single,compilation",
      limit: 50,
      market: "US",
    },
  });
}

export function getArtistAlbumsByGroups(artistId, includeGroups = "album,single,compilation") {
  return apiFetch(`/artist/${artistId}/albums`, {
    query: {
      include_groups: includeGroups,
      limit: 50,
      market: "US",
    },
  });
}

export function getAlbum(albumId) {
  return enqueueEntityRequest(() =>
    apiFetch(`/album/${albumId}`, {
      query: {
        market: "US",
      },
    }),
  );
}

export const getAlbumById = getAlbum;

export function getLikedTracksByArtist(token, artistId) {
  return apiFetch(`/me/liked-tracks/by-artist/${artistId}`, {
    token,
    query: {
      limit: 50,
      market: "US",
    },
  });
}

export function getPlaylistTracks(playlistId, limit = 50) {
  return apiFetch(`/playlists/${playlistId}/tracks`, {
    query: {
      limit,
      market: "US",
    },
  });
}

function shuffleArray(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
}

const FEATURED_ARTIST_GENRES = [
  "pop",
  "latin",
  "hip hop",
  "rock",
  "reggaeton",
  "electronic",
];

export async function getFeaturedArtists(_token, maxPoolSize = 50, minPopularity = 80) {
  const seededArtists = await Promise.all(
    FEATURED_ARTIST_GENRES.map((genre) => searchArtists(genre, null, 10)),
  );

  const uniqueArtists = new Map();
  seededArtists.flat().forEach((artist) => {
    if ((artist.popularity ?? 0) >= minPopularity && !uniqueArtists.has(artist.id)) {
      uniqueArtists.set(artist.id, artist);
    }
  });

  return shuffleArray(Array.from(uniqueArtists.values())).slice(0, Math.min(maxPoolSize, 50));
}

export async function getDiscoverArtists(_token, limit = 30, minPopularity = 50) {
  const artists = await getFeaturedArtists(null, Math.max(limit, 40), minPopularity);
  return artists.slice(0, Math.min(limit, 30));
}

export async function getFeaturedNewReleases(_token, maxPoolSize = 50) {
  const limit = Math.min(maxPoolSize, 50);
  const minimumYear = 2026;
  const [newReleasesResponse, searchedAlbums] = await Promise.all([
    getNewReleases(null, limit),
    searchAlbums(`year:${minimumYear}`, null, limit),
  ]);

  const uniqueAlbums = new Map();

  [...(newReleasesResponse.albums?.items ?? []), ...(searchedAlbums ?? [])].forEach((album) => {
    const releaseYear = getReleaseYear(album);

    if (!album?.id || album.album_type !== "album" || !Number.isFinite(releaseYear) || releaseYear < minimumYear || uniqueAlbums.has(album.id)) {
      return;
    }

    uniqueAlbums.set(album.id, album);
  });

  return Array.from(uniqueAlbums.values()).sort(sortAlbumsByNewest).slice(0, limit);
}

export async function getTopAlbumsFromTopTracks(token, maxAlbums = 30, trackLimit = 50, timeRange = "medium_term") {
  return getTopAlbums(token, maxAlbums, trackLimit, timeRange);
}

export async function getGlobalTrendingTracks(limit = 10) {
  const response = await apiFetch("/trending/global", {
    query: {
      limit: Math.min(limit, 50),
    },
  });

  return response.tracks ?? [];
}
