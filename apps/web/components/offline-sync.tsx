"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { workApi } from "@/lib/events-api";
import {
  getOfflinePackage,
  listQueuedChanges,
  markSuccessfulSync,
  removeQueuedChange,
  updateQueuedChange,
} from "@/lib/offline-queue";

/** Replays only the explicitly idempotent operation type when connectivity returns. */
export function OfflineSync({ eventId }: { eventId: string }) {
  const replayCompletion = useMutation(workApi.setCompletionOffline);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number>();
  useEffect(() => {
    let cancelled = false;
    void getOfflinePackage(eventId)
      .then((value) => {
        if (!cancelled) setLastSuccessfulSyncAt(value?.lastSuccessfulSyncAt);
      })
      .catch(() => undefined);

    async function replay() {
      if (!navigator.onLine) return;
      let changes;
      try {
        changes = await listQueuedChanges(eventId);
      } catch {
        return;
      }

      for (const change of changes) {
        if (change.status === "needsResolution") continue;
        try {
          await updateQueuedChange({
            ...change,
            status: "syncing",
            error: undefined,
          });
          await replayCompletion({
            eventId,
            operationId: change.id,
            itemId: change.payload.itemId,
            completed: change.payload.completed,
            expectedUpdatedAt: change.payload.expectedUpdatedAt,
            expectedStatus: change.payload.serverStatusAtQueue,
          });
          await removeQueuedChange(change.id);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          try {
            await updateQueuedChange({
              ...change,
              status: navigator.onLine ? "needsResolution" : "queued",
              error: navigator.onLine
                ? reason.includes("not found")
                  ? "This work item was deleted. Open Offline manager to discard the request or review the event."
                  : "The work item changed after this request was queued. Open Offline manager to choose which state should win."
                : "Still offline. This request will retry when the connection returns.",
            });
          } catch {
            return;
          }
          continue;
        }

        try {
          const synced = await markSuccessfulSync(eventId);
          if (!cancelled) {
            setLastSuccessfulSyncAt(synced?.lastSuccessfulSyncAt);
          }
        } catch {
          // The replay already succeeded and its queue row is gone. Do not
          // recreate it merely because this browser cannot save a timestamp.
          continue;
        }
      }
    }
    const onOnline = () => void replay();
    void replay();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [eventId, replayCompletion]);
  if (lastSuccessfulSyncAt === undefined) return null;
  return (
    <div
      className="border-b border-line bg-topbg px-4 py-1.5 text-center text-xs text-muted"
      role="status"
    >
      Offline changes synced at{" "}
      {new Date(lastSuccessfulSyncAt).toLocaleTimeString()}.
    </div>
  );
}
