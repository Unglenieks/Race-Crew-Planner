"use client";

import { MapExplorer } from "@/components/map-explorer";
import { SpectatorSchedule } from "@/components/spectator-schedule";
import { SpectatorVenues } from "@/components/spectator-venues";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function SpectatorInfoScreen() {
  return (
    <WorkspaceScreen id="spectator-info">
      <div className="grid gap-4">
        <SpectatorVenues />
        <MapExplorer spectator />
        <SpectatorSchedule />
      </div>
    </WorkspaceScreen>
  );
}
