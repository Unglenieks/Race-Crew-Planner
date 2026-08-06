"use client";

import { WorkItemDetail } from "@/components/work-item-detail";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

export function WorkItemDetailScreen({ itemId }: { itemId: string }) {
  const { event, role } = useEventWorkspace();
  return <WorkItemDetail eventId={event.id} itemId={itemId} role={role} />;
}
