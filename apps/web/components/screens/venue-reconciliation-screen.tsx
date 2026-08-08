"use client";

import { VenueReconciliation } from "@/components/venue-reconciliation";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

export function VenueReconciliationScreen() {
  const { event, role } = useEventWorkspace();
  return <VenueReconciliation eventId={event.id} role={role} />;
}
