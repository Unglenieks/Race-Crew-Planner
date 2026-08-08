import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity } from "./auth";
import { resolveUserProfile } from "./userProfiles";
import { calculateFuel } from "./logistics";

export const crewBriefSchemaVersion = 1;

type ExportItem = {
  itineraryItemId: Id<"itineraryItems">;
  title: string;
  scheduledFor: string;
  location?: string;
  scheduledUntil?: string;
  timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
  section?: { name: string; kind: "day" | "session" | "leg" };
  tags?: string[];
  venue?: VenueSnapshot;
  assignedTo?: string;
  notes?: string;
};

type VenueSnapshot = {
  name: string;
  address?: string;
  accessNotes?: string;
  hours?: string;
  contactDetail?: string;
  notes?: string;
  tags?: string[];
};

type CrewBriefAppendices = {
  venues: VenueSnapshot[];
  officialContacts: Array<{
    name: string;
    role?: string;
    email?: string;
    phoneNumber?: string;
    contactDetail?: string;
    notes?: string;
  }>;
  travel: Array<{
    from: string;
    to: string;
    estimate: string;
    calculation?: string;
    routeNote?: string;
  }>;
  fuel: VenueSnapshot[];
  weather: VenueSnapshot[];
  supportServices: VenueSnapshot[];
};

type CrewBrief = {
  items: ExportItem[];
  appendices: CrewBriefAppendices;
  logistics: {
    profile?: {
      carNumber?: string;
      makeModel?: string;
      fuelCapacityGallons?: number;
      stageMpg?: number;
      transitMpg?: number;
    };
    legs: Array<{
      name: string;
      stageCount: number;
      stageMiles: number;
      transitMiles: number;
      startOrder?: number;
      precedingCar?: string;
      plannedFuelGallons?: number;
      formula: string;
      overrideReason?: string;
    }>;
    services: Array<{
      name: string;
      scheduledStart: string;
      scheduledEnd: string;
      allowedDurationMinutes: number;
      fuelContext?: string;
      serviceContext?: string;
    }>;
    weather: Array<{
      forecastDate: string;
      conditions: string;
      temperatureLow?: number;
      temperatureHigh?: number;
      precipitationPercent?: number;
      windMph?: number;
      source: string;
      asOf: number;
    }>;
    travel: Array<{
      from: string;
      to: string;
      distanceMiles?: number;
      expectedDurationMinutes?: number;
      source?: string;
      routeNotes?: string;
    }>;
    supportServices: Array<{
      name: string;
      address?: string;
      categories: string[];
    }>;
    documentAccessCodes: Array<{
      label: string;
      kind: "document" | "accessCode";
      value: string;
    }>;
    contacts: Array<{
      contactId: Id<"externalContacts">;
      title: string;
      name: string;
      organization?: string;
      phone?: string;
      email?: string;
    }>;
  };
};

const inclusionOptionsValidator = v.object({
  profile: v.boolean(),
  rallyFuel: v.boolean(),
  service: v.boolean(),
  weather: v.boolean(),
  travelRoutes: v.boolean(),
  supportServices: v.boolean(),
  documentAccessCodes: v.boolean(),
  externalContactIds: v.array(v.id("externalContacts")),
});
type InclusionOptions = typeof inclusionOptionsValidator.type;
const defaultOptions = (): InclusionOptions => ({
  profile: false,
  rallyFuel: false,
  service: false,
  weather: false,
  travelRoutes: false,
  supportServices: false,
  documentAccessCodes: false,
  externalContactIds: [],
});

async function requireEventMembership(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (index) =>
      index.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (membership === null) throw new Error("Forbidden");
  return identity;
}

function validatedFilterDay(filterDay: string | undefined) {
  if (filterDay === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDay)) {
    throw new Error("Export day must be a calendar date");
  }
  return filterDay;
}

function itemSnapshot(item: {
  _id: Id<"itineraryItems">;
  title: string;
  scheduledFor: string;
  location?: string;
}): ExportItem {
  return {
    itineraryItemId: item._id,
    title: item.title,
    scheduledFor: item.scheduledFor,
    location: item.location,
  };
}

function sameItems(left: ExportItem[], right: ExportItem[], strict = false) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.itineraryItemId === right[index]?.itineraryItemId &&
        item.title === right[index]?.title &&
        item.scheduledFor === right[index]?.scheduledFor &&
        item.location === right[index]?.location &&
        (!strict ||
          (item.scheduledUntil === right[index]?.scheduledUntil &&
            item.timeKind === right[index]?.timeKind &&
            item.assignedTo === right[index]?.assignedTo &&
            item.notes === right[index]?.notes &&
            JSON.stringify(item.section) ===
              JSON.stringify(right[index]?.section) &&
            JSON.stringify(item.tags ?? []) ===
              JSON.stringify(right[index]?.tags ?? []) &&
            JSON.stringify(item.venue) ===
              JSON.stringify(right[index]?.venue))),
    )
  );
}

