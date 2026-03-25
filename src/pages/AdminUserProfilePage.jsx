import { ArrowLeft, LoaderCircle, ShieldAlert, Star, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { getSupabaseClient } from "../lib/supabase";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export default function AdminUserProfilePage() {
  const { userId } = useParams();
  const { isLoading, isLoggedIn, currentUser, isCurrentUserLoading } = useAuth();
  const [userRecord, setUserRecord] = useState(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCurrentUserLoading || !currentUser?.isAdmin || !userId) {
      return;
    }

    let cancelled = false;

    async function loadUser() {
      setIsFetchingUser(true);
      setError("");

      try {
        const supabase = getSupabaseClient();
        const { data, error: userError } = await supabase.from("users").select("*").eq("id", userId).single();

        if (userError) {
          throw userError;
        }

        if (!cancelled) {
          setUserRecord(data ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No pudimos cargar el perfil del usuario.");
        }
      } finally {
        if (!cancelled) {
          setIsFetchingUser(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.isAdmin, isCurrentUserLoading, userId]);

  if (isLoading || isCurrentUserLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          Validando acceso...
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
        <Link
          to={`/admin/users/${userId}/rankings`}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
        >
          Ver rankings
        </Link>
      </div>

      <section className="rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.04),rgba(15,23,42,0.08))] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
          <ShieldAlert className="h-3.5 w-3.5" />
          Perfil de usuario
        </div>

        {isFetchingUser ? (
          <div className="mt-8 flex min-h-48 items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
            <span className="flex items-center gap-3">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Cargando perfil...
            </span>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-red-500/20 bg-red-500/6 px-5 py-4 text-sm text-red-200">{error}</div>
        ) : !userRecord ? (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-border bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
            No encontramos el usuario.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-[1.75rem] border border-border bg-card/80 p-6">
              {userRecord.avatar_url ? (
                <img src={userRecord.avatar_url} alt={userRecord.username || "Usuario"} className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                  <UserRound className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <h1 className="mt-5 text-3xl font-black text-foreground">{userRecord.username || "Sin username"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{userRecord.email || "Sin email"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {userRecord.is_pro ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                    PRO <Star className="h-3.5 w-3.5 fill-current" />
                  </span>
                ) : null}
                {userRecord.is_admin ? (
                  <span className="inline-flex rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Admin
                  </span>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-border bg-card/80 p-6">
              <h2 className="text-xl font-bold text-foreground">Datos de la cuenta</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Username</p>
                  <p className="mt-2 text-sm text-foreground">{userRecord.username || "-"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                  <p className="mt-2 text-sm text-foreground">{userRecord.email || "-"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telefono</p>
                  <p className="mt-2 text-sm text-foreground">{userRecord.phone ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Registro</p>
                  <p className="mt-2 text-sm text-foreground">{formatDateTime(userRecord.created_at)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Membresia</p>
                  <p className="mt-2 text-sm text-foreground">{userRecord.is_pro ? "MusicDB PRO" : "Cuenta estandar"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rol</p>
                  <p className="mt-2 text-sm text-foreground">{userRecord.is_admin ? "Administrador" : "Usuario"}</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
