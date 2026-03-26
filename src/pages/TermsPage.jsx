import { FileText, ShieldCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Aceptacion",
    paragraphs: [
      "Al registrarte, navegar o usar MusicDB aceptas estos Terminos y Condiciones. Si no estas de acuerdo, no debes usar la plataforma.",
      "Estos terminos aplican tanto a usuarios con cuenta MusicDB como a usuarios que conectan Spotify para funciones adicionales.",
    ],
  },
  {
    title: "2. Uso de la plataforma",
    paragraphs: [
      "MusicDB permite descubrir musica, puntuar artistas y albumes, escribir reseñas, consultar rankings y acceder a funciones premium segun el plan activo.",
      "No esta permitido usar la plataforma para fraude, scraping abusivo, spam, suplantacion de identidad, manipulacion de rankings o cualquier actividad que afecte a otros usuarios o a la estabilidad del servicio.",
    ],
  },
  {
    title: "3. Cuentas y acceso",
    paragraphs: [
      "Cada usuario es responsable de la veracidad de los datos que ingresa y de mantener segura su sesion.",
      "MusicDB puede suspender o limitar cuentas que incumplan estos terminos, afecten la seguridad de la plataforma o generen actividad abusiva.",
    ],
  },
  {
    title: "4. Beneficios PRO y pagos",
    paragraphs: [
      "Los beneficios PRO, incluyendo identidad visual premium, banners exclusivos, reseñas destacadas y funciones extra, se habilitan mientras la suscripcion se encuentre activa.",
      "Los pagos se procesan mediante proveedores externos. MusicDB no almacena datos completos de tarjetas de pago.",
    ],
  },
  {
    title: "5. Contenido generado por usuarios",
    paragraphs: [
      "Las reseñas, puntuaciones, nombres de usuario, fotos y banners publicados por los usuarios deben respetar la ley, los derechos de terceros y las normas basicas de convivencia.",
      "MusicDB se reserva el derecho de moderar, editar, ocultar o eliminar contenido que considere ofensivo, engañoso, ilegal o dañino para la comunidad.",
    ],
  },
  {
    title: "6. Disponibilidad y cambios",
    paragraphs: [
      "MusicDB puede modificar funciones, precios, limites, integraciones o partes de la plataforma sin previo aviso cuando sea necesario para mantener el servicio, mejorar la seguridad o estabilizar el producto.",
      "Tambien podemos actualizar estos terminos. El uso continuado de la plataforma despues de cambios relevantes implica su aceptacion.",
    ],
  },
  {
    title: "7. Contacto",
    paragraphs: [
      "Si tienes consultas sobre estos terminos, puedes contactarte con MusicDB a traves de los canales oficiales publicados dentro de la plataforma.",
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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/16 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_24%),linear-gradient(135deg,rgba(10,10,12,0.98),rgba(18,16,26,0.98),rgba(8,8,10,0.98))] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/24 bg-violet-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-violet-100">
            <FileText className="h-3.5 w-3.5" />
            Legal
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">Terminos y Condiciones</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/72 sm:text-base">
            Este resumen establece las condiciones de uso de MusicDB, incluyendo cuentas, contenido, pagos y funciones premium.
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

      <section className="mt-8 rounded-[1.6rem] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(16,14,10,0.97),rgba(24,19,12,0.96))] p-6 shadow-[0_20px_60px_-36px_rgba(245,158,11,0.28)] ring-1 ring-amber-300/10 backdrop-blur-2xl sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
              <Star className="h-3.5 w-3.5 fill-current" />
              Informacion complementaria
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/72">Tambien puedes revisar como tratamos tus datos personales en nuestra Politica de Privacidad.</p>
          </div>
          <Link
            to="/privacy"
            className="inline-flex items-center justify-center rounded-full border border-amber-300/28 bg-amber-300/10 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/16"
          >
            Ver Politica de Privacidad
          </Link>
        </div>
      </section>
    </div>
  );
}
