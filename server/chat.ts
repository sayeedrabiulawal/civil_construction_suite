/**
 * Backend for the Civil Suite assistant.
 *
 * This module deliberately knows nothing about the host. It speaks only Web
 * standards (Request / Response / ReadableStream) so the very same code serves
 * the Vercel Edge Function in production and the Vite dev middleware on
 * localhost. It also imports nothing from `src/`, because the serverless build
 * has no `@` path alias — the calculator catalogue is sent up by the client,
 * which is the side that actually ships the catalogue.
 *
 * It targets the OpenAI `/chat/completions` shape, which is the one wire format
 * shared by Google AI Studio, Groq, OpenRouter, Cerebras and a local Ollama
 * server. Every one of those has a no-card free tier, so the assistant can run
 * without anyone paying for it:
 *
 *   Google AI Studio  AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 *   Groq              AI_BASE_URL=https://api.groq.com/openai/v1
 *   OpenRouter        AI_BASE_URL=https://openrouter.ai/api/v1   (use a :free model)
 *   Ollama (local)    AI_BASE_URL=http://localhost:11434/v1      (no key needed)
 */

/* ------------------------------- Types ------------------------------- */

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
    role: ChatRole;
    content: string;
}

export interface ChatContext {
    /** Route the user is looking at, e.g. `/calc/concrete-mix-design`. */
    path?: string;
    /** Human name of the calculator on screen, when there is one. */
    calculator?: string;
}

export interface ChatRequestBody {
    messages?: unknown;
    catalog?: unknown;
    context?: unknown;
}

/** A plain map of environment variables. Kept narrow so tests can inject one. */
export type ChatEnv = Record<string, string | undefined>;

export interface AiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    /** Human-facing provider name shown in the UI. */
    label: string;
}

/* ------------------------------ Limits ------------------------------- */

const MAX_BODY_CHARS = 200_000;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 6_000;
const MAX_CATALOG_CHARS = 24_000;
const MAX_OUTPUT_TOKENS = 1_500;
/** Hard cap on a single upstream call so a hung provider cannot pin the function. */
const UPSTREAM_TIMEOUT_MS = 60_000;

/** Free tier, no credit card. Override with AI_BASE_URL / AI_MODEL. */
const DEFAULT_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-2.5-flash";

const SETUP_HINT =
    "The assistant is not configured on this deployment yet. Set AI_BASE_URL, " +
    "AI_API_KEY and AI_MODEL in the environment (see .env.example) — a free " +
    "tier from Google AI Studio, Groq or OpenRouter works, or point " +
    "AI_BASE_URL at a local Ollama server for zero cost.";

/* ----------------------------- Configuration ----------------------------- */

export function resolveConfig(env: ChatEnv): AiConfig {
    const baseUrl = (
        env.AI_BASE_URL ||
        env.OPENAI_BASE_URL ||
        DEFAULT_BASE_URL
    ).replace(/\/+$/, "");

    return {
        baseUrl,
        apiKey: env.AI_API_KEY || env.OPENAI_API_KEY || "",
        model: env.AI_MODEL || env.OPENAI_MODEL || DEFAULT_MODEL,
        label: env.AI_PROVIDER_LABEL || labelFor(baseUrl),
    };
}

function labelFor(baseUrl: string): string {
    if (baseUrl.includes("generativelanguage.googleapis.com"))
        return "Google AI Studio";
    if (baseUrl.includes("api.groq.com")) return "Groq";
    if (baseUrl.includes("openrouter.ai")) return "OpenRouter";
    if (baseUrl.includes("api.openai.com")) return "OpenAI";
    if (isLoopback(baseUrl)) return "Local model";
    return "Custom endpoint";
}

function isLoopback(baseUrl: string): boolean {
    try {
        const { hostname } = new URL(baseUrl);
        return (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname === "[::1]"
        );
    } catch {
        return false;
    }
}

/**
 * A local model server needs no credentials; every hosted provider does. This
 * is what lets `ollama serve` be a valid zero-cost configuration.
 */
