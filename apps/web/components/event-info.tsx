"use client";

import { CloudSun, Fuel, Gauge, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { logisticsApi, recordsApi } from "@/lib/events-api";

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
function Weather({
  forecasts,
  coordinates,
}: {
  forecasts: Forecast[];
  coordinates?: { latitude: number; longitude: number };
}) {
  const [live, setLive] = useState<Forecast[]>([]);
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let active = true;
    void fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max&timezone=auto`,
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!active) return;
        const daily = data.daily;
        setLive(
          (daily?.time ?? []).map((date: string, index: number) => ({
            _id: `live-${date}`,
            forecastDate: date,
            conditions: `Weather code ${daily.weather_code[index]}`,
            temperatureLow: daily.temperature_2m_min[index],
            temperatureHigh: daily.temperature_2m_max[index],
            precipitationPercent: daily.precipitation_probability_max[index],
            source: "Open-Meteo · refreshed on open",
            asOf: Date.now(),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [latitude, longitude]);
  const display = live.length ? live : forecasts;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-green-ink" />
            Weather
          </span>
        </CardTitle>
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
                  {forecast.temperatureLow ?? "—"}–
                  {forecast.temperatureHigh ?? "—"}° ·{" "}
                  {forecast.precipitationPercent ?? "—"}% precip.
                </p>
                <p className="mt-2 text-xs text-muted">
                  {forecast.source} · refreshed{" "}
                  {new Date(forecast.asOf).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
  if (!overview)
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading event info…
      </p>
    );
  const profile = privateOverview?.profile;
  const weatherLocation = locations?.find(
    (location) =>
      location.latitude !== undefined && location.longitude !== undefined,
  );
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Race profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <b>Car</b>
            <br />
            {[overview.profile?.carNumber, overview.profile?.makeModel]
              .filter(Boolean)
              .join(" · ") || "Not recorded"}
          </p>
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
                  .map((code) => `${code.label}: ${code.value}`)
                  .join(" · ") || "Not recorded"}
              </p>
            </>
          )}
        </CardContent>
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
            <div className="overflow-x-auto">
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
                        <td className="py-3 pr-3">{leg.stageMiles} mi</td>
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
          )}
        </CardContent>
      </Card>
      <Weather
        forecasts={overview.weatherForecasts}
        coordinates={
          weatherLocation?.latitude === undefined ||
          weatherLocation?.longitude === undefined
            ? undefined
            : {
                latitude: weatherLocation.latitude,
                longitude: weatherLocation.longitude,
              }
        }
      />
    </div>
  );
}
