"use client";

import { ActivitySources } from "@/components/activity-sources";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function ActivityScreen() {
  const { event } = useEventWorkspace();

  return (
    <WorkspaceScreen id="activity">
      <ActivitySources eventId={event.id} />
    </WorkspaceScreen>
  );
}
