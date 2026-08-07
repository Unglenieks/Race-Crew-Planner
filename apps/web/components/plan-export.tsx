"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  type ItineraryItem,
  type PlanExport as PlanExportRecord,
  planExportsApi,
} from "@/lib/events-api";
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

function exportedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function csvCell(value: string | undefined) {
  return `"${(value ?? "").replaceAll('"', '""')}"`;
}

export function planExportCsv(
  exported: Omit<PlanExportRecord, "isSuperseded">,
) {
  const lines = [
    ["Race Planner plan brief"],
    ["Generated", new Date(exported.generatedAt).toISOString()],
    ["Event timezone", exported.timeZone],
    ["Filter", exported.filterDay ?? "All plan days"],
    [],
    ["Scheduled for", "Movement", "Location"],
    ...exported.items.map((item) => [
      item.scheduledFor,
      item.title,
      item.location ?? "",
    ]),
  ];
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

function downloadExport(exported: Omit<PlanExportRecord, "isSuperseded">) {
  const blob = new Blob([planExportCsv(exported)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `race-planner-plan-${exported.filterDay ?? "all-days"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PlanExport({
  eventId,
  items,
  timeZone,
}: {
  eventId: string;
  items: ItineraryItem[];
  timeZone: string;
}) {
  const days = useMemo(
    () => [...new Set(items.map((item) => dayOf(item.scheduledFor)))],
    [items],
  );
  const [selectedDay, setSelectedDay] = useState("all");
  const [message, setMessage] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);
  const createExport = useMutation(planExportsApi.create);
  const exports = useQuery(planExportsApi.list, { eventId });
  const visible =
    selectedDay === "all"
      ? items
      : items.filter((item) => dayOf(item.scheduledFor) === selectedDay);
  const generatedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  async function exportCsv() {
    setMessage(undefined);
    setIsExporting(true);
    try {
      const exported = await createExport({
        eventId,
        ...(selectedDay === "all" ? {} : { filterDay: selectedDay }),
      });
      downloadExport(exported);
      setMessage("Plan brief downloaded and saved to export history.");
    } catch {
      setMessage("The plan brief could not be exported. Try again.");
    } finally {
      setIsExporting(false);
    }
  }

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
          <Button
            type="button"
            onClick={() => void exportCsv()}
            disabled={isExporting}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? "Preparing brief…" : "Download CSV brief"}
          </Button>
        </div>
        {message === undefined ? null : (
          <p role="alert" className="text-sm text-muted">
            {message}
          </p>
        )}
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
        <section
          className="grid gap-2 border-t border-line pt-4"
          aria-labelledby="export-history"
        >
          <div>
            <h2 id="export-history" className="font-semibold text-ink">
              Export history
            </h2>
            <p className="text-sm text-muted">
              Saved snapshots are marked superseded only when their filtered
              plan has changed.
            </p>
          </div>
          {exports === undefined ? (
            <p className="text-sm text-muted">Loading export history…</p>
          ) : exports.length === 0 ? (
            <p className="text-sm text-muted">
              No plan briefs have been exported yet.
            </p>
          ) : (
            <ol className="divide-y divide-line rounded-lg border border-line">
              {exports.map((exported) => (
                <li
                  key={exported._id}
                  className="flex flex-wrap items-center gap-3 p-3"
                >
                  <div className="mr-auto">
                    <p className="font-medium text-ink">
                      {exported.filterDay === undefined
                        ? "All plan days"
                        : label(exported.filterDay)}
                    </p>
                    <p className="text-sm text-muted">
                      Generated {exportedAt(exported.generatedAt)}
                    </p>
                    <p
                      className={
                        exported.isSuperseded
                          ? "text-sm text-danger-tx"
                          : "text-sm text-muted"
                      }
                    >
                      {exported.isSuperseded
                        ? "Superseded — the plan changed after this export."
                        : "Current — this snapshot still matches the plan."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => downloadExport(exported)}
                  >
                    Download copy
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
