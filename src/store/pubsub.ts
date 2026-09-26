/**
 * A tiny external store primitive shared by every persisted store.
 *
 * React subscribes through `useStoreVersion()`. Any store that calls `emit()`
 * bumps the same counter, so a component re-renders for changes in any store.
 */
let version = 0;
const listeners = new Set<() => void>();

export function getVersion(): number {
    return version;
}

export function emit(): void {
    version += 1;
    for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** localStorage read that never throws (private mode, disabled storage, bad JSON). */
export function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

/** localStorage write that never throws (quota exceeded, disabled storage). */
export function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Persistence is best-effort; the app keeps working in memory.
    }
}
