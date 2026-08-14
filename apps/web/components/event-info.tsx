"use client";

import { CloudSun, Fuel, Gauge, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventInfoSwitcher } from "@/components/event-info-switcher";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import {
  logisticsApi,
  recordsApi,
  type LogisticsOverview,
} from "@/lib/events-api";

type Forecast = {
  _id: string;
  forecastDate: string;
  conditions: string;
  temperatureLow?: number;
  temperatureHigh?: number;
  precipitationPercent?: number;
  source: string;
  asOf: number;
};
export function Weather({
  forecasts,
  coordinates,
  timeZone,
}: {
  forecasts: Forecast[];
  coordinates?: { latitude: number; longitude: number };
  timeZone: string;
}) {
  const [live, setLive] = useState<Forecast[]>([]);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let active = true;
    void fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max&timezone=${encodeURIComponent(timeZone)}`,
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!active) return;
        const daily = data.daily;
        setLive(
          (daily?.time ?? []).map((date: string, index: number) => ({
            _id: `live-${date}`,
            forecastDate: date,
            conditions: weatherLabel(daily.weather_code[index]),
            temperatureLow: daily.temperature_2m_min[index],
            temperatureHigh: daily.temperature_2m_max[index],
            precipitationPercent: daily.precipitation_probability_max[index],
            source: "Open-Meteo",
            asOf: Date.now(),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [latitude, longitude, timeZone]);
  const display = live.length ? live : forecasts;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <span className="flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-green-ink" />
              Weather
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            {display[0] ? (
              <p className="text-xs text-muted">
                {display[0].source} · refreshed{" "}
                {new Date(display[0].asOf).toLocaleString()}
              </p>
            ) : null}
            <div
              className="flex rounded-md border border-btnline p-0.5"
              aria-label="Temperature unit"
            >
              {(["C", "F"] as const).map((temperatureUnit) => (
                <Button
                  key={temperatureUnit}
                  type="button"
                  size="sm"
                  variant={unit === temperatureUnit ? "primary" : "ghost"}
                  aria-pressed={unit === temperatureUnit}
                  onClick={() => setUnit(temperatureUnit)}
                >
                  °{temperatureUnit}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {display.length === 0 ? (
          <p className="text-sm text-muted">
            Add coordinates to an event or spectator location to refresh the
            forecast automatically.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {display.map((forecast) => (
              <article
                key={forecast._id}
                className="rounded-lg border border-line p-3 text-sm"
              >
                <p className="font-semibold text-ink">
                  {forecast.forecastDate}
                </p>
                <p className="mt-1 text-muted">{forecast.conditions}</p>
                <p className="mt-2 text-green-ink">
                  {formatTemperature(forecast.temperatureLow, unit)}–
                  {formatTemperature(forecast.temperatureHigh, unit)}°{unit} ·{" "}
                  {forecast.precipitationPercent ?? "—"}% precip.
                </p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTemperature(value: number | undefined, unit: "C" | "F") {
  if (value === undefined) return "—";
  return (unit === "F" ? value * 1.8 + 32 : value).toFixed(1);
}

function weatherLabel(code: number) {
  const labels: Record<number, string> = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with light hail",
    99: "Thunderstorm with heavy hail",
  };
  return labels[code] ?? "Conditions unavailable";
}

function ProfileEditor({
  eventId,
  profile,
  onClose,
}: {
  eventId: string;
  profile: NonNullable<
    ReturnType<typeof useQuery<typeof logisticsApi.getOverview>>
  >["profile"];
  onClose: () => void;
}) {
  const saveProfile = useMutation(logisticsApi.saveProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const number = (name: string) => {
      const value = String(values.get(name) ?? "").trim();
      return value ? Number(value) : undefined;
    };
    try {
      const noticeBoardCode = String(
        values.get("noticeBoardCode") ?? "",
      ).trim();
      await saveProfile({
        eventId,
        carNumber: String(values.get("carNumber") ?? "") || undefined,
        makeModel: String(values.get("makeModel") ?? "") || undefined,
        driverNames: String(values.get("driverNames") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        fuelCapacityGallons: number("fuelCapacity"),
        stageMpg: number("stageMpg"),
        transitMpg: number("transitMpg"),
        defaultFuelReservePercent: number("reserve") ?? 0,
        documentAccessCodes: noticeBoardCode
          ? [
              {
                label: "Notice board",
                kind: "accessCode",
                value: noticeBoardCode,
              },
            ]
          : [],
      });
      onClose();
    } catch {
      setError(
        "We could not save the event information. Check the numeric fields and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const noticeBoardCode =
    profile?.documentAccessCodes.find((code) =>
      code.label.toLowerCase().includes("notice"),
    )?.value ?? "";
  return (
    <form
      className="grid gap-3 border-t border-line pt-4 md:grid-cols-2"
      onSubmit={submit}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Car number</span>
        <Input name="carNumber" defaultValue={profile?.carNumber ?? ""} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Car / model</span>
        <Input name="makeModel" defaultValue={profile?.makeModel ?? ""} />
      </label>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">Driver names</span>
        <Input
          name="driverNames"
          defaultValue={profile?.driverNames?.join(", ") ?? ""}
          placeholder="Driver, Co-driver"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Notice board code</span>
        <Input name="noticeBoardCode" defaultValue={noticeBoardCode} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Fuel capacity (gal)</span>
        <Input
          name="fuelCapacity"
          type="number"
          min="0"
          step="0.1"
          defaultValue={profile?.fuelCapacityGallons}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Stage MPG</span>
        <Input
          name="stageMpg"
          type="number"
          min="0"
          step="0.1"
          defaultValue={profile?.stageMpg}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Transit MPG</span>
        <Input
          name="transitMpg"
          type="number"
          min="0"
          step="0.1"
          defaultValue={profile?.transitMpg}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Fuel reserve (%)</span>
        <Input
          name="reserve"
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={profile?.defaultFuelReservePercent ?? 0}
        />
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save event info"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="md:col-span-2 text-sm text-danger-tx" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

type LegDraft = {
  name: string;
  order: string;
  stages: Array<{ name: string; miles: string }>;
  transitMiles: string;
  startOrder: string;
  precedingCar: string;
};
const emptyLeg: LegDraft = {
  name: "",
  order: "1",
  stages: [{ name: "SS 1", miles: "0" }],
  transitMiles: "0",
  startOrder: "",
  precedingCar: "",
};
function draftForLeg(leg: LogisticsOverview["legs"][number]): LegDraft {
  return {
    name: leg.name,
    order: String(leg.order + 1),
    stages: leg.stages?.map((stage) => ({
      name: stage.name,
      miles: String(stage.miles),
    })) ?? [{ name: "Unspecified stages", miles: String(leg.stageMiles) }],
    transitMiles: String(leg.transitMiles),
    startOrder: leg.startOrder?.toString() ?? "",
    precedingCar: leg.precedingCar ?? "",
  };
}
function LegEditor({
  eventId,
  legs,
}: {
  eventId: string;
  legs: LogisticsOverview["legs"];
}) {
  const create = useMutation(logisticsApi.createLeg);
  const update = useMutation(logisticsApi.updateLeg);
  const remove = useMutation(logisticsApi.removeLeg);
  const [draft, setDraft] = useState<LegDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: Exclude<keyof LegDraft, "stages">, value: string) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const setStage = (index: number, key: "name" | "miles", value: string) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            stages: current.stages.map((stage, stageIndex) =>
              stageIndex === index ? { ...stage, [key]: value } : stage,
            ),
          }
        : current,
    );
  async function save(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const number = (value: string) => Number(value);
    try {
      const payload = {
        eventId,
        name: draft.name,
        order: number(draft.order) - 1,
        stageCount: draft.stages.length,
        stageMiles: draft.stages.reduce(
          (total, stage) => total + number(stage.miles),
          0,
        ),
        stages: draft.stages.map((stage) => ({
          name: stage.name,
          miles: number(stage.miles),
        })),
        transitMiles: number(draft.transitMiles),
        startOrder:
          draft.startOrder === "" ? undefined : number(draft.startOrder),
        precedingCar: draft.precedingCar || undefined,
      };
      if (editingId) await update({ ...payload, legId: editingId });
      else await create(payload);
      setDraft(null);
      setEditingId(null);
    } catch {
      setError(
        "We could not save this leg. Check its order and mileage values.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Edit race legs</p>
        {draft === null ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setDraft({
                ...emptyLeg,
                order: String(
                  Math.max(-1, ...legs.map((leg) => leg.order)) + 2,
                ),
              });
              setEditingId(null);
            }}
          >
            Add leg
          </Button>
        ) : null}
      </div>
      {draft ? (
        <form onSubmit={save} className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm">
            Leg name
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Leg order
            <Input
              type="number"
              min="1"
              value={draft.order}
              onChange={(e) => set("order", e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Start order
            <Input
              type="number"
              min="0"
              value={draft.startOrder}
              onChange={(e) => set("startOrder", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Transit miles
            <Input
              type="number"
              min="0"
              step="0.1"
              value={draft.transitMiles}
              onChange={(e) => set("transitMiles", e.target.value)}
              required
            />
          </label>
          <fieldset className="grid gap-2 md:col-span-4">
            <legend className="text-sm font-medium">Special stages</legend>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          stages: [
                            ...current.stages,
                            {
                              name: `SS ${current.stages.length + 1}`,
                              miles: "0",
                            },
                          ],
                        }
                      : current,
                  )
                }
              >
                Add stage
              </Button>
            </div>
            {draft.stages.map((stage, index) => (
              <div
                className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
                key={index}
              >
                <Input
                  aria-label={`Stage ${index + 1} name`}
                  value={stage.name}
                  onChange={(e) => setStage(index, "name", e.target.value)}
                  required
                />
                <Input
                  aria-label={`Stage ${index + 1} miles`}
                  type="number"
                  min="0"
                  step="0.1"
                  value={stage.miles}
                  onChange={(e) => setStage(index, "miles", e.target.value)}
                  required
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={draft.stages.length === 1}
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            stages: current.stages.filter(
                              (_, i) => i !== index,
                            ),
                          }
                        : current,
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted">
              {draft.stages.length} stages ·{" "}
              {draft.stages
                .reduce((total, stage) => total + (Number(stage.miles) || 0), 0)
                .toFixed(1)}{" "}
              stage mi
            </p>
          </fieldset>
          <label className="grid gap-1 text-sm">
            Car ahead
            <Input
              value={draft.precedingCar}
              onChange={(e) => set("precedingCar", e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save leg"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <ul className="grid gap-2">
          {legs.map((leg) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
              key={leg._id}
            >
              <span>
                {leg.order + 1}. {leg.name}
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(draftForLeg(leg));
                    setEditingId(leg._id);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove ${leg.name}?`))
                      void remove({ eventId, legId: leg._id }).catch(() =>
                        setError("We could not remove this leg."),
                      );
                  }}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className="text-sm text-danger-tx" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type MileageLeg = {
  _id: string;
  name: string;
  order: number;
  stageMiles: number;
  transitMiles: number;
  stages?: Array<{ name: string; miles: number }>;
};

