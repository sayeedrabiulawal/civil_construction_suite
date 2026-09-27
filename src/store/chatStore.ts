import type {
    ChatContext,
    ChatMessage,
    ChatStatus,
    ChatThread,
} from "@/core/chat";
import {
    deriveTitle,
    fetchChatStatus,
    newChatId,
    streamChat,
    toRequestMessages,
} from "@/core/chat";
import { emit, readJson, writeJson } from "./pubsub";

const THREADS_KEY = "ccs.chat.threads.v1";
const ACTIVE_KEY = "ccs.chat.active.v1";
const OPEN_KEY = "ccs.chat.open.v1";

const MAX_THREADS = 20;
const MAX_MESSAGES_PER_THREAD = 80;
const DEFAULT_TITLE = "New chat";

/**
 * Re-render window while tokens are arriving.
 *
 * A stream can deliver dozens of chunks a second, and every `emit()` re-renders
 * the whole app (that is how `useStoreVersion` works). Coalescing to roughly ten
 * frames a second keeps streaming smooth without re-rendering on every token.
 * localStorage is *not* touched per frame — only when a turn settles.
 */
const FRAME_MS = 90;

/* -------------------------------- State -------------------------------- */

let threads: ChatThread[] = loadThreads();
let activeId: string | null = loadActiveId();
let open = readJson<boolean>(OPEN_KEY, false);
let streaming = false;
let abort: AbortController | null = null;
let frameTimer: ReturnType<typeof setTimeout> | null = null;

let status: ChatStatus | null = null;
let statusError: string | null = null;
let statusLoading = false;
let statusRequest: Promise<void> | null = null;

/* ------------------------------ Persistence ------------------------------ */

