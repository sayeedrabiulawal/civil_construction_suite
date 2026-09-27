import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { fileURLToPath, URL } from "node:url";
import { handleChatRequest, type ChatEnv } from "./server/chat";

/** Generous ceiling for the dev proxy; the handler enforces the real limit. */
const MAX_DEV_BODY_CHARS = 1_000_000;

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

/**
 * Serves `POST /api/chat` during `npm run dev`.
 *
 * In production the request is answered by the Edge Function in `api/chat.ts`,
 * which does not exist as an HTTP endpoint under Vite. Rather than maintain a
 * second implementation, this bridges Node's `req`/`res` into the Web
 * `Request`/`Response` pair that `handleChatRequest` already speaks — so dev and
 * production run byte-for-byte the same code, streaming included.
 */
function chatApiPlugin(env: ChatEnv): Plugin {
    return {
        name: "ccs-chat-api",
        apply: "serve",

        configureServer(server) {
            // Registered on the raw middleware stack, so it is reached before
            // Vite's own HTML/asset handlers.
            server.middlewares.use("/api/chat", (req, res, next) => {
                void (async () => {
                    try {
                        const forwarded = req as IncomingMessage & {
                            originalUrl?: string;
                        };

                        const url = new URL(
                            forwarded.originalUrl ?? req.url ?? "/api/chat",
                            "http://localhost",
                        );

                        const body = await readRequestBody(req);
                        const sendsBody =
                            req.method !== "GET" &&
                            req.method !== "HEAD" &&
                            body.length > 0;

                        const response = await handleChatRequest(
                            new Request(url, {
                                method: req.method,
                                headers: toHeaders(req),
                                body: sendsBody ? body : undefined,
                            }),
                            env,
                        );

                        res.statusCode = response.status;
                        response.headers.forEach((value, key) =>
                            res.setHeader(key, value),
                        );
                        // Never let the dev server hand a browser a stale stream.
                        res.setHeader("Cache-Control", "no-store");

                        if (!response.body) {
                            res.end();
                            return;
                        }

                        const reader = response.body.getReader();
                        for (;;) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            res.write(Buffer.from(value));
                        }
                        res.end();
                    } catch (error) {
                        next(error);
                    }
                })();
            });
        },
    };
}

function readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: string[] = [];
        let size = 0;

        // Decoded up front: the handler consumes the body as text via
        // `request.text()`, and a string sidesteps the Node Buffer type not
        // satisfying the DOM's BodyInit.
        req.setEncoding("utf8");

        req.on("data", (chunk: string) => {
            size += chunk.length;
            if (size > MAX_DEV_BODY_CHARS) {
                reject(new Error("Request body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(chunks.join("")));
        req.on("error", reject);
    });
}

function toHeaders(req: IncomingMessage): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    return headers;
}

export default defineConfig(({ mode }) => {
    // Prefix "" so the server-side AI_* variables are read too. They are never
    // exposed to the bundle: only this config file and the handler see them.
    const env: ChatEnv = { ...loadEnv(mode, process.cwd(), "") };

    // Real environment variables win over `.env`, so `AI_API_KEY=… npm run dev`
    // behaves the same as the deployed function, where process.env is all there
    // is. Only the known names are copied, so nothing unrelated leaks in.
    for (const key of [
        "AI_BASE_URL",
        "AI_API_KEY",
        "AI_MODEL",
        "AI_PROVIDER_LABEL",
        "OPENAI_BASE_URL",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
    ]) {
        const value = process.env[key];
        if (value !== undefined) env[key] = value;
    }

    return {
        plugins: [react(), serviceWorkerPlugin(), chatApiPlugin(env)],
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
            },
        },
        server: {
            port: 5173,
            open: true,
        },
    };
});
