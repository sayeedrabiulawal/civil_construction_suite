import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Markdown from "@/components/Markdown";
import { SUGGESTIONS, type ChatMessage } from "@/core/chat";
import { getCalculator } from "@/core/registry";
import {
    clearChatThreads,
    deleteThread,
    getActiveThreadId,
    getChatMessages,
    getChatStatus,
    getChatStatusError,
    getChatThreads,
    isChatStatusLoading,
    isChatStreaming,
    loadChatStatus,
    sendChat,
    setActiveThread,
    startNewChat,
    stopChat,
} from "@/store/chatStore";
import { useStoreVersion } from "@/store/useStore";

interface Props {
    /** `panel` is the floating widget; `page` fills the assistant route. */
    variant: "panel" | "page";
    onClose?: () => void;
}

/**
 * The assistant's conversation surface.
 *
 * One component serves both entry points: the floating widget and the
 * `/assistant` route differ only in chrome, and duplicating the streaming,
 * autoscroll and composer behaviour for each would guarantee they drift.
 */
export default function ChatPanel({ variant, onClose }: Props) {
    useStoreVersion();

    const location = useLocation();
    const messages = getChatMessages();
    const streaming = isChatStreaming();
    const status = getChatStatus();
    const statusError = getChatStatusError();
    const loading = isChatStatusLoading();
    const threadId = getActiveThreadId();
    const threads = getChatThreads();

    const [draft, setDraft] = useState("");
    const [online, setOnline] = useState(() =>
        typeof navigator === "undefined" ? true : navigator.onLine,
    );

    const logRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    /** False once the user scrolls up, so streaming never yanks the view back. */
    const stickToBottom = useRef(true);

    /**
     * The calculator the user is looking at, if any. Passed to the model so
     * "explain this" resolves without the user naming the calculator.
     */
    const context = useMemo(() => {
        const match = /^\/calc\/([^/?#]+)/.exec(location.pathname);
        const calc = match ? getCalculator(match[1]) : undefined;
        return { path: location.pathname, calculator: calc?.name };
    }, [location.pathname]);

    // Probe the backend the first time the surface is shown. Config errors are
    // rendered, so a failed probe must not be retried on every render.
    useEffect(() => {
        void loadChatStatus();
    }, []);

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);

    // Follow the tail while an answer streams in, but only for a reader who is
    // already at the bottom.
    useEffect(() => {
        const log = logRef.current;
        if (!log || !stickToBottom.current) return;
        log.scrollTop = log.scrollHeight;
    }, [messages, streaming]);

    useEffect(() => {
        if (variant !== "panel") return;
        inputRef.current?.focus();
    }, [variant]);

    // Grow the composer with its content. CSS `field-sizing: content` would do
    // this natively, but it is not in every browser yet, and a two-line question
    // scrolling inside a one-line box is exactly the wrong first impression.
    // Emptied, the inline height is cleared so the CSS default takes over —
    // otherwise the box keeps the height of the message just sent.
    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        if (!draft) {
            input.style.height = "";
            return;
        }

        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }, [draft]);

    const submit = useCallback(
        (text: string) => {
            const prompt = text.trim();
            if (!prompt || streaming) return;
            setDraft("");
            void sendChat(prompt, context);
        },
        [context, streaming],
    );

    const onScroll = () => {
        const log = logRef.current;
        if (!log) return;
        const distance = log.scrollHeight - log.scrollTop - log.clientHeight;
        stickToBottom.current = distance < 48;
    };

    const composer = (
        <form
            className="chat-composer"
            onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
            }}
        >
            <textarea
                ref={inputRef}
                className="chat-input"
                rows={1}
                value={draft}
                placeholder={
                    online
                        ? "Ask a civil engineering question…"
                        : "You are offline — the assistant needs a connection."
                }
                aria-label="Message the assistant"
                disabled={!online}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    // Enter sends; Shift+Enter is a newline, as everywhere else.
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit(draft);
                    }
                }}
            />
            {streaming ? (
                <button
                    type="button"
                    className="icon-button"
                    onClick={stopChat}
                    aria-label="Stop generating"
                >
                    <span aria-hidden="true">■</span>
                    <span className="btn-label">Stop</span>
                </button>
            ) : (
                <button
                    type="submit"
                    className="icon-button primary-button"
                    disabled={!draft.trim() || !online}
                    aria-label="Send message"
                >
                    <span aria-hidden="true">➤</span>
                    <span className="btn-label">Send</span>
                </button>
            )}
        </form>
    );

    return (
        <div className={`chat-surface chat-surface-${variant}`}>
            <header className="chat-head">
                <div className="chat-head-title">
                    <span className="chat-head-mark" aria-hidden="true">
                        ✨
                    </span>
                    <span>
                        <strong>AI Assistant</strong>
                        <small>
                            {status?.configured
                                ? `${status.provider} · ${status.model}`
                                : "Civil engineering help"}
                        </small>
                    </span>
                </div>

                <div className="chat-head-actions">
                    <button
                        type="button"
                        className="icon-button"
                        onClick={startNewChat}
                        aria-label="Start a new chat"
                        title="New chat"
                    >
                        <span aria-hidden="true">＋</span>
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            className="icon-button"
                            onClick={onClose}
                            aria-label="Close the assistant"
                        >
                            <span aria-hidden="true">✕</span>
                        </button>
                    )}
                </div>
            </header>

            {threads.length > 1 && (
                <div className="chat-thread-bar">
                    <select
                        className="chat-thread-select"
                        aria-label="Saved conversations"
                        value={threadId ?? ""}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (value === "__new") startNewChat();
                            else if (value === "__clear") clearChatThreads();
                            else setActiveThread(value);
                        }}
                    >
                        {threadId === null && (
                            <option value="">New chat</option>
                        )}
                        {threads.map((thread) => (
                            <option key={thread.id} value={thread.id}>
                                {thread.title}
                            </option>
                        ))}
                        <option value="__new">＋ New chat</option>
                        <option value="__clear">Clear all chats</option>
                    </select>
                    {threadId !== null && (
                        <button
                            type="button"
                            className="icon-button"
                            onClick={() => deleteThread(threadId)}
                            aria-label="Delete this conversation"
                            title="Delete this conversation"
                        >
                            🗑
                        </button>
                    )}
                </div>
            )}

            {/* Pinned above the log rather than inside it: with an existing
                thread the log opens scrolled to the bottom, which would hide
                the one message that explains why nothing works yet. */}
            {!status?.configured && (
                <div className="chat-setup-wrap">
                    <SetupNotice />
                </div>
            )}

            <div
                className="chat-log"
                ref={logRef}
                onScroll={onScroll}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Conversation"
            >
                {messages.length === 0 && (
                    <div className="chat-intro">
                        <p>
                            Ask in plain language. The assistant knows every
                            calculator in this app and will link you straight to
                            the right one.
                        </p>
                        <ul className="chat-suggest">
                            {SUGGESTIONS.map((prompt) => (
                                <li key={prompt}>
                                    <button
                                        type="button"
                                        onClick={() => submit(prompt)}
                                        disabled={streaming || !online}
                                    >
                                        {prompt}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))}
            </div>

            {statusError && !status && (
                <div className="chat-banner error" role="status">
                    <span>{statusError}</span>
                    <button
                        type="button"
                        className="icon-button"
                        onClick={() => void loadChatStatus(true)}
                        disabled={loading}
                    >
                        {loading ? "Checking…" : "Retry"}
                    </button>
                </div>
            )}

            {!online && (
                <div className="chat-banner warn" role="status">
                    You are offline. Answers need a connection, but every
                    calculator keeps working.
                </div>
            )}

            {composer}

            <p className="chat-disclaimer">
                Answers are aids, not a design check — verify safety-critical
                work against the governing code.
            </p>
        </div>
    );
}