export function isConfigured(config: AiConfig): boolean {
    return config.apiKey.length > 0 || isLoopback(config.baseUrl);
}

/* ---------------------------- System prompt ---------------------------- */

/**
 * Grounding note: the model is *told* which calculators exist, so it can point
 * at them instead of inventing an id that produces a 404 for the user.
 */
const PERSONA = `You are the AI assistant built into Civil Construction Suite, an
offline-capable web app of civil engineering calculators used mostly by site
engineers, quantity surveyors and students.

How to answer:
- Be concise and practical. Lead with the answer or the number, then the working.
- Prefer SI units (mm, m, kN, kPa, kg, m³, MPa) and say which unit you are using.
  If the user writes in feet/inches or pounds, answer in both.
- Write maths as plain text, not LaTeX: use ×, ÷, √, ≈, ·, and Unicode
  superscripts/subscripts such as m³, m², σc. Never emit $...$ or \\frac.
- Show the governing formula, then substitute the numbers, then the result.
- State your assumptions. Engineering answers depend on them, and the user may
  be checking you rather than being taught.
- Quote standard values (grades, densities, allowable stresses) with the code or
  table they come from. If a value is a typical range rather than a fixed one,
  say so.
- Use a short markdown list or a small table when comparing options. Keep tables
  to four or five columns so they stay readable on a phone.

Formatting rules:
- Markdown is supported: **bold**, *italic*, \`code\`, lists, > quotes and tables.
- Do not use headings larger than ###. Do not wrap the whole answer in a code block.

Pointing at the app's calculators:
- The catalogue below lists every calculator in this build as
  \`id | name — summary [tags]\`. It is the only source of valid ids.
- When a calculator answers the question, link it as a markdown link, e.g.
  [Concrete Mix Design](/calc/concrete-mix-design). Never invent an id.
- Never tell the user to "go to the settings page" or perform steps the app
  cannot do; the calculators are reachable from the sidebar and from search.

Limits:
- You cannot see the user's screen or the numbers in their calculator. Ask for
  the missing inputs instead of guessing.
- These calculators are aids, not a design check. For anything safety-critical —
  structural member sizing, retaining walls, foundations, formwork — give the
  method but tell the user the result must be verified by a qualified engineer
  against the governing code.
- If a question is outside civil engineering and construction, say so briefly and
  steer back to what the app does.`;

export function buildSystemPrompt(catalog: unknown, context: unknown): string {
    const sections = [PERSONA];

    const trimmedCatalog =
        typeof catalog === "string"
            ? catalog.trim().slice(0, MAX_CATALOG_CHARS)
            : "";

    if (trimmedCatalog) {
        sections.push(
            [
                "Calculator catalogue for this build, as `id | name — summary [tags]`:",
                "<calculators>",
                trimmedCatalog,
                "</calculators>",
            ].join("\n"),
        );
    } else {
        sections.push(
            "No calculator catalogue was supplied for this build, so do not link " +
                "to any calculator; answer in general terms instead.",
        );
    }

    const ctx = context as ChatContext | undefined;
    if (ctx && (ctx.calculator || ctx.path)) {
        const where = ctx.calculator
            ? `the "${ctx.calculator}" calculator page`
            : `the page at ${ctx.path}`;
        sections.push(
            `The user currently has ${where} open. Keep that in mind for ` +
                `follow-ups such as "explain this" or "what does that mean", but ` +
                `do not assume they have typed anything into it.`,
        );
    }

    return sections.join("\n\n");
}

/* ----------------------------- Entry point ----------------------------- */

