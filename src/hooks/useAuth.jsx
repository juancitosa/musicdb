import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

  return {
    id: user.id,
    email: user.email ?? "",
    username: user.username ?? "",
    phone: user.phone ?? "",
    displayName: user.display_name ?? user.displayName ?? user.username ?? "MusicDB User",
    authProvider: user.auth_provider ?? user.authProvider ?? "local",
    avatar: user.avatar_url ?? user.avatar ?? "",
    name: user.display_name ?? user.displayName ?? user.username ?? "MusicDB User",
  };
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

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [appToken, setAppToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = normalizeSession(readStoredSession());
    setUser(session?.user ?? null);
    setAppToken(session?.token ?? null);
    setIsLoading(false);
  }, []);

  const setAuthenticatedSession = useCallback((session) => {
    const normalizedSession = normalizeSession(session);
    setUser(normalizedSession?.user ?? null);
    setAppToken(normalizedSession?.token ?? null);
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
    setAppToken(null);
    persistSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      appToken,
      isLoading,
      isLoggedIn: Boolean(user),
      isSpotifyUser: user?.authProvider === "spotify",
      isLocalUser: user?.authProvider === "local",
      setAuthenticatedSession,
      setAuthenticatedUser,
      clearAuthenticatedUser,
    }),
    [appToken, clearAuthenticatedUser, isLoading, setAuthenticatedSession, setAuthenticatedUser, user],
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
