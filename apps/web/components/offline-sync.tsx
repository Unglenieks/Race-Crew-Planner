"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { workApi } from "@/lib/events-api";
import {
  listQueuedChanges,
  removeQueuedChange,
  updateQueuedChange,
} from "@/lib/offline-queue";

/** Replays only the explicitly idempotent operation type when connectivity returns. */
export function OfflineSync({ eventId }: { eventId: string }) {
  const replayCompletion = useMutation(workApi.setCompletionOffline);
  useEffect(() => {
    async function replay() {
      if (!navigator.onLine) return;
      for (const change of await listQueuedChanges(eventId)) {
        if (change.status === "needsResolution") continue;
        await updateQueuedChange({
          ...change,
          status: "syncing",
          error: undefined,
        });
        try {
          await replayCompletion({
            eventId,
            operationId: change.id,
            ...change.payload,
          });
          await removeQueuedChange(change.id);
        } catch {
          await updateQueuedChange({
            ...change,
            status: "needsResolution",
            error:
              "The work item changed or access was lost. Open Offline manager to review it.",
          });
        }
      }
    }
    const onOnline = () => void replay();
    void replay();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [eventId, replayCompletion]);
  return null;
}
