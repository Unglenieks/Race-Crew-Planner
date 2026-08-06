"use client";

import { AttentionQueue } from "@/components/attention-queue";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function AttentionScreen() {
  const { event } = useEventWorkspace();

  return (
    <WorkspaceScreen id="attention">
      <AttentionQueue eventId={event.id} />
    </WorkspaceScreen>
  );
}
