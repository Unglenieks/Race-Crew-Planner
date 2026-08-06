"use client";

import { PlanSections } from "@/components/plan-sections";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function PlanSectionsScreen() {
  const { event, role } = useEventWorkspace();

  return (
    <WorkspaceScreen id="plan-sections">
      <PlanSections eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
