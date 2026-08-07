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
            ...change.payload,
          });
          await removeQueuedChange(change.id);
        } catch {
          try {
            await updateQueuedChange({
              ...change,
              status: navigator.onLine ? "needsResolution" : "queued",
              error: navigator.onLine
                ? "The work item changed or access was lost. Open Offline manager to review it."
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
    <p className="fixed bottom-3 right-3 z-20 rounded-md border border-line bg-card px-3 py-2 text-xs text-muted shadow-sm">
      Last offline sync {new Date(lastSuccessfulSyncAt).toLocaleTimeString()}.
    </p>
  );
}
