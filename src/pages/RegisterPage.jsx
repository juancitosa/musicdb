import { Link, Navigate } from "react-router-dom";

import SpotifyConnectButton from "../components/shared/SpotifyConnectButton";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";

export default function RegisterPage() {
  const { isLoggedIn } = useAuth();
  const { connectSpotify, isLoadingSpotify, isSpotifyConnected } = useSpotifyAuth();

  if (isLoggedIn || isSpotifyConnected) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Crear cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La cuenta se crea automaticamente con tu perfil de Spotify en Supabase.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          Usamos tu `display_name`, email y avatar de Spotify para crear o recuperar tu usuario.
        </div>

        <SpotifyConnectButton onClick={connectSpotify} disabled={isLoadingSpotify} size="lg" className="mt-6 w-full justify-center">
          {isLoadingSpotify ? "Conectando..." : "Crear cuenta con Spotify"}
        </SpotifyConnectButton>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ya tenes acceso?{" "}
          <Link to="/login" className="cursor-pointer font-semibold text-primary hover:underline">
            Entra con Spotify
          </Link>
        </p>
      </div>
    </div>
  );
}
