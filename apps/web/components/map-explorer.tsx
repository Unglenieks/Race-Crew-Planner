"use client";

import Link from "next/link";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Tabs, TabsContent, TabsList, TabTrigger } from "@/components/ui/tabs";
import { OpenStreetMapMap } from "@/components/openstreetmap-map";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { recordsApi, type MapLocation } from "@/lib/events-api";

function mapsHref(location: MapLocation) {
  const destination =
    location.latitude === undefined || location.longitude === undefined
      ? (location.address ?? location.name)
      : `${location.latitude},${location.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function MapExplorer({ spectator = false }: { spectator?: boolean }) {
  const { event } = useEventWorkspace();
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
