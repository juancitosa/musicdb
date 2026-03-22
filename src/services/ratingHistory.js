const API = import.meta.env.VITE_API_URL;

export const DEFAULT_RATINGS_SUMMARY = {
  average_rating: 0,
  ratings_count: 0,
};

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function submitRating({ spotify_token, entity_type, entity_id, rating_value }) {
  let response;

  try {
    response = await fetch(`${API}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spotify_token}`,
      },
      body: JSON.stringify({
        entity_type,
        entity_id,
        rating_value,
      }),
    });
  } catch {
    throw new Error("RATINGS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "RATINGS_SUBMIT_ERROR");
  }

  return data;
}

export async function getRatings(entity_type, entity_id) {
  let response;

  try {
    response = await fetch(`${API}/ratings/${encodeURIComponent(entity_type)}/${encodeURIComponent(entity_id)}`);
  } catch {
    throw new Error("RATINGS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "RATINGS_FETCH_ERROR");
  }

  return {
    average_rating: Number(data?.average_rating ?? 0),
    ratings_count: Number(data?.ratings_count ?? 0),
  };
}

export async function getUserRating(spotify_token, entity_type, entity_id) {
  let response;

  try {
    response = await fetch(`${API}/ratings/me/${encodeURIComponent(entity_type)}/${encodeURIComponent(entity_id)}`, {
      headers: {
        Authorization: `Bearer ${spotify_token}`,
      },
    });
  } catch {
    throw new Error("RATINGS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "USER_RATING_FETCH_ERROR");
  }

  return {
    rating_value: data?.rating_value === null || data?.rating_value === undefined ? null : Number(data.rating_value),
  };
}

export async function getRankings(entity_type) {
  let response;

  try {
    response = await fetch(`${API}/rankings/${encodeURIComponent(entity_type)}`);
  } catch {
    throw new Error("RATINGS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "RANKINGS_FETCH_ERROR");
  }

  return Array.isArray(data)
    ? data.map((entry) => ({
        entity_id: String(entry.entity_id),
        average_rating: Number(entry.average_rating ?? 0),
        ratings_count: Number(entry.ratings_count ?? 0),
      }))
    : [];
}
