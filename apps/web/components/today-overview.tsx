"use client";

import { CalendarClock, ChevronRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { itineraryApi } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function eventDay(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function eventLocalDateTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function timeFromScheduledFor(scheduledFor: string) {
  return scheduledFor.split("T")[1] ?? "Time to be confirmed";
}

export function TodayOverview({
  eventId,
  timeZone,
}: {
  eventId: string;
  timeZone: string;
}) {
  const items = useQuery(itineraryApi.list, { eventId });
  const today = useMemo(() => eventDay(timeZone), [timeZone]);
  const now = useMemo(() => eventLocalDateTime(timeZone), [timeZone]);
  const todaysItems = useMemo(
    () => (items ?? []).filter((item) => item.scheduledFor.startsWith(today)),
    [items, today],
  );
  const nextItem = useMemo(
    () => (items ?? []).find((item) => item.scheduledFor >= now),
    [items, now],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Movements today</CardTitle>
          <Badge variant="neutral">Event time: {timeZone}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {items === undefined ? (
          <p className="text-sm text-muted" role="status">
            Loading today&apos;s movement plan…
          </p>
        ) : nextItem === undefined ? (
          <div className="rounded-lg border border-line2 bg-topbg p-4">
            <div className="flex items-start gap-3">
              <CalendarClock
                className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-ink">
                  No upcoming plan movements
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  There are {todaysItems.length} movement
                  {todaysItems.length === 1 ? "" : "s"} scheduled today, but
                  nothing else is scheduled after the current event time.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Link
            href={`/events/${eventId}/plan/${nextItem._id}`}
            className="rounded-lg border border-success-ln bg-soft p-4 transition-colors hover:border-green focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <div className="flex items-start gap-3">
              <CalendarClock
                className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-green-ink">
                  Next movement
                </p>
                <p className="mt-1 font-semibold text-ink">{nextItem.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {timeFromScheduledFor(nextItem.scheduledFor)}
                  {nextItem.location === undefined
                    ? ""
                    : ` · ${nextItem.location}`}
                </p>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
            </div>
          </Link>
        )}
        <div className="flex items-center gap-3 border-t border-line pt-4 text-sm text-muted">
          <ClipboardCheck
            className="h-4 w-4 shrink-0 text-green-ink"
            aria-hidden="true"
          />
          <span>
            {items === undefined
              ? "Checking the plan…"
              : `${todaysItems.length} movement${todaysItems.length === 1 ? "" : "s"} scheduled today`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
