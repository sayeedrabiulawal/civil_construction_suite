import { useEffect, useRef, useState } from "react";
import {
    Link,
    NavLink,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { CATEGORIES } from "@/core/categories";
import { countByCategory } from "@/core/registry";
import ChatWidget from "@/components/ChatWidget";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import AssistantScreen from "@/screens/AssistantScreen";
import BoqScreen from "@/screens/BoqScreen";
import { CalculatorRoute } from "@/screens/CalculatorScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import ListScreen from "@/screens/ListScreen";
import { getFavorites, getHistory, getTheme, setTheme } from "@/store/storage";
import { useStoreVersion } from "@/store/useStore";
import type { ThemeName } from "@/store/storage";

/** Below this the sidebar is a horizontal strip rather than a left rail. */
const RAIL_BREAKPOINT = "(max-width: 900px)";

export default function App() {
    useStoreVersion();

    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setThemeState] = useState<ThemeName>(() => getTheme());
    const [query, setQuery] = useState("");
    const { canInstall, install } = useInstallPrompt();

    const topbarRef = useRef<HTMLElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const firstRender = useRef(true);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        setTheme(theme);
    }, [theme]);

    // The header changes height at several breakpoints, and the sidebar is
    // sticky directly beneath it. Measuring beats hard-coding a pixel value
    // that silently drifts the moment the type size or the row count changes.
    useEffect(() => {
        const bar = topbarRef.current;
        if (!bar) return;

        const apply = () => {
            const height = Math.round(bar.getBoundingClientRect().height);
            if (height > 0) {
                document.documentElement.style.setProperty(
                    "--topbar-h",
                    `${height}px`,
                );
            }
        };

        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(bar);
        window.addEventListener("orientationchange", apply);
        return () => {
            observer.disconnect();
            window.removeEventListener("orientationchange", apply);
        };
    }, []);

    // Moving between calculators keeps the old scroll offset otherwise, which
    // lands the user halfway down a page they have not read yet. Deliberately
    // instant rather than smooth: this is a page change, not an in-page move.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        // "instant", not "auto": per spec "auto" defers to the CSS
        // `scroll-behavior: smooth`, which would leave the user watching the
        // page drift back to the top instead of simply being at the top.
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [location.pathname, location.search]);

    // On phones the active category can sit off-screen in the chip strip.
    useEffect(() => {
        const strip = sidebarRef.current;
        if (!strip || !window.matchMedia(RAIL_BREAKPOINT).matches) return;

        const active = strip.querySelector<HTMLElement>(".nav-item.active");
        active?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [location.pathname]);

    const counts = countByCategory();
    const favorites = getFavorites();
    const historyCount = getHistory().length;

    return (
        <div className="app">
            <a className="skip-link" href="#main-content">
                Skip to content
            </a>

            <header className="topbar" ref={topbarRef}>
                <Link className="brand" to="/">
                    <span className="mark" aria-hidden="true">
                        🏗️
                    </span>
                    <span>
                        Civil Construction Suite
                        <small>100+ civil engineering calculators</small>
                    </span>
                </Link>

                <form
                    className="topbar-search"
                    role="search"
                    onSubmit={(e) => {
                        e.preventDefault();
                        navigate(
                            query.trim()
                                ? `/search?q=${encodeURIComponent(query.trim())}`
                                : "/search",
                        );
                    }}
                >
                    <span className="icon" aria-hidden="true">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Search calculators — brick, steel, CBR, mix design…"
                        aria-label="Search calculators"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </form>

                <div className="topbar-actions">
                    <Link
                        className="icon-button desktop-only"
                        to="/favorites"
                        aria-label={`Favourites, ${favorites.length} saved`}
                    >
                        <span aria-hidden="true">★</span>
                        <span className="btn-label">Favourites</span>
                        {favorites.length > 0 && (
                            <span className="btn-badge" aria-hidden="true">
                                {favorites.length}
                            </span>
                        )}
                    </Link>
                    <Link
                        className="icon-button desktop-only"
                        to="/history"
                        aria-label="Calculation history"
                    >
                        <span aria-hidden="true">🕘</span>
                        <span className="btn-label">History</span>
                    </Link>
                    {canInstall && (
                        <button
                            type="button"
                            className="icon-button primary-button"
                            aria-label="Install app"
                            onClick={install}
                        >
                            <span aria-hidden="true">⬇</span>
                            <span className="btn-label">Install app</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="icon-button"
                        aria-label={
                            theme === "dark"
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                        title={
                            theme === "dark"
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                        onClick={() =>
                            setThemeState((t) =>
                                t === "dark" ? "light" : "dark",
                            )
                        }
                    >
                        <span aria-hidden="true">
                            {theme === "dark" ? "☀️" : "🌙"}
                        </span>
                    </button>
                </div>
            </header>

            <div className="layout">
                <aside
                    className="sidebar"
                    ref={sidebarRef}
                    aria-label="Categories"
                >
                    <h3>All categories</h3>
                    {CATEGORIES.map((c) => (
                        <NavLink
                            key={c.id}
                            to={`/category/${c.id}`}
                            className={({ isActive }) =>
                                isActive ? "nav-item active" : "nav-item"
                            }
                        >
                            <span className="emoji" aria-hidden="true">
                                {c.icon}
                            </span>
                            {c.name}
                            <span className="count">{counts[c.id] ?? 0}</span>
                        </NavLink>
                    ))}

                    <h3>Yours</h3>
                    <NavLink
                        to="/assistant"
                        className={({ isActive }) =>
                            isActive ? "nav-item active" : "nav-item"
                        }
                    >
                        <span className="emoji" aria-hidden="true">
                            ✨
                        </span>
                        AI Assistant
                    </NavLink>
                    <NavLink
                        to="/favorites"
                        className={({ isActive }) =>
                            isActive ? "nav-item active" : "nav-item"
                        }
                    >
                        <span className="emoji" aria-hidden="true">
                            ★
                        </span>
                        Favourites
                        <span className="count">{favorites.length}</span>
                    </NavLink>
                    <NavLink
                        to="/history"
                        className={({ isActive }) =>
                            isActive ? "nav-item active" : "nav-item"
                        }
                    >
                        <span className="emoji" aria-hidden="true">
                            🕘
                        </span>
                        History
                        <span className="count">{historyCount}</span>
                    </NavLink>
                    <NavLink
                        to="/boq"
                        className={({ isActive }) =>
                            isActive ? "nav-item active" : "nav-item"
                        }
                    >
                        <span className="emoji" aria-hidden="true">
                            🧾
                        </span>
                        Bill of Quantities
                    </NavLink>
                </aside>

                <main className="content" id="main-content">
                    <Routes>
                        <Route path="/" element={<ListScreen mode="home" />} />
                        <Route
                            path="/search"
                            element={<ListScreen mode="search" />}
                        />
                        <Route
                            path="/category/:id"
                            element={<ListScreen mode="category" />}
                        />
                        <Route path="/calc/:id" element={<CalculatorRoute />} />
                        <Route
                            path="/favorites"
                            element={
                                <ListScreen
                                    mode="favorites"
                                    favoriteIds={favorites}
                                />
                            }
                        />
                        <Route path="/history" element={<HistoryScreen />} />
                        <Route
                            path="/assistant"
                            element={<AssistantScreen />}
                        />
                        <Route path="/boq" element={<BoqScreen />} />
                        <Route path="*" element={<ListScreen mode="home" />} />
                    </Routes>
                </main>
            </div>

            {/* The full-page route already shows the panel; a floating copy on
                top of it would be two conversations in one viewport. */}
            {location.pathname !== "/assistant" && <ChatWidget />}
        </div>
    );
}