function isLocationRecord(
  record: { type: string; recordTypeId?: string },
  types: Map<string, boolean>,
) {
  return record.recordTypeId === undefined
    ? ["venue", "place", "service"].includes(record.type)
    : types.get(record.recordTypeId) === true;
}

function venueSnapshot(
  record: {
    name: string;
    address?: string;
    accessNotes?: string;
    hours?: string;
    contactDetail?: string;
    notes?: string;
  },
  tags: string[],
): VenueSnapshot {
  return {
    name: record.name,
    address: record.address,
    accessNotes: record.accessNotes,
    hours: record.hours,
    contactDetail: record.contactDetail,
    notes: record.notes,
    ...(tags.length === 0 ? {} : { tags }),
  };
}

function hasTag(
  record: { name: string; notes?: string },
  tags: string[],
  term: string,
) {
  const terms = [record.name, record.notes ?? "", ...tags]
    .join(" ")
    .toLowerCase();
  return terms.includes(term);
}

/**
 * Builds the complete crew-facing artifact in one transaction. Every value
 * presented by the print view is copied into this result, never joined live.
 */
async function currentBrief(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  filterDay: string | undefined,
  suppliedOptions: InclusionOptions = defaultOptions(),
): Promise<CrewBrief> {
  const [
    items,
    records,
    recordTypes,
    categories,
    assignments,
    sections,
    work,
    travel,
    memberships,
    invitations,
    profile,
    legs,
    serviceIntervals,
    weatherForecasts,
    contacts,
  ] = await Promise.all([
    ctx.db
      .query("itineraryItems")
      .withIndex("by_eventId_scheduledFor", (index) =>
        index.eq("eventId", eventId),
      )
      .collect(),
    ctx.db
      .query("eventRecords")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventRecordTypes")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventRecordCategories")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventRecordCategoryAssignments")
      .withIndex("by_eventId_recordId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("planSections")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("workItems")
      .withIndex("by_eventId_createdAt", (index) =>
        index.eq("eventId", eventId),
      )
      .collect(),
    ctx.db
      .query("travelContexts")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventInvitations")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventLogisticsProfiles")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .unique(),
    ctx.db
      .query("rallyLegs")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("serviceIntervals")
      .withIndex("by_eventId_scheduledStart", (index) =>
        index.eq("eventId", eventId),
      )
      .collect(),
    ctx.db
      .query("weatherForecasts")
      .withIndex("by_eventId_forecastDate", (index) =>
        index.eq("eventId", eventId),
      )
      .collect(),
    ctx.db
      .query("externalContacts")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect(),
  ]);

  const recordById = new Map(records.map((record) => [record._id, record]));
  const sectionById = new Map(
    sections.map((section) => [section._id, section]),
  );
  const categoryById = new Map(
    categories.map((category) => [category._id, category.name]),
  );
  const tagsByRecordId = new Map<string, string[]>();
  for (const assignment of assignments) {
    const tag = categoryById.get(assignment.categoryId);
    if (tag === undefined) continue;
    tagsByRecordId.set(assignment.recordId, [
      ...(tagsByRecordId.get(assignment.recordId) ?? []),
      tag,
    ]);
  }
  const locationTypes = new Map(
    recordTypes.map((type) => [type._id, type.isLocation]),
  );
  const users = new Set<string>();
  memberships.forEach((membership) => users.add(membership.userId));
  work.forEach((item) => {
    if (item.assigneeId !== undefined) users.add(item.assigneeId);
  });
  const profiles = new Map(
    await Promise.all(
      [...users].map(
        async (userId) =>
          [userId, await resolveUserProfile(ctx, userId)] as const,
      ),
    ),
  );
  const assigneesByMovement = new Map<string, string[]>();
  work
    .filter(
      (item) =>
        item.itineraryItemId !== undefined &&
        item.assigneeId !== undefined &&
        item.status !== "completed",
    )
    .forEach((item) => {
      const name = profiles.get(item.assigneeId!)?.name;
      if (name === undefined) return;
      assigneesByMovement.set(item.itineraryItemId!, [
        ...(assigneesByMovement.get(item.itineraryItemId!) ?? []),
        name,
      ]);
    });

  const activeItems = items.filter(
    (item) =>
      item.archivedAt === undefined &&
      (filterDay === undefined || item.scheduledFor.startsWith(filterDay)),
  );
  const snapshotItems = activeItems.map((item) => {
    const venue =
      item.recordId === undefined ? undefined : recordById.get(item.recordId);
    const venueTags =
      venue === undefined ? [] : (tagsByRecordId.get(venue._id) ?? []);
    const section =
      item.sectionId === undefined
        ? undefined
        : sectionById.get(item.sectionId);
    const tags = [
      ...venueTags,
      ...(section === undefined ? [] : [section.kind]),
    ];
    const assignedTo = [
      ...new Set(assigneesByMovement.get(item._id) ?? []),
    ].join(", ");
    return {
      ...itemSnapshot(item),
      scheduledUntil: item.scheduledUntil,
      timeKind: item.timeKind ?? "exact",
      ...(section === undefined
        ? {}
        : { section: { name: section.name, kind: section.kind } }),
      ...(tags.length === 0 ? {} : { tags }),
      ...(venue === undefined
        ? {}
        : { venue: venueSnapshot(venue, venueTags) }),
      ...(assignedTo.length === 0 ? {} : { assignedTo }),
      notes: item.notes,
    } satisfies ExportItem;
  });

  const recordSnapshots = records.map((record) => ({
    record,
    tags: tagsByRecordId.get(record._id) ?? [],
    venue: venueSnapshot(record, tagsByRecordId.get(record._id) ?? []),
  }));
  const venues = recordSnapshots
    .filter(({ record }) => isLocationRecord(record, locationTypes))
    .map(({ venue }) => venue);
  // Contacts are private by default. Only explicitly selected external contacts
  // enter the snapshot; app members and invitations are never export contacts.
  const selectedContacts = contacts.filter((contact) =>
    suppliedOptions.externalContactIds.includes(contact._id),
  );
  const logistics = {
    ...(suppliedOptions.profile && profile
      ? {
          profile: {
            carNumber: profile.carNumber,
            makeModel: profile.makeModel,
            fuelCapacityGallons: profile.fuelCapacityGallons,
            stageMpg: profile.stageMpg,
            transitMpg: profile.transitMpg,
          },
        }
      : {}),
    legs: suppliedOptions.rallyFuel
      ? legs.map((leg) => {
          const fuel = calculateFuel({
            ...leg,
            stageMpg: profile?.stageMpg,
            transitMpg: profile?.transitMpg,
            reservePercent:
              leg.reservePercent ?? profile?.defaultFuelReservePercent ?? 0,
            capacityGallons: profile?.fuelCapacityGallons,
            overrideGallons: leg.fuelOverrideGallons,
          });
          return {
            name: leg.name,
            stageCount: leg.stageCount,
            stageMiles: leg.stageMiles,
            transitMiles: leg.transitMiles,
            startOrder: leg.startOrder,
            precedingCar: leg.precedingCar,
            ...(fuel.available
              ? { plannedFuelGallons: fuel.plannedFuelGallons }
              : {}),
            formula: fuel.formula,
            overrideReason: leg.fuelOverrideReason,
          };
        })
      : [],
    services: suppliedOptions.service
      ? serviceIntervals.map(
          ({
            name,
            scheduledStart,
            scheduledEnd,
            allowedDurationMinutes,
            fuelContext,
            serviceContext,
          }) => ({
            name,
            scheduledStart,
            scheduledEnd,
            allowedDurationMinutes,
            fuelContext,
            serviceContext,
          }),
        )
      : [],
    weather: suppliedOptions.weather
      ? weatherForecasts.map(
          ({
            forecastDate,
            conditions,
            temperatureLow,
            temperatureHigh,
            precipitationPercent,
            windMph,
            source,
            asOf,
          }) => ({
            forecastDate,
            conditions,
            temperatureLow,
            temperatureHigh,
            precipitationPercent,
            windMph,
            source,
            asOf,
          }),
        )
      : [],
    travel: suppliedOptions.travelRoutes
      ? travel.flatMap((entry) => {
          const from = recordById.get(entry.fromRecordId);
          const to = recordById.get(entry.toRecordId);
          return !from || !to
            ? []
            : [
                {
                  from: from.name,
                  to: to.name,
                  distanceMiles: entry.distanceMiles,
                  expectedDurationMinutes: entry.expectedDurationMinutes,
                  source: entry.source,
                  routeNotes: entry.routeNotes ?? entry.routeNote,
                },
              ];
        })
      : [],
    supportServices: suppliedOptions.supportServices
      ? records
          .filter((record) => (record.supportCategories?.length ?? 0) > 0)
          .map((record) => ({
            name: record.name,
            address: record.address,
            categories: record.supportCategories ?? [],
          }))
      : [],
    documentAccessCodes: suppliedOptions.documentAccessCodes
      ? (profile?.documentAccessCodes ?? [])
      : [],
    contacts: selectedContacts.map(
      ({ _id, title, name, organization, phone, email }) => ({
        contactId: _id,
        title,
        name,
        organization,
        phone,
        email,
      }),
    ),
  };

  return {
    items: snapshotItems,
    appendices: {
      venues,
      officialContacts: selectedContacts.map((contact) => ({
        name: contact.name,
        role: contact.title,
        email: contact.email,
        phoneNumber: contact.phone,
        contactDetail: contact.organization,
      })),
      travel: suppliedOptions.travelRoutes
        ? travel.flatMap((entry) => {
            const from = recordById.get(entry.fromRecordId);
            const to = recordById.get(entry.toRecordId);
            return from === undefined || to === undefined
              ? []
              : [
                  {
                    from: from.name,
                    to: to.name,
                    estimate:
                      entry.estimate ??
                      (entry.expectedDurationMinutes === undefined
                        ? "Duration not recorded"
                        : `${entry.expectedDurationMinutes} min`),
                    calculation: entry.calculation,
                    routeNote: entry.routeNote,
                  },
                ];
          })
        : [],
      fuel: suppliedOptions.rallyFuel
        ? recordSnapshots
            .filter(({ record, tags }) => hasTag(record, tags, "fuel"))
            .map(({ venue }) => venue)
        : [],
      weather: suppliedOptions.weather
        ? recordSnapshots
            .filter(({ record, tags }) => hasTag(record, tags, "weather"))
            .map(({ venue }) => venue)
        : [],
      supportServices: suppliedOptions.supportServices
        ? recordSnapshots
            .filter(
              ({ record, tags }) =>
                record.type === "service" || hasTag(record, tags, "support"),
            )
            .map(({ venue }) => venue)
        : [],
    },
    logistics,
  };
}

