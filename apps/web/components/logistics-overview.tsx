"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  logisticsApi,
  type EventRole,
  type LogisticsOverview,
} from "@/lib/events-api";

const number = (value: string) =>
  value.trim() === "" ? undefined : Number(value);
const stale = (asOf: number) => Date.now() - asOf > 12 * 60 * 60 * 1000;
const localTime = (value: string) => value.replace("T", " ");

export function LogisticsOverview({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const overview = useQuery(logisticsApi.getOverview, { eventId });
  const saveProfile = useMutation(logisticsApi.saveProfile);
  const createLeg = useMutation(logisticsApi.createLeg);
  const createService = useMutation(logisticsApi.createServiceInterval);
  const createWeather = useMutation(logisticsApi.createWeatherForecast);
  const createContact = useMutation(logisticsApi.createExternalContact);
  const canManage = role === "owner" || role === "manager";
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  if (overview === undefined)
    return (
      <p className="text-sm text-muted" role="status">
        Loading logistics…
      </p>
    );
  const profile = overview.profile;
  async function submit(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch {
      setError(
        "We could not save the logistics details. Check the required fields and try again.",
      );
    }
  }

  return (
    <section aria-labelledby="logistics-heading" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            id="logistics-heading"
            className="font-serif text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-ink"
          >
            Rally logistics
          </h1>
          <p className="mt-1 text-sm text-muted">
            A single operational brief for car, travel, service, weather, and
            support.
          </p>
        </div>
        <Badge variant={canManage ? "success" : "neutral"}>
          {canManage ? "Manager authoring" : "Crew brief · view only"}
        </Badge>
      </div>
      {error ? (
        <Banner variant="danger" label="Save failed" role="alert">
          {error}
        </Banner>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Car and access profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <p>
              <b>Car</b>
              <br />
              {[profile?.carNumber, profile?.makeModel]
                .filter(Boolean)
                .join(" · ") || "Not recorded"}
            </p>
            <p>
              <b>Fuel capacity</b>
              <br />
              {profile?.fuelCapacityGallons === undefined
                ? "Not recorded"
                : `${profile.fuelCapacityGallons} gal`}
            </p>
            <p>
              <b>Consumption</b>
              <br />
              {profile?.stageMpg === undefined ||
              profile?.transitMpg === undefined
                ? "Stage/transit MPG not recorded"
                : `${profile.stageMpg} stage / ${profile.transitMpg} transit MPG`}
            </p>
          </div>
          {profile?.documentAccessCodes.length ? (
            <ul className="grid gap-1">
              {profile.documentAccessCodes.map((entry) => (
                <li key={`${entry.kind}-${entry.label}`}>
                  <b>{entry.label}:</b> {entry.value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No access information recorded.</p>
          )}
          {canManage ? (
            <>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                {profileOpen ? "Close profile editor" : "Edit profile"}
              </Button>
              {profileOpen ? (
                <ProfileForm
                  profile={profile}
                  onSave={(data) =>
                    submit(async () => {
                      await saveProfile({ eventId, ...data });
                      setProfileOpen(false);
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rally legs and fuel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.legs.length === 0 ? (
            <p className="text-sm text-muted">No rally legs recorded.</p>
          ) : (
            overview.legs.map((leg) => (
              <div
                key={leg._id}
                className="rounded-lg border border-line p-3 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <b>
                    {leg.order + 1}. {leg.name}
                  </b>
                  <span>
                    {leg.stageCount} stages · {leg.stageMiles} stage mi ·{" "}
                    {leg.transitMiles} transit mi
                  </span>
                </div>
                <p className="mt-1 text-muted">
                  Start {leg.startOrder ?? "—"} · preceding car{" "}
                  {leg.precedingCar ?? "—"}
                </p>
                <p className="mt-2 text-muted">{leg.fuel.formula}</p>
                {leg.fuel.available ? (
                  <p className="mt-1">
                    <b>Required:</b> {leg.fuel.plannedFuelGallons?.toFixed(1)}{" "}
                    gal{" "}
                    {leg.fuel.overrideApplied
                      ? `(manual override; ${leg.fuelOverrideReason})`
                      : `(includes ${leg.reservePercent ?? profile?.defaultFuelReservePercent ?? 0}% reserve)`}
                    {(leg.fuel.capacityShortfallGallons ?? 0) > 0 ? (
                      <span className="ml-2 font-semibold text-danger">
                        Capacity short by{" "}
                        {leg.fuel.capacityShortfallGallons?.toFixed(1)} gal
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ))
          )}
          {canManage ? (
            <LegForm
              order={overview.legs.length}
              onSave={(data) => submit(() => createLeg({ eventId, ...data }))}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Travel legs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {overview.travelContexts.length === 0 ? (
              <p className="text-muted">No travel legs recorded.</p>
            ) : (
              overview.travelContexts.map((travel) => (
                <div
                  key={travel._id}
                  className="rounded-lg border border-line p-3"
                >
                  <b>
                    {travel.fromName} → {travel.toName}
                  </b>
                  <p className="mt-1 text-muted">
                    {travel.requiresReview ? (
                      <span className="font-semibold text-danger">
                        Legacy entry needs conversion.{" "}
                      </span>
                    ) : null}
                    {travel.distanceMiles ?? "—"} mi ·{" "}
                    {travel.expectedDurationMinutes ?? "—"} min ·{" "}
                    {travel.source ?? "No source"}
                  </p>
                  {travel.routeNotes || travel.routeNote ? (
                    <p className="mt-1 text-muted">
                      {travel.routeNotes ?? travel.routeNote}
                    </p>
                  ) : null}
                  <MovementLinks
                    eventId={eventId}
                    movements={travel.movements}
                  />
                </div>
              ))
            )}
            <Link
              href={`/events/${eventId}/records/travel`}
              className="text-sm font-semibold text-green-ink underline"
            >
              Manage travel legs and convert legacy entries
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Service windows</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {overview.serviceIntervals.length === 0 ? (
              <p className="text-muted">No service windows recorded.</p>
            ) : (
              overview.serviceIntervals.map((service) => (
                <div
                  key={service._id}
                  className="rounded-lg border border-line p-3"
                >
                  <b>{service.name}</b>
                  <p className="mt-1 text-muted">
                    {localTime(service.scheduledStart)}–
                    {localTime(service.scheduledEnd)} ·{" "}
                    {service.allowedDurationMinutes} min allowed
                  </p>
                  {service.fuelContext || service.serviceContext ? (
                    <p className="mt-1 text-muted">
                      {[service.fuelContext, service.serviceContext]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <MovementLinks
                    eventId={eventId}
                    movements={service.movements}
                  />
                </div>
              ))
            )}
            {canManage ? (
              <ServiceForm
                onSave={(data) =>
                  submit(() => createService({ eventId, ...data }))
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Forecast</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {overview.weatherForecasts.length === 0 ? (
              <p className="text-muted">No forecast recorded.</p>
            ) : (
              overview.weatherForecasts.map((weather) => (
                <div
                  key={weather._id}
                  className="rounded-lg border border-line p-3"
                >
                  <b>
                    {weather.forecastDate}: {weather.conditions}
                  </b>
                  <p className="mt-1 text-muted">
                    {weather.temperatureLow ?? "—"}–
                    {weather.temperatureHigh ?? "—"}° ·{" "}
                    {weather.precipitationPercent ?? "—"}% precipitation ·{" "}
                    {weather.windMph ?? "—"} mph wind
                  </p>
                  <p
                    className={
                      stale(weather.asOf)
                        ? "mt-1 font-semibold text-danger"
                        : "mt-1 text-muted"
                    }
                  >
                    Source: {weather.source} · as of{" "}
                    {new Date(weather.asOf).toLocaleString()}
                    {stale(weather.asOf) ? " · stale (over 12 hours)" : ""}
                  </p>
                </div>
              ))
            )}
            {canManage ? (
              <WeatherForm
                onSave={(data) =>
                  submit(() => createWeather({ eventId, ...data }))
                }
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Officials and support</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {overview.contacts.map((contact) => (
              <div key={contact._id}>
                <b>
                  {contact.title}: {contact.name}
                </b>
                <p className="text-muted">
                  {[contact.organization, contact.phone, contact.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
            {overview.supportLocations.length ? (
              <div className="border-t border-line pt-3">
                <b>Support locations</b>
                {overview.supportLocations.map((location) => (
                  <p key={location._id} className="mt-1 text-muted">
                    {location.name} · {location.supportCategories.join(", ")}
                  </p>
                ))}
              </div>
            ) : null}
            {canManage ? (
              <ContactForm
                onSave={(data) =>
                  submit(() => createContact({ eventId, ...data }))
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MovementLinks({
  eventId,
  movements,
}: {
  eventId: string;
  movements: Array<{ _id: string; title: string }>;
}) {
  return movements.length ? (
    <p className="mt-2 text-muted">
      Movements:{" "}
      {movements.map((item, index) => (
        <span key={item._id}>
          {index ? ", " : ""}
          <Link
            className="font-medium text-green-ink underline"
            href={`/events/${eventId}/plan/${item._id}`}
          >
            {item.title}
          </Link>
        </span>
      ))}
    </p>
  ) : (
    <p className="mt-2 text-muted">No linked movements.</p>
  );
}
function ProfileForm({
  profile,
  onSave,
}: {
  profile: LogisticsOverview["profile"];
  onSave: (data: {
    carNumber?: string;
    makeModel?: string;
    fuelCapacityGallons?: number;
    stageMpg?: number;
    transitMpg?: number;
    defaultFuelReservePercent: number;
    documentAccessCodes: Array<{
      label: string;
      kind: "document" | "accessCode";
      value: string;
    }>;
  }) => void;
}) {
  return (
    <form
      className="grid gap-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          carNumber: String(f.get("carNumber") || ""),
          makeModel: String(f.get("makeModel") || ""),
          fuelCapacityGallons: number(String(f.get("capacity") || "")),
          stageMpg: number(String(f.get("stageMpg") || "")),
          transitMpg: number(String(f.get("transitMpg") || "")),
          defaultFuelReservePercent: Number(f.get("reserve") || 0),
          documentAccessCodes: [],
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <Field
          name="carNumber"
          label="Car number"
          defaultValue={profile?.carNumber}
        />
        <Field
          name="makeModel"
          label="Make/model"
          defaultValue={profile?.makeModel}
        />
        <Field
          name="capacity"
          label="Fuel capacity (gal)"
          type="number"
          defaultValue={profile?.fuelCapacityGallons}
        />
        <Field
          name="stageMpg"
          label="Stage MPG"
          type="number"
          defaultValue={profile?.stageMpg}
        />
        <Field
          name="transitMpg"
          label="Transit MPG"
          type="number"
          defaultValue={profile?.transitMpg}
        />
        <Field
          name="reserve"
          label="Reserve %"
          type="number"
          defaultValue={profile?.defaultFuelReservePercent ?? 0}
        />
      </div>
      <Button type="submit" size="sm" className="w-fit">
        Save profile
      </Button>
    </form>
  );
}
function LegForm({
  order,
  onSave,
}: {
  order: number;
  onSave: (data: {
    name: string;
    order: number;
    stageCount: number;
    stageMiles: number;
    transitMiles: number;
    startOrder?: number;
    precedingCar?: string;
    reservePercent?: number;
    fuelOverrideGallons?: number;
    fuelOverrideReason?: string;
  }) => void;
}) {
  return (
    <CompactForm
      title="Add rally leg"
      onSubmit={(f) =>
        onSave({
          name: String(f.get("name")),
          order,
          stageCount: Number(f.get("stageCount") || 0),
          stageMiles: Number(f.get("stageMiles") || 0),
          transitMiles: Number(f.get("transitMiles") || 0),
          startOrder: number(String(f.get("startOrder") || "")),
          precedingCar: String(f.get("precedingCar") || "") || undefined,
          reservePercent: number(String(f.get("reservePercent") || "")),
          fuelOverrideGallons: number(String(f.get("override") || "")),
          fuelOverrideReason: String(f.get("reason") || "") || undefined,
        })
      }
      fields={[
        ["name", "Leg name"],
        ["stageCount", "Stage count", "number"],
        ["stageMiles", "Stage miles", "number"],
        ["transitMiles", "Transit miles", "number"],
        ["startOrder", "Start order", "number"],
        ["precedingCar", "Preceding car"],
        ["reservePercent", "Reserve %", "number"],
        ["override", "Manual fuel override (gal)", "number"],
        ["reason", "Override reason"],
      ]}
    />
  );
}
function ServiceForm({
  onSave,
}: {
  onSave: (data: {
    name: string;
    scheduledStart: string;
    scheduledEnd: string;
    allowedDurationMinutes: number;
    fuelContext?: string;
    serviceContext?: string;
  }) => void;
}) {
  return (
    <CompactForm
      title="Add service window"
      onSubmit={(f) =>
        onSave({
          name: String(f.get("name")),
          scheduledStart: String(f.get("start")),
          scheduledEnd: String(f.get("end")),
          allowedDurationMinutes: Number(f.get("minutes")),
          fuelContext: String(f.get("fuel") || "") || undefined,
          serviceContext: String(f.get("context") || "") || undefined,
        })
      }
      fields={[
        ["name", "Service name"],
        ["start", "Start", "datetime-local"],
        ["end", "End", "datetime-local"],
        ["minutes", "Allowed minutes", "number"],
        ["fuel", "Fuel context"],
        ["context", "Service context"],
      ]}
    />
  );
}
function WeatherForm({
  onSave,
}: {
  onSave: (data: {
    forecastDate: string;
    conditions: string;
    source: string;
    asOf: number;
    temperatureLow?: number;
    temperatureHigh?: number;
    precipitationPercent?: number;
    windMph?: number;
  }) => void;
}) {
  return (
    <CompactForm
      title="Add forecast"
      onSubmit={(f) =>
        onSave({
          forecastDate: String(f.get("date")),
          conditions: String(f.get("conditions")),
          source: String(f.get("source")),
          asOf: Date.now(),
          temperatureLow: number(String(f.get("temperatureLow") || "")),
          temperatureHigh: number(String(f.get("temperatureHigh") || "")),
          precipitationPercent: number(
            String(f.get("precipitationPercent") || ""),
          ),
          windMph: number(String(f.get("windMph") || "")),
        })
      }
      fields={[
        ["date", "Date", "date"],
        ["conditions", "Conditions"],
        ["source", "Source"],
        ["temperatureLow", "Low temperature", "number"],
        ["temperatureHigh", "High temperature", "number"],
        ["precipitationPercent", "Precipitation %", "number"],
        ["windMph", "Wind MPH", "number"],
      ]}
    />
  );
}
function ContactForm({
  onSave,
}: {
  onSave: (data: {
    title: string;
    name: string;
    organization?: string;
    phone?: string;
    email?: string;
  }) => void;
}) {
  return (
    <CompactForm
      title="Add official"
      onSubmit={(f) =>
        onSave({
          title: String(f.get("title")),
          name: String(f.get("name")),
          organization: String(f.get("organization") || "") || undefined,
          phone: String(f.get("phone") || "") || undefined,
          email: String(f.get("email") || "") || undefined,
        })
      }
      fields={[
        ["title", "Official title"],
        ["name", "Name"],
        ["organization", "Organization"],
        ["phone", "Phone"],
        ["email", "Email", "email"],
      ]}
    />
  );
}
function CompactForm({
  title,
  onSubmit,
  fields,
}: {
  title: string;
  onSubmit: (data: FormData) => void;
  fields: string[][];
}) {
  return (
    <details className="border-t border-line pt-3">
      <summary className="cursor-pointer font-semibold text-green-ink">
        {title}
      </summary>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        {fields.map(([name, label, type]) => (
          <Field
            key={name}
            name={name}
            label={label}
            type={type}
            required={
              ![
                "precedingCar",
                "reservePercent",
                "override",
                "reason",
                "fuel",
                "context",
                "organization",
                "phone",
                "email",
                "temperatureLow",
                "temperatureHigh",
                "precipitationPercent",
                "windMph",
              ].includes(name)
            }
          />
        ))}
        <Button type="submit" size="sm" className="w-fit">
          Save
        </Button>
      </form>
    </details>
  );
}
function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        step={type === "number" ? "any" : undefined}
        className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm font-normal"
      />
    </label>
  );
}
