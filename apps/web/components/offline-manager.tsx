"use client";

import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filesApi, itineraryApi, workApi } from "@/lib/events-api";
import {
  getOfflinePackage,
  saveOfflinePackage,
  type OfflinePackage,
} from "@/lib/offline-queue";

/** Provides a deliberately read-only local reference for an event-day device. */
export function OfflineManager({ eventId }: { eventId: string }) {
  const plan = useQuery(itineraryApi.list, { eventId });
  const work = useQuery(workApi.list, { eventId });
  const files = useQuery(filesApi.list, { eventId });
  const [saved, setSaved] = useState<OfflinePackage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = plan !== undefined && work !== undefined && files !== undefined;

  const refresh = useCallback(async () => {
    try {
      setSaved((await getOfflinePackage(eventId)) ?? null);
    } catch {
      setError("This browser could not read its event-day cache.");
    }
  }, [eventId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function save() {
    if (!ready) return;
    setError(null);
    setIsSaving(true);
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
        movementTypeLabel: item.movementTypeLabel,
        tagLabels: item.tags?.map((tag) => tag.name),
        assignmentLabels: item.assignments?.map(
          (assignment) => assignment.label,
        ),
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
      setSaved(value);
    } catch {
      setError("The event-day cache could not be saved on this browser.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Offline reference</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted">
            Save the current plan and checklist for read-only reference. Changes
            are never queued while offline; reconnect before making updates.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!ready || isSaving}
              onClick={() => void save()}
            >
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isSaving ? "Saving reference…" : "Save current reference"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refresh()}
            >
              <RefreshCw className="h-4 w-4" /> Refresh status
            </Button>
          </div>
          {saved === null ? (
            <p className="text-sm text-muted">
              No local event reference saved.
            </p>
          ) : (
            <p className="text-sm text-ink">
              Last saved {new Date(saved.downloadedAt).toLocaleString()}:{" "}
              {saved.counts.plan} plan entries and {saved.counts.work} work
              items. Files require a connection.
            </p>
          )}
          {error === null ? null : (
            <p className="text-sm text-danger-tx" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
