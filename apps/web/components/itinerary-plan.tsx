"use client";

import {
  CalendarPlus,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  itineraryApi,
  planSectionsApi,
  recordsApi,
  workApi,
  type EventRole,
  type ItineraryItem,
} from "@/lib/events-api";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { formatEventDateTime } from "@/lib/time-zones";

type Draft = {
  title: string;
  scheduledFor: string;
  scheduledUntil: string;
  timeKind: NonNullable<ItineraryItem["timeKind"]>;
  location: string;
  recordId: string;
  notes: string;
  movementType: string;
  tags: string;
  sectionId: string;
};

const emptyDraft: Draft = {
  title: "",
  scheduledFor: "",
  scheduledUntil: "",
  timeKind: "exact",
  location: "",
  recordId: "",
  notes: "",
  movementType: "",
  tags: "",
  sectionId: "",
};

const savedPlanViewKey = (eventId: string) =>
  `race-planner:plan-view:${eventId}`;

function displayScheduledFor(item: ItineraryItem, timeZone: string) {
  const start = formatEventDateTime(item.scheduledFor, timeZone);
  if (item.timeKind !== "range") return start;
  return `${start} → ${
    item.scheduledUntil === undefined
      ? "End time not recorded (legacy range)"
      : formatEventDateTime(item.scheduledUntil, timeZone)
  }`;
}

function displayDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function eventLocalDateTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export function ItineraryPlan({
  eventId,
  eventName,
  timeZone,
  role,
}: {
  eventId: string;
  eventName: string;
  timeZone: string;
  role: EventRole;
}) {
  const items = useQuery(itineraryApi.list, { eventId });
  const archivedItems = useQuery(itineraryApi.listArchived, { eventId });
  const records = useQuery(recordsApi.list, { eventId });
  const sections = useQuery(planSectionsApi.list, { eventId });
  const workItems = useQuery(workApi.list, { eventId });
  const createItem = useMutation(itineraryApi.create);
  const archiveItem = useMutation(itineraryApi.archive);
  const restoreItem = useMutation(itineraryApi.restore);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedView, setSelectedView] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(savedPlanViewKey(eventId)),
  );
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [movementType, setMovementType] = useState("");
  const [tag, setTag] = useState("");
  const [venue, setVenue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [undoItem, setUndoItem] = useState<ItineraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hasUnsavedChanges =
    JSON.stringify(draft) !== JSON.stringify(emptyDraft);

  useEffect(() => {
    if (isCreatorOpen) titleInputRef.current?.focus();
  }, [isCreatorOpen]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isCreatorOpen || !hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges, isCreatorOpen]);

  const sectionById = useMemo(
    () => new Map((sections ?? []).map((section) => [section._id, section])),
    [sections],
  );
  const days = useMemo(() => {
    const explicitDays = (sections ?? []).filter(
      (section) => section.kind === "day",
    );
    const dates = Array.from(
      new Set((items ?? []).map((item) => item.scheduledFor.split("T")[0])),
    );
    return [
      ...explicitDays.map((section) => ({
        key: `section:${section._id}`,
        label: section.name,
      })),
      ...dates
        .filter(
          (date) =>
            !(items ?? []).some(
              (item) =>
                item.scheduledFor.startsWith(date) &&
                sectionById.get(item.sectionId ?? "")?.kind === "day",
            ),
        )
        .map((date) => ({ key: `date:${date}`, label: displayDay(date) })),
    ];
  }, [items, sectionById, sections]);
  const locationRecords = useMemo(
    () =>
      (records ?? []).filter((record) =>
        ["venue", "place", "service"].includes(record.type),
      ),
    [records],
  );
  const recordsById = useMemo(
    () => new Map((records ?? []).map((record) => [record._id, record])),
    [records],
  );
  const assigneesByItem = useMemo(() => {
    const assignments = new Map<string, Set<string>>();
    for (const workItem of workItems ?? []) {
      if (
        workItem.itineraryItemId === undefined ||
        workItem.assigneeName === undefined
      )
        continue;
      const names =
        assignments.get(workItem.itineraryItemId) ?? new Set<string>();
      names.add(workItem.assigneeName);
      assignments.set(workItem.itineraryItemId, names);
    }
    return assignments;
  }, [workItems]);
  const filterOptions = useMemo(
    () => ({
      assignees: Array.from(
        new Set(
          Array.from(assigneesByItem.values()).flatMap((names) => [...names]),
        ),
      ).sort(),
      movementTypes: Array.from(
        new Set(
          (items ?? [])
            .map((item) => item.movementType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
      tags: Array.from(
        new Set((items ?? []).flatMap((item) => item.tags ?? [])),
      ).sort(),
      venues: Array.from(
        new Set(
          (items ?? [])
            .map((item) =>
              item.recordId
                ? recordsById.get(item.recordId)?.name
                : item.location,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    }),
    [assigneesByItem, items, recordsById],
  );
  const defaultView = useMemo(() => {
    if (items === undefined) return null;
    const now = eventLocalDateTime(timeZone);
    const today = now.slice(0, 10);
    const currentLeg = items
      .filter((item) => {
        const section = sectionById.get(item.sectionId ?? "");
        return (
          (section?.kind === "leg" || section?.kind === "session") &&
          item.scheduledFor <= now
        );
      })
      .at(-1);
    if (currentLeg?.sectionId !== undefined)
      return `section:${currentLeg.sectionId}`;
    if (days.some((day) => day.key === `date:${today}`)) return `date:${today}`;
    const next = days.find(
      (day) => day.key.startsWith("date:") && day.key.slice(5) > today,
    );
    return next?.key ?? days.at(-1)?.key ?? "all";
  }, [days, items, sectionById, timeZone]);
  const activeView =
    selectedView !== null &&
    (selectedView === "all" ||
      days.some((day) => day.key === selectedView) ||
      (sections ?? []).some(
        (section) => `section:${section._id}` === selectedView,
      ))
      ? selectedView
      : (defaultView ?? "all");
  function selectView(view: string) {
    setSelectedView(view);
    window.localStorage.setItem(savedPlanViewKey(eventId), view);
  }
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (items ?? []).filter((item) => {
      const matchesView =
        activeView === "all" ||
        (activeView.startsWith("date:") &&
          item.scheduledFor.startsWith(activeView.slice(5))) ||
        (activeView.startsWith("section:") &&
          item.sectionId === activeView.slice(8));
      const itemVenue = item.recordId
        ? recordsById.get(item.recordId)?.name
        : item.location;
      const haystack = [item.title, item.location, item.notes]
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase();
      return (
        matchesView &&
        (query.length === 0 || haystack.includes(query)) &&
        (assignee === "" ||
          assigneesByItem.get(item._id)?.has(assignee) === true) &&
        (movementType === "" || item.movementType === movementType) &&
        (tag === "" || item.tags?.includes(tag) === true) &&
        (venue === "" || itemVenue === venue)
      );
    });
  }, [
    assignee,
    assigneesByItem,
    items,
    movementType,
    recordsById,
    search,
    activeView,
    tag,
    venue,
  ]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { label: string; items: ItineraryItem[] }>();
    for (const item of visibleItems) {
      const section = sectionById.get(item.sectionId ?? "");
      const key =
        section?.kind === "day"
          ? `section:${section._id}`
          : `date:${item.scheduledFor.split("T")[0]}`;
      const group = groups.get(key) ?? {
        label:
          section?.kind === "day"
            ? section.name
            : displayDay(item.scheduledFor.split("T")[0]),
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [sectionById, visibleItems]);
  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSearch("");
    setAssignee("");
    setMovementType("");
    setTag("");
    setVenue("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const input = {
      eventId,
      title: draft.title,
      scheduledFor: draft.scheduledFor,
      scheduledUntil:
        draft.timeKind === "range" ? draft.scheduledUntil : undefined,
      timeKind: draft.timeKind,
      location: draft.location || undefined,
      recordId: draft.recordId || undefined,
      notes: draft.notes || undefined,
      movementType: draft.movementType || undefined,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      sectionId: draft.sectionId || undefined,
    };

    try {
      await createItem(input);
      setDraft(emptyDraft);
      setIsCreatorOpen(false);
    } catch {
      setError(
        "We could not save this movement. Your changes were not saved; please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onArchive(item: ItineraryItem) {
    setError(null);
    setIsArchiving(item._id);
    try {
      await archiveItem({ eventId, itemId: item._id });
      setUndoItem(item);
    } catch {
      setError("We could not archive this movement. It is still in the plan.");
    } finally {
      setIsArchiving(null);
    }
  }

  async function onRestore() {
    if (undoItem === null) return;
    setError(null);
    setIsRestoring(true);
    try {
      await restoreItem({ eventId, itemId: undoItem._id });
      setUndoItem(null);
    } catch {
      setError("We could not restore this movement. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function restoreArchived(item: ItineraryItem) {
    setError(null);
    setIsRestoring(true);
    try {
      await restoreItem({ eventId, itemId: item._id });
    } catch {
      setError("We could not restore this movement. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div
      className={`grid items-start gap-4 ${
        canEdit ? "xl:grid-cols-[1.35fr_.65fr]" : ""
      }`}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Schedule</CardTitle>
              <p className="mt-1 text-sm text-muted">
                {eventName} · times are in {timeZone}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={canEdit ? "success" : "neutral"}>
                {canEdit ? "Can edit" : "View only"}
              </Badge>
              {canEdit ? (
                <Button size="sm" onClick={() => setIsCreatorOpen(true)}>
                  Add movement
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {undoItem === null ? null : (
            <Banner variant="success" label="Movement archived" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {undoItem.title} was removed from the active plan. It has not
                  been permanently deleted.
                </span>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={onRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Undo archive
                </Button>
              </div>
            </Banner>
          )}
          {error === null ? null : (
            <Banner variant="danger" label="Plan update failed" role="alert">
              {error}
            </Banner>
          )}
          {items === undefined ? (
            <div
              className="flex min-h-32 items-center text-sm text-muted"
              role="status"
            >
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading movements…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No movements yet"
              description="A movement is anywhere the team has to be at a certain time. Add a time and description; place and notes are optional."
            />
          ) : (
            <>
              <div className="grid gap-3 border-b border-line pb-4">
                <div
                  className="flex flex-wrap items-center gap-2"
                  aria-label="Operational day or leg"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={activeView === "all" ? "primary" : "secondary"}
                    aria-pressed={activeView === "all"}
                    onClick={() => selectView("all")}
                  >
                    All schedule
                  </Button>
                  {days.map((day) => (
                    <Button
                      key={day.key}
                      type="button"
                      size="sm"
                      variant={activeView === day.key ? "primary" : "secondary"}
                      aria-pressed={activeView === day.key}
                      onClick={() => selectView(day.key)}
                    >
                      {day.label}
                    </Button>
                  ))}
                  {(sections ?? [])
                    .filter((section) => section.kind !== "day")
                    .map((section) => (
                      <Button
                        key={section._id}
                        type="button"
                        size="sm"
                        variant={
                          activeView === `section:${section._id}`
                            ? "primary"
                            : "secondary"
                        }
                        aria-pressed={activeView === `section:${section._id}`}
                        onClick={() => selectView(`section:${section._id}`)}
                      >
                        {section.name}
                      </Button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="movement-search">
                    Search movements
                  </label>
                  <div className="relative min-w-[min(100%,17rem)] flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      id="movement-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search description, place, or notes"
                    />
                  </div>
                  <select
                    aria-label="Filter by assignment"
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All assignments</option>
                    {filterOptions.assignees.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by movement type"
                    value={movementType}
                    onChange={(event) => setMovementType(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All movement types</option>
                    {filterOptions.movementTypes.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by tag"
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All tags</option>
                    {filterOptions.tags.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by venue"
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All venues</option>
                    {filterOptions.venues.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  {(search.length > 0 ||
                    assignee ||
                    movementType ||
                    tag ||
                    venue) && (
                    <Button type="button" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      Clear filters
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted" aria-live="polite">
                  Showing {visibleItems.length} of {items.length} movement
                  {items.length === 1 ? "" : "s"}.
                </p>
              </div>
              {visibleItems.length === 0 ? (
                <EmptyState
                  title="No movements match these filters"
                  description="Try another day or clear the current search to see the full plan."
                  action={
                    <Button type="button" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <>
                  <div
                    className="grid gap-2 sm:grid-cols-2"
                    aria-label="Day summaries"
                  >
                    {groupedItems.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-lg bg-soft px-3 py-2 text-xs text-muted"
                      >
                        <span className="font-semibold text-ink">
                          {group.label}
                        </span>{" "}
                        · {group.items.length} items · first{" "}
                        {displayScheduledFor(group.items[0], timeZone)} · last{" "}
                        {displayScheduledFor(group.items.at(-1)!, timeZone)}
                      </div>
                    ))}
                  </div>
                  <ol className="divide-y divide-line border-y border-line">
                    {visibleItems.map((item) => (
                      <li
                        key={item._id}
                        className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                      >
                        <time className="font-mono text-xs text-green-ink">
                          {displayScheduledFor(item, timeZone)}
                        </time>
                        <div className="min-w-0">
                          <Link
                            href={`/events/${eventId}/plan/${item._id}`}
                            className="font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                          >
                            {item.title}
                          </Link>
                          {item.location === undefined ? null : (
                            <p className="mt-1 text-sm text-muted">
                              {item.location}
                            </p>
                          )}
                          {item.recordId === undefined ? null : (
                            <p className="mt-1 text-xs font-medium text-green-ink">
                              Linked location:{" "}
                              {recordsById.get(item.recordId)?.name ??
                                "Unavailable record"}
                            </p>
                          )}
                          {item.notes === undefined ? null : (
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {item.notes}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                            {sectionById.get(item.sectionId ?? "")?.kind !==
                              "day" &&
                            sectionById.get(item.sectionId ?? "") !==
                              undefined ? (
                              <Badge variant="neutral">
                                {sectionById.get(item.sectionId ?? "")?.name}
                              </Badge>
                            ) : null}
                            {item.movementType ? (
                              <Badge variant="neutral">
                                {item.movementType}
                              </Badge>
                            ) : null}
                            {item.tags?.map((itemTag) => (
                              <Badge key={itemTag} variant="neutral">
                                {itemTag}
                              </Badge>
                            ))}
                            {assigneesByItem.get(item._id) ? (
                              <span>
                                Assigned:{" "}
                                {[...assigneesByItem.get(item._id)!].join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {canEdit ? (
                          <details className="relative sm:justify-self-end">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-2 hover:bg-soft">
                              <MoreHorizontal
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                Actions for {item.title}
                              </span>
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-line bg-card p-1 shadow-lg">
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                className="w-full justify-start"
                                aria-label={`Archive ${item.title}`}
                                onClick={() => onArchive(item)}
                                disabled={isArchiving === item._id}
                              >
                                {isArchiving === item._id ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                )}
                                Archive
                              </Button>
                            </div>
                          </details>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
          {archivedItems === undefined || archivedItems.length === 0 ? null : (
            <div className="grid gap-2 border-t border-line pt-4">
              <p className="text-sm font-medium text-ink">Archived movements</p>
              <p className="text-xs text-muted">
                Restoring a movement returns it to the active plan; it does not
                send a plan change.
              </p>
              {archivedItems.map((item) => (
                <div
                  key={item._id}
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <span>{item.title}</span>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void restoreArchived(item)}
                      disabled={isRestoring}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Restore
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && isCreatorOpen ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add movement</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Open an existing movement to review its details or make a
                change.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time"
                >
                  Time
                </label>
                <Input
                  id="movement-time"
                  type="datetime-local"
                  value={draft.scheduledFor}
                  onChange={(event) =>
                    updateDraft("scheduledFor", event.target.value)
                  }
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time-kind"
                >
                  Time type
                </label>
                <select
                  id="movement-time-kind"
                  value={draft.timeKind}
                  onChange={(event) =>
                    updateDraft("timeKind", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                >
                  <option value="exact">Exact</option>
                  <option value="approximate">Approximate</option>
                  <option value="range">Range</option>
                  <option value="allDay">All day</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Operational day, leg, or session
                  <select
                    value={draft.sectionId}
                    onChange={(event) =>
                      updateDraft("sectionId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal"
                  >
                    <option value="">Use scheduled date</option>
                    {(sections ?? []).map((section) => (
                      <option key={section._id} value={section._id}>
                        {section.name} · {section.kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Movement type
                  <Input
                    value={draft.movementType}
                    onChange={(event) =>
                      updateDraft("movementType", event.target.value)
                    }
                    maxLength={60}
                    placeholder="e.g. Transfer"
                  />
                </label>
              </div>
              {draft.timeKind === "range" ? (
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="movement-end-time"
                  >
                    End time
                  </label>
                  <Input
                    id="movement-end-time"
                    type="datetime-local"
                    value={draft.scheduledUntil}
                    min={draft.scheduledFor || undefined}
                    onChange={(event) =>
                      updateDraft("scheduledUntil", event.target.value)
                    }
                    required
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-record"
                >
                  Linked location <span className="text-muted">(optional)</span>
                </label>
                <select
                  id="movement-record"
                  value={draft.recordId}
                  onChange={(event) =>
                    updateDraft("recordId", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                >
                  <option value="">No linked location</option>
                  {locationRecords.map((record) => (
                    <option key={record._id} value={record._id}>
                      {record.name} · {record.type}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  Only venue, place, and service records can be linked to a
                  movement.
                </p>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-title"
                >
                  Description
                </label>
                <Input
                  id="movement-title"
                  ref={titleInputRef}
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  maxLength={160}
                  required
                  placeholder="e.g. Depart for service area"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-tags"
                >
                  Tags <span className="text-muted">(optional)</span>
                </label>
                <Input
                  id="movement-tags"
                  value={draft.tags}
                  onChange={(event) => updateDraft("tags", event.target.value)}
                  maxLength={300}
                  placeholder="e.g. crew, fuel, critical"
                />
                <p className="text-xs text-muted">Separate tags with commas.</p>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-location"
                >
                  Place <span className="text-muted">(optional)</span>
                </label>
                <Input
                  id="movement-location"
                  value={draft.location}
                  onChange={(event) =>
                    updateDraft("location", event.target.value)
                  }
                  maxLength={160}
                  placeholder="e.g. Service Park"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-notes"
                >
                  Notes <span className="text-muted">(optional)</span>
                </label>
                <textarea
                  id="movement-notes"
                  value={draft.notes}
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  maxLength={1000}
                  className="min-h-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-muted focus:border-ink focus:ring-2 focus:ring-ink"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Add movement
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (
                      !hasUnsavedChanges ||
                      window.confirm("Discard this movement draft?")
                    ) {
                      setDraft(emptyDraft);
                      setIsCreatorOpen(false);
                    }
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
