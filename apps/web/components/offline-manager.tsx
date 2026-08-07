"use client";

import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { filesApi, itineraryApi, workApi } from "@/lib/events-api";
import {
  getOfflinePackage,
  listQueuedChanges,
  saveOfflinePackage,
  type OfflinePackage,
  type QueuedChange,
} from "@/lib/offline-queue";

export function OfflineManager({ eventId }: { eventId: string }) {
  const plan = useQuery(itineraryApi.list, { eventId });
  const work = useQuery(workApi.list, { eventId });
  const files = useQuery(filesApi.list, { eventId });
  const [changes, setChanges] = useState<QueuedChange[] | null>(null);
  const [offlinePackage, setOfflinePackage] = useState<OfflinePackage | null>(
    null,
  );
  const ready = plan !== undefined && work !== undefined && files !== undefined;
  const refresh = useCallback(async () => {
    const [queued, saved] = await Promise.all([
      listQueuedChanges(eventId),
      getOfflinePackage(eventId),
    ]);
    setChanges(queued);
    setOfflinePackage(saved ?? null);
  }, [eventId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);
  async function download() {
    if (!ready) return;
    const value: OfflinePackage = {
      eventId,
      selected: { plan: true, work: true, files: false },
      downloadedAt: Date.now(),
      counts: { plan: plan.length, work: work.length, files: files.length },
      plan: plan.map((item) => ({
        id: item._id,
        title: item.title,
        scheduledFor: item.scheduledFor,
        location: item.location,
      })),
      work: work.map((item) => ({
        id: item._id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
    };
    await saveOfflinePackage(value);
    setOfflinePackage(value);
  }
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Offline readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted">
            Download the event plan and checklist on this device. Files remain
            online-only so temporary storage URLs and private evidence are never
            represented as safely cached.
          </p>
          <Button
            className="w-fit"
            type="button"
            disabled={!ready}
            onClick={() => void download()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download plan and checklist
          </Button>
          {offlinePackage === null ? (
            <p className="text-sm text-muted">No offline package downloaded.</p>
          ) : (
            <>
              <p className="text-sm text-ink">
                Downloaded {offlinePackage.counts.plan} plan entries and{" "}
                {offlinePackage.counts.work} work items. File library (
                {offlinePackage.counts.files} files) needs a connection.
              </p>
              {offlinePackage.lastSuccessfulSyncAt === undefined ? (
                <p className="text-xs text-muted">
                  No queued change has synced yet.
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Last successful sync:{" "}
                  {new Date(
                    offlinePackage.lastSuccessfulSyncAt,
                  ).toLocaleString()}
                  .
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Queued changes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            className="w-fit"
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh queue
          </Button>
          {changes === null ? (
            <p className="text-sm text-muted">Checking local queue…</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted">No queued changes.</p>
          ) : (
            <ol className="grid gap-2">
              {changes.map((change) => (
                <li key={change.id} className="text-sm text-ink">
                  <b>
                    {change.status === "needsResolution"
                      ? "Needs resolution: "
                      : "Queued: "}
                  </b>
                  {change.label}
                  {change.error === undefined ? null : (
                    <span className="block text-muted">{change.error}</span>
                  )}
                  {change.status !== "needsResolution" ? null : (
                    <span className="block text-muted">
                      Local request:{" "}
                      {change.payload.completed ? "completed" : "reopened"};
                      server was {change.payload.serverStatusAtQueue} when
                      queued and is now{" "}
                      {work?.find((item) => item._id === change.payload.itemId)
                        ?.status ?? "unavailable"}
                      . Decide which state is correct before retrying.
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
