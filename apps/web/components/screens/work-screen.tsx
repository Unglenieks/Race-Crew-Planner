"use client";

import { WorkChecklist } from "@/components/work-checklist";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function WorkScreen() {
  const { event, role } = useEventWorkspace();

  return (
    <WorkspaceScreen id="work">
      <WorkChecklist eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
