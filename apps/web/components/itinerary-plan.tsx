"use client";

import { CalendarPlus, LoaderCircle, Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { itineraryApi, type ItineraryItem } from "@/lib/events-api";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type EventRole = "owner" | "manager" | "crew";

type Draft = {
  title: string;
  scheduledFor: string;
  location: string;
  notes: string;
};

const emptyDraft: Draft = {
  title: "",
  scheduledFor: "",
  location: "",
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

function itemToDraft(item: ItineraryItem): Draft {
  return {
    title: item.title,
    scheduledFor: item.scheduledFor,
    location: item.location ?? "",
    notes: item.notes ?? "",
  };
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
  const createItem = useMutation(itineraryApi.create);
  const updateItem = useMutation(itineraryApi.update);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const input = {
      eventId,
      title: draft.title,
      scheduledFor: draft.scheduledFor,
      location: draft.location || undefined,
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
        <CardContent>
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
            <ol className="divide-y divide-line">
              {items.map((item) => (
                <li
                  key={item._id}
                  className="flex gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <time className="w-32 shrink-0 font-mono text-xs text-green-ink">
                    {displayScheduledFor(item.scheduledFor)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{item.title}</p>
                    {item.location === undefined ? null : (
                      <p className="mt-1 text-sm text-muted">{item.location}</p>
                    )}
                    {item.notes === undefined ? null : (
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  {canEdit ? (
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
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingItem === null ? "Add movement" : "Edit movement"}
            </CardTitle>
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
              {error === null ? null : (
                <p
                  className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
                  role="alert"
                >
                  {error}
                </p>
              )}
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
    </div>
  );
}
