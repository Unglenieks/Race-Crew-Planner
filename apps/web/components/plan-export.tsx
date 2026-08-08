"use client";

import { Download, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  type ItineraryItem,
  type PlanExport as PlanExportRecord,
  type PlanExportVenue,
  planExportsApi,
} from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SavedExport = Omit<PlanExportRecord, "isSuperseded">;

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

/** Prefix spreadsheet formula triggers before quote escaping the cell. */
export function csvCell(value: string | undefined) {
  const safe = (value ?? "").replace(/^[\t\r ]*([=+\-@])/, "'$&");
  return `"${safe.replaceAll('"', '""')}"`;
}

function eventTitle(exported: SavedExport) {
  return exported.eventName ?? "Race Planner";
}

function timeLabel(item: SavedExport["items"][number]) {
  const start = item.scheduledFor.split("T")[1] ?? item.scheduledFor;
  switch (item.timeKind ?? "exact") {
    case "approximate":
      return `Approx. ${start}`;
    case "range":
      return item.scheduledUntil === undefined
        ? `${start} (range)`
        : `${start}–${item.scheduledUntil.split("T")[1] ?? item.scheduledUntil}`;
    case "allDay":
      return "All day";
    case "unspecified":
      return "Time TBC";
    default:
      return start;
  }
}

function timeSemantics(item: SavedExport["items"][number]) {
  const labels = {
    exact: "Exact time",
    approximate: "Approximate time",
    range: "Time range",
    allDay: "All-day item",
    unspecified: "Time to be confirmed",
  } as const;
  return labels[item.timeKind ?? "exact"];
}

function venueDetails(venue: PlanExportVenue) {
  return [
    venue.address,
    venue.accessNotes === undefined
      ? undefined
      : `Access: ${venue.accessNotes}`,
    venue.hours === undefined ? undefined : `Hours: ${venue.hours}`,
    venue.contactDetail,
    venue.notes,
  ].filter((value): value is string => value !== undefined && value.length > 0);
}