export async function handleChatRequest(
    request: Request,
    env: ChatEnv = processEnv(),
): Promise<Response> {
    const config = resolveConfig(env);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }

    if (request.method === "GET" || request.method === "HEAD") {
        const ready = isConfigured(config);
        return json(200, {
            configured: ready,
            provider: config.label,
            model: ready ? config.model : null,
            setup: ready ? undefined : SETUP_HINT,
        });
    }

    if (request.method !== "POST") {
        return json(405, {
            error: "method_not_allowed",
            message: "Use POST to send a chat turn.",
        });
    }

    if (!isConfigured(config)) {
        return json(503, {
            error: "not_configured",
            message: SETUP_HINT,
        });
    }

    let body: ChatRequestBody;
    try {
        body = await readBody(request);
    } catch (error) {
        return json(400, {
            error: "bad_request",
            message:
                error instanceof Error
                    ? error.message
                    : "Invalid request body.",
        });
    }

    const messages = sanitiseMessages(body.messages);
    if (messages.length === 0) {
        return json(400, {
            error: "empty_conversation",
            message: "Send at least one non-empty user message.",
        });
    }

    const controller = new AbortController();
    const stopTimer = startTimeout(controller);
    const relayAbort = () => controller.abort();
    request.signal?.addEventListener("abort", relayAbort);

    const release = () => {
        stopTimer();
        request.signal?.removeEventListener("abort", relayAbort);
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
    };
    // Ollama ignores credentials, but some gateways reject an empty bearer.
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    let upstream: Response;
    try {
        upstream = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({
                model: config.model,
                stream: true,
                temperature: 0.3,
                max_tokens: MAX_OUTPUT_TOKENS,
                messages: [
                    {
                        role: "system",
                        content: buildSystemPrompt(body.catalog, body.context),
                    },
                    ...messages,
                ],
            }),
        });
    } catch (error) {
        release();
        return json(502, {
            error: "upstream_unreachable",
            message: describeTransportError(error, config),
        });
    }

    if (!upstream.ok || !upstream.body) {
        const detail = await readTextSafely(upstream);
        release();
        return json(upstream.status >= 400 ? upstream.status : 502, {
            error: "upstream_error",
            status: upstream.status,
            message: describeUpstreamError(upstream.status, detail, config),
        });
    }

    return new Response(normaliseStream(upstream.body, config, release), {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            // no-transform stops a proxy buffering the stream into one blob.
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

/* ------------------------------ Streaming ------------------------------ */

/**
 * Re-emits the provider's SSE as a small, stable protocol the client can parse
 * without knowing which provider answered:
 *
 *   data: {"type":"delta","text":"..."}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 *   data: [DONE]\n\n
 */
function normaliseStream(
    source: ReadableStream<Uint8Array>,
    config: AiConfig,
    onEnd: () => void,
): ReadableStream<Uint8Array> {
    const reader = source.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let finished = false;

    const stop = (controller: ReadableStreamDefaultController<Uint8Array>) => {
        if (finished) return;
        finished = true;
        controller.enqueue(encoder.encode(frame({ type: "done" })));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        onEnd();
    };

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            if (finished) return;

            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
                chunk = await reader.read();
            } catch (error) {
                finished = true;
                controller.enqueue(
                    encoder.encode(
                        frame({
                            type: "error",
                            message: describeTransportError(error, config),
                        }),
                    ),
                );
                controller.close();
                onEnd();
                return;
            }

            if (chunk.done) {
                stop(controller);
                return;
            }

            buffer += decoder.decode(chunk.value, { stream: true });

            // SSE events are newline delimited; keep the trailing partial line.
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith(":")) continue;
                if (!line.startsWith("data:")) continue;

                const data = line.slice(5).trim();
                if (data === "[DONE]") {
                    stop(controller);
                    return;
                }

                const text = extractDelta(data);
                if (text) {
                    controller.enqueue(
                        encoder.encode(frame({ type: "delta", text })),
                    );
                }
            }
        },

        cancel(reason) {
            finished = true;
            onEnd();
            void reader.cancel(reason).catch(() => undefined);
        },
    });
}

/** Pulls the incremental text out of one provider chunk, if it has any. */
function extractDelta(data: string): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(data);
    } catch {
        return "";
    }

    const choice = (
        parsed as {
            choices?: {
                delta?: { content?: unknown; reasoning_content?: unknown };
                message?: { content?: unknown };
                text?: unknown;
            }[];
        }
    )?.choices?.[0];

    if (!choice) return "";

    const candidate =
        choice.delta?.content ?? choice.message?.content ?? choice.text;

    if (typeof candidate === "string") return candidate;

    // Some gateways send content as an array of parts.
    if (Array.isArray(candidate)) {
        return candidate
            .map((part) =>
                typeof part === "string"
                    ? part
                    : typeof (part as { text?: unknown })?.text === "string"
                      ? (part as { text: string }).text
                      : "",
            )
            .join("");
    }

    return "";
}

