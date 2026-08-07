"use client";

import {
  ArrowDown,
  ArrowUp,
  LayoutList,
  LoaderCircle,
  Pencil,
  Search,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  recordsApi,
  recordTypes,
  type EventRecord,
  type EventRole,
  type RecordField,
  type RecordType,
} from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type Draft = {
  name: string;
  type: (typeof recordTypes)[number];
  recordTypeId?: string;
  address: string;
  notes: string;
  fieldValues: Record<string, string>;
};

const emptyDraft: Draft = {
  name: "",
  type: "venue",
  recordTypeId: undefined,
  address: "",
  notes: "",
  fieldValues: {},
};

function recordToDraft(record: EventRecord): Draft {
  return {
    name: record.name,
    type: recordTypes.includes(record.type as (typeof recordTypes)[number])
      ? (record.type as (typeof recordTypes)[number])
      : "venue",
    recordTypeId: record.recordTypeId,
    address: record.address ?? "",
    notes: record.notes ?? "",
    fieldValues: record.fieldValues ?? {},
  };
}

function isSameDraft(left: Draft, right: Draft) {
  return (
    left.name === right.name &&
    left.type === right.type &&
    left.recordTypeId === right.recordTypeId &&
    left.address === right.address &&
    left.notes === right.notes &&
    JSON.stringify(left.fieldValues) === JSON.stringify(right.fieldValues)
  );
}

