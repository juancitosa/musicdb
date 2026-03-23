import { BarChart3, ChevronDown, Disc3, LoaderCircle, LogOut, Moon, Search, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import { useSpotifyAuth } from "../../hooks/useSpotifyAuth";
import { useTheme } from "../../hooks/useTheme";
import { getImageUrl, searchSpotify } from "../../services/spotify";
import AuthDialog from "../shared/AuthDialog";
import SpotifyConnectButton from "../shared/SpotifyConnectButton";

const navigationItems = [
  { label: "Inicio", path: "/" },
];

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20 transition group-hover:rotate-12">
        <Disc3 className="h-5 w-5 text-primary-foreground" />
      </div>
      <span className="font-display text-xl font-bold tracking-tight">
        Music<span className="text-primary">DB</span>
      </span>
    </Link>
  );
}

function NavLinks() {
  return (
    <nav className="flex gap-1">
      {navigationItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
      <NavLink
        to="/dbranking"
        className={({ isActive }) =>
          `inline-flex min-w-fit shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold leading-none transition ${
            isActive
              ? "border-yellow-300/65 bg-linear-to-r from-[#231a06] via-[#1a150c] to-[#141311] text-yellow-50 shadow-[0_0_24px_rgba(250,204,21,0.16)]"
              : "border-yellow-400/38 bg-linear-to-r from-[#171206] via-[#121111] to-[#101012] text-yellow-100/95 shadow-[0_0_16px_rgba(250,204,21,0.08)] hover:-translate-y-0.5 hover:border-yellow-300/65 hover:from-[#241b08] hover:via-[#17130f] hover:to-[#141311] hover:text-yellow-50 hover:shadow-[0_0_28px_rgba(250,204,21,0.16)]"
          }`
        }
      >
        DBRanking
      </NavLink>
      <NavLink
        to="/pro"
        className={({ isActive }) =>
          `inline-flex min-w-fit shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold leading-none transition ${
            isActive
              ? "border-amber-300/65 bg-linear-to-r from-[#261807] via-[#1d1510] to-[#141311] text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.18)]"
              : "border-amber-300/40 bg-linear-to-r from-[#191106] via-[#121111] to-[#101012] text-amber-100/95 shadow-[0_0_16px_rgba(245,158,11,0.08)] hover:-translate-y-0.5 hover:border-amber-200/68 hover:from-[#251807] hover:via-[#18130f] hover:to-[#141311] hover:text-amber-50 hover:shadow-[0_0_28px_rgba(245,158,11,0.18)]"
          }`
        }
      >
        Music PRO
      </NavLink>
    </nav>
  );
}

function SearchSuggestionItem({ item, onSelect }) {
  const image = getImageUrl(item.images, "");
  const target = item._type === "artist" ? `/artist/${item.id}` : `/album/${item.id}`;

  return (
    <Link to={target} onClick={onSelect} className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary">
      {image ? (
        <img src={image} alt={item.name} className={`h-10 w-10 object-cover ${item._type === "artist" ? "rounded-full" : "rounded-md"}`} />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
          <Disc3 className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {item._type === "artist" ? "Artista" : `Album · ${item.artists?.[0]?.name ?? ""}`}
        </p>
      </div>
    </Link>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debouncedSearch = useDebounce(searchTerm);

  useEffect(() => {
    function handleClick(event) {
      if (!event.target.closest("[data-searchbox]")) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!debouncedSearch.trim()) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);

      try {
        const result = await searchSpotify(debouncedSearch, null, 5);
        const artistItems = (result.artists?.items ?? []).map((item) => ({ ...item, _type: "artist" }));
        const albumItems = (result.albums?.items ?? []).map((item) => ({ ...item, _type: "album" }));
        setSuggestions([...artistItems, ...albumItems]);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }

    fetchSuggestions();
  }, [debouncedSearch]);

  function submitSearch(event) {
    event.preventDefault();

    if (!searchTerm.trim()) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    setShowSuggestions(false);
  }

  function openExplore() {
    if (!searchTerm.trim()) {
      navigate("/search");
    }
  }

  function selectSuggestion() {
    setShowSuggestions(false);
    setSearchTerm("");
  }

  return (
    <div data-searchbox className="relative mx-4 w-full max-w-md">
      <form onSubmit={submitSearch} className="group relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onClick={openExplore}
          onFocus={() => {
            openExplore();
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Buscar artistas, albumes..."
          className="w-full rounded-full bg-secondary py-2 pr-4 pl-10 text-sm outline-none transition focus:ring-2 focus:ring-primary"
        />
        {isLoadingSuggestions ? <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-primary" /> : null}
      </form>

      {showSuggestions && suggestions.length > 0 ? (
        <div className="absolute top-full mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/30">
          {suggestions.map((item) => (
            <SearchSuggestionItem key={`${item.id}-${item._type}`} item={item} onSelect={selectSuggestion} />
          ))}
          <button onClick={submitSearch} className="w-full border-t border-border px-4 py-3 text-left text-sm font-medium text-primary transition hover:bg-secondary">
            Ver todos los resultados para "{searchTerm}"
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function UserActions() {
  const { isLoggedIn, user, clearAuthenticatedUser, isSpotifyUser } = useAuth();
  const { isSpotifyConnected, spotifyUser, connectSpotify, disconnectSpotify } = useSpotifyAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const location = useLocation();
  const profileUser = spotifyUser ?? user;

  useEffect(() => {
    if (!showProfileMenu) {
      return undefined;
    }

    function handleClickOutside(event) {
      if (!event.target.closest("[data-profile-menu]")) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  useEffect(() => {
    setShowProfileMenu(false);
  }, [location.pathname]);

  if (isLoggedIn) {
    return (
      <>
        <div className="flex items-center gap-2">
          {!isSpotifyConnected && !isSpotifyUser ? (
            <div className="hidden md:block">
              <SpotifyConnectButton onClick={() => connectSpotify({ forcePrompt: true })} className="px-4 py-2 text-sm">
                Conectar Spotify
              </SpotifyConnectButton>
            </div>
          ) : null}
          <div data-profile-menu className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((current) => !current)}
              className="flex items-center gap-2 rounded-full border border-white/5 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-800"
              title={profileUser?.name ?? "Perfil"}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
            >
              {profileUser?.avatar ? (
                <img src={profileUser.avatar} alt={profileUser.name} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                  <UserRound className="h-4 w-4" />
                </div>
              )}
              <span className={`max-w-28 truncate ${user?.isPro ? "pro-username pro-username-shimmer" : ""}`}>
                {profileUser?.name ?? "Mi perfil"}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${showProfileMenu ? "rotate-180" : ""}`} />
            </button>

            {showProfileMenu ? (
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/25">
                <Link
                  to="/profile"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-secondary"
                >
                  <UserRound className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold">Mi perfil</p>
                    <p className="text-xs text-muted-foreground">Cuenta, sesion e historial</p>
                  </div>
                </Link>
                <Link
                  to="/profile/stats"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-secondary"
                >
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold">Mis estadisticas</p>
                    <p className="text-xs text-muted-foreground">Tus tops personales de Spotify</p>
                  </div>
                </Link>
              </div>
            ) : null}
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-full bg-secondary p-2 text-muted-foreground transition hover:bg-secondary/80 hover:text-foreground"
            aria-label="Cerrar sesion"
            title="Cerrar sesion de Spotify"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {showLogoutConfirm && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/38 px-4 backdrop-blur-md">
                <div className="w-full max-w-md rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/8 backdrop-blur-2xl">
                  <h3 className="text-center text-xl font-bold text-foreground">Realmente desea cerrar sesion?</h3>
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    {isSpotifyConnected
                      ? "Vas a cerrar tu sesion de MusicDB y desconectar Spotify."
                      : "Vas a cerrar tu sesion actual de MusicDB."}
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="rounded-full border border-white/10 bg-white/6 px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutConfirm(false);
                        if (isSpotifyConnected) {
                          disconnectSpotify();
                        }
                        clearAuthenticatedUser();
                      }}
                      className="logout-confirm-button cursor-pointer rounded-full border border-red-500/90 bg-red-500/6 px-5 py-2.5 text-sm font-semibold text-red-200 shadow-[0_0_24px_rgba(239,68,68,0.4)] transition hover:bg-red-500/14 hover:text-red-100"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <AuthDialog triggerLabel="Iniciar sesion" triggerClassName="px-4 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2 md:hidden">
        <AuthDialog triggerLabel="Entrar" triggerSize="default" triggerClassName="px-3 py-2 text-xs" />
      </div>
    </>
  );
}

export default function Navbar() {
  return (
    <header className="glass-effect sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Brand />

          <div className="hidden flex-1 items-center justify-between gap-6 md:flex">
            <NavLinks />
            <SearchBox />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <UserActions />
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <UserActions />
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="w-max">
                <NavLinks />
              </div>
            </div>
            <div className="-mx-4 px-0 sm:-mx-6 sm:px-0">
              <SearchBox />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
