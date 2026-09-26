import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./pubsub";

/**
 * Re-renders the calling component whenever any persisted store changes
 * (favourites, history, theme or BOQ). Returns the store version, which is
 * handy as a memo dependency.
 */
export function useStoreVersion(): number {
    return useSyncExternalStore(subscribe, getVersion, () => 0);
}
