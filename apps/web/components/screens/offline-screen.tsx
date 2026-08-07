"use client";
import { OfflineManager } from "@/components/offline-manager";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
export function OfflineScreen() {
  const { event } = useEventWorkspace();
  return (
    <WorkspaceScreen id="offline">
      <OfflineManager eventId={event.id} />
    </WorkspaceScreen>
  );
}