function rowNotes(item: SavedExport["items"][number]) {
  return [
    item.notes,
    item.venue?.accessNotes === undefined
      ? undefined
      : `Access: ${item.venue.accessNotes}`,
    item.venue?.hours === undefined ? undefined : `Hours: ${item.venue.hours}`,
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(" · ");
}

/** Converts legacy records into a sparse brief without touching mutable data. */
function appendices(exported: SavedExport) {
  return (
    exported.appendices ?? {
      venues: [],
      officialContacts: [],
      travel: [],
      fuel: [],
      weather: [],
      supportServices: [],
    }
  );
}

export function planExportCsv(exported: SavedExport) {
  const details = appendices(exported);
  const lines: string[][] = [
    ["Race Planner crew brief"],
    ["Event", eventTitle(exported)],
    ["Generated", new Date(exported.generatedAt).toISOString()],
    ["Prepared by", exported.generatedByName ?? "Not recorded"],
    ["Crew brief schema", String(exported.schemaVersion ?? 0)],
    ["Event timezone", exported.timeZone],
    ["Filter", exported.filterDay ?? "All operational days"],
    [],
    [
      "Operational day",
      "Time",
      "Time semantics",
      "Location",
      "Address",
      "Action",
      "Movement tags",
      "Assigned to",
      "Notes",
    ],
    ...exported.items.map((item) => [
      dayOf(item.scheduledFor),
      timeLabel(item),
      timeSemantics(item),
      item.venue?.name ?? item.location ?? "",
      item.venue?.address ?? "",
      item.title,
      [...(item.tags ?? []), item.section?.name].filter(Boolean).join("; "),
      item.assignedTo ?? "",
      rowNotes(item),
    ]),
  ];
  const appendixRows = [
    ...details.venues.map((venue) => [
      "Venue",
      venue.name,
      venueDetails(venue).join(" · "),
    ]),
    ...details.officialContacts.map((contact) => [
      "Official contact",
      contact.name,
      [
        contact.role,
        contact.email,
        contact.phoneNumber,
        contact.contactDetail,
        contact.notes,
      ]
        .filter(Boolean)
        .join(" · "),
    ]),
    ...details.travel.map((travel) => [
      "Travel",
      `${travel.from} → ${travel.to}`,
      [travel.estimate, travel.calculation, travel.routeNote]
        .filter(Boolean)
        .join(" · "),
    ]),
    ...details.fuel.map((venue) => [
      "Fuel",
      venue.name,
      venueDetails(venue).join(" · "),
    ]),
    ...details.weather.map((venue) => [
      "Weather",
      venue.name,
      venueDetails(venue).join(" · "),
    ]),
    ...details.supportServices.map((venue) => [
      "Support service",
      venue.name,
      venueDetails(venue).join(" · "),
    ]),
  ];
  if (appendixRows.length > 0)
    lines.push([], ["Appendix", "Entry", "Details"], ...appendixRows);
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

function downloadExport(exported: SavedExport) {
  const blob = new Blob([planExportCsv(exported)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `race-planner-crew-brief-${exported.filterDay ?? "all-days"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function VenueAppendix({ entries }: { entries: PlanExportVenue[] }) {
  return (
    <ul className="grid gap-2">
      {entries.map((venue, index) => (
        <li key={`${venue.name}-${index}`} className="break-inside-avoid">
          <strong>{venue.name}</strong>
          {venue.tags === undefined || venue.tags.length === 0 ? null : (
            <span className="ml-2 text-muted">{venue.tags.join(" · ")}</span>
          )}
          {venueDetails(venue).map((detail) => (
            <p key={detail} className="text-muted">
              {detail}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function CrewBrief({ exported }: { exported: SavedExport }) {
  const details = appendices(exported);
  const days = new Map<string, SavedExport["items"]>();
  exported.items.forEach((item) => {
    const day = dayOf(item.scheduledFor);
    days.set(day, [...(days.get(day) ?? []), item]);
  });
  const appendixSections = [
    { title: "Venues", entries: details.venues },
    { title: "Fuel", entries: details.fuel },
    { title: "Weather", entries: details.weather },
    { title: "Support services", entries: details.supportServices },
  ].filter(({ entries }) => entries.length > 0);

  return (
    <article className="crew-brief-document bg-white text-black">
      <header className="border-b-2 border-black pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em]">
          Race Planner
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">Crew brief</h1>
        <p className="mt-1 text-lg">{eventTitle(exported)}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold">Operational time zone: </dt>
            <dd className="inline">{exported.timeZone}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Scope: </dt>
            <dd className="inline">
              {exported.filterDay === undefined
                ? "All operational days"
                : label(exported.filterDay)}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Issued: </dt>
            <dd className="inline">{exportedAt(exported.generatedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Revision: </dt>
            <dd className="inline">
              Crew brief v{exported.schemaVersion ?? 0}
              {exported.generatedByName === undefined
                ? ""
                : ` · prepared by ${exported.generatedByName}`}
            </dd>
          </div>
        </dl>
      </header>

      {exported.items.length === 0 ? (
        <p className="mt-6 text-sm">
          No movements were scheduled in this scope.
        </p>
      ) : (
        [...days.entries()].map(([day, items]) => (
          <section
            key={day}
            className="mt-6"
            aria-labelledby={`brief-day-${day}`}
          >
            <h2
              id={`brief-day-${day}`}
              className="border-b border-black pb-1 text-lg font-semibold"
            >
              Operational day · {label(day)}
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="crew-brief-table w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-black">
                    <th scope="col" className="py-2 pr-2 font-bold">
                      Time
                    </th>
                    <th scope="col" className="px-2 py-2 font-bold">
                      Location
                    </th>
                    <th scope="col" className="px-2 py-2 font-bold">
                      Action
                    </th>
                    <th scope="col" className="px-2 py-2 font-bold">
                      Assigned to
                    </th>
                    <th scope="col" className="py-2 pl-2 font-bold">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.itineraryItemId}
                      className="border-b border-black/30 align-top"
                    >
                      <td className="py-2 pr-2">
                        <strong>{timeLabel(item)}</strong>
                        <p className="mt-0.5 text-[0.65rem] text-neutral-700">
                          {timeSemantics(item)}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <strong>
                          {item.venue?.name ?? item.location ?? "—"}
                        </strong>
                        {item.venue?.address === undefined ? null : (
                          <p className="mt-0.5 text-neutral-700">
                            {item.venue.address}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <strong>{item.title}</strong>
                        {[...(item.tags ?? []), item.section?.name]
                          .filter((tag): tag is string => tag !== undefined)
                          .map((tag) => (
                            <span
                              key={tag}
                              className="mr-1 mt-1 inline-block border border-black px-1 py-0.5 text-[0.65rem]"
                            >
                              {tag}
                            </span>
                          ))}
                      </td>
                      <td className="px-2 py-2">{item.assignedTo ?? "—"}</td>
                      <td className="py-2 pl-2">{rowNotes(item) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {details.officialContacts.length === 0 &&
      appendixSections.length === 0 &&
      details.travel.length === 0 ? null : (
        <section
          className="mt-8 border-t-2 border-black pt-4"
          aria-labelledby="brief-appendices"
        >
          <h2 id="brief-appendices" className="text-lg font-semibold">
            Appendices
          </h2>
          <div className="mt-3 grid gap-5 text-xs sm:grid-cols-2">
            {details.officialContacts.length === 0 ? null : (
              <section>
                <h3 className="font-bold">Official contacts</h3>
                <ul className="mt-2 grid gap-2">
                  {details.officialContacts.map((contact, index) => (
                    <li
                      key={`${contact.name}-${index}`}
                      className="break-inside-avoid"
                    >
                      <strong>{contact.name}</strong>
                      {[
                        contact.role,
                        contact.email,
                        contact.phoneNumber,
                        contact.contactDetail,
                        contact.notes,
                      ]
                        .filter(Boolean)
                        .map((value) => (
                          <p key={value} className="text-muted">
                            {value}
                          </p>
                        ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {details.travel.length === 0 ? null : (
              <section>
                <h3 className="font-bold">Travel</h3>
                <ul className="mt-2 grid gap-2">
                  {details.travel.map((travel, index) => (
                    <li
                      key={`${travel.from}-${travel.to}-${index}`}
                      className="break-inside-avoid"
                    >
                      <strong>
                        {travel.from} → {travel.to}
                      </strong>
                      <p>{travel.estimate}</p>
                      {[travel.calculation, travel.routeNote]
                        .filter(Boolean)
                        .map((value) => (
                          <p key={value} className="text-muted">
                            {value}
                          </p>
                        ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {appendixSections.map(({ title, entries }) => (
              <section key={title}>
                <h3 className="font-bold">{title}</h3>
                <div className="mt-2">
                  <VenueAppendix entries={entries} />
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </article>
  );
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
  const [activeExport, setActiveExport] = useState<SavedExport>();
  const [printRequest, setPrintRequest] = useState(0);
  const printedRequest = useRef(0);
  const createExport = useMutation(planExportsApi.create);
  const exports = useQuery(planExportsApi.list, { eventId });

  useEffect(() => {
    if (
      printRequest === 0 ||
      activeExport === undefined ||
      printedRequest.current === printRequest
    )
      return;
    printedRequest.current = printRequest;
    window.print();
  }, [activeExport, printRequest]);

  async function createSnapshot(action: "print" | "csv") {
    setMessage(undefined);
    setIsExporting(true);
    try {
      const exported = await createExport({
        eventId,
        ...(selectedDay === "all" ? {} : { filterDay: selectedDay }),
      });
      setActiveExport(exported);
      if (action === "print") {
        setPrintRequest((request) => request + 1);
        setMessage(
          "Crew brief saved. The print dialog is ready for a PDF or paper copy.",
        );
      } else {
        downloadExport(exported);
        setMessage("Crew brief CSV downloaded and saved to export history.");
      }
    } catch {
      setMessage("The crew brief could not be generated. Try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function printSaved(exported: SavedExport) {
    setActiveExport(exported);
    setPrintRequest((request) => request + 1);
  }

  return (
    <>
      <Card data-crew-brief-controls>
        <CardHeader>
          <CardTitle>Crew brief</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted">
            Generate a versioned, self-contained brief for printing or sharing.
            PDF/print is the primary crew format; CSV is available for data
            work.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium" htmlFor="plan-day">
              Scope
            </label>
            <select
              id="plan-day"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value)}
              className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
            >
              <option value="all">All operational days</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {label(day)}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">
              Event time zone: {timeZone}
            </span>
            <Button
              type="button"
              className="ml-auto"
              onClick={() => void createSnapshot("print")}
              disabled={isExporting}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              {isExporting ? "Preparing brief…" : "Generate & print crew brief"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void createSnapshot("csv")}
              disabled={isExporting}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV snapshot
            </Button>
          </div>
          {message === undefined ? null : (
            <p role="alert" className="text-sm text-muted">
              {message}
            </p>
          )}
          {activeExport === undefined ? null : (
            <div className="rounded-lg border border-success-ln bg-success-bg p-3 text-sm text-success-tx">
              Crew brief v{activeExport.schemaVersion ?? 0} is ready. Use the
              print button for a PDF or paper copy; its content is frozen at{" "}
              {exportedAt(activeExport.generatedAt)}.
            </div>
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
                Each copy opens from its saved snapshot; it never fills
                historical details from the current plan.
              </p>
            </div>
            {exports === undefined ? (
              <p className="text-sm text-muted">Loading export history…</p>
            ) : exports.length === 0 ? (
              <p className="text-sm text-muted">
                No crew briefs have been exported yet.
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
                          ? "All operational days"
                          : label(exported.filterDay)}
                      </p>
                      <p className="text-sm text-muted">
                        Generated {exportedAt(exported.generatedAt)} · crew
                        brief v{exported.schemaVersion ?? 0}
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
                      onClick={() => printSaved(exported)}
                    >
                      <Printer className="h-4 w-4" aria-hidden="true" />
                      Print / PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => downloadExport(exported)}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      CSV
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </CardContent>
      </Card>
      <div className="crew-brief-print mt-6 rounded-xl border border-line p-4 sm:p-6 print:block print:border-0 print:p-0">
        {activeExport === undefined ? null : (
          <CrewBrief exported={activeExport} />
        )}
      </div>
    </>
  );
}
