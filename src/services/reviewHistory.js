async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createReview({ session_token, entity_type, entity_id, review_text, rating_value }) {
  if (!session_token) {
    throw new Error("Tenes que iniciar sesion");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session_token}`,
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

  return {
    review: data?.review ?? null,
    usage: data?.usage ?? null,
  };
}

export async function getReviews(entity_type, entity_id) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/reviews/${encodeURIComponent(entity_type)}/${encodeURIComponent(entity_id)}`);
  } catch {
    throw new Error("REVIEWS_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "REVIEWS_FETCH_ERROR");
  }

  return Array.isArray(data?.reviews)
    ? data.reviews.map((review) => ({
        ...review,
        is_pro: Boolean(review?.is_pro),
      }))
    : [];
}

export async function deleteReview(review_id, session_token) {
  if (!session_token) {
    throw new Error("Tenes que iniciar sesion");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/reviews/${encodeURIComponent(review_id)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session_token}`,
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

export async function fetchPublicUserPreview(user_id) {
  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/users/${encodeURIComponent(user_id)}/preview`);
  } catch {
    throw new Error("USER_PREVIEW_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "USER_PREVIEW_FETCH_ERROR");
  }

  return data?.user ?? null;
}
