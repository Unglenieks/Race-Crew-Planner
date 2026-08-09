import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { writeAudit } from "./audit";

const supportCategory = v.union(
  v.literal("fuel"),
  v.literal("grocery"),
  v.literal("parts"),
  v.literal("tire"),
  v.literal("medical"),
  v.literal("towing"),
  v.literal("other"),
);
const documentAccessCode = v.object({
  label: v.string(),
  kind: v.union(v.literal("document"), v.literal("accessCode")),
  value: v.string(),
});
type LegInput = {
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
};
type ServiceInput = {
  name: string;
  scheduledStart: string;
  scheduledEnd: string;
  allowedDurationMinutes: number;
  fuelContext?: string;
  serviceContext?: string;
};
type WeatherInput = {
  forecastDate: string;
  conditions: string;
  temperatureLow?: number;
  temperatureHigh?: number;
  precipitationPercent?: number;
  windMph?: number;
  source: string;
  asOf: number;
};
type ContactInput = {
  title: string;
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
};

function text(value: string | undefined, maximum: number, label: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > maximum)
    throw new Error(`${label} must be at most ${maximum} characters`);
  return normalized;
}
function required(value: string, maximum: number, label: string) {
  const normalized = text(value, maximum, label);
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}
function positive(value: number, label: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    throw new Error(
      `${label} must be ${allowZero ? "zero or greater" : "greater than zero"}`,
    );
  return value;
}
function percent(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error(`${label} must be between 0 and 100`);
  return value;
}
async function member(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q) =>
      q.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (!membership) throw new Error("Forbidden");
  return { identity, membership };
}
async function manager(ctx: MutationCtx, eventId: Id<"events">) {
  const result = await member(ctx, eventId);
  requireRole(result.membership.role, ["owner", "manager"]);
  return result;
}
async function eventRow<
  T extends
    "rallyLegs" | "serviceIntervals" | "weatherForecasts" | "externalContacts",
>(ctx: MutationCtx, eventId: Id<"events">, id: Id<T>, label: string) {
  const row = await ctx.db.get(id);
  if (!row || row.eventId !== eventId) throw new Error(`${label} not found`);
  return row;
}

export function calculateFuel(input: {
  stageMiles: number;
  transitMiles: number;
  stageMpg?: number;
  transitMpg?: number;
  reservePercent: number;
  capacityGallons?: number;
  overrideGallons?: number;
}) {
  const {
    stageMiles,
    transitMiles,
    stageMpg,
    transitMpg,
    reservePercent,
    capacityGallons,
    overrideGallons,
  } = input;
  if (stageMpg === undefined || transitMpg === undefined)
    return {
      available: false,
      formula: "Fuel calculation requires stage MPG and transit MPG.",
    };
  const stageFuelGallons = stageMiles / stageMpg;
  const transitFuelGallons = transitMiles / transitMpg;
  const calculatedPlannedFuelGallons =
    (stageFuelGallons + transitFuelGallons) * (1 + reservePercent / 100);
  const plannedFuelGallons = overrideGallons ?? calculatedPlannedFuelGallons;
  return {
    available: true,
    stageFuelGallons,
    transitFuelGallons,
    calculatedPlannedFuelGallons,
    plannedFuelGallons,
    reservePercent,
    overrideApplied: overrideGallons !== undefined,
    capacityShortfallGallons:
      capacityGallons === undefined
        ? undefined
        : Math.max(0, plannedFuelGallons - capacityGallons),
    formula: `(${stageMiles} mi ÷ ${stageMpg} MPG + ${transitMiles} mi ÷ ${transitMpg} MPG) × (1 + ${reservePercent}%)`,
  };
}