function frame(payload: unknown): string {
    return `data: ${JSON.stringify(payload)}\n\n`;
}

/* ------------------------------ Utilities ------------------------------ */

function processEnv(): ChatEnv {
    return typeof process === "undefined" ? {} : (process.env as ChatEnv);
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

async function readBody(request: Request): Promise<ChatRequestBody> {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) {
        throw new Error("Conversation is too long to send.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Body must be valid JSON.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Body must be a JSON object.");
    }

    return parsed as ChatRequestBody;
}

/**
 * Trust nothing from the wire: every turn is re-typed, re-trimmed and capped,
 * and only the tail of a long conversation is kept. The catalogue already
 * travels in the system prompt, so old turns are the cheapest thing to drop.
 */
function sanitiseMessages(input: unknown): ChatTurn[] {
    if (!Array.isArray(input)) return [];

    const turns: ChatTurn[] = [];
    for (const item of input) {
        if (!item || typeof item !== "object") continue;

        const { role, content } = item as { role?: unknown; content?: unknown };
        if (role !== "user" && role !== "assistant") continue;
        if (typeof content !== "string") continue;

        const text = content.trim();
        if (!text) continue;

        turns.push({ role, content: text.slice(0, MAX_MESSAGE_CHARS) });
    }

    return turns.slice(-MAX_MESSAGES);
}

function startTimeout(controller: AbortController): () => void {
    // Edge runtimes provide both; the guard keeps the module importable in a
    // bare test environment.
    if (typeof setTimeout !== "function") return () => undefined;
    const handle = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    return () => clearTimeout(handle);
}

async function readTextSafely(response: Response): Promise<string> {
    try {
        return (await response.text()).slice(0, 800);
    } catch {
        return "";
    }
}

function describeTransportError(error: unknown, config: AiConfig): string {
    const name = (error as { name?: string })?.name;
    if (name === "AbortError") {
        return `The request to ${config.label} timed out. Try a shorter question, or retry.`;
    }
    return `Could not reach ${config.label} at ${config.baseUrl}. Check the endpoint and the deployment's network access.`;
}

function describeUpstreamError(
    status: number,
    detail: string,
    config: AiConfig,
): string {
    const note = extractProviderMessage(detail);

    if (status === 401 || status === 403) {
        return `${config.label} rejected the API key. Check AI_API_KEY in the environment.${note}`;
    }
    if (status === 404) {
        return `${config.label} does not offer a model called "${config.model}". Set AI_MODEL to a model your account can use.${note}`;
    }
    if (status === 429) {
        return `${config.label}'s rate limit was reached. Free tiers allow only a few requests per minute — wait a moment and try again.${note}`;
    }
    if (status === 400 || status === 422) {
        return `${config.label} rejected the request.${note || ` ${detail.slice(0, 200)}`}`;
    }
    if (status >= 500) {
        return `${config.label} reported a server error (${status}). This is usually temporary.${note}`;
    }
    return `The assistant request failed with status ${status}.${note}`;
}

/** Digs the human-readable sentence out of a provider's JSON error body. */
function extractProviderMessage(detail: string): string {
    if (!detail.trim()) return "";
    try {
        const parsed = JSON.parse(detail) as {
            error?: { message?: unknown } | string;
            message?: unknown;
        };
        const message =
            typeof parsed.error === "string"
                ? parsed.error
                : (parsed.error?.message ?? parsed.message);
        if (typeof message === "string" && message.trim()) {
            return ` Provider said: ${message.trim().slice(0, 300)}`;
        }
    } catch {
        // Not JSON — fall through to the raw text.
    }
    const plain = detail.replace(/<[^>]*>/g, " ").trim();
    return plain ? ` Provider said: ${plain.slice(0, 300)}` : "";
}
