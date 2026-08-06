"use client";

import { RecordsDirectory } from "@/components/records-directory";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function RecordsScreen() {
  const { event, role } = useEventWorkspace();

  return (
    <WorkspaceScreen id="records">
      <RecordsDirectory eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