export const getOverview = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { membership } = await member(ctx, eventId);
    if (membership.role === "spectator") throw new Error("Forbidden");
    const [
      profile,
      legs,
      serviceIntervals,
      weatherForecasts,
      contacts,
      records,
      movements,
    ] = await Promise.all([
      ctx.db
        .query("eventLogisticsProfiles")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .unique(),
      ctx.db
        .query("rallyLegs")
        .withIndex("by_eventId_order", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("serviceIntervals")
        .withIndex("by_eventId_scheduledStart", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("weatherForecasts")
        .withIndex("by_eventId_forecastDate", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("externalContacts")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventRecords")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("itineraryItems")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    const activeMovements = movements.filter(
      (movement) => movement.archivedAt === undefined,
    );
    return {
      profile,
      legs: legs.map((leg) => ({
        ...leg,
        fuel: calculateFuel({
          ...leg,
          stageMpg: profile?.stageMpg,
          transitMpg: profile?.transitMpg,
          reservePercent:
            leg.reservePercent ?? profile?.defaultFuelReservePercent ?? 0,
          capacityGallons: profile?.fuelCapacityGallons,
          overrideGallons: leg.fuelOverrideGallons,
        }),
      })),
      weatherForecasts,
      contacts,
      serviceIntervals: serviceIntervals.map((service) => ({
        ...service,
        movements: activeMovements
          .filter((movement) => movement.serviceIntervalId === service._id)
          .map((movement) => ({ _id: movement._id, title: movement.title })),
      })),
      supportLocations: records
        .filter((record) => (record.supportCategories?.length ?? 0) > 0)
        .map((record) => ({
          _id: record._id,
          name: record.name,
          address: record.address,
          supportCategories: record.supportCategories ?? [],
        })),
    };
  },
});

/** The only logistics projection that a spectator can request. */
export const getSpectatorOverview = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { membership } = await member(ctx, eventId);
    if (membership.role !== "spectator") throw new Error("Forbidden");
    const [profile, legs, weatherForecasts] = await Promise.all([
      ctx.db
        .query("eventLogisticsProfiles")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .unique(),
      ctx.db
        .query("rallyLegs")
        .withIndex("by_eventId_order", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("weatherForecasts")
        .withIndex("by_eventId_forecastDate", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    return {
      profile: profile
        ? {
            carNumber: profile.carNumber,
            makeModel: profile.makeModel,
            driverNames: profile.driverNames,
          }
        : null,
      legs: legs.map((leg) => ({
        _id: leg._id,
        name: leg.name,
        order: leg.order,
        stageMiles: leg.stageMiles,
        transitMiles: leg.transitMiles,
      })),
      weatherForecasts,
    };
  },
});

export const saveProfile = mutation({
  args: {
    eventId: v.id("events"),
    carNumber: v.optional(v.string()),
    makeModel: v.optional(v.string()),
    driverNames: v.optional(v.array(v.string())),
    fuelCapacityGallons: v.optional(v.number()),
    stageMpg: v.optional(v.number()),
    transitMpg: v.optional(v.number()),
    defaultFuelReservePercent: v.number(),
    documentAccessCodes: v.array(documentAccessCode),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const data = {
      carNumber: text(args.carNumber, 40, "Car number"),
      makeModel: text(args.makeModel, 160, "Make/model"),
      driverNames:
        args.driverNames === undefined
          ? undefined
          : args.driverNames
              .map((name) => required(name, 120, "Driver name"))
              .slice(0, 4),
      fuelCapacityGallons:
        args.fuelCapacityGallons === undefined
          ? undefined
          : positive(args.fuelCapacityGallons, "Fuel capacity"),
      stageMpg:
        args.stageMpg === undefined
          ? undefined
          : positive(args.stageMpg, "Stage MPG"),
      transitMpg:
        args.transitMpg === undefined
          ? undefined
          : positive(args.transitMpg, "Transit MPG"),
      defaultFuelReservePercent: percent(
        args.defaultFuelReservePercent,
        "Default fuel reserve",
      ),
      documentAccessCodes: args.documentAccessCodes.map((entry) => ({
        label: required(entry.label, 80, "Document/access-code label"),
        kind: entry.kind,
        value: required(entry.value, 500, "Document/access-code value"),
      })),
      updatedAt: Date.now(),
    };
    const existing = await ctx.db
      .query("eventLogisticsProfiles")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, data);
    else
      await ctx.db.insert("eventLogisticsProfiles", {
        eventId: args.eventId,
        ...data,
        createdAt: data.updatedAt,
      });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "logistics.updated",
      message: "Updated event logistics profile",
      objectType: "logistics",
    });
  },
});