/** Saves a versioned, self-contained crew brief for later printing or sharing. */
export const create = mutation({
  args: {
    eventId: v.id("events"),
    filterDay: v.optional(v.string()),
    inclusionOptions: v.optional(inclusionOptionsValidator),
  },
  handler: async (
    ctx,
    { eventId, filterDay: rawFilterDay, inclusionOptions: suppliedOptions },
  ) => {
    const identity = await requireEventMembership(ctx, eventId);
    const filterDay = validatedFilterDay(rawFilterDay);
    const event = await ctx.db.get(eventId);
    if (event === null || event.archivedAt !== undefined) {
      throw new Error("Event not found");
    }
    const inclusionOptions = suppliedOptions ?? defaultOptions();
    const brief = await currentBrief(ctx, eventId, filterDay, inclusionOptions);
    const generatedAt = Date.now();
    const generatedByName = identity.name ?? identity.email ?? identity.subject;
    const snapshot = {
      eventId,
      filterDay,
      schemaVersion: crewBriefSchemaVersion,
      eventName: event.name,
      timeZone: event.timeZone,
      generatedAt,
      generatedBy: identity.subject,
      generatedByName,
      items: brief.items,
      appendices: brief.appendices,
      inclusionOptions,
      logistics: brief.logistics,
    };
    const exportId = await ctx.db.insert("planExports", snapshot);
    return { _id: exportId, ...snapshot };
  },
});

/** Lists stored snapshots; old schema versions stay readable without live joins. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const exports = await ctx.db
      .query("planExports")
      .withIndex("by_eventId_generatedAt", (index) =>
        index.eq("eventId", eventId),
      )
      .collect();
    return await Promise.all(
      exports.reverse().map(async (record) => {
        const current = await currentBrief(
          ctx,
          eventId,
          record.filterDay,
          record.inclusionOptions ?? defaultOptions(),
        );
        return {
          ...record,
          isSuperseded:
            !sameItems(
              record.items,
              current.items,
              record.schemaVersion !== undefined,
            ) ||
            (record.schemaVersion !== undefined &&
              (JSON.stringify(record.appendices ?? {}) !==
                JSON.stringify(current.appendices) ||
                JSON.stringify(record.logistics ?? {}) !==
                  JSON.stringify(current.logistics))),
        };
      }),
    );
  },
});

export { currentBrief, sameItems, validatedFilterDay };
