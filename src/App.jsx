import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Wrench } from "lucide-react";

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

function MaintenanceScreen() {
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
          <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-amber-100/80">MusicDB Beta 1.0.6</p>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">
            Estamos ajustando la integracion con Spotify para estabilizar la plataforma. Durante este proceso, el acceso a la app queda pausado temporalmente.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/56">
            En cuanto terminemos, retiramos esta pantalla y todo vuelve a la normalidad.
          </p>
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
