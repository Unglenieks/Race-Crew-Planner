"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { isLocationRecord } from "@/lib/record-locations";
import { recordsApi } from "@/lib/events-api";

const canManage = (role: string) => role === "owner" || role === "manager";
const field = "grid gap-1.5";
const control =
  "min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink";

function displayFieldValue(value: string | undefined) {
  if (value === undefined || value.trim() === "")
    return { kind: "empty" as const, label: "Not recorded" };
  if (value === "true" || value === "false")
    return { kind: "text" as const, label: value === "true" ? "Yes" : "No" };
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:")
      return { kind: "link" as const, label: value };
  } catch {
    // Non-URL values are displayed as saved text.
  }
  return { kind: "text" as const, label: value };
}

export function RecordDetail({ recordId }: { recordId: string }) {
  const { event, role } = useEventWorkspace();
  const record = useQuery(recordsApi.get, { eventId: event.id, recordId });
  const categories = useQuery(recordsApi.listCategories, { eventId: event.id });
  const types = useQuery(recordsApi.listTypes, { eventId: event.id });
  const saveDetails = useMutation(recordsApi.saveVenueDetails);
  const assign = useMutation(recordsApi.assignCategory);
  const remove = useMutation(recordsApi.removeCategory);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (record === undefined || categories === undefined || types === undefined)
    return <p className="text-sm text-muted">Loading record…</p>;
  const location = isLocationRecord(record, types);
  async function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const form = new FormData(eventForm.currentTarget);
    try {
      await saveDetails({
        eventId: event.id,
        recordId,
        address: String(form.get("address") || "") || undefined,
        accessNotes: String(form.get("accessNotes") || "") || undefined,
        hours: String(form.get("hours") || "") || undefined,
        contactDetail: String(form.get("contact") || "") || undefined,
        spectatorVisible: form.get("spectatorVisible") === "on",
        confirmationStatus: String(form.get("status")) as
          "confirmed" | "unconfirmed",
        confirmationSource: String(form.get("source") || "") || undefined,
      });
      setMessage("Venue details saved.");
    } catch {
      setError("We could not save venue details. Your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section aria-labelledby="record-heading" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/events/${event.id}/records`}
            className="text-sm font-semibold text-green-ink underline underline-offset-4"
          >
            Records & venues
          </Link>
          <h1
            id="record-heading"
            className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink"
          >
            {record.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{record.type}</p>
        </div>
      </div>
      {error === null ? null : (
        <Banner variant="danger" label="Venue details" role="alert">
          {error}
        </Banner>
      )}
      {message === null ? null : (
        <Banner variant="success" label="Venue details" role="status">
          {message}
        </Banner>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Record details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold text-ink">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-muted">
                {record.notes?.trim() || "Not recorded"}
              </dd>
            </div>
            {[
              ...record.fields.map((fieldDefinition) => ({
                key: fieldDefinition.key,
                label: fieldDefinition.label,
              })),
              ...Object.keys(record.fieldValues ?? {})
                .filter(
                  (key) =>
                    !record.fields.some(
                      (fieldDefinition) => fieldDefinition.key === key,
                    ),
                )
                .map((key) => ({
                  key,
                  label: key.replaceAll("-", " ").replaceAll("_", " "),
                })),
            ].map((fieldDefinition) => {
              const value = displayFieldValue(
                record.fieldValues?.[fieldDefinition.key],
              );
              return (
                <div key={fieldDefinition.key}>
                  <dt className="font-semibold capitalize text-ink">
                    {fieldDefinition.label}
                  </dt>
                  <dd
                    className={`mt-1 whitespace-pre-wrap ${value.kind === "empty" ? "text-muted" : "text-ink"}`}
                  >
                    {value.kind === "link" ? (
                      <a
                        className="break-all text-green-ink underline"
                        href={value.label}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {value.label}
                      </a>
                    ) : (
                      value.label
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {record.categories.length === 0 ? (
              <span className="text-sm text-muted">
                No categories assigned.
              </span>
            ) : (
              record.categories.map((category) => (
                <Button
                  key={category._id}
                  type="button"
                  size="sm"
                  disabled={!canManage(role)}
                  aria-label={`Remove category ${category.name}`}
                  onClick={async () => {
                    setError(null);
                    try {
                      await remove({
                        eventId: event.id,
                        recordId,
                        categoryId: category._id,
                      });
                    } catch {
                      setError("We could not remove that category.");
                    }
                  }}
                >
                  {category.name}
                  <span aria-hidden="true"> ×</span>
                </Button>
              ))
            )}
          </div>
          {canManage(role) ? (
            <select
              className={control}
              defaultValue=""
              aria-label="Assign a category"
              onChange={async (e) => {
                const select = e.currentTarget;
                const categoryId = select.value;
                if (!categoryId) return;
                select.value = "";
                setError(null);
                try {
                  await assign({ eventId: event.id, recordId, categoryId });
                } catch {
                  setError("We could not assign that category.");
                }
              }}
            >
              <option value="">Assign a category…</option>
              {categories
                .filter(
                  (c) =>
                    c.archivedAt === undefined &&
                    !record.categories.some(
                      (assigned) => assigned._id === c._id,
                    ),
                )
                .map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
            </select>
          ) : null}
        </CardContent>
      </Card>
      {location ? (
        <Card>
          <CardHeader>
            <CardTitle>Venue detail</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage(role) ? (
              <form className="grid gap-4" onSubmit={submit}>
                <label className={field}>
                  Address
                  <Input
                    name="address"
                    defaultValue={record.address ?? ""}
                    maxLength={300}
                  />
                </label>
                <label className={field}>
                  Access notes
                  <textarea
                    className={control}
                    name="accessNotes"
                    defaultValue={record.accessNotes ?? ""}
                    maxLength={1000}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={field}>
                    Hours
                    <Input
                      name="hours"
                      defaultValue={record.hours ?? ""}
                      maxLength={240}
                    />
                  </label>
                  <label className={field}>
                    Contact detail
                    <Input
                      name="contact"
                      defaultValue={record.contactDetail ?? ""}
                      maxLength={300}
                    />
                  </label>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-ink">
                  <input
                    name="spectatorVisible"
                    type="checkbox"
                    defaultChecked={record.spectatorVisible === true}
                    className="mt-1 h-4 w-4 accent-[var(--color-green)]"
                  />
                  <span>
                    <span className="block font-semibold">
                      Show in spectator info
                    </span>
                    <span className="mt-1 block text-muted">
                      Spectators can see this location, its address, hours, and
                      navigation link.
                    </span>
                  </span>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={field}>
                    Confirmation
                    <select
                      className={control}
                      name="status"
                      defaultValue={record.confirmationStatus ?? "unconfirmed"}
                    >
                      <option value="unconfirmed">Unconfirmed</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </label>
                  <label className={field}>
                    Source
                    <Input
                      name="source"
                      defaultValue={record.confirmationSource ?? ""}
                      maxLength={500}
                    />
                  </label>
                </div>
                <Button type="submit" variant="primary" disabled={saving}>
                  Save venue details
                </Button>
              </form>
            ) : (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">Address</dt>
                  <dd className="text-muted">
                    {record.address ?? "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Access</dt>
                  <dd className="text-muted">
                    {record.accessNotes ?? "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Confirmation</dt>
                  <dd className="text-muted">
                    {record.confirmationStatus ?? "Unconfirmed"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">
              Venue details are available for location-capable record types.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function TypesCategoriesScreen() {
  const { event, role } = useEventWorkspace();
  const types = useQuery(recordsApi.listTypes, { eventId: event.id });
  const categories = useQuery(recordsApi.listCategories, { eventId: event.id });
  const createType = useMutation(recordsApi.createType);
  const createCategory = useMutation(recordsApi.createCategory);
  const archiveType = useMutation(recordsApi.archiveType);
  const restoreType = useMutation(recordsApi.restoreType);
  const archiveCategory = useMutation(recordsApi.archiveCategory);
  const restoreCategory = useMutation(recordsApi.restoreCategory);
  const [error, setError] = useState<string | null>(null);
  async function addType(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // React clears `currentTarget` as soon as the handler returns, and an async
    // handler returns at its first await. The element must be captured up front
    // or the reset throws and reports a failure for a write that succeeded.
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    try {
      await createType({
        eventId: event.id,
        name: String(form.get("name")),
        isLocation: form.get("location") === "on",
      });
      formElement.reset();
    } catch {
      setError("We could not add that record type.");
    }
  }
  async function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    try {
      await createCategory({
        eventId: event.id,
        name: String(form.get("name")),
        color: String(form.get("color")),
      });
      formElement.reset();
    } catch {
      setError("We could not add that category.");
    }
  }
  return (
    <section aria-labelledby="types-heading" className="grid gap-4">
      <div>
        <Link
          href={`/events/${event.id}/records`}
          className="text-sm font-semibold text-green-ink underline underline-offset-4"
        >
          Records & venues
        </Link>
        <h1
          id="types-heading"
          className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink"
        >
          Types & categories
        </h1>
        <p className="mt-1 text-sm text-muted">
          Event-owned vocabulary and place taxonomy.
        </p>
      </div>
      {error ? (
        <Banner variant="danger" label="Configuration update failed">
          {error}
        </Banner>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record types</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted">
              Built-in types remain available. Custom types can be marked as
              locations for venues.
            </p>
            {types === undefined ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <ul className="grid gap-2">
                {types.map((type) => (
                  <li
                    className="flex justify-between gap-3 text-sm"
                    key={type._id}
                  >
                    <span>
                      {type.name}
                      {type.isLocation ? " · location" : ""}
                      {type.archivedAt ? " · archived" : ""}
                    </span>
                    {canManage(role) && !type.archivedAt ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void archiveType({
                            eventId: event.id,
                            typeId: type._id,
                          })
                        }
                      >
                        Archive
                      </Button>
                    ) : canManage(role) ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void restoreType({
                            eventId: event.id,
                            typeId: type._id,
                          })
                        }
                      >
                        Restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage(role) ? (
              <form
                className="grid gap-3 border-t border-line pt-4"
                onSubmit={addType}
              >
                <Input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Marshal post"
                />
                <label className="flex gap-2 text-sm">
                  <input name="location" type="checkbox" /> This type is a
                  location
                </label>
                <Button type="submit" variant="primary">
                  Add type
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Place categories</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {categories === undefined ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <ul className="grid gap-2">
                {categories.map((category) => (
                  <li
                    key={category._id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {category.name}
                      {category.archivedAt ? " · archived" : ""}
                    </span>
                    {canManage(role) && !category.archivedAt ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void archiveCategory({
                            eventId: event.id,
                            categoryId: category._id,
                          })
                        }
                      >
                        Archive
                      </Button>
                    ) : canManage(role) ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void restoreCategory({
                            eventId: event.id,
                            categoryId: category._id,
                          })
                        }
                      >
                        Restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage(role) ? (
              <form
                className="grid gap-3 border-t border-line pt-4"
                onSubmit={addCategory}
              >
                <Input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Fuel"
                />
                <select name="color" className={control}>
                  <option value="slate">Slate</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="yellow">Yellow</option>
                </select>
                <Button type="submit" variant="primary">
                  Add category
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