/* ------------------------------ Sub-views ------------------------------ */

function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user";

    return (
        <div className={`chat-msg ${isUser ? "user" : "assistant"}`}>
            <span className="chat-avatar" aria-hidden="true">
                {isUser ? "🙋" : "✨"}
            </span>

            <div className="chat-bubble">
                {isUser ? (
                    <p className="chat-plain">{message.content}</p>
                ) : message.content ? (
                    <Markdown text={message.content} />
                ) : null}

                {message.pending && !message.content && (
                    <p className="chat-typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </p>
                )}

                {message.error && (
                    <p className="chat-msg-error" role="alert">
                        {message.error}
                    </p>
                )}

                {message.stopped && !message.error && (
                    <p className="chat-msg-note">Stopped.</p>
                )}

                {!isUser && !message.pending && message.content && (
                    <div className="chat-msg-actions">
                        <CopyButton text={message.content} />
                    </div>
                )}
            </div>
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            className="icon-button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                } catch {
                    setCopied(false);
                }
            }}
            aria-label="Copy this answer"
        >
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

/**
 * Shown when the deployment has no provider configured. This is the normal
 * state for a fresh clone, so it explains the fix rather than reporting a bug.
 */
function SetupNotice() {
    if (isChatStatusLoading()) {
        return (
            <div className="chat-setup">
                <p>Checking the assistant configuration…</p>
            </div>
        );
    }

    return (
        <div className="chat-setup">
            <strong>The assistant is not switched on yet.</strong>
            <p>
                This deployment has no AI provider configured. Setting one up
                takes a free API key — no card needed:
            </p>
            <ol>
                <li>
                    Get a free key from{" "}
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Google AI Studio
                    </a>
                    ,{" "}
                    <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Groq
                    </a>{" "}
                    or{" "}
                    <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        OpenRouter
                    </a>
                    .
                </li>
                <li>
                    Set <code>AI_BASE_URL</code>, <code>AI_API_KEY</code> and{" "}
                    <code>AI_MODEL</code> in the Vercel project, or in a local{" "}
                    <code>.env</code> (copy <code>.env.example</code>).
                </li>
                <li>
                    Prefer to keep everything local? Point{" "}
                    <code>AI_BASE_URL</code> at a local Ollama server — that
                    costs nothing at all.
                </li>
            </ol>
            <p>
                Meanwhile, all 100+ calculators work offline exactly as before.{" "}
                <Link to="/">Browse them →</Link>
            </p>
        </div>
    );
}
