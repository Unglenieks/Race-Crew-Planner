"use client";

import { useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { PlanChangeDelivery } from "@/components/plan-change-delivery";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { itineraryApi } from "@/lib/events-api";

export function PlanPublishScreen() {
  const { event, role } = useEventWorkspace();
  const items = useQuery(itineraryApi.list, { eventId: event.id });

  return (
    <WorkspaceScreen id="plan-publish">
      {items === undefined ? (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading the movement plan…
        </p>
      ) : (
        <PlanChangeDelivery eventId={event.id} role={role} items={items} />
      )}
    </WorkspaceScreen>
  );
}
