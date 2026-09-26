import type { Calculator, HistoryEntry } from "@/core/types";
import { emit, readJson, writeJson } from "./pubsub";

const FAVORITES_KEY = "ccs.favorites.v1";
const HISTORY_KEY = "ccs.history.v1";
const HISTORY_LIMIT = 100;

let favorites: string[] = readJson<string[]>(FAVORITES_KEY, []);
let history: HistoryEntry[] = readJson<HistoryEntry[]>(HISTORY_KEY, []);

/* ----------------------------- Favorites ----------------------------- */

export function getFavorites(): string[] {
    return favorites;
}

export function isFavorite(id: string): boolean {
    return favorites.includes(id);
}

export function toggleFavorite(id: string): void {
    favorites = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [id, ...favorites];
    writeJson(FAVORITES_KEY, favorites);
    emit();
}

/* ------------------------------ History ------------------------------ */

export function getHistory(): HistoryEntry[] {
    return history;
}

export function addHistory(
    calc: Calculator,
    inputs: string,
    result: string,
): void {
    const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        calcId: calc.id,
        calcName: calc.name,
        at: Date.now(),
        inputs,
        result,
    };

    // Collapse an immediate duplicate so a re-render does not spam the list.
    if (history[0]?.calcId === calc.id && history[0]?.inputs === inputs) {
        history = [entry, ...history.slice(1)];
    } else {
        history = [entry, ...history].slice(0, HISTORY_LIMIT);
    }

    writeJson(HISTORY_KEY, history);
    emit();
}

export function clearHistory(): void {
    history = [];
    writeJson(HISTORY_KEY, history);
    emit();
}

export function removeHistoryEntry(id: string): void {
    history = history.filter((h) => h.id !== id);
    writeJson(HISTORY_KEY, history);
    emit();
}

/* ------------------------------ Settings ----------------------------- */

const THEME_KEY = "ccs.theme.v1";

export type ThemeName = "light" | "dark";

export function getTheme(): ThemeName {
    const stored = readJson<ThemeName | null>(THEME_KEY, null);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function setTheme(theme: ThemeName): void {
    writeJson(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    emit();
}
