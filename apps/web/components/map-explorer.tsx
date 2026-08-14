"use client";

import Link from "next/link";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabTrigger } from "@/components/ui/tabs";
import { OpenStreetMapMap } from "@/components/openstreetmap-map";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { resolveLocation } from "@/lib/location-resolution";
import {
  recordsApi,
  type EventRecord,
  type MapLocation,
} from "@/lib/events-api";

type SupportCategory = NonNullable<EventRecord["supportCategories"]>[number];

const supportOptions = [
  "fuel",
  "grocery",
  "parts",
  "tire",
  "medical",
  "towing",
  "other",
] as const;

function AddMapLocation({ eventId }: { eventId: string }) {
  const saveMapLocation = useMutation(recordsApi.saveMapLocation);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"venue" | "support">("venue");
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleCategory = (category: SupportCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  async function submit(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const formElement = form.currentTarget;
    const values = new FormData(formElement);
    setSaving(true);
    setError(null);
    try {
      const location = await resolveLocation(
        eventId,
        String(values.get("locationQuery") ?? ""),
      );
      await saveMapLocation({
        eventId,
        name: String(values.get("name") ?? ""),
        kind,
        address: location.address,
        notes: String(values.get("notes") ?? "") || undefined,
        hours: String(values.get("hours") ?? "") || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        supportCategories:
          kind === "support"
            ? categories.length
              ? categories
              : ["other"]
            : [],
        spectatorVisible: values.get("spectatorVisible") === "on",
      });
      formElement.reset();
      setCategories([]);
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not save this location. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Locations</h2>
          <p className="mt-1 text-sm text-muted">
            Add a venue or a crew support stop to the shared map.
          </p>
        </div>
        {!open ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Add location
          </Button>
        ) : null}
      </div>
      {open ? (
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            Location kind
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as "venue" | "support");
                setCategories([]);
              }}
              className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
            >
              <option value="venue">Venue</option>
              <option value="support">Support location</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Name
            <Input name="name" required maxLength={160} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Address or Plus Code
            <Input
              name="locationQuery"
              required
              maxLength={300}
              placeholder="123 Rally Road, Town, State or 849VCWC8+R9"
            />
            <span className="text-xs font-normal text-muted">
              Use a full address, or add a city or region to a short Plus Code.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Opening hours
            <textarea
              name="hours"
              className="min-h-32 rounded-lg border border-line bg-card px-3 py-2 text-sm"
              maxLength={1000}
              placeholder={
                "Thu: 08:00-18:00\nFri: 08:00-12:00; 13:00-18:00\nSat: 07:00-16:00\nSun: Closed"
              }
            />
            <span className="text-xs font-normal text-muted">
              Add one day per line. Include split hours and closures when
              needed.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Notes
            <textarea
              name="notes"
              className="min-h-24 rounded-lg border border-line bg-card px-3 py-2 text-sm"
              maxLength={1000}
            />
          </label>
          {kind === "support" ? (
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium">Support available</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {supportOptions.map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-2 text-sm capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm md:col-span-2">
            <input
              name="spectatorVisible"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--color-green)]"
            />
            <span>
              <span className="block font-semibold">
                Show in spectator info
              </span>
              <span className="mt-1 block text-muted">
                Spectators can see the location and navigation link.
              </span>
            </span>
          </label>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save location"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-danger-tx" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function mapsHref(location: MapLocation) {
  const destination =
    location.latitude === undefined || location.longitude === undefined
      ? (location.address ?? location.name)
      : `${location.latitude},${location.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function MapExplorer({ spectator = false }: { spectator?: boolean }) {
  const { event, role } = useEventWorkspace();
  const locations = useQuery(recordsApi.listMapLocations, {
    eventId: event.id,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      (locations ?? []).filter(
        (location) => !spectator || location.spectatorVisible,
      ),
    [locations, spectator],
  );
  const venues = useMemo(
    () => visible.filter((location) => location.kind === "venue"),
    [visible],
  );
  const support = useMemo(
    () => visible.filter((location) => location.kind === "support"),
    [visible],
  );
  const selected =
    visible.find((location) => location._id === selectedId) ??
    venues[0] ??
    support[0] ??
    null;
  const pinnedCount = visible.filter(
    (location) =>
      location.latitude !== undefined && location.longitude !== undefined,
  ).length;
  const select = useCallback((id: string) => setSelectedId(id), []);

  const list = (items: MapLocation[]) =>
    items.length === 0 ? (
      <p className="rounded-lg border border-line bg-card p-4 text-sm text-muted">
        No locations have been added here yet.
      </p>
    ) : (
      <ul className="grid gap-2">
        {items.map((location) => (
          <li key={location._id}>
            <button
              type="button"
              onClick={() => select(location._id)}
              className={`w-full rounded-lg border p-3 text-left focus-visible:outline-3 focus-visible:outline-focus ${selected?._id === location._id ? "border-green bg-soft" : "border-line bg-card hover:bg-soft"}`}
            >
              <span className="flex items-center justify-between gap-2 font-semibold text-ink">
                <span>{location.name}</span>
                <MapPin className="h-4 w-4 text-green-ink" />
              </span>
              <span className="mt-1 block text-sm text-muted">
                {location.address ??
                  location.hours ??
                  "Location details available"}
              </span>
              {location.supportCategories?.length ? (
                <span className="mt-1 block text-xs uppercase tracking-wide text-green-ink">
                  {location.supportCategories.join(" · ")}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="h-[30vh] min-h-64 max-h-96 bg-soft">
          <OpenStreetMapMap
            locations={visible}
            selectedId={selected?._id ?? null}
            onSelect={select}
          />
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-semibold text-ink">
              {selected?.name ?? "Event locations"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {selected?.address ??
                selected?.notes ??
                "Select a location to see its details."}
            </p>
            <p className="mt-2 text-xs text-muted">
              {pinnedCount} of {visible.length} location
              {visible.length === 1 ? "" : "s"} pinned on the map.
              {pinnedCount === visible.length
                ? ""
                : " Add coordinates to place the rest."}
            </p>
          </div>
          {selected ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={mapsHref(selected)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green px-3 text-sm font-semibold text-card"
              >
                <Navigation className="h-4 w-4" /> Navigate
              </a>
              {!spectator ? (
                <Link
                  href={`/events/${event.id}/records/${selected._id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-btnline px-3 text-sm font-semibold"
                >
                  Detail <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      {!spectator && (role === "owner" || role === "manager") ? (
        <AddMapLocation eventId={event.id} />
      ) : null}
      {spectator ? (
        <section>
          <h2 className="mb-3 font-semibold text-ink">Spectator locations</h2>
          {list(visible)}
        </section>
      ) : (
        <Tabs defaultValue="venues">
          <TabsList aria-label="Map location groups">
            <TabTrigger value="venues">Venues</TabTrigger>
            <TabTrigger value="support">Support</TabTrigger>
          </TabsList>
          <TabsContent value="venues" className="mt-4">
            {list(venues)}
          </TabsContent>
          <TabsContent value="support" className="mt-4">
            {list(support)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
