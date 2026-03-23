import { LoaderCircle, MailCheck, MailWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { verifyEmailToken } from "../services/appAuth";

function mapVerificationError(errorCode) {
  switch (errorCode) {
    case "Falta el token de verificacion":
      return "El link de verificacion no es valido.";
    case "El token de verificacion no existe":
      return "El link de verificacion no es valido.";
    case "El token de verificacion esta expirado":
      return "El link vencio. Vuelve al login y reenvia el mail de verificacion.";
    case "El token tiene un user_id invalido":
      return "El link de verificacion es invalido.";
    case "APP_BACKEND_UNAVAILABLE":
      return "No pudimos conectar con el backend.";
    default:
      return "No pudimos verificar tu email.";
  }
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
        await verifyEmailToken(token);

        if (cancelled) {
          return;
        }

        setStatus("success");
        setMessage("Tu cuenta ya esta verificada. Ahora puedes iniciar sesion.");
        window.setTimeout(() => navigate("/login", { replace: true }), 1200);
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
  }, [navigate, searchParams]);

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
              ? "Si no te redirigimos automaticamente, puedes iniciar sesion manualmente."
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
