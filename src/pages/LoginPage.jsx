import { Link, Navigate, useLocation } from "react-router-dom";

import AuthDialog from "../components/shared/AuthDialog";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const shouldAutoOpen = Boolean(location.state?.openAuthDialog);

  if (isLoggedIn) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Iniciar sesion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entra con tu cuenta MusicDB y conecta Spotify solo si quieres funciones extra.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          La app ya no depende de Spotify para votar, crear resenas, usar rankings, navegar ni buscar.
        </div>

        <AuthDialog triggerLabel="Iniciar sesion" triggerClassName="mt-6 w-full justify-center" triggerSize="lg" autoOpen={shouldAutoOpen} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Necesitas una cuenta?{" "}
          <Link to="/register" className="cursor-pointer font-semibold text-primary hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
