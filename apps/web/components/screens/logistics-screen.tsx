"use client";

import { LogisticsOverview } from "@/components/logistics-overview";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function LogisticsScreen() {
  const { event, role } = useEventWorkspace();
  return (
    <WorkspaceScreen id="logistics">
      <LogisticsOverview eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
