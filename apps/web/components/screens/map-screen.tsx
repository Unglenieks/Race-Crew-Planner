"use client";

import { MapExplorer } from "@/components/map-explorer";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function MapScreen() {
  return (
    <WorkspaceScreen id="map">
      <MapExplorer />
    </WorkspaceScreen>
  );
}
