"use client";

import {
  CalendarPlus,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { itineraryApi, recordsApi, type ItineraryItem } from "@/lib/events-api";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { PlanChangeDelivery } from "@/components/plan-change-delivery";

type EventRole = "owner" | "manager" | "crew";

type Draft = {
  title: string;
  scheduledFor: string;
  location: string;
  recordId: string;
  notes: string;
};

const emptyDraft: Draft = {
  title: "",
  scheduledFor: "",
  location: "",
  recordId: "",
  notes: "",
};

function displayScheduledFor(scheduledFor: string) {
  const [date, time] = scheduledFor.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));

  return `${dateLabel} · ${time}`;
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

function itemToDraft(item: ItineraryItem): Draft {
  return {
    title: item.title,
    scheduledFor: item.scheduledFor,
    location: item.location ?? "",
    recordId: item.recordId ?? "",
    notes: item.notes ?? "",
  };
}

function isSameDraft(left: Draft, right: Draft) {
  return (
    left.title === right.title &&
    left.scheduledFor === right.scheduledFor &&
    left.location === right.location &&
    left.recordId === right.recordId &&
    left.notes === right.notes
  );
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
  const records = useQuery(recordsApi.list, { eventId });
  const createItem = useMutation(itineraryApi.create);
  const updateItem = useMutation(itineraryApi.update);
  const archiveItem = useMutation(itineraryApi.archive);
  const restoreItem = useMutation(itineraryApi.restore);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [undoItem, setUndoItem] = useState<ItineraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const haystack = [item.title, item.location, item.notes]
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase();
      return matchesDay && (query.length === 0 || haystack.includes(query));
    });
  }, [items, search, selectedDay]);
  const initialDraft =
    editingItem === null ? emptyDraft : itemToDraft(editingItem);
  const hasUnsavedChanges = !isSameDraft(draft, initialDraft);

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function beginEditing(item: ItineraryItem) {
    setEditingItem(item);
    setDraft(itemToDraft(item));
    setError(null);
  }

  function cancelEditing() {
    setEditingItem(null);
    setDraft(emptyDraft);
    setError(null);
  }

  function clearFilters() {
    setSelectedDay(null);
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
      location: draft.location || undefined,
      recordId: draft.recordId || undefined,
      notes: draft.notes || undefined,
    };

    try {
      if (editingItem === null) {
        await createItem(input);
      } else {
        await updateItem({ ...input, itemId: editingItem._id });
      }
      cancelEditing();
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
      if (editingItem?._id === item._id) cancelEditing();
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

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Movement plan</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {eventName} · times are in {timeZone}
            </p>
          </div>
          <Badge variant={canEdit ? "success" : "neutral"}>
            {canEdit ? "Can edit" : "View only"}
          </Badge>
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
                      placeholder="Search description, place, or notes"
                    />
                  </div>
                  {(selectedDay !== null || search.length > 0) && (
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
                        {displayScheduledFor(item.scheduledFor)}
                      </time>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{item.title}</p>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => beginEditing(item)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
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
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {editingItem === null ? "Add movement" : "Edit movement"}
              </CardTitle>
              {hasUnsavedChanges ? (
                <p className="mt-1 text-sm text-warning-tx" role="status">
                  Draft changes are local to this form and have not been shared.
                </p>
              ) : null}
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
                  {editingItem === null ? "Add movement" : "Save movement"}
                </Button>
                {editingItem === null ? null : (
                  <Button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {items === undefined ? null : (
        <PlanChangeDelivery eventId={eventId} role={role} items={items} />
      )}
    </div>
  );
}
