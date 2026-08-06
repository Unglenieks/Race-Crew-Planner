"use client";

import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import type { ItineraryItem } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function dayOf(value: string) {
  return value.slice(0, 10);
}
function label(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function PlanExport({
  items,
  timeZone,
}: {
  items: ItineraryItem[];
  timeZone: string;
}) {
  const days = useMemo(
    () => [...new Set(items.map((item) => dayOf(item.scheduledFor)))],
    [items],
  );
  const [selectedDay, setSelectedDay] = useState("all");
  const visible =
    selectedDay === "all"
      ? items
      : items.filter((item) => dayOf(item.scheduledFor) === selectedDay);
  const generatedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtered plan</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium" htmlFor="plan-day">
            Show
          </label>
          <select
            id="plan-day"
            value={selectedDay}
            onChange={(event) => setSelectedDay(event.target.value)}
            className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
          >
            <option value="all">All plan days</option>
            {days.map((day) => (
              <option key={day} value={day}>
                {label(day)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            className="ml-auto"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print this view
          </Button>
        </div>
        <div className="rounded-lg border border-line bg-topbg p-3 text-xs text-muted print:border-0 print:bg-white">
          <p>
            Filter:{" "}
            {selectedDay === "all" ? "All plan days" : label(selectedDay)}
          </p>
          <p>Event timezone: {timeZone}</p>
          <p>Generated: {generatedAt}</p>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted">No movements match this day.</p>
        ) : (
          <ol className="divide-y divide-line">
            {visible.map((item) => (
              <li key={item._id} className="py-3">
                <p className="font-semibold text-ink">
                  {item.scheduledFor.replace("T", " · ")} · {item.title}
                </p>
                {item.location === undefined ? null : (
                  <p className="mt-1 text-sm text-muted">{item.location}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
