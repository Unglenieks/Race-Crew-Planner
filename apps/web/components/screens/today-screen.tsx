"use client";

import { EventSetupGuide } from "@/components/event-setup-guide";
import { TodayOverview } from "@/components/today-overview";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function TodayScreen() {
  const { event, role } = useEventWorkspace();
  // Only roles that can act on setup steps see the guide.
  const canSetUp = role === "owner" || role === "manager";
  const showSetupGuide = canSetUp;

  return (
    <WorkspaceScreen id="today">
      <div className="grid gap-4">
        {showSetupGuide ? (
          <EventSetupGuide
            eventId={event.id}
            eventName={event.name}
            role={role}
          />
        ) : null}
        <TodayOverview eventId={event.id} timeZone={event.timeZone} />
      </div>
    </WorkspaceScreen>
  );
}
