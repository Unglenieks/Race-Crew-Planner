"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  planChangesApi,
  workApi,
  type PlanChangeRecipient,
  type PublishedPlanChange,
  type WorkItem,
} from "@/lib/events-api";

export type AttentionChange = {
  recipient: PlanChangeRecipient;
  change: PublishedPlanChange;
};

export type Attention = {
  /** Open work items assigned to the signed-in operator. */
  assignedWork: WorkItem[];
  /** Published changes this operator has not acknowledged. */
  unacknowledged: AttentionChange[];
  count: number;
  isLoading: boolean;
};

/**
 * Shared by the attention screen and the topbar badge so a single definition of
 * "needs attention" drives both. Previously the screen computed this inline
 * with its own duplicated function references.
 */
export function useAttention(eventId: string): Attention {
  const { userId } = useAuth();
  const work = useQuery(workApi.list, { eventId });
  const changes = useQuery(planChangesApi.listForMe, { eventId });

  const assignedWork = (work ?? []).filter(
    (item) => item.status === "open" && item.assigneeId === userId,
  );

  const unacknowledged = (changes ?? []).flatMap((entry) =>
    entry.change !== null &&
    entry.recipient.state !== "acknowledged" &&
    entry.recipient.state !== "acknowledgedElsewhere"
      ? [{ recipient: entry.recipient, change: entry.change }]
      : [],
  );

  return {
    assignedWork,
    unacknowledged,
    count: assignedWork.length + unacknowledged.length,
    isLoading: work === undefined || changes === undefined,
  };
}
