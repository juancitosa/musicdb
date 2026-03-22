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
    displayName: user.display_name ?? user.displayName ?? user.username ?? "Spotify User",
    authProvider: user.auth_provider ?? user.authProvider ?? "spotify",
    avatar: user.avatar_url ?? user.avatar ?? "",
    name: user.display_name ?? user.displayName ?? user.username ?? "Spotify User",
  };
}

function persistSession(user) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(normalizeUser(readStoredSession()));
    setIsLoading(false);
  }, []);

  const setAuthenticatedUser = useCallback((nextUser) => {
    const normalizedUser = normalizeUser(nextUser);
    setUser(normalizedUser);
    persistSession(normalizedUser);
    return normalizedUser;
  }, []);

  const clearAuthenticatedUser = useCallback(() => {
    setUser(null);
    persistSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isLoggedIn: Boolean(user),
      setAuthenticatedUser,
      clearAuthenticatedUser,
    }),
    [clearAuthenticatedUser, isLoading, setAuthenticatedUser, user],
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
