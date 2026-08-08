"use client";

import { EventDashboard } from "@/components/event-dashboard";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function TodayScreen() {
  return (
    <WorkspaceScreen id="today">
      <EventDashboard />
    </WorkspaceScreen>
  );
}
