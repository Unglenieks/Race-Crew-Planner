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
};

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
  const officialContacts = [
    ...recordSnapshots
      .filter(({ record }) => ["person", "organization"].includes(record.type))
      .map(({ record }) => ({
        name: record.name,
        contactDetail: record.contactDetail,
        notes: record.notes,
      })),
    ...memberships.map((membership) => {
      const profile = profiles.get(membership.userId);
      return {
        name: profile?.name ?? "Profile pending",
        role: membership.role,
        email: profile?.email,
        phoneNumber: profile?.phoneNumber,
      };
    }),
    ...invitations
      .filter((invitation) => invitation.status === "pending")
      .map((invitation) => ({
        name: invitation.email,
        role: `${invitation.role} (pending)`,
        email: invitation.email,
      })),
  ];

  return {
    items: snapshotItems,
    appendices: {
      venues,
      officialContacts,
      travel: travel.flatMap((entry) => {
        const from = recordById.get(entry.fromRecordId);
        const to = recordById.get(entry.toRecordId);
        return from === undefined || to === undefined
          ? []
          : [
              {
                from: from.name,
                to: to.name,
                estimate: entry.estimate,
                calculation: entry.calculation,
                routeNote: entry.routeNote,
              },
            ];
      }),
      fuel: recordSnapshots
        .filter(({ record, tags }) => hasTag(record, tags, "fuel"))
        .map(({ venue }) => venue),
      weather: recordSnapshots
        .filter(({ record, tags }) => hasTag(record, tags, "weather"))
        .map(({ venue }) => venue),
      supportServices: recordSnapshots
        .filter(
          ({ record, tags }) =>
            record.type === "service" || hasTag(record, tags, "support"),
        )
        .map(({ venue }) => venue),
    },
  };
}

/** Saves a versioned, self-contained crew brief for later printing or sharing. */
export const create = mutation({
  args: { eventId: v.id("events"), filterDay: v.optional(v.string()) },
  handler: async (ctx, { eventId, filterDay: rawFilterDay }) => {
    const identity = await requireEventMembership(ctx, eventId);
    const filterDay = validatedFilterDay(rawFilterDay);
    const event = await ctx.db.get(eventId);
    if (event === null || event.archivedAt !== undefined) {
      throw new Error("Event not found");
    }
    const brief = await currentBrief(ctx, eventId, filterDay);
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
    const currentByFilter = new Map<string, ExportItem[]>();
    return await Promise.all(
      exports.reverse().map(async (record) => {
        const key = record.filterDay ?? "all";
        let current = currentByFilter.get(key);
        if (current === undefined) {
          current = (await currentBrief(ctx, eventId, record.filterDay)).items;
          currentByFilter.set(key, current);
        }
        return {
          ...record,
          isSuperseded: !sameItems(
            record.items,
            current,
            record.schemaVersion !== undefined,
          ),
        };
      }),
    );
  },
});

export { currentBrief, sameItems, validatedFilterDay };
