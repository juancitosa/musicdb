export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-background/72 px-4 py-5 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="footer-neon-text text-xs font-medium tracking-[0.22em] uppercase text-white/88">
          MusicDB © - Todos los derechos reservados 2026
        </p>
        <p className="footer-neon-text text-[11px] font-semibold tracking-[0.28em] uppercase text-white/72">
          Beta 1.0.1
        </p>
      </div>
    </footer>
  );
}
