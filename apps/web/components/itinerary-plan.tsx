"use client";

import {
  CalendarPlus,
  Copy,
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
  logisticsApi,
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
import { OperationalSections } from "@/components/operational-sections";
import { planSectionsApi, type PlanSection } from "@/lib/events-api";
import {
  calendarDay,
  displayMovementTime,
  movementTimeLabel,
  operationalDayLabel,
} from "@/lib/timing";
import { locationRecords } from "@/lib/record-locations";
import { VenueLinkCombobox } from "@/components/venue-link-combobox";
import {
  ItineraryStagingGrid,
  type StagedMovement,
} from "@/components/itinerary-staging-grid";

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
  sectionId: string;
  operationalDay: string;
  displayTime: "standard" | "2400";
  travelContextId: string;
  serviceIntervalId: string;
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
  sectionId: "",
  operationalDay: "",
  displayTime: "standard",
  travelContextId: "",
  serviceIntervalId: "",
};

function sectionDate(sectionId: string, sections: PlanSection[]) {
  return sections.find((section) => section._id === sectionId)?.operationalDate;
}

function serverTiming(draft: Draft, sections: PlanSection[]) {
  const operationalDay =
    draft.operationalDay || sectionDate(draft.sectionId, sections) || undefined;
  if (draft.timeKind === "allDay") {
    return {
      scheduledFor: `${draft.scheduledFor}T00:00`,
      operationalDay: operationalDay ?? draft.scheduledFor,
      displayTime: "standard" as const,
    };
  }
  if (draft.displayTime === "2400") {
    const day = operationalDay ?? draft.scheduledFor;
    return {
      scheduledFor: `${day}T24:00`,
      operationalDay: day,
      displayTime: "2400" as const,
    };
  }
  return {
    scheduledFor: draft.scheduledFor,
    operationalDay,
    displayTime: "standard" as const,
  };
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
  const sections = useQuery(planSectionsApi.list, { eventId });
  const records = useQuery(recordsApi.list, { eventId });
  const directory = useQuery(movementsApi.listDirectory, { eventId });
  const recordTypes = useQuery(recordsApi.listTypes, { eventId });
  const logistics = useQuery(logisticsApi.getOverview, { eventId });
  const createItem = useMutation(itineraryApi.create);
  const createWithVenue = useMutation(itineraryApi.createWithVenue);
  const createMany = useMutation(itineraryApi.createMany);
  const archiveItem = useMutation(itineraryApi.archive);
  const restoreItem = useMutation(itineraryApi.restore);
  const ensureDefaults = useMutation(movementsApi.ensureDefaults);
  const createType = useMutation(movementsApi.createType);
  const createTag = useMutation(movementsApi.createTag);
  const createTeam = useMutation(movementsApi.createTeam);
  const createOperationalRole = useMutation(movementsApi.createOperationalRole);
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
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [search, setSearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [undoItem, setUndoItem] = useState<ItineraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [vocabularyKind, setVocabularyKind] = useState("type");
  const [vocabularyName, setVocabularyName] = useState("");
  const [isSavingVocabulary, setIsSavingVocabulary] = useState(false);
  const [isStagingOpen, setIsStagingOpen] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
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
      const matchesTag =
        selectedTag.length === 0 ||
        (item.tags ?? []).some((tag) => tag._id === selectedTag);
      const matchesAssignment =
        selectedAssignment.length === 0 ||
        (item.assignments ?? []).some(
          (assignment) => assignment.label === selectedAssignment,
        );
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
        matchesTag &&
        matchesAssignment &&
        matchesVenue &&
        (query.length === 0 || haystack.includes(query))
      );
    });
  }, [
    items,
    recordsById,
    search,
    selectedAssignment,
    activeDay,
    selectedTag,
    selectedType,
    selectedVenue,
  ]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ItineraryItem[]>();
    for (const item of visibleItems) {
      const day = calendarDay(item);
      groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    return [...groups].map(([day, grouped]) => ({ day, items: grouped }));
  }, [visibleItems]);
  const assignmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? []).flatMap((item) =>
            (item.assignments ?? []).map((assignment) => assignment.label),
          ),
        ),
      ).sort(),
    [items],
  );
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
  const activeSecondaryFilterCount = [
    selectedType,
    selectedTag,
    selectedAssignment,
    selectedVenue,
  ].filter(Boolean).length;
  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSelectedDay(null);
    setSelectedType("");
    setSelectedTag("");
    setSelectedAssignment("");
    setSelectedVenue("");
    setSearch("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const timing = serverTiming(draft, sections ?? []);
    const input = {
      eventId,
      title: draft.title,
      scheduledFor: timing.scheduledFor,
      scheduledUntil:
        draft.timeKind === "range" ? draft.scheduledUntil : undefined,
      timeKind: draft.timeKind,
      sectionId: draft.sectionId || undefined,
      operationalDay: timing.operationalDay,
      displayTime: timing.displayTime,
      location: draft.location || undefined,
      notes: draft.notes || undefined,
      movementTypeId: draft.movementTypeId || null,
      travelContextId: draft.travelContextId || undefined,
      serviceIntervalId: draft.serviceIntervalId || undefined,
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
      }
    } catch {
      setError(
        "We could not save this movement. Your changes were not saved; please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addVocabulary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSavingVocabulary(true);
    try {
      const input = { eventId, name: vocabularyName };
      if (vocabularyKind === "type") await createType(input);
      else if (vocabularyKind === "tag") await createTag(input);
      else if (vocabularyKind === "team") await createTeam(input);
      else await createOperationalRole(input);
      setVocabularyName("");
    } catch {
      setError("We could not add that operational value. It was not saved.");
    } finally {
      setIsSavingVocabulary(false);
    }
  }

  async function saveStagedRows(rows: StagedMovement[]) {
    setError(null);
    setIsSubmitting(true);
    try {
      const activeTypes = directory?.types.filter(
        (entry) => entry.archivedAt === undefined,
      );
      const activeTags = directory?.tags.filter(
        (entry) => entry.archivedAt === undefined,
      );
      const activeTeams = directory?.teams.filter(
        (entry) => entry.archivedAt === undefined,
      );
      const byName = <T extends { name: string }>(
        entries: T[] | undefined,
        name: string,
      ) =>
        entries?.find(
          (entry) =>
            entry.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
        );
      const unresolved = rows.find(
        (row) =>
          (row.movementType && !byName(activeTypes, row.movementType)) ||
          (row.team && !byName(activeTeams, row.team)) ||
          row.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .some((tag) => !byName(activeTags, tag)),
      );
      if (unresolved)
        throw new Error(
          "Use operational vocabulary values that already exist before saving staged rows.",
        );
      await createMany({
        eventId,
        items: rows.map((row) => ({
          eventId,
          title: row.title,
          scheduledFor: row.scheduledFor,
          location: row.location || undefined,
          operationalDay: row.operationalDay || undefined,
          movementTypeId: byName(activeTypes, row.movementType)?._id ?? null,
          teamId: byName(activeTeams, row.team)?._id,
          tagIds: row.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => byName(activeTags, tag)!._id),
          timeKind: "exact",
        })),
      });
    } catch {
      setError(
        "We could not add the staged movements. Check the rows and try again.",
      );
      throw new Error("Staged movements were not saved");
    } finally {
      setIsSubmitting(false);
    }
  }

  function duplicateItem(item: ItineraryItem) {
    setDraft({
      title: item.title,
      scheduledFor: "",
      scheduledUntil: "",
      timeKind: item.timeKind ?? "exact",
      location: item.location ?? "",
      recordId: item.recordId ?? "",
      venueName: "",
      venueAddress: "",
      notes: item.notes ?? "",
      operationalDay: item.operationalDay ?? "",
      movementTypeId: item.movementTypeId ?? "",
      sectionId: item.sectionId ?? "",
      displayTime: item.displayTime ?? "standard",
      travelContextId: item.travelContextId ?? "",
      serviceIntervalId: item.serviceIntervalId ?? "",
    });
    setIsCreatorOpen(true);
    setIsStagingOpen(false);
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
                  <Link
                    className="inline-flex min-h-11 items-center rounded-lg border border-btnline bg-card px-3 text-xs font-semibold text-ink2 hover:bg-soft"
                    href={`/events/${eventId}/plan/import`}
                  >
                    Import plan
                  </Link>
                  <Link
                    href={`/events/${eventId}/plan/reconcile`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-green-ink underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    Reconcile venues
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsCreatorOpen(true);
                      setIsStagingOpen(false);
                    }}
                  >
                    Add movement
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsStagingOpen(true);
                      setIsCreatorOpen(false);
                    }}
                  >
                    Add many
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
                  className="flex gap-2 overflow-x-auto pb-1"
                  aria-label="Filter by day"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={activeDay === null ? "primary" : "secondary"}
                    aria-pressed={activeDay === null}
                    onClick={() => {
                      setSelectedDay(null);
                      window.localStorage.setItem(
                        `race-planner:plan-view:${eventId}`,
                        "all",
                      );
                    }}
                  >
                    All days
                  </Button>
                  {days.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={activeDay === day ? "primary" : "secondary"}
                      aria-pressed={activeDay === day}
                      onClick={() => {
                        setSelectedDay(day);
                        window.localStorage.setItem(
                          `race-planner:plan-view:${eventId}`,
                          day,
                        );
                      }}
                    >
                      {displayDay(day)}
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
                      placeholder="Search movement, type, tag, assignment, place, or notes"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="md:hidden"
                    aria-expanded={isFiltersOpen}
                    aria-controls="movement-secondary-filters"
                    onClick={() => setIsFiltersOpen((open) => !open)}
                  >
                    Filters
                    {activeSecondaryFilterCount === 0
                      ? ""
                      : ` (${activeSecondaryFilterCount})`}
                  </Button>
                </div>
                <div
                  id="movement-secondary-filters"
                  className={`${isFiltersOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 md:flex`}
                >
                  <select
                    aria-label="Filter by movement type"
                    value={selectedType}
                    onChange={(event) => setSelectedType(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All types</option>
                    {(directory?.types ?? []).map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by movement tag"
                    value={selectedTag}
                    onChange={(event) => setSelectedTag(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All tags</option>
                    {(directory?.tags ?? []).map((tag) => (
                      <option key={tag._id} value={tag._id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by assignment"
                    value={selectedAssignment}
                    onChange={(event) =>
                      setSelectedAssignment(event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All assignments</option>
                    {assignmentOptions.map((assignment) => (
                      <option key={assignment}>{assignment}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by venue"
                    value={selectedVenue}
                    onChange={(event) => setSelectedVenue(event.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">All venues</option>
                    {venueOptions.map((venue) => (
                      <option key={venue}>{venue}</option>
                    ))}
                  </select>
                  {(activeDay !== null ||
                    selectedType.length > 0 ||
                    selectedTag.length > 0 ||
                    selectedAssignment.length > 0 ||
                    selectedVenue.length > 0 ||
                    search.length > 0) && (
                    <Button type="button" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      Clear filters
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted" aria-live="polite">
                  Showing {visibleItems.length} of {items.length} movement
                  {items.length === 1 ? "" : "s"}
                  {activeDay === null ? "" : ` on ${displayDay(activeDay)}`}
                  {search.trim().length === 0 ? "" : " matching your search"}.
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
                        key={group.day}
                        className="rounded-lg bg-soft px-3 py-2 text-xs text-muted"
                      >
                        <span className="font-semibold text-ink">
                          {displayDay(group.day)}
                        </span>{" "}
                        · {group.items.length} movement
                        {group.items.length === 1 ? "" : "s"} · first{" "}
                        {displayMovementTime(group.items[0])} · last{" "}
                        {displayMovementTime(group.items.at(-1)!)}
                      </div>
                    ))}
                  </div>
                  <ol className="divide-y divide-line border-y border-line">
                    {visibleItems.map((item, index) => (
                      <li
                        key={item._id}
                        className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                      >
                        {index === 0 ||
                        calendarDay(visibleItems[index - 1]) !==
                          calendarDay(item) ? (
                          <h3 className="pt-2 font-semibold text-ink sm:col-span-3">
                            {displayDay(calendarDay(item))}
                          </h3>
                        ) : null}
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
                          <p className="mt-1 text-xs font-medium text-muted">
                            {operationalDayLabel(item, sections ?? [])}
                          </p>
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
                              <Button
                                type="button"
                                variant="soft"
                                size="sm"
                                onClick={() => duplicateItem(item)}
                              >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                                Duplicate
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

      {canEdit && isStagingOpen ? (
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Add movements in a spreadsheet</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Use the same staging table for typing, row-by-row work, and
                multi-row spreadsheet paste.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ItineraryStagingGrid
              onSave={saveStagedRows}
              isSaving={isSubmitting}
            />
          </CardContent>
        </Card>
      ) : null}

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
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time"
                >
                  {draft.timeKind === "allDay"
                    ? "Date"
                    : draft.displayTime === "2400"
                      ? "Operational day"
                      : "Time"}
                </label>
                <Input
                  id="movement-time"
                  ref={firstInputRef}
                  type={
                    draft.timeKind === "allDay" || draft.displayTime === "2400"
                      ? "date"
                      : "datetime-local"
                  }
                  value={draft.scheduledFor}
                  onChange={(event) =>
                    updateDraft("scheduledFor", event.target.value)
                  }
                  required
                />
              </div>
              {draft.timeKind === "range" ||
              draft.timeKind === "allDay" ? null : (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={draft.displayTime === "2400"}
                    onChange={(event) => {
                      const next = event.target.checked ? "2400" : "standard";
                      updateDraft("displayTime", next);
                      if (next === "2400" && draft.scheduledFor.includes("T")) {
                        const day = draft.scheduledFor.slice(0, 10);
                        updateDraft("scheduledFor", day);
                        if (!draft.operationalDay)
                          updateDraft("operationalDay", day);
                      }
                    }}
                  />
                  Display midnight as 2400 on the preceding operational day
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Travel leg <span className="text-muted">(optional)</span>
                  <select
                    value={draft.travelContextId}
                    onChange={(event) =>
                      updateDraft("travelContextId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">No travel leg</option>
                    {(logistics?.travelContexts ?? []).map((travel) => (
                      <option key={travel._id} value={travel._id}>
                        {travel.fromName} → {travel.toName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Service window <span className="text-muted">(optional)</span>
                  <select
                    value={draft.serviceIntervalId}
                    onChange={(event) =>
                      updateDraft("serviceIntervalId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                  >
                    <option value="">No service window</option>
                    {(logistics?.serviceIntervals ?? []).map((service) => (
                      <option key={service._id} value={service._id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="movement-time-kind"
                >
                  Operational section{" "}
                  <span className="text-muted">(optional)</span>
                </label>
                <select
                  id="movement-section"
                  value={draft.sectionId}
                  onChange={(event) =>
                    updateDraft("sectionId", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                >
                  <option value="">No named section</option>
                  {(sections ?? []).map((section) => (
                    <option key={section._id} value={section._id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              {draft.timeKind === "allDay" ? null : (
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="movement-operational-day"
                  >
                    Operational day{" "}
                    <span className="text-muted">(optional)</span>
                  </label>
                  <Input
                    id="movement-operational-day"
                    type="date"
                    value={draft.operationalDay}
                    onChange={(event) =>
                      updateDraft("operationalDay", event.target.value)
                    }
                  />
                  <p className="text-xs text-muted">
                    Use this to keep an early-morning calendar time in the prior
                    operational schedule.
                  </p>
                </div>
              )}
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
                  htmlFor="movement-type"
                >
                  Movement type <span className="text-muted">(optional)</span>
                </label>
                <select
                  id="movement-type"
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
                      onChange={(event) =>
                        updateDraft("venueName", event.target.value)
                      }
                      maxLength={160}
                      required
                      aria-label="New venue name"
                    />
                    <Input
                      value={draft.venueAddress}
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
                  htmlFor="movement-location"
                >
                  Location label{" "}
                  <span className="text-muted">(snapshot or override)</span>
                </label>
                <Input
                  id="movement-location"
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
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Operational vocabulary</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Add event-local movement types, control tags, teams, and
              operational roles. These do not change member permissions.
            </p>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap gap-2" onSubmit={addVocabulary}>
              <select
                aria-label="Operational vocabulary kind"
                value={vocabularyKind}
                onChange={(event) => setVocabularyKind(event.target.value)}
                className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
              >
                <option value="type">Movement type</option>
                <option value="tag">Control code or tag</option>
                <option value="team">Team</option>
                <option value="role">Operational role</option>
              </select>
              <Input
                aria-label="Operational vocabulary name"
                value={vocabularyName}
                onChange={(event) => setVocabularyName(event.target.value)}
                maxLength={80}
                required
                placeholder={
                  vocabularyKind === "tag"
                    ? "e.g. FCI"
                    : vocabularyKind === "team"
                      ? "e.g. RRC"
                      : vocabularyKind === "role"
                        ? "e.g. Stage Captain"
                        : "e.g. Regroup"
                }
              />
              <Button type="submit" disabled={isSavingVocabulary}>
                {isSavingVocabulary ? "Adding…" : "Add"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <OperationalSections eventId={eventId} role={role} />
    </div>
  );
}