const legArgs = {
  eventId: v.id("events"),
  name: v.string(),
  order: v.number(),
  stageCount: v.number(),
  stageMiles: v.number(),
  transitMiles: v.number(),
  startOrder: v.optional(v.number()),
  precedingCar: v.optional(v.string()),
  reservePercent: v.optional(v.number()),
  fuelOverrideGallons: v.optional(v.number()),
  fuelOverrideReason: v.optional(v.string()),
};
function legData(args: LegInput) {
  const override =
    args.fuelOverrideGallons === undefined
      ? undefined
      : positive(args.fuelOverrideGallons, "Fuel override", true);
  const reason = text(args.fuelOverrideReason, 500, "Fuel override reason");
  if ((override === undefined) !== (reason === undefined))
    throw new Error(
      "A fuel override and override reason must be provided together",
    );
  return {
    name: required(args.name, 160, "Leg name"),
    order: positive(args.order, "Leg order", true),
    stageCount: positive(args.stageCount, "Stage count", true),
    stageMiles: positive(args.stageMiles, "Stage miles", true),
    transitMiles: positive(args.transitMiles, "Transit miles", true),
    startOrder:
      args.startOrder === undefined
        ? undefined
        : positive(args.startOrder, "Start order"),
    precedingCar: text(args.precedingCar, 80, "Preceding car"),
    reservePercent:
      args.reservePercent === undefined
        ? undefined
        : percent(args.reservePercent, "Leg reserve"),
    fuelOverrideGallons: override,
    fuelOverrideReason: reason,
    updatedAt: Date.now(),
  };
}
export const createLeg = mutation({
  args: legArgs,
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const data = legData(args);
    return await ctx.db.insert("rallyLegs", {
      eventId: args.eventId,
      ...data,
      createdAt: data.updatedAt,
    });
  },
});
export const updateLeg = mutation({
  args: { legId: v.id("rallyLegs"), ...legArgs },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const existing = await eventRow(ctx, args.eventId, args.legId, "Rally leg");
    // Reserve is no longer a per-leg editing control. Retain historical
    // overrides when another leg field is changed instead of clearing them.
    await ctx.db.patch(
      args.legId,
      legData({
        ...args,
        reservePercent: args.reservePercent ?? existing.reservePercent,
      }),
    );
  },
});

/** Removes an event leg after Crew Chief authorization. */
export const removeLeg = mutation({
  args: { eventId: v.id("events"), legId: v.id("rallyLegs") },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const leg = await eventRow(ctx, args.eventId, args.legId, "Rally leg");
    await ctx.db.delete(args.legId);
    const remaining = await ctx.db
      .query("rallyLegs")
      .withIndex("by_eventId_order", (q) => q.eq("eventId", args.eventId))
      .collect();
    await Promise.all(
      remaining
        .filter((candidate) => candidate.order > leg.order)
        .map((candidate) =>
          ctx.db.patch(candidate._id, {
            order: candidate.order - 1,
            updatedAt: Date.now(),
          }),
        ),
    );
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "logistics.updated",
      message: `Removed rally leg: ${leg.name}`,
      objectType: "rallyLeg",
      objectId: args.legId,
      objectLabel: leg.name,
    });
  },
});

const serviceArgs = {
  eventId: v.id("events"),
  name: v.string(),
  scheduledStart: v.string(),
  scheduledEnd: v.string(),
  allowedDurationMinutes: v.number(),
  fuelContext: v.optional(v.string()),
  serviceContext: v.optional(v.string()),
};
function serviceData(args: ServiceInput) {
  const start = required(args.scheduledStart, 40, "Scheduled start");
  const end = required(args.scheduledEnd, 40, "Scheduled end");
  if (end <= start)
    throw new Error("Scheduled end must be after scheduled start");
  return {
    name: required(args.name, 160, "Service name"),
    scheduledStart: start,
    scheduledEnd: end,
    allowedDurationMinutes: positive(
      args.allowedDurationMinutes,
      "Allowed duration",
    ),
    fuelContext: text(args.fuelContext, 1000, "Fuel context"),
    serviceContext: text(args.serviceContext, 1000, "Service context"),
    updatedAt: Date.now(),
  };
}
export const createServiceInterval = mutation({
  args: serviceArgs,
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const data = serviceData(args);
    return await ctx.db.insert("serviceIntervals", {
      eventId: args.eventId,
      ...data,
      createdAt: data.updatedAt,
    });
  },
});
export const updateServiceInterval = mutation({
  args: { serviceIntervalId: v.id("serviceIntervals"), ...serviceArgs },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await eventRow(
      ctx,
      args.eventId,
      args.serviceIntervalId,
      "Service interval",
    );
    await ctx.db.patch(args.serviceIntervalId, serviceData(args));
  },
});

