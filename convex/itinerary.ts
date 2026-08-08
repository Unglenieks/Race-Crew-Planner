import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireIdentity, requireRole } from "./auth";
import { isLocationRecord } from "./records";
import { validatedRecordInput } from "./records";
import { writeAudit } from "./audit";

const itineraryArgs = {
  eventId: v.id("events"),
  title: v.string(),
  scheduledFor: v.string(),
  scheduledUntil: v.optional(v.string()),
  location: v.optional(v.string()),
  recordId: v.optional(v.id("eventRecords")),
  notes: v.optional(v.string()),
  sectionId: v.optional(v.id("planSections")),
  timeKind: v.optional(
    v.union(
      v.literal("exact"),
      v.literal("approximate"),
      v.literal("range"),
      v.literal("allDay"),
      v.literal("unspecified"),
    ),
  ),
};

type ItineraryInput = {
  title: string;
  scheduledFor: string;
  scheduledUntil?: string;
  location?: string;
  notes?: string;
  sectionId?: Id<"planSections">;
  timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
};

function optionalText(value: string | undefined, maximum: number) {
  const normalized = value?.trim();

  if (normalized === undefined || normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > maximum) {
    throw new Error(`Text must be at most ${maximum} characters`);
  }

  return normalized;
}

/** Validates a movement without converting it out of the event's local time. */
export function validatedItineraryInput({
  title,
  scheduledFor,
  scheduledUntil,
  location,
  notes,
  sectionId,
  timeKind,
}: ItineraryInput) {
  const normalizedTitle = title.trim();

  if (normalizedTitle.length === 0 || normalizedTitle.length > 160) {
    throw new Error(
      "Movement description must be between 1 and 160 characters",
    );
  }

  if (
    (timeKind ?? "exact") !== "unspecified" &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledFor) ||
      Number.isNaN(Date.parse(`${scheduledFor}:00Z`)))
  ) {
    throw new Error("A valid planned date and time is required");
  }

  if (timeKind === "range") {
    if (
      scheduledUntil === undefined ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledUntil) ||
      Number.isNaN(Date.parse(`${scheduledUntil}:00Z`))
    ) {
      throw new Error("A range movement needs a valid end date and time");
    }
    if (scheduledUntil <= scheduledFor) {
      throw new Error("Range end time must be after its start time");
    }
  }

  return {
    title: normalizedTitle,
    scheduledFor,
    ...(timeKind === "range" ? { scheduledUntil } : {}),
    location: optionalText(location, 160),
    notes: optionalText(notes, 1000),
    ...(sectionId === undefined ? {} : { sectionId }),
    ...(timeKind === undefined ? {} : { timeKind }),
  };
}

async function requireEventMembership(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q) =>
      q.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();

  if (membership === null) {
    throw new Error("Forbidden");
  }

  return { identity, membership };
}

async function requireLocationRecord(
  ctx: MutationCtx,
  eventId: Id<"events">,
  recordId: Id<"eventRecords"> | undefined,
) {
  if (recordId === undefined) return undefined;
  const record = await ctx.db.get(recordId);
  if (
    record === null ||
    record.eventId !== eventId ||
    !(await isLocationRecord(ctx, record))
  ) {
    throw new Error("Location record not found");
  }
  return record;
}

function movementChangeSnapshot(existing: {
  title: string;
  scheduledFor: string;
  scheduledUntil?: string;
  location?: string;
  recordId?: Id<"eventRecords">;
}) {
  return {
    lastChangedTitle: existing.title,
    lastChangedScheduledFor: existing.scheduledFor,
    lastChangedScheduledUntil: existing.scheduledUntil,
    lastChangedLocation: existing.location,
    lastChangedRecordId: existing.recordId,
    lastChangedAt: Date.now(),
  };
}

/** Lists active movements in chronological event-local order. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);

    const items = await ctx.db
      .query("itineraryItems")
      .withIndex("by_eventId_scheduledFor", (q) => q.eq("eventId", eventId))
      .collect();

    return items.filter((item) => item.archivedAt === undefined);
  },
});

/** Lists archived movements for the event's recovery inventory. */
export const listArchived = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const items = await ctx.db
      .query("itineraryItems")
      .withIndex("by_eventId_scheduledFor", (q) => q.eq("eventId", eventId))
      .collect();
    return items.filter((item) => item.archivedAt !== undefined);
  },
});

