"use client";

import { ItineraryPlan } from "@/components/itinerary-plan";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function ScheduleScreen() {
  const { event, role } = useEventWorkspace();
  return (
    <WorkspaceScreen id="schedule">
      <ItineraryPlan
        eventId={event.id}
        eventName={event.name}
        timeZone={event.timeZone}
        role={role}
      />
    </WorkspaceScreen>
  );
}
