"use client";

import Link from "next/link";
import { Crosshair, ExternalLink, MapPin, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Tabs, TabsContent, TabsList, TabTrigger } from "@/components/ui/tabs";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { recordsApi, type MapLocation } from "@/lib/events-api";

type Position = { latitude: number; longitude: number };
type Route = { miles: number; minutes: number };
const rad = (value: number) => (value * Math.PI) / 180;
function directMiles(a: Position, b: Position) {
  const earth = 3958.8;
  const latitude = rad(b.latitude - a.latitude);
  const longitude = rad(b.longitude - a.longitude);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(longitude / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function mapsHref(location: MapLocation) {
  const destination =
    location.latitude === undefined || location.longitude === undefined
      ? (location.address ?? location.name)
      : `${location.latitude},${location.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
function mapHref(location: MapLocation) {
  if (location.latitude === undefined || location.longitude === undefined)
    return "https://www.openstreetmap.org";
  const delta = 0.025;
  const { latitude, longitude } = location;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function MapExplorer({ spectator = false }: { spectator?: boolean }) {
  const { event } = useEventWorkspace();
  const locations = useQuery(recordsApi.listMapLocations, {
    eventId: event.id,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      (locations ?? []).filter(
        (location) => !spectator || location.spectatorVisible,
      ),
    [locations, spectator],
  );
  const venues = useMemo(
    () =>
      visible.filter((location) => location.supportCategories?.length === 0),
    [visible],
  );
  const support = useMemo(
    () =>
      visible.filter(
        (location) => (location.supportCategories?.length ?? 0) > 0,
      ),
    [visible],
  );
  const selected =
    visible.find((location) => location._id === selectedId) ??
    venues[0] ??
    support[0] ??
    null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("This browser cannot share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (value) => {
        setPosition({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
        });
        setLocationError(null);
      },
      () =>
        setLocationError(
          "Location was not shared. You can still open directions in your maps app.",
        ),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }
  useEffect(() => {
    if (
      !position ||
      !selected ||
      selected.latitude === undefined ||
      selected.longitude === undefined
    )
      return;
    let active = true;
    const fallbackMiles = directMiles(position, {
      latitude: selected.latitude,
      longitude: selected.longitude,
    });
    void fetch(
      `https://router.project-osrm.org/route/v1/driving/${position.longitude},${position.latitude};${selected.longitude},${selected.latitude}?overview=false`,
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const result = data.routes?.[0];
        if (active && result)
          setRoute({
            miles: result.distance / 1609.344,
            minutes: Math.round(result.duration / 60),
          });
      })
      .catch(() => {
        if (active)
          setRoute({
            miles: fallbackMiles,
            minutes: Math.round((fallbackMiles / 35) * 60),
          });
      });
    return () => {
      active = false;
    };
  }, [position, selected]);
  const usableRoute =
    position &&
    selected?.latitude !== undefined &&
    selected.longitude !== undefined
      ? route
      : null;

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
              onClick={() => setSelectedId(location._id)}
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
          {selected ? (
            <iframe
              title={`Map of ${selected.name}`}
              src={mapHref(selected)}
              className="h-full w-full border-0"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">
              Add a geocoded location to show the map.
            </div>
          )}
        </div>
        {selected ? (
          <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-semibold text-ink">{selected.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {selected.address ?? selected.notes ?? "Address not recorded"}
              </p>
              {usableRoute ? (
                <p className="mt-2 text-sm text-green-ink">
                  {usableRoute.miles.toFixed(1)} mi · about{" "}
                  {usableRoute.minutes} min by road
                </p>
              ) : null}
              {locationError ? (
                <p className="mt-2 text-xs text-muted">{locationError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-btnline px-3 text-sm font-semibold"
                onClick={useMyLocation}
              >
                <Crosshair className="h-4 w-4" />
                Distance
              </button>
              <a
                href={mapsHref(selected)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green px-3 text-sm font-semibold text-card"
              >
                <Navigation className="h-4 w-4" />
                Navigate
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
          </div>
        ) : null}
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
