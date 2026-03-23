import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { getSupabaseClient } from "../lib/supabase";

function AdminTable({ users }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="px-5 py-4 font-semibold text-foreground">Username</th>
              <th className="px-5 py-4 font-semibold text-foreground">Phone</th>
              <th className="px-5 py-4 font-semibold text-foreground">is_admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {users.map((user) => (
              <tr key={user.id} className="transition hover:bg-secondary/30">
                <td className="px-5 py-4 text-foreground">{user.username || "-"}</td>
                <td className="px-5 py-4 text-muted-foreground">{user.phone || "-"}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      user.is_admin ? "bg-emerald-500/12 text-emerald-600" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {user.is_admin ? "true" : "false"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { isLoading, isLoggedIn, currentUser, isCurrentUserLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCurrentUserLoading) {
      return;
    }

    if (!currentUser?.is_admin) {
      setIsFetchingUsers(false);
      return;
    }

    let cancelled = false;

    async function loadUsers() {
      setIsFetchingUsers(true);
      setError("");

      try {
        const supabase = getSupabaseClient();
        const { data, error: usersError } = await supabase.from("users").select("*");

        if (usersError) {
          throw usersError;
        }

        if (!cancelled) {
          setUsers(data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No pudimos cargar los usuarios.");
        }
      } finally {
        if (!cancelled) {
          setIsFetchingUsers(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.is_admin, isCurrentUserLoading]);

  if (isLoading || isCurrentUserLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          Validando acceso al panel...
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !currentUser?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.04),rgba(15,23,42,0.08))] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">Panel de administracion</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Listado simple de usuarios obtenidos desde Supabase.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            {isFetchingUsers ? "Cargando usuarios..." : `${users.length} usuarios`}
          </div>
        </div>

        <div className="mt-8">
          {isFetchingUsers ? (
            <div className="flex min-h-48 items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
              <span className="flex items-center gap-3">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                Consultando usuarios...
              </span>
            </div>
          ) : error ? (
            <div className="rounded-[1.75rem] border border-red-500/20 bg-red-500/6 px-5 py-4 text-sm text-red-200">{error}</div>
          ) : (
            <AdminTable users={users} />
          )}
        </div>
      </section>
    </div>
  );
}
