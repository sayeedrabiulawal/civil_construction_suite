import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/core/categories";
import { countByCategory } from "@/core/registry";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import BoqScreen from "@/screens/BoqScreen";
import { CalculatorRoute } from "@/screens/CalculatorScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import ListScreen from "@/screens/ListScreen";
import { getFavorites, getHistory, getTheme, setTheme } from "@/store/storage";
import { useStoreVersion } from "@/store/useStore";
import type { ThemeName } from "@/store/storage";

export default function App() {
    useStoreVersion();

    const navigate = useNavigate();
    const [theme, setThemeState] = useState<ThemeName>(() => getTheme());
    const [query, setQuery] = useState("");
    const { canInstall, install } = useInstallPrompt();

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        setTheme(theme);
    }, [theme]);

    const counts = countByCategory();
    const favorites = getFavorites();
    const historyCount = getHistory().length;

    return (
        <div className="app">
            <header className="topbar">
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
                    <Link className="icon-button" to="/favorites">
                        ★ Favourites
                        {favorites.length > 0 ? ` (${favorites.length})` : ""}
                    </Link>
                    <Link className="icon-button" to="/history">
                        🕘 History
                    </Link>
                    {canInstall && (
                        <button
                            type="button"
                            className="icon-button primary-button"
                            onClick={install}
                        >
                            ⬇ Install app
                        </button>
                    )}
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="Toggle dark mode"
                        onClick={() =>
                            setThemeState((t) =>
                                t === "dark" ? "light" : "dark",
                            )
                        }
                    >
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                </div>
            </header>

            <div className="layout">
                <aside className="sidebar">
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

                <main className="content">
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
                        <Route path="/boq" element={<BoqScreen />} />
                        <Route path="*" element={<ListScreen mode="home" />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}
