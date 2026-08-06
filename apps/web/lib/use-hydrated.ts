import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Whether the component has hydrated on the client.
 *
 * Useful for values the server cannot compute identically, such as anything
 * derived from the runtime's ICU data or the user's own locale. Implemented with
 * `useSyncExternalStore` rather than `useState` in an effect so it does not
 * trigger a cascading render, and so the server snapshot is explicit.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
