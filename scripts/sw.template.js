/**
 * Service worker for Civil Construction Suite.
 *
 * The build substitutes the two placeholders defined just below with a build
 * version hash and the list of URLs to precache. See `serviceWorkerPlugin` in
 * vite.config.ts, and keep this comment free of the literal placeholder tokens
 * so the substitution cannot touch it.
 *
 * Strategy
 *   • Precache       -> the app shell and every hashed asset, at install time, so
 *                       the app works offline immediately after the first visit.
 *   • Navigations    -> network first, falling back to the cached shell.
 *   • Hashed assets  -> cache first. Names change per build, so never stale.
 *   • /api/*         -> never touched. Server data is live, and the assistant
 *                       must never be answered from a cache.
 *   • Other same-origin + web fonts -> stale-while-revalidate.
 */
const VERSION = "__VERSION__";
const SHELL_CACHE = `ccs-shell-${VERSION}`;
const ASSET_CACHE = `ccs-assets-${VERSION}`;
const PRECACHE_MANIFEST = __PRECACHE_MANIFEST__;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) =>
                // One failing URL must not abort the whole install.
                Promise.allSettled(
                    PRECACHE_MANIFEST.map((url) => cache.add(url)),
                ),
            )
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) => key !== SHELL_CACHE && key !== ASSET_CACHE,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

/** Vite emits filenames containing a content hash under /assets/. */
function isHashedAsset(url) {
    return url.pathname.startsWith("/assets/");
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put("/index.html", response.clone());
        }
        return response;
    } catch {
        const cached =
            (await caches.match(request)) ??
            (await caches.match("/index.html")) ??
            (await caches.match("/"));
        if (cached) return cached;
        throw new Error("Offline and no cached shell available");
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
        const cache = await caches.open(ASSET_CACHE);
        cache.put(request, response.clone());
    }
    return response;
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const network = fetch(request)
        .then(async (response) => {
            if (response && (response.ok || response.type === "opaque")) {
                const cache = await caches.open(ASSET_CACHE);
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);

    return cached ?? network;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Web fonts are cross-origin and arrive as opaque responses, which can still
    // be cached and replayed. Caching them keeps the offline app fully styled.
    const isFont =
        url.hostname === "fonts.googleapis.com" ||
        url.hostname === "fonts.gstatic.com";
    if (isFont) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    if (url.origin !== self.location.origin) return;

    // Never cache the worker itself, so updates always land.
    if (url.pathname === "/sw.js") return;

    // Server endpoints are live data, never cacheable. Without this the status
    // probe would be served stale-while-revalidate, so a deployment that has
    // just been given an API key would still claim the assistant is off.
    if (url.pathname.startsWith("/api/")) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (isHashedAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});
