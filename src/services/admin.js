async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function serializeLocalDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export async function fetchAdminUsers(sessionToken, { page = 0, pageSize = 30, search = "", fromDate = "", toDate = "", proStatus = "all", sortOrder = "desc" } = {}) {
  if (!sessionToken) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    pro_status: proStatus,
    sort_order: sortOrder,
  });

  if (search) {
    params.set("search", search);
  }

  if (fromDate) {
    params.set("from_date", serializeLocalDateTime(fromDate));
  }

  if (toDate) {
    params.set("to_date", serializeLocalDateTime(toDate));
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/admin/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  } catch {
    throw new Error("ADMIN_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "ADMIN_USERS_FETCH_ERROR");
  }

  return {
    users: Array.isArray(data?.users) ? data.users : [],
    hasNextPage: Boolean(data?.has_next_page),
  };
}

export async function deleteAdminUser(userId, sessionToken) {
  if (!sessionToken) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  } catch {
    throw new Error("ADMIN_BACKEND_UNAVAILABLE");
  }

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    throw new Error(data?.error?.code || "ADMIN_USER_DELETE_ERROR");
  }
}

export async function fetchAdminUserProfile(userId, sessionToken) {
  if (!sessionToken) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${encodeURIComponent(userId)}/profile`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  } catch {
    throw new Error("ADMIN_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "ADMIN_USER_PROFILE_FETCH_ERROR");
  }

  return data?.user ?? null;
}

export async function fetchAdminUserRankings(userId, sessionToken) {
  if (!sessionToken) {
    throw new Error("APP_AUTH_REQUIRED");
  }

  let response;

  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${encodeURIComponent(userId)}/rankings`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  } catch {
    throw new Error("ADMIN_BACKEND_UNAVAILABLE");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.error?.code || "ADMIN_USER_RANKINGS_FETCH_ERROR");
  }

  return {
    user: data?.user ?? null,
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
}
