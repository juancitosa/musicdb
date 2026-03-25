import { Instagram } from "lucide-react";

function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.12v12.12a2.77 2.77 0 1 1-2-2.66V8.3a5.9 5.9 0 1 0 5.12 5.86V8.02a7.9 7.9 0 0 0 4.77 1.6V6.69Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-background/72 px-4 py-5 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-center sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left">
        <p className="footer-neon-text text-xs font-medium tracking-[0.22em] uppercase text-white/88">
          {"MusicDB \u00A9 Todos los derechos reservados 2026"}
        </p>
        <div className="footer-neon-text inline-flex items-center justify-center gap-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-white/78 sm:justify-start">
          <span>Siguenos en nuestras redes!</span>
          <a
            href="https://www.instagram.com/themusicdb_/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de MusicDB"
            className="transition hover:text-primary"
          >
            <Instagram className="h-4 w-4" />
          </a>
          <a
            href="https://www.tiktok.com/@themusicdb?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok de MusicDB"
            className="transition hover:text-primary"
          >
            <TikTokIcon className="h-4 w-4" />
          </a>
        </div>
        <p className="footer-neon-text text-[11px] font-semibold tracking-[0.28em] uppercase text-white/72">
          Beta 1.0.4
        </p>
      </div>
    </footer>
  );
}