function LegCards({
  legs,
  privateLegs,
  fuelByLeg,
  totals,
  totalFuel,
  canViewPrivate,
}: {
  legs: MileageLeg[];
  privateLegs: LogisticsOverview["legs"];
  fuelByLeg: Map<string, number | undefined>;
  totals: { stage: number; transit: number };
  totalFuel: number;
  canViewPrivate: boolean;
}) {
  return (
    <div className="grid gap-3 xl:hidden" aria-label="Leg cards">
      {legs.map((leg) => {
        const privateLeg = privateLegs.find(
          (candidate) => candidate._id === leg._id,
        );
        const fuel = fuelByLeg.get(leg._id);
        return (
          <article
            key={leg._id}
            className="grid gap-3 rounded-lg border border-line p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {leg.order + 1}. {leg.name}
              </p>
              <p className="mt-1 text-xs text-muted">Leg {leg.order + 1}</p>
            </div>
            {canViewPrivate ? (
              <div className="grid grid-cols-2 gap-3 text-muted">
                <p>
                  <span className="block text-xs font-medium uppercase tracking-wide">
                    Start order
                  </span>
                  {privateLeg?.startOrder ?? "—"}
                </p>
                <p>
                  <span className="block text-xs font-medium uppercase tracking-wide">
                    Car ahead
                  </span>
                  {privateLeg?.precedingCar ?? "—"}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 text-muted">
              <p>
                <span className="block text-xs font-medium uppercase tracking-wide">
                  Stage
                </span>
                {leg.stageMiles.toFixed(1)} mi
              </p>
              <p>
                <span className="block text-xs font-medium uppercase tracking-wide">
                  Transit
                </span>
                {leg.transitMiles.toFixed(1)} mi
              </p>
              <p>
                <span className="block text-xs font-medium uppercase tracking-wide">
                  Total
                </span>
                {(leg.stageMiles + leg.transitMiles).toFixed(1)} mi
              </p>
              {canViewPrivate ? (
                <p>
                  <span className="block text-xs font-medium uppercase tracking-wide">
                    Planned fuel
                  </span>
                  {fuel ? `${fuel.toFixed(1)} gal` : "—"}
                </p>
              ) : null}
            </div>
            {leg.stages?.length ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">
                  View {leg.stages.length} stages
                </summary>
                <ul className="mt-2 grid gap-1">
                  {leg.stages.map((stage, index) => (
                    <li key={`${stage.name}-${index}`}>
                      {stage.name}: {stage.miles.toFixed(1)} mi
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        );
      })}
      <section
        className="grid gap-2 rounded-lg border border-line bg-soft/50 p-3 text-sm"
        aria-label="Overall mileage"
      >
        <p className="font-semibold text-ink">Overall</p>
        <div className="grid grid-cols-2 gap-3 text-muted">
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide">
              Stage
            </span>
            {totals.stage.toFixed(1)} mi
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide">
              Transit
            </span>
            {totals.transit.toFixed(1)} mi
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide">
              Total
            </span>
            {(totals.stage + totals.transit).toFixed(1)} mi
          </p>
          {canViewPrivate ? (
            <p>
              <span className="block text-xs font-medium uppercase tracking-wide">
                Fuel
              </span>
              {totalFuel ? `${totalFuel.toFixed(1)} gal` : "—"}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function EventInfo() {
  const { event, role } = useEventWorkspace();
  const privateOverview = useQuery(
    logisticsApi.getOverview,
    role === "spectator" ? "skip" : { eventId: event.id },
  );
  const publicOverview = useQuery(
    logisticsApi.getSpectatorOverview,
    role === "spectator" ? { eventId: event.id } : "skip",
  );
  const locations = useQuery(recordsApi.listMapLocations, {
    eventId: event.id,
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const overview = role === "spectator" ? publicOverview : privateOverview;
  const totals = useMemo(
    () =>
      (overview?.legs ?? []).reduce(
        (result, leg) => ({
          stage: result.stage + leg.stageMiles,
          transit: result.transit + leg.transitMiles,
        }),
        { stage: 0, transit: 0 },
      ),
    [overview],
  );
  const fuelByLeg = useMemo(
    () =>
      new Map(
        (privateOverview?.legs ?? []).map((leg) => [
          leg._id,
          leg.fuel.plannedFuelGallons,
        ]),
      ),
    [privateOverview],
  );
  const totalFuel = Array.from(fuelByLeg.values()).reduce<number>(
    (total, fuel) => total + (fuel ?? 0),
    0,
  );
  const weatherLocation = useMemo(() => {
    const geocoded = (locations ?? []).filter(
      (location) =>
        location.kind === "venue" &&
        location.latitude !== undefined &&
        location.longitude !== undefined,
    );
    if (geocoded.length === 0) return undefined;
    return geocoded.reduce(
      (center, location) => ({
        latitude: center.latitude + location.latitude! / geocoded.length,
        longitude: center.longitude + location.longitude! / geocoded.length,
      }),
      { latitude: 0, longitude: 0 },
    );
  }, [locations]);
  if (!overview)
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading event info…
      </p>
    );
  const profile = privateOverview?.profile;
  return (
    <div className="grid gap-4">
      <EventInfoSwitcher current="overview" />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>Race profile</CardTitle>
            {role === "owner" || role === "manager" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setEditingProfile((current) => !current)}
              >
                <Pencil className="h-4 w-4" />
                {editingProfile ? "Close editor" : "Edit event info"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <b>Car</b>
            <br />
            {[overview.profile?.carNumber, overview.profile?.makeModel]
              .filter(Boolean)
              .join(" · ") || "Not recorded"}
          </p>
          {overview.profile?.driverNames?.length ? (
            <p>
              <b>Drivers</b>
              <br />
              {overview.profile.driverNames.join(" · ")}
            </p>
          ) : null}
          {role === "spectator" ? (
            <p>
              <b>Event mileage</b>
              <br />
              {totals.stage.toFixed(1)} stage mi · {totals.transit.toFixed(1)}{" "}
              transit mi
            </p>
          ) : (
            <>
              <p>
                <b>Fuel economy</b>
                <br />
                {profile?.stageMpg ?? "—"} stage / {profile?.transitMpg ?? "—"}{" "}
                MPG
              </p>
              <p>
                <b>Notice board</b>
                <br />
                {profile?.documentAccessCodes
                  .map((code) => code.value)
                  .join(" · ") || "Not recorded"}
              </p>
            </>
          )}
        </CardContent>
        {editingProfile && role !== "spectator" ? (
          <CardContent>
            <ProfileEditor
              eventId={event.id}
              profile={profile ?? null}
              onClose={() => setEditingProfile(false)}
            />
          </CardContent>
        ) : null}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-green-ink" />
              Legs, order, and mileage
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.legs.length === 0 ? (
            <p className="text-sm text-muted">No race legs recorded.</p>
          ) : (
            <>
              <LegCards
                legs={overview.legs}
                privateLegs={privateOverview?.legs ?? []}
                fuelByLeg={fuelByLeg}
                totals={totals}
                totalFuel={totalFuel}
                canViewPrivate={role !== "spectator"}
              />
              <div className="hidden min-w-0 max-w-full overflow-x-auto xl:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="pb-2 pr-3">Leg / day</th>
                      <th className="pb-2 pr-3">Order</th>
                      <th className="pb-2 pr-3">Car ahead</th>
                      <th className="pb-2 pr-3">Stage</th>
                      <th className="pb-2 pr-3">Transit</th>
                      <th className="pb-2 pr-3">Total</th>
                      <th className="pb-2">Fuel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.legs.map((leg) => {
                      const privateLeg = privateOverview?.legs.find(
                        (candidate) => candidate._id === leg._id,
                      );
                      const fuel = fuelByLeg.get(leg._id);
                      return (
                        <tr
                          key={leg._id}
                          className="border-b border-line2 last:border-0"
                        >
                          <td className="py-3 pr-3 font-semibold text-ink">
                            {leg.order + 1}. {leg.name}
                          </td>
                          <td className="py-3 pr-3">
                            {privateLeg?.startOrder ?? "—"}
                          </td>
                          <td className="py-3 pr-3">
                            {privateLeg?.precedingCar ?? "—"}
                          </td>
                          <td className="py-3 pr-3">
                            <p>{leg.stageMiles.toFixed(1)} mi</p>
                            {leg.stages?.length ? (
                              <details className="mt-1 text-xs text-muted">
                                <summary className="cursor-pointer">
                                  View {leg.stages.length} stages
                                </summary>
                                <ul className="mt-1 grid gap-1">
                                  {leg.stages.map((stage, index) => (
                                    <li key={`${stage.name}-${index}`}>
                                      {stage.name}: {stage.miles.toFixed(1)} mi
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3">{leg.transitMiles} mi</td>
                          <td className="py-3 pr-3">
                            {(leg.stageMiles + leg.transitMiles).toFixed(1)} mi
                          </td>
                          <td className="py-3">
                            {fuel ? (
                              <span className="inline-flex items-center gap-1">
                                <Fuel className="h-4 w-4 text-green-ink" />
                                {fuel.toFixed(1)} gal
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-ink">
                      <td className="pt-3" colSpan={3}>
                        Overall
                      </td>
                      <td className="pt-3">{totals.stage.toFixed(1)} mi</td>
                      <td className="pt-3">{totals.transit.toFixed(1)} mi</td>
                      <td className="pt-3">
                        {(totals.stage + totals.transit).toFixed(1)} mi
                      </td>
                      <td className="pt-3">
                        {totalFuel ? `${totalFuel.toFixed(1)} gal` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
        {role === "owner" || role === "manager" ? (
          <CardContent>
            <LegEditor eventId={event.id} legs={privateOverview?.legs ?? []} />
          </CardContent>
        ) : null}
      </Card>
      <Weather
        forecasts={overview.weatherForecasts}
        coordinates={weatherLocation}
        timeZone={event.timeZone}
      />
    </div>
  );
}
