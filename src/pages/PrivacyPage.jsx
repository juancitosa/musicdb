import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Datos que podemos tratar",
    paragraphs: [
      "Podemos tratar datos como email, nombre de usuario, avatar, banner, telefono opcional, actividad dentro de la plataforma, reseñas, puntuaciones y datos necesarios para autenticar la cuenta.",
      "Si conectas Spotify, MusicDB puede acceder a la informacion estrictamente necesaria para mostrar funciones personales habilitadas por esa integracion.",
    ],
  },
  {
    title: "2. Para que usamos los datos",
    paragraphs: [
      "Usamos los datos para crear y mantener tu cuenta, habilitar funciones de la app, mostrar tu perfil, procesar beneficios PRO, moderar contenido y reforzar la seguridad del servicio.",
      "Tambien podemos usar informacion tecnica y operativa para detectar abuso, errores, fraude, accesos indebidos o fallos de rendimiento.",
    ],
  },
  {
    title: "3. Pagos e integraciones",
    paragraphs: [
      "Los pagos son procesados por proveedores externos y MusicDB no almacena informacion completa de tarjetas.",
      "Algunas funciones pueden depender de integraciones de terceros como Spotify o proveedores de autenticacion y almacenamiento.",
    ],
  },
  {
    title: "4. Conservacion y seguridad",
    paragraphs: [
      "Aplicamos medidas tecnicas razonables para limitar el acceso a datos sensibles, proteger sesiones, restringir tablas expuestas y asegurar archivos de usuario segun el alcance de la plataforma.",
      "Conservamos la informacion mientras sea necesaria para operar la cuenta, cumplir obligaciones legales o resolver incidentes de seguridad y moderacion.",
    ],
  },
  {
    title: "5. Derechos y contacto",
    paragraphs: [
      "Puedes solicitar correcciones sobre tus datos de perfil y gestionar parte de tu informacion desde la propia cuenta dentro de MusicDB.",
      "Si tienes consultas sobre privacidad o tratamiento de datos, puedes comunicarte por los canales oficiales informados en la plataforma.",
    ],
  },
];

function LegalSection({ title, paragraphs }) {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/6 p-6 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] ring-1 ring-white/8 backdrop-blur-2xl sm:p-7">
      <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/72 sm:text-[15px]">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/14 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_24%),linear-gradient(135deg,rgba(9,12,16,0.98),rgba(14,20,28,0.98),rgba(8,10,14,0.98))] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/24 bg-cyan-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
            <LockKeyhole className="h-3.5 w-3.5" />
            Privacidad
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">Politica de Privacidad</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/72 sm:text-base">
            Este resumen explica que datos puede tratar MusicDB, con que finalidad y bajo que criterios de seguridad operamos la plataforma.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
            <ShieldCheck className="h-4 w-4" />
            Ultima actualizacion: 25 de marzo de 2026
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-5">
        {sections.map((section) => (
          <LegalSection key={section.title} title={section.title} paragraphs={section.paragraphs} />
        ))}
      </div>

      <section className="mt-8 rounded-[1.6rem] border border-violet-300/16 bg-[linear-gradient(135deg,rgba(12,10,18,0.97),rgba(19,16,28,0.96))] p-6 shadow-[0_20px_60px_-36px_rgba(124,58,237,0.28)] ring-1 ring-violet-300/10 backdrop-blur-2xl sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm leading-relaxed text-white/72">Si quieres revisar las reglas generales de uso de MusicDB, tambien puedes leer nuestros Terminos y Condiciones.</p>
          </div>
          <Link
            to="/terms"
            className="inline-flex items-center justify-center rounded-full border border-violet-300/28 bg-violet-300/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-300/16"
          >
            Ver Terminos y Condiciones
          </Link>
        </div>
      </section>
    </div>
  );
}
