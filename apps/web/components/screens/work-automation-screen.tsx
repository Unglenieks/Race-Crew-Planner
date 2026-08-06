"use client";

import { WorkAutomation } from "@/components/work-automation";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function WorkAutomationScreen() {
  const { event } = useEventWorkspace();

  return (
    <WorkspaceScreen id="work-automation">
      <WorkAutomation eventId={event.id} />
    </WorkspaceScreen>
  );
}
