import { LoaderCircle, MailCheck, MailWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { verifyEmailToken } from "../services/appAuth";

function mapVerificationError(errorCode) {
  switch (errorCode) {
    case "INVALID_EMAIL_VERIFICATION_TOKEN":
    case "EMAIL_VERIFICATION_INVALID":
      return "El link de verificacion no es valido.";
    case "EMAIL_VERIFICATION_ALREADY_USED":
      return "Ese link ya fue usado. Si la cuenta ya esta activa, puedes iniciar sesion.";
    case "EMAIL_VERIFICATION_EXPIRED":
      return "El link vencio. Vuelve al login y reenvia el mail de verificacion.";
    case "EMAIL_VERIFICATION_SCHEMA_MISSING":
      return "Falta la configuracion de base de datos para este flujo.";
    case "APP_BACKEND_UNAVAILABLE":
      return "No pudimos conectar con el backend.";
    default:
      return "No pudimos verificar tu email.";
  }
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Estamos validando tu email.");

  useEffect(() => {
    const token = searchParams.get("token")?.trim() || "";

    if (!token) {
      setStatus("error");
      setMessage("Falta el token de verificacion en el enlace.");
      return;
    }

    let cancelled = false;

    async function runVerification() {
      try {
        const response = await verifyEmailToken({ token });

        if (cancelled) {
          return;
        }

        setAuthenticatedSession(response);
        setStatus("success");
        setMessage("Tu cuenta ya esta verificada. Entrando a tu perfil...");
        window.setTimeout(() => navigate("/profile", { replace: true }), 1200);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setMessage(mapVerificationError(error?.message));
      }
    }

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, setAuthenticatedSession]);

  return (
    <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full p-3 ${
              status === "success" ? "bg-emerald-500/12 text-emerald-500" : status === "error" ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary"
            }`}
          >
            {status === "success" ? (
              <MailCheck className="h-6 w-6" />
            ) : status === "error" ? (
              <MailWarning className="h-6 w-6" />
            ) : (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">Verificacion de email</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          {status === "loading"
            ? "Este proceso suele tardar unos segundos."
            : status === "success"
              ? "Si no te redirigimos automaticamente, puedes entrar manualmente."
              : "Si el enlace vencio o ya no funciona, abre el login y usa la opcion de reenviar verificacion."}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-secondary"
          >
            Ir al login
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Crear otra cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
