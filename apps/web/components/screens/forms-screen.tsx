"use client";

import { FormsInspections } from "@/components/forms-inspections";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function FormsScreen() {
  const { event, role } = useEventWorkspace();

  return (
    <WorkspaceScreen id="forms">
      <FormsInspections eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
