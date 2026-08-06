"use client";

import { LoaderCircle, Pencil, Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  recordsApi,
  recordTypes,
  type EventRecord,
  type EventRole,
} from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type Draft = {
  name: string;
  type: EventRecord["type"];
  address: string;
  notes: string;
};

const emptyDraft: Draft = {
  name: "",
  type: "venue",
  address: "",
  notes: "",
};

function recordToDraft(record: EventRecord): Draft {
  return {
    name: record.name,
    type: record.type,
    address: record.address ?? "",
    notes: record.notes ?? "",
  };
}

function isSameDraft(left: Draft, right: Draft) {
  return (
    left.name === right.name &&
    left.type === right.type &&
    left.address === right.address &&
    left.notes === right.notes
  );
}

function labelForType(type: EventRecord["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function RecordsDirectory({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const records = useQuery(recordsApi.list, { eventId });
  const createRecord = useMutation(recordsApi.create);
  const updateRecord = useMutation(recordsApi.update);
  const canManage = role === "owner" || role === "manager";
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingRecord, setEditingRecord] = useState<EventRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (records ?? []).filter((record) => {
      const haystack = [record.name, record.type, record.address, record.notes]
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase();
      return query.length === 0 || haystack.includes(query);
    });
  }, [records, search]);
  const initialDraft =
    editingRecord === null ? emptyDraft : recordToDraft(editingRecord);
  const hasUnsavedChanges = !isSameDraft(draft, initialDraft);

  function cancelEditing() {
    setEditingRecord(null);
    setDraft(emptyDraft);
    setError(null);
  }

  function beginEditing(record: EventRecord) {
    setEditingRecord(record);
    setDraft(recordToDraft(record));
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const input = {
      eventId,
      name: draft.name,
      type: draft.type,
      address: draft.address || undefined,
      notes: draft.notes || undefined,
    };

    try {
      if (editingRecord === null) await createRecord(input);
      else await updateRecord({ ...input, recordId: editingRecord._id });
      cancelEditing();
    } catch {
      setError("We could not save this record. Your changes were not saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Directory</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Shared operational places, services, equipment, and people.
              </p>
            </div>
            <Badge variant={canManage ? "success" : "neutral"}>
              {canManage ? "Can manage" : "View only"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error === null ? null : (
            <Banner variant="danger" label="Record update failed" role="alert">
              {error}
            </Banner>
          )}
          {records === undefined ? (
            <div
              className="flex min-h-32 items-center text-sm text-muted"
              role="status"
            >
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading records…
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              title="No records yet"
              description="Start with a venue, service, vehicle, or person. You can add more context later."
            />
          ) : (
            <>
              <div className="relative">
                <label className="sr-only" htmlFor="record-search">
                  Search records
                </label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  id="record-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search names, types, addresses, or notes"
                />
              </div>
              <p className="text-xs text-muted" aria-live="polite">
                Showing {visibleRecords.length} of {records.length} record
                {records.length === 1 ? "" : "s"}.
              </p>
              {visibleRecords.length === 0 ? (
                <EmptyState
                  title="No records match your search"
                  description="Try another name, type, address, or note."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSearch("")}
                    >
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <ol className="divide-y divide-line">
                  {visibleRecords.map((record) => (
                    <li
                      key={record._id}
                      className="flex gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">
                            {record.name}
                          </p>
                          <Badge variant="neutral">
                            {labelForType(record.type)}
                          </Badge>
                        </div>
                        {record.address === undefined ? null : (
                          <p className="mt-1 text-sm text-muted">
                            {record.address}
                          </p>
                        )}
                        {record.notes === undefined ? null : (
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {record.notes}
                          </p>
                        )}
                      </div>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${record.name}`}
                          onClick={() => beginEditing(record)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {editingRecord === null ? "Add record" : "Edit record"}
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
                  htmlFor="record-name"
                >
                  Name
                </label>
                <Input
                  id="record-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  maxLength={160}
                  required
                  placeholder="e.g. Service Park entrance"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="record-type"
                >
                  Type
                </label>
                <select
                  id="record-type"
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      type: event.target.value as EventRecord["type"],
                    }))
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                >
                  {recordTypes.map((type) => (
                    <option key={type} value={type}>
                      {labelForType(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="record-address"
                >
                  Address or access detail{" "}
                  <span className="text-muted">(optional)</span>
                </label>
                <Input
                  id="record-address"
                  value={draft.address}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  maxLength={300}
                  placeholder="e.g. North gate, off County Road 12"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="record-notes"
                >
                  Notes <span className="text-muted">(optional)</span>
                </label>
                <textarea
                  id="record-notes"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  className="min-h-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-muted focus:border-ink focus:ring-2 focus:ring-ink"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : null}
                  {editingRecord === null ? "Add record" : "Save record"}
                </Button>
                {editingRecord === null ? null : (
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
