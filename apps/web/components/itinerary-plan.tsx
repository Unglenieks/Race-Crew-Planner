"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
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
  movementsApi,
  recordsApi,
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
import {
  calendarDay,
  displayMovementTime,
  movementTimeLabel,
} from "@/lib/timing";
import { locationRecords } from "@/lib/record-locations";
import { VenueLinkCombobox } from "@/components/venue-link-combobox";

type Draft = {
  title: string;
  scheduledFor: string;
  scheduledUntil: string;
  timeKind: NonNullable<ItineraryItem["timeKind"]>;
  location: string;
  recordId: string;
  venueName: string;
  venueAddress: string;
  notes: string;
  movementTypeId: string;
  spectatorVisible: boolean;
};

const emptyDraft: Draft = {
  title: "",
  scheduledFor: "",
  scheduledUntil: "",
  timeKind: "exact",
  location: "",
  recordId: "",
  venueName: "",
  venueAddress: "",
  notes: "",
  movementTypeId: "",
  spectatorVisible: false,
};

function displayDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
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
  const directory = useQuery(movementsApi.listDirectory, { eventId });
  const recordTypes = useQuery(recordsApi.listTypes, { eventId });
  const createItem = useMutation(itineraryApi.create);
  const createWithVenue = useMutation(itineraryApi.createWithVenue);
  const archiveItem = useMutation(itineraryApi.archive);
  const restoreItem = useMutation(itineraryApi.restore);
  const ensureDefaults = useMutation(movementsApi.ensureDefaults);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedDay, setSelectedDay] = useState<string | null | undefined>(
    () => {
      if (typeof window === "undefined") return undefined;
      const saved = window.localStorage.getItem(
        `race-planner:plan-view:${eventId}`,
      );
      return saved === "all" ? null : (saved ?? undefined);
    },
  );
  const [selectedType, setSelectedType] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [undoItem, setUndoItem] = useState<ItineraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dayCardsRef = useRef<HTMLDivElement>(null);
  const [canScrollDayCards, setCanScrollDayCards] = useState({
    backward: false,
    forward: false,
  });
  const hasUnsavedChanges =
    JSON.stringify(draft) !== JSON.stringify(emptyDraft);

  useEffect(() => {
    if (isCreatorOpen) firstInputRef.current?.focus();
  }, [isCreatorOpen]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isCreatorOpen || !hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges, isCreatorOpen]);
  useEffect(() => {
    if (!canEdit) return;
    void ensureDefaults({ eventId }).catch(() => undefined);
  }, [canEdit, ensureDefaults, eventId]);

  const days = useMemo(
    () => Array.from(new Set((items ?? []).map(calendarDay))).sort(),
    [items],
  );
  const defaultDay = useMemo(() => {
    if (items === undefined || days.length === 0) return null;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return days.find((day) => day >= today) ?? days.at(-1) ?? null;
  }, [days, items, timeZone]);
  const activeDay =
    selectedDay === undefined ||
    (selectedDay !== null && !days.includes(selectedDay))
      ? defaultDay
      : selectedDay;
  const locationRecordOptions = useMemo(
    () => locationRecords(records ?? [], recordTypes ?? []),
    [records, recordTypes],
  );
  const recordsById = useMemo(
    () => new Map((records ?? []).map((record) => [record._id, record])),
    [records],
  );
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (items ?? []).filter((item) => {
      const matchesDay = activeDay === null || calendarDay(item) === activeDay;
      const matchesType =
        selectedType.length === 0 || item.movementTypeId === selectedType;
      const venueName =
        item.recordId === undefined
          ? item.location
          : recordsById.get(item.recordId)?.name;
      const matchesVenue =
        selectedVenue.length === 0 || venueName === selectedVenue;
      const haystack = [
        item.title,
        item.location,
        item.notes,
        item.movementTypeLabel,
        ...(item.tags ?? []).map((tag) => tag.name),
        ...(item.assignments ?? []).map((assignment) => assignment.label),
      ]
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase();
      return (
        matchesDay &&
        matchesType &&
        matchesVenue &&
        (query.length === 0 || haystack.includes(query))
      );
    });
  }, [items, recordsById, search, activeDay, selectedType, selectedVenue]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ItineraryItem[]>();
    for (const item of visibleItems) {
      const day = calendarDay(item);
      groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    return [...groups].map(([day, grouped]) => ({ day, items: grouped }));
  }, [visibleItems]);
  useEffect(() => {
    const dayCards = dayCardsRef.current;
    if (dayCards === null) return;
    const updateScrollState = () => {
      const maximum = dayCards.scrollWidth - dayCards.clientWidth;
      setCanScrollDayCards({
        backward: dayCards.scrollLeft > 1,
        forward: dayCards.scrollLeft < maximum - 1,
      });
    };
    updateScrollState();
    dayCards.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(dayCards);
    return () => {
      dayCards.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [groupedItems]);
  const venueOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? [])
            .map((item) =>
              item.recordId === undefined
                ? item.location
                : recordsById.get(item.recordId)?.name,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [items, recordsById],
  );
  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    selectDay(null);
    setSelectedType("");
    setSelectedVenue("");
    setSearch("");
  }

  function selectDay(day: string | null) {
    setSelectedDay(day);
    window.localStorage.setItem(
      `race-planner:plan-view:${eventId}`,
      day ?? "all",
    );
  }

  function scrollDayCards(direction: "backward" | "forward") {
    const dayCards = dayCardsRef.current;
    if (dayCards === null) return;
    dayCards.scrollBy({
      left: (direction === "forward" ? 1 : -1) * dayCards.clientWidth * 0.85,
      behavior: "smooth",
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const input = {
      eventId,
      title: draft.title,
      scheduledFor:
        draft.timeKind === "allDay"
          ? `${draft.scheduledFor}T00:00`
          : draft.scheduledFor,
      scheduledUntil:
        draft.timeKind === "range" ? draft.scheduledUntil : undefined,
      timeKind: draft.timeKind,
      location: draft.location || undefined,
      notes: draft.notes || undefined,
      movementTypeId: draft.movementTypeId || null,
      spectatorVisible: draft.spectatorVisible,
    };

    try {
      if (draft.venueName) {
        await createWithVenue({
          ...input,
          venueName: draft.venueName,
          venueAddress: draft.venueAddress || undefined,
        });
      } else {
        await createItem({ ...input, recordId: draft.recordId || undefined });
      }
      const continueAdding =
        (
          (event.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null
        )?.value === "continue";
      if (continueAdding) {
        setDraft((current) => ({
          ...current,
          scheduledFor: "",
          scheduledUntil: "",
          title: "",
        }));
        requestAnimationFrame(() => firstInputRef.current?.focus());
      } else {
        setDraft(emptyDraft);
        setIsCreatorOpen(false);
        setMessage("Movement added to the schedule.");
      }
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
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsCreatorOpen(true);
                    }}
                  >
                    Add movement
                  </Button>
                </>
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
          {message === null ? null : (
            <Banner variant="success" label="Schedule updated" role="status">
              {message}
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
              <div className="grid gap-2 border-b border-line pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <div
                  aria-label="Schedule view"
                  className="grid min-w-0 gap-1.5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-2"
                  role="group"
                >
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="movement-day"
                  >
                    Schedule view
                  </label>
                  <select
                    id="movement-day"
                    name="movementDay"
                    value={activeDay ?? "all"}
                    onChange={(event) =>
                      selectDay(
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      )
                    }
                    className="min-h-9 min-w-0 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink"
                  >
                    <option value="all">All days</option>
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {displayDay(day)}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  aria-label="Schedule filters"
                  className="grid grid-cols-1 gap-2 min-w-0 lg:grid-cols-2 lg:border-l lg:border-line lg:pl-2"
                  role="group"
                >
                  <select
                    id="movement-type-filter"
                    name="movementTypeFilter"
                    aria-label="Movement type filter"
                    value={selectedType}
                    onChange={(event) => setSelectedType(event.target.value)}
                    className="min-h-9 min-w-0 w-full rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All types</option>
                    {(directory?.types ?? []).map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <select
                    id="movement-venue-filter"
                    name="movementVenueFilter"
                    aria-label="Venue filter"
                    value={selectedVenue}
                    onChange={(event) => setSelectedVenue(event.target.value)}
                    className="min-h-9 min-w-0 w-full rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All venues</option>
                    {venueOptions.map((venue) => (
                      <option key={venue}>{venue}</option>
                    ))}
                  </select>
                </div>
                <div className="relative min-w-0 w-full">
                  <label className="sr-only" htmlFor="movement-search">
                    Search movements
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="movement-search"
                    name="movementSearch"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-9 pl-9"
                    placeholder="Search title, place, or notes"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:col-span-4">
                  {(selectedDay !== undefined ||
                    selectedType.length > 0 ||
                    selectedVenue.length > 0 ||
                    search.length > 0) && (
                    <Button type="button" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      Clear filters
                    </Button>
                  )}
                  <p className="text-xs text-muted" aria-live="polite">
                    Showing {visibleItems.length} of {items.length} movement
                    {items.length === 1 ? "" : "s"}
                    {activeDay === null ? "" : ` on ${displayDay(activeDay)}`}
                    {search.trim().length === 0 ? "" : " matching your search"}.
                  </p>
                </div>
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
                <section className="grid gap-3" aria-label="Schedule by day">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted">
                      {activeDay === null
                        ? "Browse days horizontally."
                        : "Showing the selected day."}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        aria-label="Previous schedule day"
                        onClick={() => scrollDayCards("backward")}
                        disabled={!canScrollDayCards.backward}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        aria-label="Next schedule day"
                        onClick={() => scrollDayCards("forward")}
                        disabled={!canScrollDayCards.forward}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div
                    ref={dayCardsRef}
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                    aria-label="Schedule day cards"
                  >
                    {groupedItems.map((group) => (
                      <section
                        key={group.day}
                        className="min-w-[min(100%,24rem)] snap-start rounded-xl border border-line bg-card p-4"
                        aria-labelledby={`schedule-day-${group.day}`}
                      >
                        <div className="border-b border-line pb-3">
                          <h3
                            id={`schedule-day-${group.day}`}
                            className="font-semibold text-ink"
                          >
                            {displayDay(group.day)}
                          </h3>
                          <p className="mt-1 text-xs text-muted">
                            {group.items.length} movement
                            {group.items.length === 1 ? "" : "s"} · first{" "}
                            {displayMovementTime(group.items[0])} · last{" "}
                            {displayMovementTime(group.items.at(-1)!)}
                          </p>
                        </div>
                        <ol className="divide-y divide-line">
                          {group.items.map((item) => (
                            <li
                              key={item._id}
                              className="grid gap-3 py-4 first:pt-4 last:pb-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
                            >
                              <time
                                className="font-mono text-xs text-green-ink"
                                aria-label={movementTimeLabel(item)}
                              >
                                {displayMovementTime(item)}
                              </time>
                              <div className="min-w-0">
                                <Link
                                  href={`/events/${eventId}/plan/${item._id}`}
                                  className="font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                                >
                                  {item.title}
                                </Link>
                                {item.movementTypeLabel === undefined ? null : (
                                  <Badge
                                    className="ml-2 align-middle"
                                    variant="neutral"
                                  >
                                    {item.movementTypeLabel}
                                  </Badge>
                                )}
                                {item.tags === undefined ||
                                item.tags.length === 0 ? null : (
                                  <p className="mt-1 flex flex-wrap gap-1">
                                    {item.tags.map((tag) => (
                                      <Badge key={tag._id} variant="info">
                                        {tag.name}
                                      </Badge>
                                    ))}
                                  </p>
                                )}
                                {item.assignments === undefined ||
                                item.assignments.length === 0 ? null : (
                                  <p className="mt-1 text-xs text-muted">
                                    Assigned:{" "}
                                    {item.assignments
                                      .map((assignment) => assignment.label)
                                      .join(", ")}
                                  </p>
                                )}
                                {item.location === undefined ? null : (
                                  <p className="mt-1 text-sm text-muted">
                                    {item.location}
                                  </p>
                                )}
                                {item.recordId === undefined ? null : (
                                  <p className="mt-1 text-xs font-medium text-green-ink">
                                    Linked location:{" "}
                                    <Link
                                      className="underline underline-offset-2"
                                      href={`/events/${eventId}/records/${item.recordId}`}
                                    >
                                      {recordsById.get(item.recordId)?.name ??
                                        "Unavailable record"}
                                    </Link>
                                  </p>
                                )}
                                {item.notes === undefined ? null : (
                                  <p className="mt-1 text-sm leading-relaxed text-muted">
                                    {item.notes}
                                  </p>
                                )}
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
                                  <div className="grid min-w-36 gap-1 rounded-lg border border-line bg-card p-2 shadow-lg sm:absolute sm:right-0 sm:z-10">
                                    <Button
                                      type="button"
                                      variant="danger"
                                      size="sm"
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
                      </section>
                    ))}
                  </div>
                </section>
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
                Add a time and description; place and notes are optional.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time-kind"
                >
                  Time type
                </label>
                <select
                  id="movement-time-kind"
                  name="movementTimeKind"
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
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time"
                >
                  {draft.timeKind === "allDay" ? "Date" : "Time"}
                </label>
                <Input
                  id="movement-time"
                  name="movementTime"
                  ref={firstInputRef}
                  type={draft.timeKind === "allDay" ? "date" : "datetime-local"}
                  value={draft.scheduledFor}
                  onChange={(event) =>
                    updateDraft("scheduledFor", event.target.value)
                  }
                  required
                />
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
                    name="movementEndTime"
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
                  htmlFor="movement-type"
                >
                  Movement type <span className="text-muted">(optional)</span>
                </label>
                <select
                  id="movement-type"
                  name="movementType"
                  value={draft.movementTypeId}
                  onChange={(event) =>
                    updateDraft("movementTypeId", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
                >
                  <option value="">Unclassified</option>
                  {(directory?.types ?? [])
                    .filter((type) => type.archivedAt === undefined)
                    .map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted">
                  Codes such as FCI, FCO, MTC, and Service A/B are tags on the
                  movement detail.
                </p>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-record"
                >
                  Linked venue <span className="text-muted">(optional)</span>
                </label>
                {draft.venueName ? (
                  <div className="grid gap-3 rounded-lg border border-line bg-topbg p-3">
                    <p className="text-sm font-medium text-ink">
                      Create and link venue
                    </p>
                    <Input
                      value={draft.venueName}
                      name="newVenueName"
                      onChange={(event) =>
                        updateDraft("venueName", event.target.value)
                      }
                      maxLength={160}
                      required
                      aria-label="New venue name"
                    />
                    <Input
                      value={draft.venueAddress}
                      name="newVenueAddress"
                      onChange={(event) =>
                        updateDraft("venueAddress", event.target.value)
                      }
                      maxLength={300}
                      placeholder="Address (optional)"
                      aria-label="New venue address"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        updateDraft("venueName", "");
                        updateDraft("venueAddress", "");
                      }}
                    >
                      Use an existing venue instead
                    </Button>
                  </div>
                ) : (
                  <VenueLinkCombobox
                    records={locationRecordOptions}
                    selectedId={draft.recordId}
                    onSelect={(record) => {
                      updateDraft("recordId", record?._id ?? "");
                      if (record !== null) updateDraft("location", record.name);
                    }}
                    onCreate={(name) => updateDraft("venueName", name)}
                  />
                )}
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
                  name="movementDescription"
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  maxLength={160}
                  required
                  placeholder="e.g. Depart for service area"
                />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="spectatorVisible"
                  checked={draft.spectatorVisible}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      spectatorVisible: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-[var(--color-green)]"
                />
                <span>
                  <span className="block font-semibold">
                    Show on spectator schedule
                  </span>
                  <span className="mt-1 block text-muted">
                    This movement appears on the spectator schedule when saved.
                  </span>
                </span>
              </label>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-location"
                >
                  Location label{" "}
                  <span className="text-muted">(snapshot or override)</span>
                </label>
                <Input
                  id="movement-location"
                  name="movementLocation"
                  value={draft.location}
                  onChange={(event) =>
                    updateDraft("location", event.target.value)
                  }
                  maxLength={160}
                  placeholder="Defaults to the selected venue"
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
                  name="movementNotes"
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
                  Add
                </Button>
                <Button
                  type="submit"
                  name="continue"
                  value="continue"
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  Add and continue
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
