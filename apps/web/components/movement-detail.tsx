"use client";

import { Archive, ChevronLeft, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  itineraryApi,
  planChangesApi,
  recordsApi,
  type EventRole,
  type ItineraryItem,
} from "@/lib/events-api";
import { locationRecords } from "@/lib/record-locations";

type Draft = {
  title: string;
  scheduledFor: string;
  location: string;
  recordId: string;
  notes: string;
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
    location: item.location ?? "",
    recordId: item.recordId ?? "",
    notes: item.notes ?? "",
    timeKind: item.timeKind ?? "exact",
  };
}

function changeSummary(change: { recipients: Array<{ state: string }> }) {
  const recipients = change.recipients;
  const acknowledged = recipients.filter((item) =>
    ["acknowledged", "acknowledgedElsewhere"].includes(item.state),
  ).length;
  return { acknowledged, unreached: recipients.length - acknowledged };
}

export function MovementDetail({
  eventId,
  itemId,
  role,
}: {
  eventId: string;
  itemId: string;
  role: EventRole;
}) {
  const router = useRouter();
  const item = useQuery(itineraryApi.get, { eventId, itemId });
  const records = useQuery(recordsApi.list, { eventId });
  const recordTypes = useQuery(recordsApi.listTypes, { eventId });
  const changes = useQuery(planChangesApi.listForMovement, { eventId, itemId });
  const update = useMutation(itineraryApi.update);
  const archive = useMutation(itineraryApi.archive);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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
    recordTypes === undefined ||
    changes === undefined
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
    try {
      await update({
        eventId,
        itemId,
        title: currentDraft.title,
        scheduledFor: currentDraft.scheduledFor,
        location: currentDraft.location || undefined,
        recordId: currentDraft.recordId || undefined,
        notes: currentDraft.notes || undefined,
        timeKind: currentDraft.timeKind,
      });
      setDraft(null);
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
          {canEdit && currentDraft !== null ? (
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
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}{" "}
                  Save movement
                </Button>
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
                  {item.scheduledFor || "Not specified"} ·{" "}
                  {timeKindLabels[item.timeKind ?? "exact"]}
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
      <Card>
        <CardHeader>
          <CardTitle>Published delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {changes.length === 0 ? (
            <p className="text-sm text-muted">
              No change to this movement has been published yet.
            </p>
          ) : (
            changes.map((change) => {
              const { acknowledged, unreached } = changeSummary(change);
              return (
                <div
                  key={change._id}
                  className="border-b border-line pb-4 last:border-0 last:pb-0"
                >
                  <p className="font-semibold text-ink">{change.reason}</p>
                  <p className="mt-1 text-xs text-muted">
                    {change.severity === "critical" ? "Critical" : "Routine"} ·
                    published {new Date(change.publishedAt).toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    <strong className="text-ink">{acknowledged}</strong>{" "}
                    acknowledged ·{" "}
                    <strong className="text-ink">{unreached}</strong> awaiting
                    acknowledgement
                  </p>
                </div>
              );
            })
          )}
          <Link
            href={`/events/${eventId}/plan/publish`}
            className="text-sm font-semibold text-green-ink underline underline-offset-4"
          >
            Publish a change
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
