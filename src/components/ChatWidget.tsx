import { useEffect, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import { isChatOpen, setChatOpen, toggleChat } from "@/store/chatStore";
import { useStoreVersion } from "@/store/useStore";

/**
 * The assistant, available from every screen.
 *
 * Rendered as a fixed launcher plus a panel rather than a route, so the
 * conversation survives navigation — asking about one calculator and then
 * clicking through to another is the whole point of the feature.
 *
 * `App` keeps this mounted everywhere except `/assistant`, where the same panel
 * is already on the page at full size.
 */
export default function ChatWidget() {
    useStoreVersion();

    const open = isChatOpen();
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape closes the panel, which is what a dialog is expected to do.
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setChatOpen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open]);

    return (
        <>
            <button
                type="button"
                className="chat-launcher"
                aria-expanded={open}
                aria-controls="chat-widget-panel"
                aria-label={
                    open ? "Hide the AI assistant" : "Ask the AI assistant"
                }
                title="Ask the AI assistant"
                onClick={toggleChat}
            >
                <span aria-hidden="true">{open ? "✕" : "✨"}</span>
                <span className="chat-launcher-label">Ask AI</span>
            </button>

            {open && (
                <div
                    id="chat-widget-panel"
                    ref={panelRef}
                    className="chat-widget"
                    role="dialog"
                    aria-label="AI assistant"
                >
                    <ChatPanel
                        variant="panel"
                        onClose={() => setChatOpen(false)}
                    />
                </div>
            )}
        </>
    );
}
