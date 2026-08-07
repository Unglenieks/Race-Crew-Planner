"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listQueuedChanges, type QueuedChange } from "@/lib/offline-queue";

export function OfflineManager({ eventId }: { eventId: string }) {
  const [changes, setChanges] = useState<QueuedChange[] | null>(null);
  useEffect(() => {
    void listQueuedChanges(eventId)
      .then(setChanges)
      .catch(() => setChanges([]));
  }, [eventId]);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Offline readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            This event currently does not download a package or queue writes.
            Use an active connection to make changes; this screen will show
            durable queued work when a replayable operation is introduced.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Queued changes</CardTitle>
        </CardHeader>
        <CardContent>
          {changes === null ? (
            <p className="text-sm text-muted">Checking local queue…</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted">No queued changes.</p>
          ) : (
            <ol className="grid gap-2">
              {changes.map((change) => (
                <li key={change.id} className="text-sm text-ink">
                  {change.label}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