/** Returns one movement after proving it belongs to the caller's event. */
export const get = query({
  args: { eventId: v.id("events"), itemId: v.id("itineraryItems") },
  handler: async (ctx, { eventId, itemId }) => {
    await requireEventMembership(ctx, eventId);
    const item = await ctx.db.get(itemId);
    if (item === null || item.eventId !== eventId) {
      throw new Error("Movement not found");
    }
    return item;
  },
});

/** Archives a movement without destroying it, so the caller can undo safely. */
export const archive = mutation({
  args: { itemId: v.id("itineraryItems"), eventId: v.id("events") },
  handler: async (ctx, { itemId, eventId }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(itemId);

    if (existing === null || existing.eventId !== eventId) {
      throw new Error("Movement not found");
    }

    if (existing.archivedAt === undefined) {
      await ctx.db.patch(itemId, {
        archivedAt: Date.now(),
        updatedAt: Date.now(),
      });
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "movement.archived",
        message: `Archived movement: ${existing.title}`,
        objectType: "movement",
        objectId: itemId,
        objectLabel: existing.title,
      });
    }
  },
});

/** Restores a movement previously archived in the same event. */
export const restore = mutation({
  args: { itemId: v.id("itineraryItems"), eventId: v.id("events") },
  handler: async (ctx, { itemId, eventId }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(itemId);

    if (existing === null || existing.eventId !== eventId) {
      throw new Error("Movement not found");
    }

    if (existing.archivedAt !== undefined) {
      await ctx.db.patch(itemId, {
        archivedAt: undefined,
        updatedAt: Date.now(),
      });
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "movement.restored",
        message: `Restored movement: ${existing.title}`,
        objectType: "movement",
        objectId: itemId,
        objectLabel: existing.title,
        href: `/events/${eventId}/plan/${itemId}`,
      });
    }
  },
});

/** Adds a movement; only event owners and managers can change the plan. */
export const create = mutation({
  args: itineraryArgs,
  handler: async (ctx, args) => {
    const { identity, membership } = await requireEventMembership(
      ctx,
      args.eventId,
    );
    requireRole(membership.role, ["owner", "manager"]);
    const item = validatedItineraryInput(args);
    const record = await requireLocationRecord(
      ctx,
      args.eventId,
      args.recordId,
    );
    const now = Date.now();

    const itemId = await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      // The record is canonical. This label deliberately snapshots the location
      // at authoring time, so renamed venues do not rewrite historic plans.
      location: item.location ?? record?.name,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "movement.created",
      message: `Created movement: ${item.title}`,
      objectType: "movement",
      objectId: itemId,
      objectLabel: item.title,
      href: `/events/${args.eventId}/plan/${itemId}`,
      createdAt: now,
    });
    return itemId;
  },
});

/**
 * Creates the location record and movement in one Convex transaction. A failed
 * movement write rolls back the record too, so this flow cannot leave an orphan
 * venue behind.
 */
export const createWithVenue = mutation({
  args: {
    ...itineraryArgs,
    venueName: v.string(),
    venueAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, membership } = await requireEventMembership(
      ctx,
      args.eventId,
    );
    requireRole(membership.role, ["owner", "manager"]);
    const item = validatedItineraryInput(args);
    const venue = validatedRecordInput({
      name: args.venueName,
      type: "venue",
      address: args.venueAddress,
    });
    const now = Date.now();
    const recordId = await ctx.db.insert("eventRecords", {
      eventId: args.eventId,
      ...venue,
      createdAt: now,
      updatedAt: now,
    });
    const itemId = await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId,
      location: item.location ?? venue.name,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "record.created",
      message: `Created and linked venue: ${venue.name}`,
      objectType: "record",
      objectId: recordId,
      objectLabel: venue.name,
      href: `/events/${args.eventId}/records/${recordId}`,
      createdAt: now,
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "movement.created",
      message: `Created movement: ${item.title}`,
      objectType: "movement",
      objectId: itemId,
      objectLabel: item.title,
      href: `/events/${args.eventId}/plan/${itemId}`,
      createdAt: now,
    });
    return itemId;
  },
});