function loadThreads(): ChatThread[] {
    const raw = readJson<unknown>(THREADS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw
        .map(normaliseThread)
        .filter((t): t is ChatThread => t !== null)
        .slice(0, MAX_THREADS);
}

/**
 * Stored chats may come from an older build or a half-written record, so every
 * field is coerced rather than trusted. A corrupt thread must never stop the
 * assistant from opening.
 */
function normaliseThread(raw: unknown): ChatThread | null {
    if (!raw || typeof raw !== "object") return null;
    const t = raw as Partial<ChatThread>;
    if (typeof t.id !== "string" || !t.id) return null;

    const messages: ChatMessage[] = Array.isArray(t.messages)
        ? t.messages
              .map(normaliseMessage)
              .filter((m): m is ChatMessage => m !== null)
              .slice(-MAX_MESSAGES_PER_THREAD)
        : [];

    return {
        id: t.id,
        title: typeof t.title === "string" && t.title ? t.title : DEFAULT_TITLE,
        createdAt: numOr(t.createdAt, Date.now()),
        updatedAt: numOr(t.updatedAt, Date.now()),
        messages,
    };
}

function normaliseMessage(raw: unknown): ChatMessage | null {
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Partial<ChatMessage>;
    if (m.role !== "user" && m.role !== "assistant") return null;

    return {
        id: typeof m.id === "string" && m.id ? m.id : newChatId("m"),
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
        at: numOr(m.at, Date.now()),
        // A stream cannot survive a page load, so nothing is pending on boot.
        pending: false,
        error: typeof m.error === "string" ? m.error : undefined,
        stopped: m.stopped === true ? true : undefined,
    };
}

function loadActiveId(): string | null {
    const stored = readJson<string | null>(ACTIVE_KEY, null);
    if (typeof stored !== "string") return null;
    return threads.some((t) => t.id === stored) ? stored : null;
}

function numOr(value: unknown, fallback: number): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function persist(): void {
    writeJson(THREADS_KEY, threads);
    writeJson(ACTIVE_KEY, activeId);
}

/** Immediate emit + persist: correct for anything the user did. */
function flush(): void {
    cancelFrame();
    persist();
    emit();
}

/** Coalesced emit only: for token-by-token updates during a stream. */
function scheduleEmit(): void {
    if (frameTimer !== null) return;
    frameTimer = setTimeout(() => {
        frameTimer = null;
        emit();
    }, FRAME_MS);
}

function cancelFrame(): void {
    if (frameTimer === null) return;
    clearTimeout(frameTimer);
    frameTimer = null;
}

/* ------------------------------- Reading -------------------------------- */

export function isChatOpen(): boolean {
    return open;
}

/** Threads newest first, which is the order the switcher shows them in. */
export function getChatThreads(): ChatThread[] {
    return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveThreadId(): string | null {
    return activeId;
}

export function getActiveThread(): ChatThread | undefined {
    return threads.find((t) => t.id === activeId);
}

export function getChatMessages(): ChatMessage[] {
    return getActiveThread()?.messages ?? [];
}

export function isChatStreaming(): boolean {
    return streaming;
}

export function getChatStatus(): ChatStatus | null {
    return status;
}

export function getChatStatusError(): string | null {
    return statusError;
}

export function isChatStatusLoading(): boolean {
    return statusLoading;
}

/* ------------------------------- Mutations ------------------------------- */

export function setChatOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    writeJson(OPEN_KEY, open);
    emit();
}

export function toggleChat(): void {
    setChatOpen(!open);
}

export function setActiveThread(id: string | null): void {
    if (id !== null && !threads.some((t) => t.id === id)) return;
    activeId = id;
    flush();
}

/** Starts a blank chat; the thread itself is created on the first message. */
export function startNewChat(): void {
    stopChat();
    activeId = null;
    flush();
}

export function deleteThread(id: string): void {
    if (
        streaming &&
        threads.find((t) => t.id === id)?.messages.some((m) => m.pending)
    ) {
        stopChat();
    }

    threads = threads.filter((t) => t.id !== id);
    if (activeId === id) activeId = threads[0]?.id ?? null;
    flush();
}

export function clearChatThreads(): void {
    stopChat();
    threads = [];
    activeId = null;
    flush();
}

export function stopChat(): void {
    abort?.abort();
}

/* -------------------------------- Status -------------------------------- */

/**
 * Asks the backend once whether it has a provider configured. Kicked off lazily
 * (the widget is closed for most sessions, and this is a network round trip),
 * and never re-run unless the user asks for a retry after a failure.
 */
export function loadChatStatus(force = false): Promise<void> {
    if (!force) {
        if (statusRequest) return statusRequest;
        if (status !== null) return Promise.resolve();
    }

    statusLoading = true;
    statusError = null;
    emit();

    statusRequest = fetchChatStatus()
        .then((value) => {
            status = value;
        })
        .catch((error: unknown) => {
            status = null;
            statusError =
                error instanceof Error
                    ? error.message
                    : "Could not reach the assistant endpoint.";
        })
        .finally(() => {
            statusLoading = false;
            statusRequest = null;
            emit();
        });

    return statusRequest;
}

/* ------------------------------ Conversation ------------------------------ */

/**
 * Appends the turn, streams the answer into it, and settles it.
 *
 * Deliberately not re-entrant: a second send while a stream is open is ignored,
 * because the two answer streams would interleave into the same message list.
 */
export async function sendChat(
    text: string,
    context?: ChatContext,
): Promise<void> {
    const prompt = text.trim();
    if (!prompt || streaming) return;

    const thread = ensureThread();

    const question: ChatMessage = {
        id: newChatId("m"),
        role: "user",
        content: prompt,
        at: Date.now(),
    };
    const answer: ChatMessage = {
        id: newChatId("m"),
        role: "assistant",
        content: "",
        at: Date.now(),
        pending: true,
    };

    thread.messages.push(question, answer);
    thread.updatedAt = Date.now();
    if (thread.title === DEFAULT_TITLE) thread.title = deriveTitle(prompt);
    trim(thread);

    // Snapshot before the placeholder starts filling in: the request must not
    // carry the empty assistant turn alongside the question.
    const history = toRequestMessages(thread.messages);

    const controller = new AbortController();
    abort = controller;
    streaming = true;
    flush();

    try {
        await streamChat({
            messages: history,
            context,
            signal: controller.signal,
            onDelta: (delta) => {
                answer.content += delta;
                scheduleEmit();
            },
        });

        if (!answer.content.trim()) {
            answer.content =
                "The assistant returned an empty answer. Please try again.";
        }
    } catch (error) {
        if (controller.signal.aborted) {
            answer.stopped = true;
            if (!answer.content.trim()) answer.content = "Stopped.";
        } else {
            answer.error =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while answering.";
        }
    } finally {
        answer.pending = false;
        answer.at = Date.now();
        thread.updatedAt = Date.now();
        streaming = false;
        abort = null;
        flush();
    }
}

function ensureThread(): ChatThread {
    const existing = threads.find((t) => t.id === activeId);
    if (existing) return existing;

    const thread: ChatThread = {
        id: newChatId("chat"),
        title: DEFAULT_TITLE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
    };

    threads = [thread, ...threads].slice(0, MAX_THREADS);
    activeId = thread.id;
    return thread;
}

/** Keeps a thread bounded, always cutting on a user/assistant pair boundary. */
function trim(thread: ChatThread): void {
    if (thread.messages.length <= MAX_MESSAGES_PER_THREAD) return;
    thread.messages = thread.messages.slice(-MAX_MESSAGES_PER_THREAD);
}
