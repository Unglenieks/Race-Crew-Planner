"use client";

import {
  CalendarPlus,
  LoaderCircle,
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
import { formatEventDateTime } from "@/lib/time-zones";

type Draft = {
  title: string;
  scheduledFor: string;
  scheduledUntil: string;
  timeKind: NonNullable<ItineraryItem["timeKind"]>;
  location: string;
  recordId: string;
  notes: string;
  movementTypeId: string;
};

const emptyDraft: Draft = {
  title: "",
  scheduledFor: "",
  scheduledUntil: "",
  timeKind: "exact",
  location: "",
  recordId: "",
  notes: "",
  movementTypeId: "",
};

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
  const createItem = useMutation(itineraryApi.create);
  const archiveItem = useMutation(itineraryApi.archive);
  const restoreItem = useMutation(itineraryApi.restore);
  const ensureDefaults = useMutation(movementsApi.ensureDefaults);
  const createType = useMutation(movementsApi.createType);
  const createTag = useMutation(movementsApi.createTag);
  const createTeam = useMutation(movementsApi.createTeam);
  const createOperationalRole = useMutation(movementsApi.createOperationalRole);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [undoItem, setUndoItem] = useState<ItineraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [vocabularyKind, setVocabularyKind] = useState("type");
  const [vocabularyName, setVocabularyName] = useState("");
  const [isSavingVocabulary, setIsSavingVocabulary] = useState(false);
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
  useEffect(() => {
    if (!canEdit) return;
    void ensureDefaults({ eventId }).catch(() => undefined);
  }, [canEdit, ensureDefaults, eventId]);

  const days = useMemo(
    () =>
      Array.from(
        new Set((items ?? []).map((item) => item.scheduledFor.split("T")[0])),
      ),
    [items],
  );
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
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (items ?? []).filter((item) => {
      const matchesDay =
        selectedDay === null || item.scheduledFor.startsWith(selectedDay);
      const matchesType =
        selectedType.length === 0 || item.movementTypeId === selectedType;
      const matchesTag =
        selectedTag.length === 0 ||
        (item.tags ?? []).some((tag) => tag._id === selectedTag);
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
        (query.length === 0 || haystack.includes(query))
      );
    });
  }, [items, search, selectedDay, selectedTag, selectedType]);
  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSelectedDay(null);
    setSelectedType("");
    setSelectedTag("");
    setSearch("");
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
      movementTypeId: draft.movementTypeId || null,
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
                  aria-label="Filter by day"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedDay === null ? "primary" : "secondary"}
                    aria-pressed={selectedDay === null}
                    onClick={() => setSelectedDay(null)}
                  >
                    All days
                  </Button>
                  {days.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={selectedDay === day ? "primary" : "secondary"}
                      aria-pressed={selectedDay === day}
                      onClick={() => setSelectedDay(day)}
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
                  {(selectedDay !== null ||
                    selectedType.length > 0 ||
                    selectedTag.length > 0 ||
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
                  {selectedDay === null ? "" : ` on ${displayDay(selectedDay)}`}
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
                <ol className="divide-y divide-line">
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
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Link
                            href={`/events/${eventId}/plan/${item._id}`}
                            className="inline-flex min-h-11 items-center rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-ink2 hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                          >
                            Open details
                          </Link>
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
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                            Archive
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
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
    </div>
  );
}
