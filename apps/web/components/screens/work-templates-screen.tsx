"use client";

import { WorkTemplates } from "@/components/work-templates";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function WorkTemplatesScreen() {
  const { event } = useEventWorkspace();

  return (
    <WorkspaceScreen id="work-templates">
      <WorkTemplates eventId={event.id} />
    </WorkspaceScreen>
  );
}
