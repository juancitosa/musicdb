import { Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-background/72 px-4 py-5 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-center sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left">
        <p className="footer-neon-text text-xs font-medium tracking-[0.22em] uppercase text-white/88">
          MusicDB Copyright - Todos los derechos reservados 2026
        </p>
        <a
          href="https://www.instagram.com/themusicdb_/"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-neon-text inline-flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-white/78 transition hover:text-primary sm:justify-start"
        >
          <span>Siguenos en nuestras redes!</span>
          <Instagram className="h-4 w-4" />
        </a>
        <p className="footer-neon-text text-[11px] font-semibold tracking-[0.28em] uppercase text-white/72">
          Beta 1.0.3
        </p>
      </div>
    </footer>
  );
}