/** Updates one movement after confirming it belongs to the selected event. */
export const update = mutation({
  args: { itemId: v.id("itineraryItems"), ...itineraryArgs },
  handler: async (ctx, args) => {
    const { identity, membership } = await requireEventMembership(
      ctx,
      args.eventId,
    );
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(args.itemId);

    if (existing === null || existing.eventId !== args.eventId) {
      throw new Error("Movement not found");
    }

    const record = await requireLocationRecord(
      ctx,
      args.eventId,
      args.recordId,
    );

    const item = validatedItineraryInput(args);
    await ctx.db.patch(args.itemId, {
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      location: item.location ?? record?.name,
      ...movementChangeSnapshot(existing),
      lastChangedNotes: existing.notes,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "movement.updated",
      message: `Updated movement: ${item.title}`,
      objectType: "movement",
      objectId: args.itemId,
      objectLabel: item.title,
      href: `/events/${args.eventId}/plan/${args.itemId}`,
    });
  },
});

export function normalizedVenueName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(st|str)\.?\b/g, "street")
    .replace(/\b(rd)\.?\b/g, "road")
    .replace(/\b(ave|av)\.?\b/g, "avenue")
    .replace(/\b(blvd)\.?\b/g, "boulevard")
    .replace(/\b(ctr)\.?\b/g, "center")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fuzzyVenueScore(left: string, right: string) {
  const leftTokens = new Set(
    normalizedVenueName(left).split(" ").filter(Boolean),
  );
  const rightTokens = new Set(
    normalizedVenueName(right).split(" ").filter(Boolean),
  );
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const shared = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return shared / new Set([...leftTokens, ...rightTokens]).size;
}

/** Lists unlinked movements with review-only exact and fuzzy venue suggestions. */
export const listUnlinked = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const [items, records] = await Promise.all([
      ctx.db
        .query("itineraryItems")
        .withIndex("by_eventId_scheduledFor", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventRecords")
        .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    const locations = [] as typeof records;
    for (const record of records) {
      if (await isLocationRecord(ctx, record)) locations.push(record);
    }
    return items
      .filter(
        (item) => item.archivedAt === undefined && item.recordId === undefined,
      )
      .map((item) => {
        const normalized = normalizedVenueName(item.location ?? "");
        const candidates = locations
          .map((record) => {
            const exact = normalizedVenueName(record.name) === normalized;
            const score = exact
              ? 1
              : fuzzyVenueScore(item.location ?? "", record.name);
            return {
              recordId: record._id,
              name: record.name,
              type: record.type,
              address: record.address,
              match: exact ? ("exact" as const) : ("fuzzy" as const),
              score,
            };
          })
          .filter((candidate) => candidate.score >= 0.5)
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        return {
          itemId: item._id,
          title: item.title,
          location: item.location,
          candidates,
        };
      });
  },
});

/** Applies only explicit human-approved venue links; it never auto-links matches. */
export const reconcileLinks = mutation({
  args: {
    eventId: v.id("events"),
    links: v.array(
      v.object({
        itemId: v.id("itineraryItems"),
        recordId: v.id("eventRecords"),
      }),
    ),
  },
  handler: async (ctx, { eventId, links }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    if (links.length === 0 || links.length > 100)
      throw new Error("Choose between 1 and 100 links to approve");
    if (new Set(links.map((link) => link.itemId)).size !== links.length)
      throw new Error("A movement can only be linked once per approval");
    const now = Date.now();
    for (const link of links) {
      const item = await ctx.db.get(link.itemId);
      if (
        item === null ||
        item.eventId !== eventId ||
        item.archivedAt !== undefined ||
        item.recordId !== undefined
      )
        throw new Error("Movement is no longer available for reconciliation");
      await requireLocationRecord(ctx, eventId, link.recordId);
      await ctx.db.patch(link.itemId, {
        recordId: link.recordId,
        ...movementChangeSnapshot(item),
        lastChangedNotes: item.notes,
        updatedAt: now,
      });
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "movement.updated",
        message: `Linked venue to movement: ${item.title}`,
        objectType: "movement",
        objectId: link.itemId,
        objectLabel: item.title,
        href: `/events/${eventId}/plan/${link.itemId}`,
        createdAt: now,
      });
    }
  },
});
