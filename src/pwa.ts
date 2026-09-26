/**
 * Registers the service worker so the app works offline and can be installed.
 *
 * Only runs in a production build: during development the worker would serve
 * cached responses and hide your edits.
 */
export function registerServiceWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    if (!import.meta.env.PROD) return;

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
            // Registration fails on unsupported or insecure origins. Offline support
            // is a progressive enhancement, so there is nothing to recover from.
        });
    });
}
