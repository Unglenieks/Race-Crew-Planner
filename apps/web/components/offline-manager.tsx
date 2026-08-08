"use client";

import {
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filesApi, itineraryApi, workApi } from "@/lib/events-api";
import {
  getOfflinePackage,
  listQueuedChanges,
  markSuccessfulSync,
  removeQueuedChange,
  saveOfflinePackage,
  type OfflinePackage,
  type QueuedChange,
} from "@/lib/offline-queue";

export function OfflineManager({ eventId }: { eventId: string }) {
  const plan = useQuery(itineraryApi.list, { eventId });
  const work = useQuery(workApi.list, { eventId });
  const files = useQuery(filesApi.list, { eventId });
  const replayCompletion = useMutation(workApi.setCompletionOffline);
  const [changes, setChanges] = useState<QueuedChange[] | null>(null);
  const [offlinePackage, setOfflinePackage] = useState<OfflinePackage | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingChangeId, setPendingChangeId] = useState<string | null>(null);
  const ready = plan !== undefined && work !== undefined && files !== undefined;

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [queued, saved] = await Promise.all([
        listQueuedChanges(eventId),
        getOfflinePackage(eventId),
      ]);
      setChanges(queued);
      setOfflinePackage(saved ?? null);
    } catch {
      setError(
        "This browser could not read its offline storage. Your event data was not changed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function download() {
    if (!ready) return;
    setError(null);
    setIsDownloading(true);
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

    try {
      await saveOfflinePackage(value);
      setOfflinePackage(value);
    } catch {
      setError(
        "The offline package could not be saved on this browser. Check available storage and try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function keepServerState(change: QueuedChange) {
    setError(null);
    setPendingChangeId(change.id);
    try {
      await removeQueuedChange(change.id);
      await refresh();
    } catch {
      setError(
        "The queued request could not be removed. It is still available for review.",
      );
    } finally {
      setPendingChangeId(null);
    }
  }

  async function applyLocalRequest(change: QueuedChange) {
    const item = work?.find((entry) => entry._id === change.payload.itemId);
    if (item === undefined) {
      setError(
        "This work item was deleted or is no longer available. Discard the queued request or refresh after confirming your event access.",
      );
      return;
    }
    if (!navigator.onLine) {
      setError("Reconnect before applying a queued request to the live event.");
      return;
    }

    setError(null);
    setPendingChangeId(change.id);
    try {
      await replayCompletion({
        eventId,
        operationId: change.id,
        itemId: change.payload.itemId,
        completed: change.payload.completed,
        expectedUpdatedAt: item.updatedAt,
        expectedStatus: item.status,
      });
      await removeQueuedChange(change.id);
      try {
        const synced = await markSuccessfulSync(eventId);
        setOfflinePackage(synced ?? offlinePackage);
      } catch {
        setError(
          "The local request was applied, but this browser could not save its last-sync time.",
        );
      }
      await refresh();
    } catch {
      setError(
        "The local request was not applied because the work item changed again or your access changed. Refresh the queue and review the latest state.",
      );
    } finally {
      setPendingChangeId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Offline package</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted">
            Save the current plan and checklist on this device. Completion
            changes queue while offline and sync after you reconnect. Files and
            opening the app from a fully closed browser still need a connection.
          </p>
          <Button
            className="w-fit"
            type="button"
            disabled={!ready || isDownloading}
            onClick={() => void download()}
          >
            {isDownloading ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {isDownloading ? "Saving package…" : "Save plan and checklist"}
          </Button>
          {offlinePackage === null ? (
            <p className="text-sm text-muted">No offline package saved.</p>
          ) : (
            <>
              <p className="text-sm text-ink">
                Saved {offlinePackage.counts.plan} plan entries and{" "}
                {offlinePackage.counts.work} work items in this browser. File
                library ({offlinePackage.counts.files} files) needs a
                connection.
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
            disabled={isRefreshing}
            onClick={() => {
              setError(null);
              void refresh();
            }}
          >
            {isRefreshing ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {isRefreshing ? "Refreshing…" : "Refresh queue"}
          </Button>
          {changes === null ? (
            <p className="text-sm text-muted">Checking local queue…</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted">No queued changes.</p>
          ) : (
            <ol className="grid gap-2">
              {changes.map((change) => {
                const currentStatus = work?.find(
                  (item) => item._id === change.payload.itemId,
                )?.status;

                return (
                  <li
                    key={change.id}
                    className="grid gap-2 rounded-lg border border-line p-3 text-sm text-ink"
                  >
                    <b>
                      {change.status === "needsResolution"
                        ? "Needs resolution: "
                        : "Queued: "}
                    </b>
                    <span>{change.label}</span>
                    {change.error === undefined ? null : (
                      <span className="text-muted">{change.error}</span>
                    )}
                    {change.status === "needsResolution" ? (
                      <>
                        <span className="text-muted">
                          Local request:{" "}
                          {change.payload.completed ? "completed" : "reopened"};
                          server was {change.payload.serverStatusAtQueue} when
                          queued and is now {currentStatus ?? "unavailable"}.
                          Choose the state that should win.
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={pendingChangeId !== null}
                            onClick={() => void keepServerState(change)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Keep server state
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={
                              pendingChangeId !== null || work === undefined
                            }
                            onClick={() => void applyLocalRequest(change)}
                          >
                            {pendingChangeId === change.id ? (
                              <LoaderCircle
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <RotateCcw
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            Apply local request
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pendingChangeId !== null}
                          onClick={() => void keepServerState(change)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Discard queued request
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {error === null ? null : (
            <Banner variant="danger" role="alert">
              {error}
            </Banner>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
