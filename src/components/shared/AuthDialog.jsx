import { LogIn, Mail, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useSpotifyAuth } from "../../hooks/useSpotifyAuth";
import { useToast } from "../../hooks/useToast";
import { loginLocalUser, registerLocalUser } from "../../services/appAuth";
import SpotifyConnectButton from "./SpotifyConnectButton";
import Button from "../ui/Button";

function EmptyForm() {
  return {
    email: "",
    username: "",
    password: "",
    phone: "",
  };
}

function mapAuthError(errorCode) {
  switch (errorCode) {
    case "INVALID_REGISTER_PAYLOAD":
      return "Completa email, username y una contraseña de al menos 6 caracteres.";
    case "INVALID_LOGIN_PAYLOAD":
      return "Completa email y contraseña.";
    case "EMAIL_ALREADY_EXISTS":
      return "Ese email ya tiene una cuenta creada.";
    case "USERNAME_ALREADY_EXISTS":
      return "Ese nombre de usuario ya está en uso.";
    case "LOCAL_LOGIN_INVALID":
      return "Email o contraseña incorrectos.";
    case "APP_BACKEND_UNAVAILABLE":
      return "No pudimos conectar con el backend de la app.";
    default:
      return "No pudimos completar la autenticación. Intenta nuevamente.";
  }
}

export default function AuthDialog({
  triggerLabel = "Iniciar sesión",
  triggerClassName = "",
  triggerVariant = "default",
  triggerSize = "default",
  initialMode = "login",
}) {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const { connectSpotify, isLoadingSpotify, isSpotifyConnected, spotifyUser } = useSpotifyAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(EmptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setMode(initialMode);
      setForm(EmptyForm());
      setError("");
      setIsSubmitting(false);
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleLocalAuth(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload =
        mode === "register"
          ? {
              email: form.email,
              username: form.username,
              password: form.password,
              phone: form.phone || undefined,
            }
          : {
              email: form.email,
              password: form.password,
            };

      const response = mode === "register" ? await registerLocalUser(payload) : await loginLocalUser(payload);

      setAuthenticatedSession(response);
      setIsOpen(false);
      navigate("/profile");
      toast({
        title: mode === "register" ? "Cuenta creada" : "Sesion iniciada",
        description: mode === "register" ? "Tu cuenta MusicDB ya está lista para usar." : "Ya puedes usar MusicDB sin depender de Spotify.",
      });
    } catch (requestError) {
      setError(mapAuthError(requestError?.message));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSpotify() {
    setError("");
    await connectSpotify({ forcePrompt: true });
  }

  const connectedName = spotifyUser?.name ?? "tu cuenta de Spotify";

  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} className={triggerClassName} onClick={() => setIsOpen(true)}>
        {triggerLabel}
      </Button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
              <div
                className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
                  <div className="bg-linear-to-br from-[#121a12] via-[#142316] to-[#0b120d] p-8 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Acceso</p>
                        <h2 className="mt-3 text-3xl font-black leading-tight">Iniciar sesion</h2>
                        <p className="mt-3 text-sm text-white/72">
                          Spotify ahora es opcional. Puedes entrar con cuenta MusicDB y conectar Spotify solo si quieres las funciones extra.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="rounded-full bg-white/8 p-2 text-white/72 transition hover:bg-white/14 hover:text-white"
                        aria-label="Cerrar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
                      <p className="text-sm font-semibold">Continuar con Spotify</p>
                      <p className="mt-2 text-sm text-white/72">
                        Mantiene el flujo actual y desbloquea top artistas, top canciones, top albumes y escuchando ahora.
                      </p>
                      {isSpotifyConnected ? (
                        <p className="mt-3 text-xs text-green-200/90">Spotify ya está conectado como {connectedName}.</p>
                      ) : null}
                      <SpotifyConnectButton onClick={handleSpotify} disabled={isLoadingSpotify} size="lg" className="mt-5 w-full justify-center">
                        {isLoadingSpotify ? "Conectando..." : isSpotifyConnected ? "Reconectar con Spotify" : "Continuar con Spotify"}
                      </SpotifyConnectButton>
                    </div>
                  </div>

                  <div className="p-8">
                    <div className="flex rounded-full bg-secondary p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("login");
                          setError("");
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                          mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LogIn className="h-4 w-4" />
                        Ingresar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("register");
                          setError("");
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                          mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <UserPlus className="h-4 w-4" />
                        Cuenta MusicDB
                      </button>
                    </div>

                    <form onSubmit={handleLocalAuth} className="mt-6 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="email"
                            value={form.email}
                            onChange={(event) => updateField("email", event.target.value)}
                            className="w-full rounded-2xl border border-border bg-background py-3 pr-4 pl-11 text-sm outline-none transition focus:border-primary"
                            placeholder="tu@email.com"
                            required
                          />
                        </div>
                      </div>

                      {mode === "register" ? (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">Username</label>
                          <input
                            type="text"
                            value={form.username}
                            onChange={(event) => updateField("username", event.target.value)}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                            placeholder="Tu nombre en MusicDB"
                            required
                          />
                        </div>
                      ) : null}

                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Contrasena</label>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(event) => updateField("password", event.target.value)}
                          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                          placeholder={mode === "register" ? "Minimo 6 caracteres" : "Tu contrasena"}
                          required
                        />
                      </div>

                      {mode === "register" ? (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">Phone opcional</label>
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(event) => updateField("phone", event.target.value)}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                            placeholder="+54 11 1234 5678"
                          />
                        </div>
                      ) : null}

                      {error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">{error}</p> : null}

                      <Button type="submit" className="w-full justify-center" size="lg" disabled={isSubmitting}>
                        {isSubmitting
                          ? mode === "register"
                            ? "Creando cuenta..."
                            : "Ingresando..."
                          : mode === "register"
                            ? "Crear cuenta MusicDB"
                            : "Entrar con email"}
                      </Button>

                      <p className="text-sm text-muted-foreground">
                        {mode === "register"
                          ? "Con esta cuenta puedes votar, crear resenas, usar rankings y explorar toda la app aunque Spotify falle."
                          : "Si luego conectas Spotify, las funciones extra se habilitan sin perder tu acceso a MusicDB."}
                      </p>
                    </form>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
