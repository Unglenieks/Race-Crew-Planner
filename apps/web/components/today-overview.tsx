"use client";

import { CalendarClock, ChevronRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { itineraryApi, type ItineraryItem } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  eventDateKey,
  eventLocalDateTime,
  formatEventDateTime,
} from "@/lib/time-zones";

export function todayMovementState(
  items: ItineraryItem[],
  timeZone: string,
  clock: Date,
) {
  const today = eventDateKey(timeZone, clock);
  const now = eventLocalDateTime(timeZone, clock);
  return {
    today,
    todaysItems: items.filter(
      (item) => item.scheduledFor.split("T")[0] === today,
    ),
    nextItem: items.find((item) => item.scheduledFor >= now),
  };
}

export function TodayOverview({
  eventId,
  timeZone,
}: {
  eventId: string;
  timeZone: string;
}) {
  const items = useQuery(itineraryApi.list, { eventId });
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const state = useMemo(
    () => todayMovementState(items ?? [], timeZone, new Date(clock)),
    [clock, items, timeZone],
  );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Movements today</CardTitle>
            <Badge variant="neutral">Event time: {timeZone}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {items === undefined ? (
            <p className="text-sm text-muted" role="status">
              Loading today&apos;s movement plan…
            </p>
          ) : state.todaysItems.length === 0 ? (
            <p className="text-sm text-muted">
              No movements are scheduled for {state.today} in the event time
              zone.
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {state.todaysItems.map((item) => (
                <li key={item._id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    className="font-semibold text-ink underline-offset-4 hover:underline"
                    href={`/events/${eventId}/plan/${item._id}`}
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {formatEventDateTime(item.scheduledFor, timeZone)}
                    {item.location ? ` · ${item.location}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
            <ClipboardCheck
              className="h-4 w-4 text-green-ink"
              aria-hidden="true"
            />
            {items === undefined
              ? "Checking the plan…"
              : `${state.todaysItems.length} movement${state.todaysItems.length === 1 ? "" : "s"} scheduled today`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next upcoming movement</CardTitle>
        </CardHeader>
        <CardContent>
          {items === undefined ? (
            <p className="text-sm text-muted" role="status">
              Checking the next movement…
            </p>
          ) : state.nextItem === undefined ? (
            <p className="text-sm text-muted">
              No future movement is scheduled.
            </p>
          ) : (
            <Link
              href={`/events/${eventId}/plan/${state.nextItem._id}`}
              className="flex items-start gap-3 rounded-lg border border-success-ln bg-soft p-4 focus-visible:outline-3 focus-visible:outline-focus"
            >
              <CalendarClock
                className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{state.nextItem.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatEventDateTime(state.nextItem.scheduledFor, timeZone)}
                  {state.nextItem.location
                    ? ` · ${state.nextItem.location}`
                    : ""}
                </p>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
