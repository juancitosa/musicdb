import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchAuthenticatedUser, fetchSupabaseProfile } from "../services/appAuth";

const SESSION_KEY = "musicdb_app_session";

const AuthContext = createContext(undefined);

function readStoredSession() {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const authProvider = user.auth_provider ?? user.authProvider ?? "local";
  const username = user.username ?? "";
  const resolvedDisplayName =
    authProvider === "local"
      ? username || user.display_name || user.displayName || user.name || "MusicDB User"
      : user.display_name || user.displayName || user.username || user.name || "MusicDB User";

  return {
    id: user.id,
    email: user.email ?? "",
    username,
    phone: user.phone ?? "",
    displayName: resolvedDisplayName,
    authProvider,
    avatar: user.avatar_url ?? user.avatar ?? "",
    banner: user.banner_url ?? user.banner ?? "",
    name: resolvedDisplayName,
    isVerified: Boolean(user.is_verified ?? user.isVerified ?? authProvider === "spotify"),
    verifiedAt: user.verified_at ?? user.verifiedAt ?? null,
    isAdmin: Boolean(user.is_admin ?? user.isAdmin),
    isPro: Boolean(user.is_pro ?? user.isPro),
    proUntil: user.pro_until ?? user.proUntil ?? null,
  };
}

function mergeProfileIntoUser(user, profile) {
  if (!user || !profile) {
    return user;
  }

  const username = user.username?.trim() || profile.username || "";
  const phone = user.phone?.trim() || profile.phone || "";
  const avatar = user.avatar?.trim() || profile.avatar_url || "";
  const banner = user.banner?.trim() || profile.banner_url || "";
  const displayName = username || user.displayName || user.name || "MusicDB User";

  return normalizeUser({
    ...user,
    username,
    phone,
    is_admin: profile.is_admin ?? user.isAdmin,
    avatar_url: avatar,
    avatar,
    banner_url: banner,
    banner,
    display_name: displayName,
    displayName,
    name: displayName,
  });
}

function mergeBackendStatusIntoLocalUser(localUser, backendUser) {
  if (!localUser) {
    return null;
  }

  if (!backendUser) {
    return normalizeUser(localUser);
  }

  return normalizeUser({
    ...localUser,
    email: backendUser.email ?? localUser.email,
    username: backendUser.username ?? localUser.username,
    phone: backendUser.phone ?? localUser.phone,
    display_name: backendUser.display_name ?? localUser.displayName ?? localUser.name,
    avatar_url: backendUser.avatar_url ?? localUser.avatar,
    banner_url: backendUser.banner_url ?? localUser.banner,
    is_admin: backendUser.is_admin ?? localUser.isAdmin,
    is_pro: backendUser.is_pro ?? localUser.isPro,
    pro_until: backendUser.pro_until ?? localUser.proUntil,
    is_verified: backendUser.is_verified ?? localUser.isVerified,
    verified_at: backendUser.verified_at ?? localUser.verifiedAt,
    auth_provider: "local",
  });
}

function normalizeSession(session) {
  if (!session?.user || !session?.token) {
    return null;
  }

  const user = normalizeUser(session.user);

  if (!user) {
    return null;
  }

  return {
    user,
    token: session.token,
  };
}

function persistSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: session.token,
      user: session.user
        ? {
            id: session.user.id,
            email: session.user.email,
            username: session.user.username,
            phone: session.user.phone,
            display_name: session.user.displayName,
            auth_provider: session.user.authProvider,
            avatar_url: session.user.avatar,
            banner_url: session.user.banner,
            is_admin: session.user.isAdmin,
            is_verified: session.user.isVerified,
            verified_at: session.user.verifiedAt,
            name: session.user.name,
          }
        : null,
    }),
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [appToken, setAppToken] = useState(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentUserLoading, setIsCurrentUserLoading] = useState(true);

  useEffect(() => {
    const session = normalizeSession(readStoredSession());

    setUser(session?.user ?? null);
    setAppToken(session?.token ?? null);

    let cancelled = false;

    async function hydrateUserFromBackend() {
      if (!session?.token) {
        if (!cancelled) {
          setHasActiveSession(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        let normalizedUser = null;

        try {
          const backendUser = await fetchAuthenticatedUser(session.token);
          normalizedUser = backendUser ? normalizeUser(backendUser) : normalizeUser(session.user);
        } catch {
          const backendUser = await fetchAuthenticatedUser(session.token).catch(() => null);
          normalizedUser = backendUser ? normalizeUser(backendUser) : normalizeUser(session.user);
        }

        if (!cancelled && normalizedUser) {
          setUser(normalizedUser);
          setAppToken(session.token);
          setHasActiveSession(true);
          persistSession({
            token: session.token,
            user: normalizedUser,
          });
        }
      } catch {
        if (!cancelled && session.user) {
          setUser(session.user);
          setAppToken(session.token);
          setHasActiveSession(true);
          setIsLoading(false);
          return;
        }

        if (!cancelled) {
          setUser(null);
          setCurrentUser(null);
          setAppToken(null);
          setHasActiveSession(false);
          persistSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrateUserFromBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLocalProfile() {
      if (!appToken || user?.authProvider !== "local" || !user?.id) {
        return;
      }

      try {
        const profile = await fetchSupabaseProfile(user.id);

        if (cancelled || !profile) {
          return;
        }

        const mergedUser = mergeProfileIntoUser(user, profile);

        if (
          mergedUser?.username === user.username &&
          mergedUser?.phone === user.phone &&
          mergedUser?.avatar === user.avatar &&
          mergedUser?.banner === user.banner &&
          mergedUser?.displayName === user.displayName &&
          mergedUser?.isAdmin === user.isAdmin
        ) {
          return;
        }

        setUser(mergedUser);
        persistSession({
          token: appToken,
          user: mergedUser,
        });
      } catch {
        // Keep current session state if profiles cannot be read.
      }
    }

    hydrateLocalProfile();

    return () => {
      cancelled = true;
    };
  }, [appToken, user]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCurrentUser() {
      if (!user?.email) {
        if (!cancelled) {
          setCurrentUser(null);
          setIsCurrentUserLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setIsCurrentUserLoading(true);
      }

      try {
        const nextCurrentUser = await fetchAuthenticatedUser(appToken);

        if (!cancelled) {
          setCurrentUser(normalizeUser(nextCurrentUser));
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsCurrentUserLoading(false);
        }
      }
    }

    hydrateCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [appToken, user?.email]);

  const setAuthenticatedSession = useCallback((session) => {
    const normalizedSession = normalizeSession(session);
    setUser(normalizedSession?.user ?? null);
    setAppToken(normalizedSession?.token ?? null);
    setHasActiveSession(Boolean(normalizedSession?.user && normalizedSession?.token));
    persistSession(normalizedSession);
    return normalizedSession?.user ?? null;
  }, []);

  const setAuthenticatedUser = useCallback(
    (nextUser) => {
      const normalizedUser = normalizeUser(nextUser);

      if (!normalizedUser || !appToken) {
        return null;
      }

      const nextSession = {
        user: normalizedUser,
        token: appToken,
      };

      setUser(normalizedUser);
      persistSession(nextSession);
      return normalizedUser;
    },
    [appToken],
  );

  const clearAuthenticatedUser = useCallback(() => {
    setUser(null);
    setCurrentUser(null);
    setAppToken(null);
    setHasActiveSession(false);
    setIsCurrentUserLoading(false);
    persistSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      currentUser: currentUser ?? user,
      appToken,
      hasActiveSession,
      isLoading,
      isCurrentUserLoading,
      isLoggedIn: Boolean(user && hasActiveSession),
      isSpotifyUser: user?.authProvider === "spotify",
      isLocalUser: user?.authProvider === "local",
      setAuthenticatedSession,
      setAuthenticatedUser,
      clearAuthenticatedUser,
    }),
    [appToken, clearAuthenticatedUser, currentUser, hasActiveSession, isCurrentUserLoading, isLoading, setAuthenticatedSession, setAuthenticatedUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
