"use client";

import { Pencil, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { resolveLocation } from "@/lib/location-resolution";
import { recordsApi, type MapLocation } from "@/lib/events-api";

type Draft = {
  name: string;
  locationQuery: string;
  hours: string;
  notes: string;
};
const emptyDraft: Draft = {
  name: "",
  locationQuery: "",
  hours: "",
  notes: "",
};
function draftFor(location: MapLocation): Draft {
  return {
    name: location.name,
    locationQuery: location.address ?? "",
    hours: location.hours ?? "",
    notes: location.notes ?? "",
  };
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
      const location = await resolveLocation(event.id, draft.locationQuery);
      await saveMapLocation({
        eventId: event.id,
        recordId: editing?._id,
        kind: "venue",
        name: draft.name,
        address: location.address,
        notes: draft.notes || undefined,
        hours: draft.hours || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        supportCategories: [],
        spectatorVisible: true,
      });
      setDraft(null);
      setEditing(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not save this spectator venue. Try again.",
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
        {venues.length === 0 ? (
          <p className="text-sm text-muted">
            No spectator venues have been published.
          </p>
        ) : (
          <ul className="grid gap-2">
            {venues.map((venue) => (
              <li
                key={venue._id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div>
                  <p className="font-medium text-ink">{venue.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {venue.address ?? "Address not recorded"}
                  </p>
                  {venue.hours ? (
                    <p className="mt-1 text-sm text-muted">{venue.hours}</p>
                  ) : null}
                  {venue.notes ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                      {venue.notes}
                    </p>
                  ) : null}
                </div>
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
              </li>
            ))}
          </ul>
        )}
        {draft ? (
          <form
            className="grid gap-3 rounded-lg border border-line bg-soft/50 p-3 md:grid-cols-2"
            onSubmit={submit}
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Venue name
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Hours
              <Input
                value={draft.hours}
                onChange={(e) => set("hours", e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Address or Plus Code
              <Input
                value={draft.locationQuery}
                onChange={(e) => set("locationQuery", e.target.value)}
                maxLength={300}
                placeholder="123 Rally Road, Town, State or 849VCWC8+R9"
                required
              />
              <span className="text-xs font-normal text-muted">
                Use a full address, or add a city or region to a short Plus
                Code.
              </span>
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Notes
              <textarea
                className="min-h-24 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={1000}
              />
            </label>
            <div className="flex gap-2 md:col-span-2">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save venue"}
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
          </form>
        ) : null}
        {error ? (
          <p className="text-sm text-danger-tx" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
