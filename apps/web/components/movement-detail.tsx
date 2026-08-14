"use client";

import { Archive, ChevronLeft, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDestructiveAction } from "@/components/ui/confirm-destructive-action";
import {
  itineraryApi,
  movementsApi,
  recordsApi,
  type EventRole,
  type ItineraryItem,
} from "@/lib/events-api";
import { locationRecords } from "@/lib/record-locations";
import { displayMovementTime, movementTimeLabel } from "@/lib/timing";
import { VenueLinkCombobox } from "@/components/venue-link-combobox";

type Draft = {
  title: string;
  scheduledFor: string;
  scheduledUntil: string;
  location: string;
  recordId: string;
  notes: string;
  timeKind: NonNullable<ItineraryItem["timeKind"]>;
  movementTypeId: string;
  spectatorVisible: boolean;
};

const timeKindLabels: Record<Draft["timeKind"], string> = {
  exact: "Exact",
  approximate: "Approximate",
  range: "Range",
  allDay: "All day",
  unspecified: "Intentionally unspecified",
};

function toDraft(item: ItineraryItem): Draft {
  return {
    title: item.title,
    scheduledFor:
      item.timeKind === "allDay"
        ? item.scheduledFor.slice(0, 10)
        : item.scheduledFor,
    scheduledUntil: item.scheduledUntil ?? "",
    location: item.location ?? "",
    recordId: item.recordId ?? "",
    notes: item.notes ?? "",
    timeKind: item.timeKind ?? "exact",
    movementTypeId: item.movementTypeId ?? "",
    spectatorVisible: item.spectatorVisible === true,
  };
}

