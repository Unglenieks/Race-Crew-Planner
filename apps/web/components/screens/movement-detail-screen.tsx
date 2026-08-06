"use client";

import { MovementDetail } from "@/components/movement-detail";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

export function MovementDetailScreen({ itemId }: { itemId: string }) {
  const { event, role } = useEventWorkspace();
  return <MovementDetail eventId={event.id} itemId={itemId} role={role} />;
}
