import { Link } from "react-router-dom";

import SpotifyConnectButton from "../components/shared/SpotifyConnectButton";
import { useAuth } from "../hooks/useAuth";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";

export default function LoginPage() {
  const { user } = useAuth();
  const { connectSpotify, isLoadingSpotify, isSpotifyConnected, spotifyUser } = useSpotifyAuth();
  const connectedName = spotifyUser?.name ?? user?.name ?? "tu cuenta actual";

  return (
    <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Iniciar sesion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entra solo con Spotify. No usamos password ni login manual.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          Cuando Spotify te autentica, traemos tu perfil y lo sincronizamos con Supabase automaticamente.
        </div>

        {isSpotifyConnected ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/8 p-4 text-sm text-muted-foreground">
            Ya hay una cuenta conectada como <span className="font-semibold text-foreground">{connectedName}</span>. Si queres cambiarla, al volver a iniciar sesion Spotify te va a pedir elegir o reconectar otra cuenta.
          </div>
        ) : null}

        <SpotifyConnectButton onClick={() => connectSpotify({ forcePrompt: true })} disabled={isLoadingSpotify} size="lg" className="mt-6 w-full justify-center">
          {isLoadingSpotify ? "Conectando..." : isSpotifyConnected ? "Reconectar con Spotify" : "Entrar con Spotify"}
        </SpotifyConnectButton>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Necesitas una cuenta?{" "}
          <Link to="/register" className="cursor-pointer font-semibold text-primary hover:underline">
            Usa Spotify
          </Link>
        </p>
      </div>
    </div>
  );
}
