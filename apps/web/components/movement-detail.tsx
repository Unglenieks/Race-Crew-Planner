"use client";

import { Archive, ChevronLeft, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanChangeDelivery } from "@/components/plan-change-delivery";
import {
  itineraryApi,
  recordsApi,
  type EventRole,
  type ItineraryItem,
} from "@/lib/events-api";
import { locationRecords } from "@/lib/record-locations";
import { formatEventDateTime } from "@/lib/time-zones";

type Draft = {
  title: string;
  scheduledFor: string;
  scheduledUntil: string;
  location: string;
  recordId: string;
  notes: string;
  movementType: string;
  tags: string;
  sectionId: string;
  timeKind: NonNullable<ItineraryItem["timeKind"]>;
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
    scheduledFor: item.scheduledFor,
    scheduledUntil: item.scheduledUntil ?? "",
    location: item.location ?? "",
    recordId: item.recordId ?? "",
    notes: item.notes ?? "",
    movementType: item.movementType ?? "",
    tags: (item.tags ?? []).join(", "),
    sectionId: item.sectionId ?? "",
    timeKind: item.timeKind ?? "exact",
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
  const update = useMutation(itineraryApi.update);
  const archive = useMutation(itineraryApi.archive);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [openPublisher, setOpenPublisher] = useState(false);
  const canEdit = role === "owner" || role === "manager";
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
    recordTypes === undefined
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

  function updateDraft(field: keyof Draft, value: string) {
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
    const publishAfterSave =
      ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
        ?.value === "publish";
    try {
      await update({
        eventId,
        itemId,
        title: currentDraft.title,
        scheduledFor: currentDraft.scheduledFor,
        scheduledUntil:
          currentDraft.timeKind === "range"
            ? currentDraft.scheduledUntil
            : undefined,
        location: currentDraft.location || undefined,
        recordId: currentDraft.recordId || undefined,
        notes: currentDraft.notes || undefined,
        movementType: currentDraft.movementType || undefined,
        tags: currentDraft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        sectionId: currentDraft.sectionId || undefined,
        timeKind: currentDraft.timeKind,
      });
      setDraft(null);
      setOpenPublisher(publishAfterSave);
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
    <section
      aria-labelledby="movement-detail-heading"
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
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
              <p className="mt-1 text-sm text-muted">
                Changes are private until an authorized operator publishes them.
              </p>
            </div>
            <Badge variant={canEdit ? "success" : "neutral"}>
              {canEdit ? "Can edit" : "View only"}
            </Badge>
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
                  value={currentDraft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  maxLength={160}
                  required
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Time
                  <input
                    type="datetime-local"
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
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Linked location
                  <select
                    value={currentDraft.recordId}
                    onChange={(event) =>
                      updateDraft("recordId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                  >
                    <option value="">No linked location</option>
                    {locationRecordOptions.map((record) => (
                      <option key={record._id} value={record._id}>
                        {record.name} · {record.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Place{" "}
                  <span className="font-normal text-muted">(optional)</span>
                  <input
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
                <Button
                  type="submit"
                  name="intent"
                  value="publish"
                  variant="secondary"
                  disabled={isSaving}
                >
                  Save & publish change
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
                  onClick={() => void archiveMovement()}
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
                <dd className="mt-1 text-muted">
                  {item.scheduledFor
                    ? formatEventDateTime(item.scheduledFor, timeZone)
                    : "Not specified"}{" "}
                  · {timeKindLabels[item.timeKind ?? "exact"]}
                  {item.timeKind === "range"
                    ? ` → ${
                        item.scheduledUntil === undefined
                          ? "End time not recorded (legacy range)"
                          : formatEventDateTime(item.scheduledUntil, timeZone)
                      }`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Place</dt>
                <dd className="mt-1 text-muted">
                  {item.location ?? "No place entered"}
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
        </CardContent>
      </Card>
      {canEdit && !isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage movement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted">
              Review the current instruction before changing it. Publish only
              after a saved change needs crew acknowledgement.
            </p>
            <Link
              href={`/events/${eventId}/plan/${itemId}?edit=1`}
              className="w-fit text-sm font-semibold text-green-ink underline underline-offset-4"
            >
              Edit movement
            </Link>
          </CardContent>
        </Card>
      ) : null}
      {isEditing ? null : (
        <PlanChangeDelivery
          eventId={eventId}
          role={role}
          items={[item]}
          movementId={itemId}
          openComposer={openPublisher}
        />
      )}
    </section>
  );
}
