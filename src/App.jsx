import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Instagram, Wrench } from "lucide-react";

import AppLayout from "./components/layout/AppLayout";
import { AuthProvider } from "./hooks/useAuth";
import { SpotifyAuthProvider } from "./hooks/useSpotifyAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { ToastProvider } from "./hooks/useToast";
import AlbumPage from "./pages/AlbumPage";
import AdminPanel from "./pages/AdminPanel";
import AdminUserProfilePage from "./pages/AdminUserProfilePage";
import AdminUserRankingsPage from "./pages/AdminUserRankingsPage";
import ArtistPage from "./pages/ArtistPage";
import DBRankingPage from "./pages/DBRankingPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProPage from "./pages/ProPage";
import ProfilePage from "./pages/ProfilePage";
import PrivacyPage from "./pages/PrivacyPage";
import RegisterPage from "./pages/RegisterPage";
import SearchPage from "./pages/SearchPage";
import TermsPage from "./pages/TermsPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

const MAINTENANCE_MODE = true;
const MAINTENANCE_DURATION_MS = 12 * 60 * 60 * 1000;
const MAINTENANCE_DEADLINE_KEY = "musicdb_maintenance_deadline";

function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.12v12.12a2.77 2.77 0 1 1-2-2.66V8.3a5.9 5.9 0 1 0 5.12 5.86V8.02a7.9 7.9 0 0 0 4.77 1.6V6.69Z" />
    </svg>
  );
}

function resolveMaintenanceDeadline() {
  if (typeof window === "undefined") {
    return Date.now() + MAINTENANCE_DURATION_MS;
  }

  try {
    const storedDeadline = Number.parseInt(window.localStorage.getItem(MAINTENANCE_DEADLINE_KEY) ?? "", 10);

    if (Number.isFinite(storedDeadline) && storedDeadline > Date.now()) {
      return storedDeadline;
    }

    const nextDeadline = Date.now() + MAINTENANCE_DURATION_MS;
    window.localStorage.setItem(MAINTENANCE_DEADLINE_KEY, String(nextDeadline));
    return nextDeadline;
  } catch {
    return Date.now() + MAINTENANCE_DURATION_MS;
  }
}

function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(Math.floor(remainingMs / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function MaintenanceScreen() {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(resolveMaintenanceDeadline() - Date.now(), 0));

  useEffect(() => {
    const deadline = resolveMaintenanceDeadline();

    function updateRemainingTime() {
      setRemainingMs(Math.max(deadline - Date.now(), 0));
    }

    updateRemainingTime();

    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020202] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_20%),radial-gradient(circle_at_bottom,rgba(113,94,255,0.14),transparent_24%)]" />
      <div className="absolute inset-0 backdrop-blur-sm" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/8 backdrop-blur-3xl sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/20 bg-amber-200/10 text-amber-100 shadow-[0_0_40px_rgba(245,158,11,0.18)]">
            <Wrench className="h-9 w-9" />
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/75">Mantenimiento</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Estamos en mantenimiento</h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">
            Estamos trabajando en una proxima actualizacion, si quieres saber mas esta atento a nuestras redes sociales:
          </p>

          <div className="mt-5 flex items-center justify-center gap-3 text-sm font-semibold text-amber-100/90">
            <a
              href="https://www.instagram.com/themusicdb_/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 transition hover:border-amber-200/50 hover:bg-white/10 hover:text-white"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
            <a
              href="https://www.tiktok.com/@themusicdb?lang=en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 transition hover:border-amber-200/50 hover:bg-white/10 hover:text-white"
            >
              <TikTokIcon className="h-4 w-4" />
              TikTok
            </a>
          </div>

          <div className="mx-auto mt-8 max-w-md rounded-[1.5rem] border border-white/10 bg-black/22 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">Cuenta atras</p>
            <p className="mt-3 font-mono text-4xl font-black tracking-[0.16em] text-white sm:text-5xl">{formatCountdown(remainingMs)}</p>
            <p className="mt-3 text-xs text-white/52">Tiempo estimado para la proxima actualizacion.</p>
          </div>

          <p className="mt-8 text-sm font-semibold tracking-[0.18em] text-amber-100/80">MusicDB Beta 1.0.6</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  if (MAINTENANCE_MODE) {
    return <MaintenanceScreen />;
  }

  return (
    <BrowserRouter>
      <ToastProvider>
        <ThemeProvider>
          <AuthProvider>
            <SpotifyAuthProvider>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/admin/users/:userId/profile" element={<AdminUserProfilePage />} />
                  <Route path="/admin/users/:userId/rankings" element={<AdminUserRankingsPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/dbranking" element={<DBRankingPage />} />
                  <Route path="/pro" element={<ProPage />} />
                  <Route path="/artist/:id" element={<ArtistPage />} />
                  <Route path="/album/:id" element={<AlbumPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/stats" element={<ProfilePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppLayout>
            </SpotifyAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
