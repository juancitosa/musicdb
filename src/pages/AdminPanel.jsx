import { BarChart3, ChevronDown, LoaderCircle, Search, ShieldAlert, Star, Trash2, UserRound } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { getSupabaseClient } from "../lib/supabase";

const PAGE_SIZE = 30;

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildSearchFilter(searchTerm) {
  const value = searchTerm.trim();

  if (!value) {
    return null;
  }

  const escapedValue = value.replaceAll(",", "\\,");

  return `username.ilike.%${escapedValue}%,email.ilike.%${escapedValue}%`;
}

function FiltersBar({
  filters,
  onChange,
  onApply,
  onReset,
  hasPreviousPage,
  hasNextPage,
  isFetchingUsers,
  onPreviousPage,
  onNextPage,
  usersCount,
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 shadow-lg shadow-black/10">
      <div className="grid gap-4 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Desde</span>
          <input
            type="datetime-local"
            value={filters.fromDate}
            onChange={(event) => onChange("fromDate", event.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hasta</span>
          <input
            type="datetime-local"
            value={filters.toDate}
            onChange={(event) => onChange("toDate", event.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">PRO</span>
          <select
            value={filters.proStatus}
            onChange={(event) => onChange("proStatus", event.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="all">Todos</option>
            <option value="pro">Solo PRO</option>
            <option value="free">Solo no PRO</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Orden</span>
          <select
            value={filters.sortOrder}
            onChange={(event) => onChange("sortOrder", event.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="desc">Mas recientes</option>
            <option value="asc">Mas antiguos</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters.search}
            onChange={(event) => onChange("search", event.target.value)}
            placeholder="Buscar usuario o email"
            className="w-full rounded-2xl border border-border bg-background py-3 pr-4 pl-10 text-sm outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={isFetchingUsers}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={isFetchingUsers}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpiar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Mostrando {usersCount} de {PAGE_SIZE}
          </span>
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={!hasPreviousPage || isFetchingUsers}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNextPage || isFetchingUsers}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersTable({ users, openUserId, onToggleUser, onViewProfile, onViewRankings, onDeleteUser, isDeletingUserId }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="px-5 py-4 font-semibold text-foreground">Usuario</th>
              <th className="px-5 py-4 font-semibold text-foreground">Email</th>
              <th className="px-5 py-4 font-semibold text-foreground">Telefono</th>
              <th className="px-5 py-4 font-semibold text-foreground">Registro</th>
              <th className="px-5 py-4 text-center font-semibold text-foreground">PRO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {users.map((user) => {
              const isOpen = openUserId === user.id;
              const isDeleting = isDeletingUserId === user.id;

              return (
                <Fragment key={user.id}>
                  <tr
                    onClick={() => onToggleUser(user.id)}
                    className={`cursor-pointer transition hover:bg-secondary/30 ${isOpen ? "bg-secondary/20" : ""}`}
                  >
                    <td className="px-5 py-4 font-medium text-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>{user.username || "-"}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{user.email || "-"}</td>
                    <td className="px-5 py-4 text-muted-foreground">{user.phone ?? "-"}</td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDateTime(user.created_at)}</td>
                    <td className="px-5 py-4 text-center">
                      {user.is_pro ? <Star className="mx-auto h-4 w-4 fill-[#facc15] text-[#facc15]" /> : <span className="inline-block h-4 w-4" />}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-background/70">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="rounded-2xl border border-border bg-background/80 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => onViewProfile(user.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
                            >
                              <UserRound className="h-4 w-4 text-primary" />
                              Ver perfil
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewRankings(user.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
                            >
                              <BarChart3 className="h-4 w-4 text-primary" />
                              Ver rankings
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteUser(user)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/8 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Eliminar usuario
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, isDeleting, onCancel, onConfirm }) {
  if (!user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[2rem] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200">
          <Trash2 className="h-3.5 w-3.5" />
          Confirmar eliminacion
        </div>
        <h2 className="mt-4 text-2xl font-black text-foreground">Eliminar usuario</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Vas a eliminar a <span className="font-semibold text-foreground">{user.username || user.email || "este usuario"}</span> de la tabla `users`.
          Esta accion no se puede deshacer.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-full border border-white/10 bg-white/6 px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-full border border-red-500/80 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-100 shadow-[0_0_28px_rgba(239,68,68,0.45)] transition hover:bg-red-500/16 hover:shadow-[0_0_36px_rgba(239,68,68,0.62)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Eliminando...
              </span>
            ) : (
              "Eliminar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, isLoggedIn, currentUser, isCurrentUserLoading } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
    proStatus: "all",
    sortOrder: "desc",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
    proStatus: "all",
    sortOrder: "desc",
  });
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [error, setError] = useState("");
  const [openUserId, setOpenUserId] = useState(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);

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
        let query = supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: appliedFilters.sortOrder === "asc" })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        const searchFilter = buildSearchFilter(appliedFilters.search);

        if (searchFilter) {
          query = query.or(searchFilter);
        }

        if (appliedFilters.fromDate) {
          query = query.gte("created_at", new Date(appliedFilters.fromDate).toISOString());
        }

        if (appliedFilters.toDate) {
          query = query.lte("created_at", new Date(appliedFilters.toDate).toISOString());
        }

        if (appliedFilters.proStatus === "pro") {
          query = query.eq("is_pro", true);
        }

        if (appliedFilters.proStatus === "free") {
          query = query.eq("is_pro", false);
        }

        const { data, error: usersError } = await query;

        if (usersError) {
          throw usersError;
        }

        if (!cancelled) {
          const nextUsers = data ?? [];
          setUsers(nextUsers.slice(0, PAGE_SIZE));
          setHasNextPage(nextUsers.length > PAGE_SIZE);
          setOpenUserId((current) => (nextUsers.some((entry) => entry.id === current) ? current : null));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No pudimos cargar los usuarios.");
          setUsers([]);
          setHasNextPage(false);
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
  }, [appliedFilters, currentUser?.is_admin, isCurrentUserLoading, page]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    setPage(0);
    setOpenUserId(null);
    setAppliedFilters(filters);
  }

  function resetFilters() {
    const nextFilters = {
      search: "",
      fromDate: "",
      toDate: "",
      proStatus: "all",
      sortOrder: "desc",
    };

    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(0);
    setOpenUserId(null);
  }

  function handleDeleteRequest(user) {
    setPendingDeleteUser(user);
  }

  async function confirmDeleteUser() {
    if (!pendingDeleteUser) {
      return;
    }

    setIsDeletingUserId(pendingDeleteUser.id);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase.from("users").delete().eq("id", pendingDeleteUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setUsers((current) => current.filter((entry) => entry.id !== pendingDeleteUser.id));
      setOpenUserId((current) => (current === pendingDeleteUser.id ? null : current));
      setPendingDeleteUser(null);
      toast({
        title: "Usuario eliminado",
        description: "El usuario ya no aparece en el panel.",
      });
    } catch (deleteUserError) {
      toast({
        title: "No pudimos eliminar el usuario",
        description: deleteUserError.message || "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUserId(null);
    }
  }

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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.04),rgba(15,23,42,0.08))] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">Panel de administracion</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Usuarios ordenados por fecha y hora de registro, con filtros y busqueda. Toca cualquier fila para desplegar acciones.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            {isFetchingUsers ? "Cargando usuarios..." : `${users.length} usuarios en pantalla`}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <FiltersBar
            filters={filters}
            onChange={updateFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            hasPreviousPage={page > 0}
            hasNextPage={hasNextPage}
            isFetchingUsers={isFetchingUsers}
            onPreviousPage={() => setPage((current) => Math.max(current - 1, 0))}
            onNextPage={() => setPage((current) => current + 1)}
            usersCount={users.length}
          />

          {isFetchingUsers ? (
            <div className="flex min-h-48 items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
              <span className="flex items-center gap-3">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                Consultando usuarios...
              </span>
            </div>
          ) : error ? (
            <div className="rounded-[1.75rem] border border-red-500/20 bg-red-500/6 px-5 py-4 text-sm text-red-200">{error}</div>
          ) : users.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
              No encontramos usuarios con esos filtros.
            </div>
          ) : (
            <UsersTable
              users={users}
              openUserId={openUserId}
              onToggleUser={(userId) => setOpenUserId((current) => (current === userId ? null : userId))}
              onViewProfile={(userId) => navigate(`/admin/users/${userId}/profile`)}
              onViewRankings={(userId) => navigate(`/admin/users/${userId}/rankings`)}
              onDeleteUser={handleDeleteRequest}
              isDeletingUserId={isDeletingUserId}
            />
          )}
        </div>
      </section>

      <DeleteUserModal
        user={pendingDeleteUser}
        isDeleting={isDeletingUserId === pendingDeleteUser?.id}
        onCancel={() => {
          if (isDeletingUserId) {
            return;
          }

          setPendingDeleteUser(null);
        }}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
}
