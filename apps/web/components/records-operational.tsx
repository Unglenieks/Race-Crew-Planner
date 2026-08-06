"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { recordsApi, type EventRecord } from "@/lib/events-api";

const canManage = (role: string) => role === "owner" || role === "manager";
const field = "grid gap-1.5";
const control =
  "min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink";

export function RecordDetail({ recordId }: { recordId: string }) {
  const { event, role } = useEventWorkspace();
  const record = useQuery(recordsApi.get, { eventId: event.id, recordId });
  const categories = useQuery(recordsApi.listCategories, { eventId: event.id });
  const types = useQuery(recordsApi.listTypes, { eventId: event.id });
  const saveDetails = useMutation(recordsApi.saveVenueDetails);
  const assign = useMutation(recordsApi.assignCategory);
  const remove = useMutation(recordsApi.removeCategory);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (record === undefined || categories === undefined || types === undefined)
    return <p className="text-sm text-muted">Loading record…</p>;
  const location =
    ["venue", "place", "service"].includes(record.type) ||
    (record.recordTypeId !== undefined &&
      types.some(
        (type) => type._id === record.recordTypeId && type.isLocation,
      ));
  async function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData(eventForm.currentTarget);
    try {
      await saveDetails({
        eventId: event.id,
        recordId,
        address: String(form.get("address") || "") || undefined,
        accessNotes: String(form.get("accessNotes") || "") || undefined,
        hours: String(form.get("hours") || "") || undefined,
        contactDetail: String(form.get("contact") || "") || undefined,
        confirmationStatus: String(form.get("status")) as
          "confirmed" | "unconfirmed",
        confirmationSource: String(form.get("source") || "") || undefined,
      });
      setMessage("Venue details saved.");
    } catch {
      setMessage("We could not save venue details.");
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
        <Link
          href={`/events/${event.id}/records/travel`}
          className="text-sm font-semibold text-green-ink underline underline-offset-4"
        >
          Add travel context
        </Link>
      </div>
      {message === null ? null : (
        <Banner
          variant={message.includes("could not") ? "danger" : "success"}
          label="Venue details"
        >
          {message}
        </Banner>
      )}
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
                  size="sm"
                  disabled={!canManage(role)}
                  onClick={() =>
                    void remove({
                      eventId: event.id,
                      recordId,
                      categoryId: category._id,
                    })
                  }
                >
                  {category.name} ×
                </Button>
              ))
            )}
          </div>
          {canManage(role) ? (
            <select
              className={control}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  void assign({
                    eventId: event.id,
                    recordId,
                    categoryId: e.target.value,
                  });
                e.currentTarget.value = "";
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
      <Card>
        <CardHeader>
          <CardTitle>Travel context</CardTitle>
        </CardHeader>
        <CardContent>
          {record.travelContexts.length === 0 ? (
            <EmptyState
              title="No travel context yet"
              description="Add an estimate or route note between two locations."
            />
          ) : (
            <ul className="grid gap-3">
              {record.travelContexts.map((travel) => (
                <li
                  key={travel._id}
                  className="border-t border-line pt-3 text-sm"
                >
                  <b>{travel.estimate}</b>
                  {travel.routeNote ? (
                    <p className="mt-1 text-muted">{travel.routeNote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
  const [error, setError] = useState<string | null>(null);
  async function addType(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await createType({
        eventId: event.id,
        name: String(form.get("name")),
        isLocation: form.get("location") === "on",
      });
      e.currentTarget.reset();
    } catch {
      setError("We could not add that record type.");
    }
  }
  async function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await createCategory({
        eventId: event.id,
        name: String(form.get("name")),
        color: String(form.get("color")),
      });
      e.currentTarget.reset();
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
              locations for venues and travel.
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
                  <li key={category._id} className="text-sm">
                    {category.name}
                    {category.archivedAt ? " · archived" : ""}
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

export function TravelScreen() {
  const { event, role } = useEventWorkspace();
  const records = useQuery(recordsApi.list, { eventId: event.id });
  const types = useQuery(recordsApi.listTypes, { eventId: event.id });
  const travel = useQuery(recordsApi.listTravel, { eventId: event.id });
  const save = useMutation(recordsApi.saveTravel);
  const [error, setError] = useState<string | null>(null);
  const locations = useMemo(() => {
    const locationTypeIds = new Set(
      (types ?? []).filter((type) => type.isLocation).map((type) => type._id),
    );
    return (records ?? []).filter(
      (record) =>
        ["venue", "place", "service"].includes(record.type) ||
        (record.recordTypeId !== undefined &&
          locationTypeIds.has(record.recordTypeId)),
    );
  }, [records, types]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await save({
        eventId: event.id,
        fromRecordId: String(form.get("from")),
        toRecordId: String(form.get("to")),
        estimate: String(form.get("estimate")),
        calculation: String(form.get("calculation") || "") || undefined,
        routeNote: String(form.get("routeNote") || "") || undefined,
      });
      e.currentTarget.reset();
    } catch {
      setError("We could not save travel context. Choose two event locations.");
    }
  }
  return (
    <section aria-labelledby="travel-heading" className="grid gap-4">
      <div>
        <Link
          href={`/events/${event.id}/records`}
          className="text-sm font-semibold text-green-ink underline underline-offset-4"
        >
          Records & venues
        </Link>
        <h1
          id="travel-heading"
          className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink"
        >
          Travel context
        </h1>
        <p className="mt-1 text-sm text-muted">
          Place-to-place estimates and last-mile route notes.
        </p>
      </div>
      {error ? (
        <Banner variant="danger" label="Travel update failed">
          {error}
        </Banner>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Saved travel context</CardTitle>
        </CardHeader>
        <CardContent>
          {travel === undefined ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : travel.length === 0 ? (
            <EmptyState title="No travel context yet" />
          ) : (
            <ul className="grid gap-3">
              {travel.map((item) => (
                <li
                  key={item._id}
                  className="border-t border-line pt-3 text-sm"
                >
                  <b>{item.estimate}</b>
                  {item.calculation ? (
                    <span className="text-muted"> · {item.calculation}</span>
                  ) : null}
                  {item.routeNote ? (
                    <p className="mt-1 text-muted">{item.routeNote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {canManage(role) ? (
        <Card>
          <CardHeader>
            <CardTitle>Add travel context</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <label className={field}>
                From
                <select name="from" className={control} required>
                  <option value="">Choose a location…</option>
                  {locations.map((record: EventRecord) => (
                    <option key={record._id} value={record._id}>
                      {record.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field}>
                To
                <select name="to" className={control} required>
                  <option value="">Choose a location…</option>
                  {locations.map((record: EventRecord) => (
                    <option key={record._id} value={record._id}>
                      {record.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field}>
                Estimate
                <Input
                  name="estimate"
                  required
                  maxLength={120}
                  placeholder="e.g. 15 minutes"
                />
              </label>
              <label className={field}>
                Calculation / source
                <Input
                  name="calculation"
                  maxLength={240}
                  placeholder="e.g. Google Maps · 07:30"
                />
              </label>
              <label className={field}>
                Route note
                <textarea
                  name="routeNote"
                  className={control}
                  maxLength={1000}
                />
              </label>
              <Button type="submit" variant="primary">
                Save travel context
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
