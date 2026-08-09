"use client";

import { Pencil, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { recordsApi, type MapLocation } from "@/lib/events-api";

type Draft = {
  name: string;
  address: string;
  hours: string;
  latitude: string;
  longitude: string;
};
const emptyDraft: Draft = {
  name: "",
  address: "",
  hours: "",
  latitude: "",
  longitude: "",
};
function draftFor(location: MapLocation): Draft {
  return {
    name: location.name,
    address: location.address ?? "",
    hours: location.hours ?? "",
    latitude: location.latitude?.toString() ?? "",
    longitude: location.longitude?.toString() ?? "",
  };
}
function coordinate(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

export function SpectatorVenues() {
  const { event, role } = useEventWorkspace();
  const canManage = role === "owner" || role === "manager";
  const locations = useQuery(recordsApi.listMapLocations, {
    eventId: event.id,
  });
  const saveMapLocation = useMutation(recordsApi.saveMapLocation);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<MapLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canManage) return null;
  const venues = (locations ?? []).filter(
    (location) => location.kind === "venue" && location.spectatorVisible,
  );
  const set = (key: keyof Draft, value: string) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await saveMapLocation({
        eventId: event.id,
        recordId: editing?._id,
        kind: "venue",
        name: draft.name,
        address: draft.address || undefined,
        hours: draft.hours || undefined,
        latitude: coordinate(draft.latitude),
        longitude: coordinate(draft.longitude),
        supportCategories: [],
        spectatorVisible: true,
      });
      setDraft(null);
      setEditing(null);
    } catch {
      setError(
        "We could not save this spectator venue. Enter both valid coordinates or leave both blank.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Spectator venues</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Published locations for the spectator map and schedule.
            </p>
          </div>
          {draft === null ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setDraft(emptyDraft)}
            >
              <Plus className="h-4 w-4" /> Add venue
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={submit}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 pr-3">Venue</th>
                  <th className="pb-2 pr-3">Address</th>
                  <th className="pb-2 pr-3">Hours</th>
                  <th className="pb-2 pr-3">Coordinates</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr
                    key={venue._id}
                    className="border-b border-line2 last:border-0"
                  >
                    <td className="py-3 pr-3 font-medium text-ink">
                      {venue.name}
                    </td>
                    <td className="py-3 pr-3">{venue.address ?? "—"}</td>
                    <td className="py-3 pr-3">{venue.hours ?? "—"}</td>
                    <td className="py-3 pr-3">
                      {venue.latitude === undefined
                        ? "Pin needed"
                        : `${venue.latitude.toFixed(4)}, ${venue.longitude!.toFixed(4)}`}
                    </td>
                    <td className="py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(venue);
                          setDraft(draftFor(venue));
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {venues.length === 0 && draft === null ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted">
                      No spectator venues have been published.
                    </td>
                  </tr>
                ) : null}
                {draft ? (
                  <tr className="border-b border-line2 bg-soft/50 align-top">
                    <td className="p-2">
                      <Input
                        value={draft.name}
                        onChange={(e) => set("name", e.target.value)}
                        required
                        aria-label="Venue name"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={draft.address}
                        onChange={(e) => set("address", e.target.value)}
                        aria-label="Venue address"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={draft.hours}
                        onChange={(e) => set("hours", e.target.value)}
                        aria-label="Venue hours"
                      />
                    </td>
                    <td className="p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="any"
                          min="-90"
                          max="90"
                          value={draft.latitude}
                          onChange={(e) => set("latitude", e.target.value)}
                          aria-label="Latitude"
                        />
                        <Input
                          type="number"
                          step="any"
                          min="-180"
                          max="180"
                          value={draft.longitude}
                          onChange={(e) => set("longitude", e.target.value)}
                          aria-label="Longitude"
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button
                          type="submit"
                          size="sm"
                          variant="primary"
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDraft(null);
                            setEditing(null);
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </form>
        {error ? (
          <p className="text-sm text-danger-tx" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
