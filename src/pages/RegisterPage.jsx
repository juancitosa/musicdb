import { Link, Navigate } from "react-router-dom";

import AuthDialog from "../components/shared/AuthDialog";
import { useAuth } from "../hooks/useAuth";

export default function RegisterPage() {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Crear cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crea una cuenta MusicDB con email y contrasena. Spotify queda como opcion adicional.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          Con la cuenta local puedes votar, dejar resenas, usar rankings y explorar toda la app sin depender del limite de usuarios de Spotify.
        </div>

        <AuthDialog
          triggerLabel="Crear cuenta"
          triggerClassName="mt-6 w-full justify-center"
          triggerSize="lg"
          initialMode="register"
        />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ya tienes acceso?{" "}
          <Link to="/login" className="cursor-pointer font-semibold text-primary hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
