import { Database, UserRound } from "lucide-react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";

export default function ProfilePage() {
  const { isLoggedIn, user } = useAuth();
  const { isSpotifyConnected, isLoadingSpotify, spotifyUser } = useSpotifyAuth();
  const profileUser = spotifyUser ?? user;
  const canViewProfile = isLoggedIn || isSpotifyConnected;

  if (isLoadingSpotify && !profileUser) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 animate-pulse rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-24 w-24 rounded-full bg-secondary" />
            <div className="space-y-3">
              <div className="h-4 w-28 rounded bg-secondary" />
              <div className="h-10 w-56 rounded bg-secondary" />
              <div className="h-4 w-44 rounded bg-secondary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewProfile) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
            {profileUser?.avatar ? (
              <img src={profileUser.avatar} alt={profileUser.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              <UserRound className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-primary">
              {spotifyUser ? "Perfil de Spotify" : "Perfil de usuario"}
            </p>
            <h1 className="text-4xl font-bold">{profileUser?.name}</h1>
            <p className="mt-1 text-muted-foreground">{profileUser?.email || "Sin email visible"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Estado de sesion</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="font-semibold">Estado de cuenta:</span> {isSpotifyConnected ? "Verificada" : "Sin verificar"}
            </p>
            <p>
              <span className="font-semibold">Spotify:</span> {isSpotifyConnected ? `Conectado como ${spotifyUser?.name ?? "usuario"}` : "No conectado"}
            </p>
            <p>
              <span className="font-semibold">User ID:</span> {user?.id ?? "No disponible"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Ratings sincronizados</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tus votos de artistas y álbumes ahora se guardan en el backend real mediante `/api/ratings`.
                El historial y los rankings locales fueron retirados para no mezclar datos temporales con datos persistidos.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
