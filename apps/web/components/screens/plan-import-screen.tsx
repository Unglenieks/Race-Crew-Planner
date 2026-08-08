"use client";

import { PlanImport } from "@/components/plan-import";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function PlanImportScreen() {
  const { event, role } = useEventWorkspace();
  return (
    <WorkspaceScreen id="plan-import">
      <PlanImport eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
