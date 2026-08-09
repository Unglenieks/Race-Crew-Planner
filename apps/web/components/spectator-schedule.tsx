"use client";

import { CalendarDays, LoaderCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { itineraryApi } from "@/lib/events-api";
import { displayMovementTime } from "@/lib/timing";

export function SpectatorSchedule() {
  const { event, role } = useEventWorkspace();
  const items = useQuery(
    itineraryApi.listSpectator,
    role === "spectator" ? { eventId: event.id } : "skip",
  );
  if (role !== "spectator") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-green-ink" /> Spectator
            schedule
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading published
            events…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No schedule events have been published for spectators yet.
          </p>
        ) : (
          <ol className="grid gap-3">
            {items.map((item) => (
              <li key={item._id} className="rounded-lg border border-line p-3">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {displayMovementTime(item)}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                  {item.notes}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
