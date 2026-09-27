/**
 * Client half of the AI assistant.
 *
 * `core/` stays free of React and of the DOM beyond `fetch`, so everything the
 * store and the components need to know about the wire protocol lives here:
 * how the calculator catalogue is described to the model, how a streamed answer
 * is parsed, and how a failure is turned into a sentence worth showing a user.
 */
import { CATEGORIES } from "./categories";
import { CALCULATORS } from "./registry";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    at: number;
    /** True while tokens are still arriving for this message. */
    pending?: boolean;
    /** Set when the stream failed; `content` may still hold a partial answer. */
    error?: string;
    /** True when the user pressed Stop rather than the request failing. */
    stopped?: boolean;
}

export interface ChatThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
}

/** What the serverless function reports about its own configuration. */
export interface ChatStatus {
    configured: boolean;
    provider: string;
    model: string | null;
    setup?: string;
}

export interface ChatContext {
    path?: string;
    calculator?: string;
}

export const CHAT_ENDPOINT = "/api/chat";

/** Starter prompts, chosen to show off the calculators rather than the model. */
export const SUGGESTIONS: string[] = [
    "How much cement, sand and aggregate do I need for 1 m³ of M25?",
    "What is the unit weight of a 16 mm TMT bar, and how is it derived?",
    "My slab is 4.5 m × 3.2 m × 125 mm. How much concrete and steel?",
    "Explain the difference between dry and wet volume in concrete mixes.",
];

/* --------------------------------- Ids --------------------------------- */

export function newChatId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

/* ----------------------------- The catalogue ----------------------------- */

let catalogue: string | null = null;

/**
 * A compact, human-readable map of every calculator in THIS build, sent up with
 * each request so the model can deep-link instead of guessing an id.
 *
 * Built on the client on purpose: the serverless bundle has no access to the
 * app's registry, and this way the catalogue can never describe a calculator the
 * deployed bundle does not contain. Cached because the registry is static.
 */
export function buildCatalogue(): string {
    if (catalogue !== null) return catalogue;

    const out: string[] = [];
    for (const category of CATEGORIES) {
        const items = CALCULATORS.filter((c) => c.category === category.id);
        if (items.length === 0) continue;

        out.push(`${category.name}:`);
        for (const calc of items) {
            const tags = (calc.tags ?? []).slice(0, 6).join(", ");
            out.push(
                `- ${calc.id} | ${calc.name} — ${shorten(calc.summary, 110)}` +
                    (tags ? ` [${tags}]` : ""),
            );
        }
    }

    catalogue = out.join("\n");
    return catalogue;
}

function shorten(text: string, limit: number): string {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

/* -------------------------------- Status -------------------------------- */

/** Asks the backend what it is configured with, without sending a question. */
export async function fetchChatStatus(
    signal?: AbortSignal,
): Promise<ChatStatus> {
    const response = await fetch(CHAT_ENDPOINT, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
    });

    if (!response.ok) {
        throw new Error(
            response.status === 404
                ? "The assistant endpoint is missing from this deployment."
                : `The assistant endpoint replied with status ${response.status}.`,
        );
    }

    return (await response.json()) as ChatStatus;
}

/* ------------------------------- Streaming ------------------------------- */

interface StreamFrame {
    type?: string;
    text?: string;
    message?: string;
}

export interface ChatStreamOptions {
    messages: { role: ChatRole; content: string }[];
    context?: ChatContext;
    signal?: AbortSignal;
    onDelta: (text: string) => void;
}

/**
 * Sends a conversation and reports tokens as they arrive.
 *
 * Resolves when the answer is complete. An error frame thrown mid-stream still
 * leaves the caller holding whatever text arrived first, which the store keeps
 * so a half-finished answer is never silently thrown away.
 */
export async function streamChat(options: ChatStreamOptions): Promise<void> {
    const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
        },
        signal: options.signal,
        body: JSON.stringify({
            messages: options.messages,
            catalog: buildCatalogue(),
            context: options.context,
        }),
    });

    if (!response.ok) throw new Error(await describeFailure(response));
    if (!response.body)
        throw new Error("The assistant returned an empty stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Framed on a blank line, per the SSE spec; hold back the partial tail.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const raw of frames) {
            const payload = parseFrame(raw);
            if (!payload) continue;

            if (payload.type === "delta" && typeof payload.text === "string") {
                options.onDelta(payload.text);
            } else if (payload.type === "error") {
                throw new Error(
                    payload.message ?? "The assistant stopped unexpectedly.",
                );
            }
        }
    }
}

function parseFrame(raw: string): StreamFrame | null {
    const data = raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

    if (!data || data === "[DONE]") return null;

    try {
        const parsed = JSON.parse(data) as unknown;
        return parsed && typeof parsed === "object"
            ? (parsed as StreamFrame)
            : null;
    } catch {
        // A truncated frame is not worth failing the whole answer over.
        return null;
    }
}

/** Turns a failed response into the sentence the user actually sees. */
async function describeFailure(response: Response): Promise<string> {
    let detail = "";
    try {
        detail = await response.text();
    } catch {
        detail = "";
    }

    try {
        const parsed = JSON.parse(detail) as { message?: unknown };
        if (typeof parsed.message === "string" && parsed.message.trim()) {
            return parsed.message.trim();
        }
    } catch {
        // Not JSON — fall through to a status-based message.
    }

    if (response.status === 503) {
        return "The assistant is not configured on this deployment yet.";
    }
    if (response.status === 429) {
        return "Too many requests — the free tier needs a moment to catch up.";
    }
    if (response.status === 404) {
        return "The assistant endpoint is missing from this deployment.";
    }
    if (response.status >= 500) {
        return "The assistant service had a problem. Please try again.";
    }
    return `The assistant request failed (status ${response.status}).`;
}

/* --------------------------------- Text --------------------------------- */

/** First user turn, trimmed to a label that fits the thread switcher. */
export function deriveTitle(text: string): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return "New chat";
    return clean.length <= 44 ? clean : `${clean.slice(0, 43)}…`;
}

/**
 * Turns a stored thread into the turns worth sending.
 *
 * The in-flight assistant placeholder is skipped, and so is anything that ended
 * up empty. A *stopped* answer is kept when it has text, because dropping it
 * would leave two user turns in a row and lose context the model already has.
 */
export function toRequestMessages(
    messages: ChatMessage[],
): { role: ChatRole; content: string }[] {
    return messages
        .filter((m) => !m.pending && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content.trim() }));
}
