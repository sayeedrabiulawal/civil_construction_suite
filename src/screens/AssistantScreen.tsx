import { useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import { loadChatStatus } from "@/store/chatStore";

/**
 * The assistant as a full page (`/assistant`).
 *
 * Same panel as the floating widget, given the whole content column: on a phone
 * this is the comfortable way to use it, and it is the only surface that can be
 * linked to.
 */
export default function AssistantScreen() {
    useEffect(() => {
        void loadChatStatus();
    }, []);

    return (
        <section className="assistant-screen">
            <header className="assistant-intro">
                <h1>AI Assistant</h1>
                <p>
                    A civil engineering assistant that knows every calculator in
                    this app. Ask about mix proportions, quantities, steel
                    weights, foundations or hydraulics — it will work through
                    the numbers and link you to the calculator that does it for
                    you.
                </p>
            </header>

            <ChatPanel variant="page" />
        </section>
    );
}
