"use client";

import { useQuery } from "convex/react";
import { EventSetupGuide } from "@/components/event-setup-guide";
import { TodayOverview } from "@/components/today-overview";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { itineraryApi } from "@/lib/events-api";

export function TodayScreen() {
  const { event, role } = useEventWorkspace();
  const items = useQuery(itineraryApi.list, { eventId: event.id });

  // Offer the setup guide while the plan is still empty, and only to roles that
  // can act on it. This replaces the previous "recently created" flag, which
  // vanished on reload.
  const canSetUp = role === "owner" || role === "manager";
  const showSetupGuide = canSetUp && items !== undefined && items.length === 0;

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
