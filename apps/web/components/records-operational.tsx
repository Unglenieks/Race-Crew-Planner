"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { resolveLocation } from "@/lib/location-resolution";
import { isLocationRecord } from "@/lib/record-locations";
import { recordsApi } from "@/lib/events-api";

const canManage = (role: string) => role === "owner" || role === "manager";
const field = "grid gap-1.5";
const control =
  "min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink";

export function RecordDetail({ recordId }: { recordId: string }) {
  const { event, role } = useEventWorkspace();
  const record = useQuery(recordsApi.get, { eventId: event.id, recordId });
  const types = useQuery(recordsApi.listTypes, { eventId: event.id });
  const saveDetails = useMutation(recordsApi.saveVenueDetails);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (record === undefined || types === undefined)
    return <p className="text-sm text-muted">Loading record…</p>;
  const location = isLocationRecord(record, types);
  async function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const form = new FormData(eventForm.currentTarget);
    try {
      const enteredAddress = String(form.get("address") || "").trim();
      const location = enteredAddress
        ? await resolveLocation(event.id, enteredAddress)
        : undefined;
      await saveDetails({
        eventId: event.id,
        recordId,
        name: String(form.get("name") || ""),
        address: location?.address,
        notes: String(form.get("notes") || "") || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accessNotes: String(form.get("accessNotes") || "") || undefined,
        hours: String(form.get("hours") || "") || undefined,
        spectatorVisible: form.get("spectatorVisible") === "on",
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
          {location ? (
            <Link
              href={`/events/${event.id}/map`}
              className="text-sm font-semibold text-green-ink underline underline-offset-4"
            >
              Back to map
            </Link>
          ) : null}
          <h1
            id="record-heading"
            className={`font-serif text-3xl font-semibold tracking-tight text-ink ${location ? "mt-2" : ""}`}
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
      {location ? (
        <Card>
          <CardHeader>
            <CardTitle>Venue detail</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage(role) ? (
              <form className="grid gap-4" onSubmit={submit}>
                <label className={field}>
                  Venue name
                  <Input
                    name="name"
                    defaultValue={record.name}
                    maxLength={160}
                    required
                  />
                </label>
                <label className={field}>
                  Address
                  <Input
                    name="address"
                    defaultValue={record.address ?? ""}
                    maxLength={300}
                  />
                  <span className="text-xs text-muted">
                    An address or Plus Code is resolved to the map pin when you
                    save.
                  </span>
                </label>
                <label className={field}>
                  Description
                  <textarea
                    className={control}
                    name="notes"
                    defaultValue={record.notes ?? ""}
                    maxLength={1000}
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
                <label className={field}>
                  Opening hours
                  <textarea
                    className={control}
                    name="hours"
                    defaultValue={record.hours ?? ""}
                    maxLength={1000}
                    placeholder={
                      "Thu: 08:00-18:00\nFri: 08:00-12:00; 13:00-18:00\nSat: 07:00-16:00\nSun: Closed"
                    }
                  />
                  <span className="text-xs text-muted">
                    Add one day per line. Include split hours and closures when
                    needed.
                  </span>
                </label>
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
                  <dt className="font-semibold">Opening hours</dt>
                  <dd className="whitespace-pre-wrap text-muted">
                    {record.hours ?? "Not recorded"}
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
