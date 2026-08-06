"use client";

import { EventContacts } from "@/components/event-contacts";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function PeopleScreen() {
  const { event } = useEventWorkspace();

  return (
    <WorkspaceScreen id="people">
      <EventContacts eventId={event.id} />
    </WorkspaceScreen>
  );
}
