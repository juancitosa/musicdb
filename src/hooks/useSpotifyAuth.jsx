import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchSpotifyProfile, syncSpotifyUser } from "../services/appAuth";
import {
  clearSpotifyCodeFromUrl,
  clearStoredSpotifySession,
  exchangeCodeForToken,
  getSpotifyAuthorizationUrl,
  getSpotifyCodeFromUrl,
  getStoredSpotifySession,
  refreshSpotifyToken,
  wakeSpotifyBackend,
} from "../services/spotifyAuth";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

const SpotifyAuthContext = createContext(undefined);

let pendingSessionExchange = null;

function normalizeSpotifyUser(profile) {
  return {
    id: profile.spotify_user_id,
    name: profile.display_name || profile.email || "Spotify User",
    email: profile.email,
    avatar: profile.avatar_url ?? "",
  };
}

function exchangeCodeOnce(code) {
  if (!pendingSessionExchange) {
    pendingSessionExchange = exchangeCodeForToken(code).finally(() => {
      pendingSessionExchange = null;
    });
  }

  return pendingSessionExchange;
}

export function SpotifyAuthProvider({ children }) {
  const { setAuthenticatedUser, clearAuthenticatedUser } = useAuth();
  const { toast } = useToast();
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [session, setSession] = useState(() => getStoredSpotifySession());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const loadSpotifyProfile = useCallback(
    async (accessToken) => {
      const profile = await fetchSpotifyProfile(accessToken);
      const response = await syncSpotifyUser(profile);
      const nextUser = normalizeSpotifyUser(profile);

      setSpotifyUser(nextUser);
      setAuthenticatedUser(response.user);

      return nextUser;
    },
    [setAuthenticatedUser],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);

      try {
        const code = getSpotifyCodeFromUrl();

        if (code) {
          const nextSession = await exchangeCodeOnce(code);
          clearSpotifyCodeFromUrl();

          if (cancelled) return;

          setSession(nextSession);
          await loadSpotifyProfile(nextSession.accessToken);

          if (cancelled) return;

          toast({
            title: "Sesión iniciada",
            description: "Ya puedes rankear artistas y albumes",
          });
          return;
        }

        let storedSession = getStoredSpotifySession();
        if (!storedSession?.accessToken) {
          if (!cancelled) {
            setSession(null);
            setSpotifyUser(null);
            clearAuthenticatedUser();
          }
          return;
        }

        if (Date.now() >= storedSession.expiresAt - 60_000) {
          if (!storedSession.refreshToken) {
            clearStoredSpotifySession();

            if (!cancelled) {
              setSession(null);
              setSpotifyUser(null);
              clearAuthenticatedUser();
            }

            return;
          }

          storedSession = await refreshSpotifyToken(storedSession.refreshToken);
        }

        if (cancelled) return;

        setSession(storedSession);
        await loadSpotifyProfile(storedSession.accessToken);
      } catch (error) {
        if (!cancelled) {
          clearStoredSpotifySession();
          setSession(null);
          setSpotifyUser(null);
          clearAuthenticatedUser();
          clearSpotifyCodeFromUrl();

          if (error?.message === "SPOTIFY_BACKEND_UNAVAILABLE") {
            toast({
              title: "Backend de Spotify no disponible",
              description: "Levantá el backend configurado para completar el inicio de sesión",
              variant: "destructive",
            });
          } else if (error?.message === "APP_BACKEND_UNAVAILABLE") {
            toast({
              title: "Backend de la app no disponible",
              description: "Levantá el backend y verificá la conexión con Supabase",
              variant: "destructive",
            });
          } else if (error?.message === "SPOTIFY_CONFIG_MISSING") {
            toast({
              title: "Spotify no está configurado",
              description: "Completá las credenciales en server/.env y reiniciá el backend",
              variant: "destructive",
            });
          } else if (error?.message === "SUPABASE_CONFIG_MISSING") {
            toast({
              title: "Supabase no está configurado",
              description: "Completá las credenciales en server/.env y reiniciá el backend",
              variant: "destructive",
            });
          } else if (error?.message === "SPOTIFY_TOKEN_EXCHANGE_ERROR") {
            toast({
              title: "Spotify rechazó el inicio de sesión",
              description: "Revisá la redirect URI y las credenciales del backend",
              variant: "destructive",
            });
          } else if (error?.message === "INVALID_SPOTIFY_AUTH_PAYLOAD") {
            toast({
              title: "Perfil de Spotify incompleto",
              description: "No pudimos sincronizar tu cuenta con la base de datos",
              variant: "destructive",
            });
          } else if (error?.message === "SPOTIFY_TOKEN_UNAUTHORIZED" || error?.message === "TOKEN_EXPIRED") {
            toast({
              title: "Sesión de Spotify expirada",
              description: "Volvé a conectar Spotify para seguir usando datos reales",
              variant: "destructive",
            });
          } else {
            toast({
              title: "No se pudo iniciar sesión con Spotify",
              description: "Revisá la configuración del backend y volvé a intentarlo",
              variant: "destructive",
            });
          }
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearAuthenticatedUser, loadSpotifyProfile, toast]);

  const value = useMemo(
    () => ({
      spotifyUser,
      spotifyToken: session?.accessToken ?? null,
      isSpotifyConnected: Boolean(session?.accessToken),
      isLoadingSpotify: isBootstrapping || isConnecting,
      async connectSpotify() {
        if (isConnecting) {
          return;
        }

        setIsConnecting(true);

        try {
          await wakeSpotifyBackend();

          const url = await getSpotifyAuthorizationUrl();
          if (!url) {
            return;
          }

          window.location.href = url;
        } catch (error) {
          if (error?.message === "SPOTIFY_BACKEND_UNAVAILABLE") {
            toast({
              title: "Preparando inicio con Spotify",
              description: "El backend tardó demasiado en despertar. Intentá nuevamente en unos segundos.",
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "No se pudo iniciar sesión con Spotify",
            description: "Revisá la configuración del backend y volvé a intentarlo",
            variant: "destructive",
          });
        } finally {
          setIsConnecting(false);
        }
      },
      disconnectSpotify() {
        clearStoredSpotifySession();
        setSession(null);
        setSpotifyUser(null);
        clearAuthenticatedUser();
        toast({ title: "Sesión cerrada" });
      },
    }),
    [clearAuthenticatedUser, isBootstrapping, isConnecting, session?.accessToken, spotifyUser, toast],
  );

  return <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>;
}

export function useSpotifyAuth() {
  const context = useContext(SpotifyAuthContext);

  if (!context) {
    throw new Error("useSpotifyAuth must be used within SpotifyAuthProvider");
  }

  return context;
}
