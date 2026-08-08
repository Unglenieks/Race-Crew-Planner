"use client";

import { EventInfo } from "@/components/event-info";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function EventInfoScreen() {
  return (
    <WorkspaceScreen id="event-info">
      <EventInfo />
    </WorkspaceScreen>
  );
}