function labelForType(type: EventRecord["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function displayRecordType(
  record: EventRecord,
  configuredTypes: readonly RecordType[] | undefined,
) {
  return (
    configuredTypes?.find((type) => type._id === record.recordTypeId)?.name ??
    labelForType(record.type)
  );
}

function draftTypeValue(draft: Draft) {
  return draft.recordTypeId === undefined
    ? `builtin:${draft.type}`
    : `custom:${draft.recordTypeId}`;
}

export function RecordsDirectory({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const records = useQuery(recordsApi.list, { eventId });
  const configuredTypes = useQuery(recordsApi.listTypes, { eventId });
  const fields = useQuery(recordsApi.listFields, { eventId });
  const createRecord = useMutation(recordsApi.create);
  const updateRecord = useMutation(recordsApi.update);
  const createField = useMutation(recordsApi.createField);
  const updateField = useMutation(recordsApi.updateField);
  const reorderFields = useMutation(recordsApi.reorderFields);
  const canManage = role === "owner" || role === "manager";
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "table">("list");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "select">("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [editingField, setEditingField] = useState<RecordField | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isFieldConfigurationOpen, setIsFieldConfigurationOpen] =
    useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingRecord, setEditingRecord] = useState<EventRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (records ?? []).filter((record) => {
      const haystack = [record.name, record.type, record.address, record.notes]
        .concat(Object.values(record.fieldValues ?? {}))
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase();
      const matchesSearch = query.length === 0 || haystack.includes(query);
      const matchesField =
        filterField.length === 0 ||
        filterValue.length === 0 ||
        (record.fieldValues?.[filterField] ?? "")
          .toLocaleLowerCase()
          .includes(filterValue.toLocaleLowerCase());
      return matchesSearch && matchesField;
    });
  }, [filterField, filterValue, records, search]);
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
      fieldValues: draft.fieldValues,
    };

    try {
      if (editingRecord === null)
        await createRecord({ ...input, recordTypeId: draft.recordTypeId });
      else
        await updateRecord({
          ...input,
          recordId: editingRecord._id,
          // The form always represents the operator's full intent, so an empty
          // selection is an explicit clear rather than "leave unchanged".
          recordTypeId: draft.recordTypeId ?? null,
        });
      cancelEditing();
    } catch {
      setError("We could not save this record. Your changes were not saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    const options = newFieldOptions
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    try {
      await createField({
        eventId,
        label: newFieldLabel,
        type: newFieldType,
        ...(newFieldType === "select" ? { options } : {}),
      });
      setNewFieldLabel("");
      setNewFieldOptions("");
      setNewFieldType("text");
    } catch {
      setFieldError(
        "We could not add this field. Check its name and options, then try again.",
      );
    }
  }

  async function moveField(field: RecordField, direction: -1 | 1) {
    if (fields === undefined) return;
    const index = fields.findIndex((candidate) => candidate._id === field._id);
    const next = index + direction;
    if (next < 0 || next >= fields.length) return;
    const order = fields.map((candidate) => candidate._id);
    [order[index], order[next]] = [order[next], order[index]];
    try {
      await reorderFields({ eventId, fieldIds: order });
    } catch {
      setFieldError(
        "We could not reorder fields. Their current order was kept.",
      );
    }
  }

  async function saveField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingField === null) return;
    setFieldError(null);
    try {
      await updateField({
        eventId,
        fieldId: editingField._id,
        label: editingField.label,
        ...(editingField.type === "select"
          ? { options: editingField.options ?? [] }
          : {}),
      });
      setEditingField(null);
    } catch {
      setFieldError(
        "We could not update this field. Your saved configuration was not changed.",
      );
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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex min-h-11 items-center rounded-lg border border-btnline bg-card px-3 text-sm font-semibold text-green-ink hover:border-green focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                href={`/events/${eventId}/records/travel`}
              >
                Travel reference
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-green-ink underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                href={`/events/${eventId}/records/types`}
              >
                Configure records
              </Link>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsFieldConfigurationOpen((open) => !open)}
                >
                  {isFieldConfigurationOpen
                    ? "Close field settings"
                    : "Configure fields"}
                </Button>
              ) : null}
              <Badge variant={canManage ? "success" : "neutral"}>
                {canManage ? "Can manage" : "View only"}
              </Badge>
            </div>
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
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1">
                  <label
                    className="text-xs font-medium text-muted"
                    htmlFor="record-field-filter"
                  >
                    Filter by field
                  </label>
                  <select
                    id="record-field-filter"
                    value={filterField}
                    onChange={(event) => {
                      setFilterField(event.target.value);
                      setFilterValue("");
                    }}
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm text-ink"
                  >
                    <option value="">All fields</option>
                    {(fields ?? []).map((field) => (
                      <option key={field._id} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
                {filterField.length === 0 ? null : (
                  <div className="grid gap-1">
                    <label
                      className="text-xs font-medium text-muted"
                      htmlFor="record-filter-value"
                    >
                      Contains
                    </label>
                    <Input
                      id="record-filter-value"
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Filter value"
                    />
                  </div>
                )}
                <div
                  className="ml-auto flex gap-1"
                  role="group"
                  aria-label="Directory view"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "list" ? "primary" : "ghost"}
                    onClick={() => setView("list")}
                  >
                    <LayoutList className="h-4 w-4" aria-hidden="true" /> List
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "table" ? "primary" : "ghost"}
                    onClick={() => setView("table")}
                  >
                    <Table2 className="h-4 w-4" aria-hidden="true" /> Table
                  </Button>
                </div>
                {filterField.length === 0 && search.length === 0 ? null : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilterField("");
                      setFilterValue("");
                    }}
                  >
                    Reset filters
                  </Button>
                )}
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
              ) : view === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line text-xs text-muted">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Type</th>
                        {(fields ?? []).map((field) => (
                          <th className="p-2" key={field._id}>
                            {field.label}
                          </th>
                        ))}
                        <th className="p-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.map((record) => (
                        <tr key={record._id} className="border-b border-line">
                          <td className="p-2">
                            <Link
                              className="font-semibold text-ink underline-offset-4 hover:underline"
                              href={`/events/${eventId}/records/${record._id}`}
                            >
                              {record.name}
                            </Link>
                          </td>
                          <td className="p-2">
                            {displayRecordType(record, configuredTypes)}
                          </td>
                          {(fields ?? []).map((field) => (
                            <td className="p-2" key={field._id}>
                              {record.fieldValues?.[field.key] ?? "—"}
                            </td>
                          ))}
                          <td className="p-2">
                            {canManage ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit ${record.name}`}
                                onClick={() => beginEditing(record)}
                              >
                                <Pencil
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Edit
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ol className="divide-y divide-line">
                  {visibleRecords.map((record) => (
                    <li
                      key={record._id}
                      className="flex gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="font-semibold text-ink underline-offset-4 hover:underline"
                            href={`/events/${eventId}/records/${record._id}`}
                          >
                            {record.name}
                          </Link>
                          <Badge variant="neutral">
                            {displayRecordType(record, configuredTypes)}
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
                        {(fields ?? [])
                          .filter((field) => record.fieldValues?.[field.key])
                          .map((field) => (
                            <p
                              className="mt-1 text-sm text-muted"
                              key={field._id}
                            >
                              <span className="font-medium text-ink">
                                {field.label}:
                              </span>{" "}
                              {record.fieldValues?.[field.key]}
                            </p>
                          ))}
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

      {canManage && isFieldConfigurationOpen ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Directory fields</CardTitle>
              <p className="mt-1 text-sm text-muted">
                These fields belong to every record in this event. Renaming a
                field keeps its existing values.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {fieldError === null ? null : (
              <Banner
                variant="danger"
                label="Field configuration failed"
                role="alert"
              >
                {fieldError}
              </Banner>
            )}
            <ol className="grid gap-2">
              {(fields ?? []).map((field, index) => (
                <li
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3"
                  key={field._id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{field.label}</p>
                    <p className="text-xs text-muted">
                      {field.type === "select"
                        ? `Select: ${(field.options ?? []).join(", ")}`
                        : "Text"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    aria-label={`Move ${field.label} up`}
                    onClick={() => moveField(field, -1)}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === (fields ?? []).length - 1}
                    aria-label={`Move ${field.label} down`}
                    onClick={() => moveField(field, 1)}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEditingField(field)}
                  >
                    Rename
                  </Button>
                </li>
              ))}
            </ol>
            <form
              className="grid gap-3 rounded-lg border border-line p-3"
              onSubmit={submitField}
            >
              <p className="font-medium text-ink">Add field</p>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="new-record-field"
                >
                  Field name
                </label>
                <Input
                  id="new-record-field"
                  value={newFieldLabel}
                  onChange={(event) => setNewFieldLabel(event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="new-record-field-type"
                >
                  Field type
                </label>
                <select
                  id="new-record-field-type"
                  value={newFieldType}
                  onChange={(event) =>
                    setNewFieldType(event.target.value as "text" | "select")
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
                >
                  <option value="text">Text</option>
                  <option value="select">Select</option>
                </select>
              </div>
              {newFieldType !== "select" ? null : (
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="new-record-field-options"
                  >
                    Options
                  </label>
                  <Input
                    id="new-record-field-options"
                    value={newFieldOptions}
                    onChange={(event) => setNewFieldOptions(event.target.value)}
                    placeholder="Comma-separated options"
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-fit">
                Add field
              </Button>
            </form>
            {editingField === null ? null : (
              <form
                className="grid gap-3 rounded-lg border border-line p-3"
                onSubmit={saveField}
              >
                <p className="font-medium text-ink">Edit field</p>
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="edit-record-field"
                  >
                    Field name
                  </label>
                  <Input
                    id="edit-record-field"
                    value={editingField.label}
                    onChange={(event) =>
                      setEditingField((field) =>
                        field === null
                          ? null
                          : { ...field, label: event.target.value },
                      )
                    }
                    maxLength={80}
                    required
                  />
                </div>
                {editingField.type === "select" ? (
                  <div className="grid gap-1.5">
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="edit-record-field-options"
                    >
                      Options
                    </label>
                    <Input
                      id="edit-record-field-options"
                      value={(editingField.options ?? []).join(", ")}
                      onChange={(event) =>
                        setEditingField((field) =>
                          field === null
                            ? null
                            : {
                                ...field,
                                options: event.target.value
                                  .split(",")
                                  .map((option) => option.trim())
                                  .filter(Boolean),
                              },
                        )
                      }
                      required
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit">Save field</Button>
                  <Button type="button" onClick={() => setEditingField(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

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
                  value={draftTypeValue(draft)}
                  onChange={(event) => {
                    const [kind, value] = event.target.value.split(":", 2);
                    setDraft((current) =>
                      kind === "custom"
                        ? { ...current, type: "venue", recordTypeId: value }
                        : {
                            ...current,
                            type: value as (typeof recordTypes)[number],
                            recordTypeId: undefined,
                          },
                    );
                  }}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                >
                  <optgroup label="Built-in types">
                    {recordTypes.map((type) => (
                      <option key={type} value={`builtin:${type}`}>
                        {labelForType(type)}
                      </option>
                    ))}
                  </optgroup>
                  {configuredTypes === undefined ? null : (
                    <optgroup label="Event types">
                      {configuredTypes
                        .filter((type) => type.archivedAt === undefined)
                        .map((type) => (
                          <option key={type._id} value={`custom:${type._id}`}>
                            {type.name}
                            {type.isLocation ? " · location" : ""}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
              {(fields ?? []).map((field) => (
                <div className="grid gap-1.5" key={field._id}>
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor={`record-field-${field.key}`}
                  >
                    {field.label} <span className="text-muted">(optional)</span>
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={`record-field-${field.key}`}
                      value={draft.fieldValues[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fieldValues: {
                            ...current.fieldValues,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                      className="min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                    >
                      <option value="">No selection</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`record-field-${field.key}`}
                      value={draft.fieldValues[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fieldValues: {
                            ...current.fieldValues,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                      maxLength={500}
                    />
                  )}
                </div>
              ))}
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
