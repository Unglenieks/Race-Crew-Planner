"use client";

import { MapExplorer } from "@/components/map-explorer";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function SpectatorInfoScreen() {
  return (
    <WorkspaceScreen id="spectator-info">
      <MapExplorer spectator />
    </WorkspaceScreen>
  );
}
