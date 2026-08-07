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
    void getOfflinePackage(eventId).then((value) =>
      setLastSuccessfulSyncAt(value?.lastSuccessfulSyncAt),
    );
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
          const synced = await markSuccessfulSync(eventId);
          setLastSuccessfulSyncAt(synced?.lastSuccessfulSyncAt);
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
  if (lastSuccessfulSyncAt === undefined) return null;
  return (
    <p className="fixed bottom-3 right-3 z-20 rounded-md border border-line bg-card px-3 py-2 text-xs text-muted shadow-sm">
      Last offline sync {new Date(lastSuccessfulSyncAt).toLocaleTimeString()}.
    </p>
  );
}
