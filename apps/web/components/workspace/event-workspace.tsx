"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EventRole, EventSummary } from "@/lib/events-api";

type EventWorkspaceValue = {
  /** The event currently open in the workspace. */
  event: EventSummary;
  /** Every event the signed-in operator can reach, for the switcher. */
  events: EventSummary[];
  role: EventRole;
};

const EventWorkspaceContext = createContext<EventWorkspaceValue | null>(null);

export function EventWorkspaceProvider({
  event,
  events,
  children,
}: {
  event: EventSummary;
  events: EventSummary[];
  children: ReactNode;
}) {
  return (
    <EventWorkspaceContext.Provider value={{ event, events, role: event.role }}>
      {children}
    </EventWorkspaceContext.Provider>
  );
}

/**
 * Reads the open event. Throws rather than returning a placeholder so a screen
 * rendered outside the workspace shell fails loudly instead of inventing data,
 * which is how the previous sidebar ended up showing a hard-coded event.
 */
export function useEventWorkspace(): EventWorkspaceValue {
  const value = useContext(EventWorkspaceContext);
  if (value === null) {
    throw new Error(
      "useEventWorkspace must be used inside the event workspace shell.",
    );
  }
  return value;
}
