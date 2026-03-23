import { BrowserRouter, Route, Routes } from "react-router-dom";

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
import RegisterPage from "./pages/RegisterPage";
import SearchPage from "./pages/SearchPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

export default function App() {
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
