import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

/**
 * Emits `dist/sw.js` from `scripts/sw.template.js`, injecting the real precache
 * list and a version hash.
 *
 * This is why there is no `vite-plugin-pwa` dependency: the only thing such a
 * plugin would give us here is this manifest injection, and Vite already reports
 * every emitted asset to `generateBundle`.
 */
function serviceWorkerPlugin(): Plugin {
    return {
        name: "ccs-service-worker",
        apply: "build",
        enforce: "post",

        generateBundle(_options, bundle) {
            const emitted = Object.keys(bundle).map(
                (fileName) => `/${fileName}`,
            );

            const precache = [
                "/",
                "/index.html",
                "/manifest.webmanifest",
                "/icons/icon-192.png",
                "/icons/icon-512.png",
                ...emitted,
            ];

            // Deduplicate, then hash. A new build changes the hash, which changes
            // the cache names, which retires the old caches on activate.
            const unique = [...new Set(precache)];
            const version = createHash("sha256")
                .update(unique.join("|"))
                .digest("hex")
                .slice(0, 12);

            const template = readFileSync(
                fileURLToPath(
                    new URL("./scripts/sw.template.js", import.meta.url),
                ),
                "utf8",
            );

            this.emitFile({
                type: "asset",
                fileName: "sw.js",
                source: template
                    .replace("__VERSION__", version)
                    .replace(
                        "__PRECACHE_MANIFEST__",
                        JSON.stringify(unique, null, 2),
                    ),
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), serviceWorkerPlugin()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        port: 5173,
        open: true,
    },
});
