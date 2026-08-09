"use client";

import { FilesLibrary } from "@/components/files-library";
import { EventInfoSwitcher } from "@/components/event-info-switcher";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function FilesScreen() {
  const { event, role } = useEventWorkspace();
  return (
    <WorkspaceScreen id="files">
      <div className="grid gap-4">
        <EventInfoSwitcher current="files" />
        <FilesLibrary eventId={event.id} role={role} />
      </div>
    </WorkspaceScreen>
  );
}