export function MovementDetail({
  eventId,
  itemId,
  role,
  timeZone,
}: {
  eventId: string;
  itemId: string;
  role: EventRole;
  timeZone: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("edit") === "1";
  const item = useQuery(itineraryApi.get, { eventId, itemId });
  const records = useQuery(recordsApi.list, { eventId });
  const recordTypes = useQuery(recordsApi.listTypes, { eventId });
  const directory = useQuery(movementsApi.listDirectory, { eventId });
  const update = useMutation(itineraryApi.update);
  const archive = useMutation(itineraryApi.archive);
  const ensureDefaults = useMutation(movementsApi.ensureDefaults);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveConfirmationOpen, setIsArchiveConfirmationOpen] =
    useState(false);
  const canEdit = role === "owner" || role === "manager";
  useEffect(() => {
    if (!canEdit) return;
    void ensureDefaults({ eventId }).catch(() => undefined);
  }, [canEdit, ensureDefaults, eventId]);
  const currentDraft = draft ?? (item === undefined ? null : toDraft(item));
  // Uses the shared rule so a team's own location types appear here exactly as
  // they do on the records screens and exactly as the server accepts them.
  const locationRecordOptions = useMemo(
    () => locationRecords(records ?? [], recordTypes ?? []),
    [records, recordTypes],
  );

  if (
    item === undefined ||
    records === undefined ||
    recordTypes === undefined ||
    directory === undefined
  ) {
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading movement details…
      </p>
    );
  }

  if (item.archivedAt !== undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This movement is archived</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted">
            It is no longer part of the active plan.
          </p>
          <Link
            href={`/events/${eventId}/plan`}
            className="w-fit text-sm font-semibold text-green-ink underline underline-offset-4"
          >
            Back to movement plan
          </Link>
        </CardContent>
      </Card>
    );
  }

  function updateDraft(field: keyof Draft, value: Draft[keyof Draft]) {
    setDraft(
      (current) =>
        ({ ...(current ?? toDraft(item!)), [field]: value }) as Draft,
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentDraft === null) return;
    setError(null);
    setIsSaving(true);
    try {
      const scheduledFor =
        currentDraft.timeKind === "allDay"
          ? `${currentDraft.scheduledFor}T00:00`
          : currentDraft.scheduledFor;
      await update({
        eventId,
        itemId,
        title: currentDraft.title,
        scheduledFor,
        scheduledUntil:
          currentDraft.timeKind === "range"
            ? currentDraft.scheduledUntil
            : undefined,
        location: currentDraft.location || undefined,
        recordId: currentDraft.recordId || undefined,
        notes: currentDraft.notes || undefined,
        movementTypeId: currentDraft.movementTypeId || null,
        timeKind: currentDraft.timeKind,
        spectatorVisible: currentDraft.spectatorVisible,
      });
      setDraft(null);
      router.replace(`/events/${eventId}/plan/${itemId}`);
    } catch {
      setError("We could not save this movement. Your changes were not saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveMovement() {
    setError(null);
    setIsArchiving(true);
    try {
      await archive({ eventId, itemId });
      router.push(`/events/${eventId}/plan`);
    } catch {
      setError("We could not archive this movement. It is still in the plan.");
      setIsArchiving(false);
    }
  }

  return (
    <section aria-labelledby="movement-detail-heading" className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href={`/events/${eventId}/plan`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-green-ink underline-offset-4 hover:underline"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Movement
                plan
              </Link>
              <h1
                id="movement-detail-heading"
                className="mt-3 font-serif text-[clamp(24px,3vw,32px)] font-semibold leading-tight tracking-tight text-ink"
              >
                {item.title}
              </h1>
              <p className="mt-1 text-xs text-muted">Event time: {timeZone}</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && !isEditing ? (
                <Link
                  href={`/events/${eventId}/plan/${itemId}?edit=1`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  Edit
                </Link>
              ) : null}
              <Badge variant={canEdit ? "success" : "neutral"}>
                {canEdit ? "Can edit" : "View only"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error === null ? null : (
            <Banner
              variant="danger"
              label="Movement update failed"
              role="alert"
            >
              {error}
            </Banner>
          )}
          {canEdit && isEditing && currentDraft !== null ? (
            <form className="mt-4 grid gap-4" onSubmit={save}>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Description
                <input
                  name="movementDescription"
                  value={currentDraft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  maxLength={160}
                  required
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                />
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="spectatorVisible"
                  checked={currentDraft.spectatorVisible}
                  onChange={(event) =>
                    updateDraft("spectatorVisible", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-[var(--color-green)]"
                />
                <span>
                  <span className="block font-semibold">
                    Show on spectator schedule
                  </span>
                  <span className="mt-1 block text-muted">
                    Publish this event to spectators.
                  </span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  {currentDraft.timeKind === "allDay" ? "Date" : "Time"}
                  <input
                    type={
                      currentDraft.timeKind === "allDay"
                        ? "date"
                        : "datetime-local"
                    }
                    name="movementTime"
                    value={currentDraft.scheduledFor}
                    onChange={(event) =>
                      updateDraft("scheduledFor", event.target.value)
                    }
                    required={currentDraft.timeKind !== "unspecified"}
                    disabled={currentDraft.timeKind === "unspecified"}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Time confidence
                  <select
                    name="movementTimeKind"
                    value={currentDraft.timeKind}
                    onChange={(event) =>
                      updateDraft("timeKind", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                  >
                    {Object.entries(timeKindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {currentDraft.timeKind === "range" ? (
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  End time
                  <input
                    type="datetime-local"
                    value={currentDraft.scheduledUntil}
                    min={currentDraft.scheduledFor || undefined}
                    onChange={(event) =>
                      updateDraft("scheduledUntil", event.target.value)
                    }
                    required
                    className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                  />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Movement type
                <select
                  name="movementType"
                  value={currentDraft.movementTypeId}
                  onChange={(event) =>
                    updateDraft("movementTypeId", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                >
                  <option value="">Unclassified</option>
                  {directory.types
                    .filter((type) => type.archivedAt === undefined)
                    .map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5 text-sm font-medium text-ink">
                  <span>Linked venue</span>
                  <VenueLinkCombobox
                    records={locationRecordOptions}
                    selectedId={currentDraft.recordId}
                    onSelect={(record) => {
                      updateDraft("recordId", record?._id ?? "");
                      if (record !== null) updateDraft("location", record.name);
                    }}
                  />
                </div>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Location label{" "}
                  <span className="font-normal text-muted">
                    (saved snapshot or override)
                  </span>
                  <input
                    name="movementLocation"
                    value={currentDraft.location}
                    onChange={(event) =>
                      updateDraft("location", event.target.value)
                    }
                    maxLength={160}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Notes <span className="font-normal text-muted">(optional)</span>
                <textarea
                  name="movementNotes"
                  value={currentDraft.notes}
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  maxLength={1000}
                  className="min-h-28 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  name="intent"
                  value="save"
                  variant="primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}{" "}
                  Save movement
                </Button>
                <Link
                  href={`/events/${eventId}/plan/${itemId}`}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-soft hover:text-ink focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  Cancel
                </Link>
                <Button
                  type="button"
                  variant="danger"
                  disabled={isArchiving}
                  onClick={() => setIsArchiveConfirmationOpen(true)}
                >
                  {isArchiving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}{" "}
                  Archive
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-4 grid gap-4 text-sm">
              <div>
                <dt className="font-semibold text-ink">Time</dt>
                <dd
                  className="mt-1 text-muted"
                  aria-label={movementTimeLabel(item)}
                >
                  {item.scheduledFor
                    ? displayMovementTime(item)
                    : "Not specified"}{" "}
                  · {timeKindLabels[item.timeKind ?? "exact"]}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Place</dt>
                <dd className="mt-1 text-muted">
                  {item.location ?? "No place entered"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Movement type</dt>
                <dd className="mt-1 text-muted">
                  {item.movementTypeLabel ?? "Unclassified"}
                  {item.tags === undefined || item.tags.length === 0
                    ? ""
                    : ` · ${item.tags.map((tag) => tag.name).join(", ")}`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Assignments</dt>
                <dd className="mt-1 text-muted">
                  {item.assignments === undefined ||
                  item.assignments.length === 0
                    ? "No operational assignments"
                    : item.assignments
                        .map((assignment) => assignment.label)
                        .join(", ")}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted">
                  {item.notes ?? "No notes"}
                </dd>
              </div>
            </dl>
          )}
          {isArchiveConfirmationOpen ? (
            <ConfirmDestructiveAction
              title="Archive movement?"
              description={`Archive ${item.title}. It will be removed from the active plan and can be restored from the archived movements list.`}
              confirmLabel="Archive movement"
              isPending={isArchiving}
              onCancel={() => setIsArchiveConfirmationOpen(false)}
              onConfirm={() => void archiveMovement()}
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
