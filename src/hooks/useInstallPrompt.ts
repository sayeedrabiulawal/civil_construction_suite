import { useEffect, useState } from "react";

/** Chrome/Edge fire this; Safari and Firefox do not support it yet. */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Exposes the browser's install prompt so the app can offer an "Install" button.
 * `canInstall` is false on browsers that install through their own menu instead.
 */
export function useInstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
        null,
    );
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const alreadyStandalone =
            window.matchMedia?.("(display-mode: standalone)").matches ?? false;
        if (alreadyStandalone) setInstalled(true);

        const onPrompt = (event: Event) => {
            // Stop the browser's own mini-infobar so the in-app button is the only prompt.
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };

        const onInstalled = () => {
            setInstalled(true);
            setDeferred(null);
        };

        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const install = async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
    };

    return { canInstall: deferred !== null && !installed, install };
}
