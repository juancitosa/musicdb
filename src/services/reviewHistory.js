const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createReview({ spotify_token, entity_type, entity_id, review_text, rating_value }) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spotify_token}`,
      },
      body: JSON.stringify({
        entity_type,
        entity_id,
        review_text,
        rating_value,
      }),
    });
  } catch {
    throw new Error("REVIEWS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "REVIEW_CREATE_ERROR");
  }

  return data?.review ?? null;
}

export async function getReviews(entity_type, entity_id) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(entity_type)}/${encodeURIComponent(entity_id)}`);
  } catch {
    throw new Error("REVIEWS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "REVIEWS_FETCH_ERROR");
  }

  return Array.isArray(data?.reviews) ? data.reviews : [];
}

export async function deleteReview(review_id, spotify_token) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(review_id)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spotify_token}`,
      },
    });
  } catch {
    throw new Error("REVIEWS_BACKEND_UNAVAILABLE");
  }

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    throw new Error(data?.error?.code || "REVIEW_DELETE_ERROR");
  }

  return true;
}
