"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapLocation } from "@/lib/events-api";

type Point = Pick<
  MapLocation,
  "_id" | "name" | "latitude" | "longitude" | "kind"
>;

export function OpenStreetMapMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: Point[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = element.current;
    if (!host) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed) return;
      map = L.map(host, { scrollWheelZoom: false }).setView([39.5, -98.35], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const pinned = locations.filter(
        (location) =>
          location.latitude !== undefined && location.longitude !== undefined,
      );
      const markers = pinned.map((location) => {
        const selected = location._id === selectedId;
        const marker = L.marker([location.latitude!, location.longitude!], {
          icon: L.divIcon({
            className: "race-map-pin",
            html: `<span class="race-map-pin__dot ${location.kind === "support" ? "race-map-pin__dot--support" : ""} ${selected ? "race-map-pin__dot--selected" : ""}"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          title: location.name,
        }).addTo(map!);
        marker.on("click", () => onSelect(location._id));
        return marker;
      });
      if (markers.length === 1) map.setView(markers[0].getLatLng(), 13);
      else if (markers.length > 1)
        map.fitBounds(L.featureGroup(markers).getBounds(), {
          padding: [32, 32],
        });
      window.setTimeout(() => map?.invalidateSize(), 0);
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [locations, onSelect, selectedId]);

  return (
    <div
      ref={element}
      className="h-full w-full"
      aria-label="OpenStreetMap venue map"
    />
  );
}
