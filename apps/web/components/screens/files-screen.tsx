"use client";

import { FilesLibrary } from "@/components/files-library";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function FilesScreen() {
  const { event, role } = useEventWorkspace();
  return (
    <WorkspaceScreen id="files">
      <FilesLibrary eventId={event.id} role={role} />
    </WorkspaceScreen>
  );
}