const weatherArgs = {
  eventId: v.id("events"),
  forecastDate: v.string(),
  conditions: v.string(),
  temperatureLow: v.optional(v.number()),
  temperatureHigh: v.optional(v.number()),
  precipitationPercent: v.optional(v.number()),
  windMph: v.optional(v.number()),
  source: v.string(),
  asOf: v.number(),
};
function weatherData(args: WeatherInput) {
  const low = args.temperatureLow;
  const high = args.temperatureHigh;
  if (
    (low !== undefined && !Number.isFinite(low)) ||
    (high !== undefined && !Number.isFinite(high)) ||
    (low !== undefined && high !== undefined && low > high)
  )
    throw new Error("Temperature range is invalid");
  return {
    forecastDate: required(args.forecastDate, 10, "Forecast date"),
    conditions: required(args.conditions, 240, "Conditions"),
    temperatureLow: low,
    temperatureHigh: high,
    precipitationPercent:
      args.precipitationPercent === undefined
        ? undefined
        : percent(args.precipitationPercent, "Precipitation"),
    windMph:
      args.windMph === undefined
        ? undefined
        : positive(args.windMph, "Wind", true),
    source: required(args.source, 240, "Forecast source"),
    asOf: positive(args.asOf, "Forecast as-of"),
    updatedAt: Date.now(),
  };
}
export const createWeatherForecast = mutation({
  args: weatherArgs,
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const data = weatherData(args);
    return await ctx.db.insert("weatherForecasts", {
      eventId: args.eventId,
      ...data,
      createdAt: data.updatedAt,
    });
  },
});
export const updateWeatherForecast = mutation({
  args: { weatherForecastId: v.id("weatherForecasts"), ...weatherArgs },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await eventRow(
      ctx,
      args.eventId,
      args.weatherForecastId,
      "Weather forecast",
    );
    await ctx.db.patch(args.weatherForecastId, weatherData(args));
  },
});

const contactArgs = {
  eventId: v.id("events"),
  title: v.string(),
  name: v.string(),
  organization: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
};
const contactInput = v.object({
  title: v.string(),
  name: v.string(),
  organization: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
});
function contactData(args: ContactInput) {
  const email = text(args.email, 320, "Email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Email must be valid");
  return {
    title: required(args.title, 120, "Official title"),
    name: required(args.name, 160, "Contact name"),
    organization: text(args.organization, 160, "Organization"),
    phone: text(args.phone, 80, "Phone"),
    email,
    updatedAt: Date.now(),
  };
}
export const createExternalContact = mutation({
  args: contactArgs,
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const data = contactData(args);
    return await ctx.db.insert("externalContacts", {
      eventId: args.eventId,
      ...data,
      createdAt: data.updatedAt,
    });
  },
});

/** Adds a validated set of event contacts together after Crew Chief authorization. */
export const createExternalContacts = mutation({
  args: { eventId: v.id("events"), contacts: v.array(contactInput) },
  handler: async (ctx, { eventId, contacts }) => {
    await manager(ctx, eventId);
    if (contacts.length === 0 || contacts.length > 50)
      throw new Error("Add between 1 and 50 contacts at a time");
    const contactRows = contacts.map(contactData);
    return await Promise.all(
      contactRows.map((contact) =>
        ctx.db.insert("externalContacts", {
          eventId,
          ...contact,
          createdAt: contact.updatedAt,
        }),
      ),
    );
  },
});
export const updateExternalContact = mutation({
  args: { contactId: v.id("externalContacts"), ...contactArgs },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await eventRow(ctx, args.eventId, args.contactId, "External contact");
    await ctx.db.patch(args.contactId, contactData(args));
  },
});

/** Removes an event-owned official/support contact after Crew Chief authorization. */
export const removeExternalContact = mutation({
  args: { eventId: v.id("events"), contactId: v.id("externalContacts") },
  handler: async (ctx, { eventId, contactId }) => {
    const { identity } = await manager(ctx, eventId);
    const contact = await eventRow(ctx, eventId, contactId, "External contact");
    await ctx.db.delete(contactId);
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "logistics.updated",
      message: `Removed event contact: ${contact.name}`,
      objectType: "externalContact",
      objectId: contactId,
      objectLabel: contact.name,
    });
  },
});

export const supportCategories = [
  "fuel",
  "grocery",
  "parts",
  "tire",
  "medical",
  "towing",
  "other",
] as const;
export const supportCategoryValidator = supportCategory;
