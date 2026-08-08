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
import { movementStructuredFields } from "./movements";
import {
  isCalendarDate,
  isValidEventLocalDateTime,
  normalize2400,
} from "./timeSemantics";

const itineraryArgs = {
  eventId: v.id("events"),
  title: v.string(),
  scheduledFor: v.string(),
  scheduledUntil: v.optional(v.string()),
  location: v.optional(v.string()),
  recordId: v.optional(v.id("eventRecords")),
  travelContextId: v.optional(v.id("travelContexts")),
  serviceIntervalId: v.optional(v.id("serviceIntervals")),
  notes: v.optional(v.string()),
  movementTypeId: v.optional(v.union(v.id("eventMovementTypes"), v.null())),
  sectionId: v.optional(v.id("planSections")),
  operationalDay: v.optional(v.string()),
  displayTime: v.optional(v.union(v.literal("standard"), v.literal("2400"))),
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
  operationalDay?: string;
  displayTime?: "standard" | "2400";
  travelContextId?: Id<"travelContexts">;
  serviceIntervalId?: Id<"serviceIntervals">;
  timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
  movementTypeId?: Id<"eventMovementTypes"> | null;
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
export function validatedItineraryInput(
  {
    title,
    scheduledFor,
    scheduledUntil,
    location,
    notes,
    sectionId,
    operationalDay,
    displayTime,
    timeKind,
    movementTypeId,
    travelContextId,
    serviceIntervalId,
  }: ItineraryInput,
  timeZone = "UTC",
) {
  const normalizedTitle = title.trim();

  if (normalizedTitle.length === 0 || normalizedTitle.length > 160) {
    throw new Error(
      "Movement description must be between 1 and 160 characters",
    );
  }

  const normalizedScheduledFor = normalize2400(scheduledFor, displayTime);
  if (
    (timeKind ?? "exact") !== "unspecified" &&
    !isValidEventLocalDateTime(normalizedScheduledFor, timeZone)
  ) {
    throw new Error("A valid planned date and time is required");
  }
  if (operationalDay !== undefined && !isCalendarDate(operationalDay)) {
    throw new Error("Operational day must be a valid calendar date");
  }
  if (
    displayTime === "2400" &&
    (operationalDay === undefined ||
      normalizedScheduledFor !==
        normalize2400(`${operationalDay}T24:00`, "2400"))
  ) {
    throw new Error("2400 must be assigned to an operational day and midnight");
  }

  if (timeKind === "range") {
    if (
      scheduledUntil === undefined ||
      !isValidEventLocalDateTime(scheduledUntil, timeZone)
    ) {
      throw new Error("A range movement needs a valid end date and time");
    }
    if (scheduledUntil <= normalizedScheduledFor) {
      throw new Error("Range end time must be after its start time");
    }
  }

  return {
    title: normalizedTitle,
    scheduledFor: normalizedScheduledFor,
    ...(timeKind === "range" ? { scheduledUntil } : {}),
    location: optionalText(location, 160),
    notes: optionalText(notes, 1000),
    ...(sectionId === undefined ? {} : { sectionId }),
    ...(operationalDay === undefined ? {} : { operationalDay }),
    ...(displayTime === undefined ? {} : { displayTime }),
    ...(travelContextId === undefined ? {} : { travelContextId }),
    ...(serviceIntervalId === undefined ? {} : { serviceIntervalId }),
    ...(timeKind === undefined ? {} : { timeKind }),
    ...(movementTypeId === undefined ? {} : { movementTypeId }),
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

async function requireMovementType(
  ctx: MutationCtx,
  eventId: Id<"events">,
  movementTypeId: Id<"eventMovementTypes"> | null | undefined,
) {
  if (movementTypeId === undefined || movementTypeId === null) return;
  const type = await ctx.db.get(movementTypeId);
  if (
    type === null ||
    type.eventId !== eventId ||
    type.archivedAt !== undefined
  ) {
    throw new Error("Movement type not found");
  }
}

async function requireEventTimeZone(ctx: MutationCtx, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (event === null || event.archivedAt !== undefined)
    throw new Error("Event not found");
  return event.timeZone;
}

async function requireSection(
  ctx: MutationCtx,
  eventId: Id<"events">,
  sectionId: Id<"planSections"> | undefined,
) {
  if (sectionId === undefined) return;
  const section = await ctx.db.get(sectionId);
  if (section === null || section.eventId !== eventId) {
    throw new Error("Operational section not found");
  }
}
async function requireLogisticsReferences(
  ctx: MutationCtx,
  eventId: Id<"events">,
  travelContextId: Id<"travelContexts"> | undefined,
  serviceIntervalId: Id<"serviceIntervals"> | undefined,
) {
  if (travelContextId !== undefined) {
    const travel = await ctx.db.get(travelContextId);
    if (travel === null || travel.eventId !== eventId)
      throw new Error("Travel context not found");
  }
  if (serviceIntervalId !== undefined) {
    const service = await ctx.db.get(serviceIntervalId);
    if (service === null || service.eventId !== eventId)
      throw new Error("Service interval not found");
  }
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

    return await Promise.all(
      items
        .filter((item) => item.archivedAt === undefined)
        .map(async (item) => ({
          ...item,
          ...(await movementStructuredFields(ctx, item)),
        })),
    );
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
    return await Promise.all(
      items
        .filter((item) => item.archivedAt !== undefined)
        .map(async (item) => ({
          ...item,
          ...(await movementStructuredFields(ctx, item)),
        })),
    );
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
    return { ...item, ...(await movementStructuredFields(ctx, item)) };
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
    const timeZone = await requireEventTimeZone(ctx, args.eventId);
    const item = validatedItineraryInput(args, timeZone);
    const record = await requireLocationRecord(
      ctx,
      args.eventId,
      args.recordId,
    );
    await requireMovementType(ctx, args.eventId, args.movementTypeId);
    await requireSection(ctx, args.eventId, args.sectionId);
    await requireLogisticsReferences(
      ctx,
      args.eventId,
      args.travelContextId,
      args.serviceIntervalId,
    );
    const now = Date.now();

    const itemId = await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      movementTypeId: item.movementTypeId ?? undefined,
      // The record is canonical. This label deliberately snapshots the location
      // at authoring time, so renamed venues do not rewrite historic plans.
      location: item.location ?? record?.name,
      travelContextId: args.travelContextId,
      serviceIntervalId: args.serviceIntervalId,
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
    const timeZone = await requireEventTimeZone(ctx, args.eventId);
    const item = validatedItineraryInput(args, timeZone);
    await requireMovementType(ctx, args.eventId, args.movementTypeId);
    await requireSection(ctx, args.eventId, args.sectionId);
    await requireLogisticsReferences(
      ctx,
      args.eventId,
      args.travelContextId,
      args.serviceIntervalId,
    );
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
      movementTypeId: item.movementTypeId ?? undefined,
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

/** Creates a reviewed set of structured movements in one authorized operation. */
export const createMany = mutation({
  args: {
    eventId: v.id("events"),
    items: v.array(
      v.object({
        ...itineraryArgs,
        tagIds: v.array(v.id("eventMovementTags")),
        teamId: v.optional(v.id("eventTeams")),
      }),
    ),
  },
  handler: async (ctx, { eventId, items }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    if (items.length === 0 || items.length > 100)
      throw new Error("Add between 1 and 100 movements at a time");
    if (items.some((item) => item.eventId !== eventId))
      throw new Error("All staged movements must belong to the selected event");

    const timeZone = await requireEventTimeZone(ctx, eventId);
    const now = Date.now();
    const ids: Id<"itineraryItems">[] = [];
    for (const raw of items) {
      const item = validatedItineraryInput(raw, timeZone);
      const record = await requireLocationRecord(ctx, eventId, raw.recordId);
      await requireMovementType(ctx, eventId, raw.movementTypeId);
      await requireSection(ctx, eventId, raw.sectionId);
      await requireLogisticsReferences(
        ctx,
        eventId,
        raw.travelContextId,
        raw.serviceIntervalId,
      );
      const uniqueTagIds = [...new Set(raw.tagIds)];
      const tags = await Promise.all(
        uniqueTagIds.map((tagId) => ctx.db.get(tagId)),
      );
      if (
        tags.some(
          (tag) =>
            tag === null ||
            tag.eventId !== eventId ||
            tag.archivedAt !== undefined,
        )
      )
        throw new Error("Movement tag not found");
      const team =
        raw.teamId === undefined ? undefined : await ctx.db.get(raw.teamId);
      if (
        raw.teamId !== undefined &&
        (team === null ||
          team?.eventId !== eventId ||
          team.archivedAt !== undefined)
      )
        throw new Error("Assigned team not found");

      const itemId = await ctx.db.insert("itineraryItems", {
        eventId,
        ...item,
        scheduledUntil:
          item.timeKind === "range" ? item.scheduledUntil : undefined,
        recordId: raw.recordId,
        location: item.location ?? record?.name,
        movementTypeId: item.movementTypeId ?? undefined,
        travelContextId: raw.travelContextId,
        serviceIntervalId: raw.serviceIntervalId,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(itemId);
      for (const tagId of uniqueTagIds)
        await ctx.db.insert("movementTagAssignments", {
          eventId,
          itineraryItemId: itemId,
          tagId,
          createdAt: now,
        });
      if (team !== undefined && team !== null)
        await ctx.db.insert("movementAssignments", {
          eventId,
          itineraryItemId: itemId,
          targetKind: "team",
          teamId: team._id,
          label: team.name,
          createdAt: now,
        });
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "movement.created",
        message: `Created movement: ${item.title}`,
        objectType: "movement",
        objectId: itemId,
        objectLabel: item.title,
        href: `/events/${eventId}/plan/${itemId}`,
        createdAt: now,
      });
    }
    return ids;
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
    await requireMovementType(ctx, args.eventId, args.movementTypeId);
    await requireLogisticsReferences(
      ctx,
      args.eventId,
      args.travelContextId,
      args.serviceIntervalId,
    );

    const timeZone = await requireEventTimeZone(ctx, args.eventId);
    const item = validatedItineraryInput(args, timeZone);
    await requireSection(ctx, args.eventId, args.sectionId);
    const previousStructured = await movementStructuredFields(ctx, existing);
    await ctx.db.patch(args.itemId, {
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      movementTypeId: item.movementTypeId ?? undefined,
      location: item.location ?? record?.name,
      ...movementChangeSnapshot(existing),
      travelContextId: args.travelContextId,
      serviceIntervalId: args.serviceIntervalId,
      lastChangedNotes: existing.notes,
      lastChangedMovementTypeLabel: previousStructured.movementTypeLabel,
      lastChangedTagLabels: previousStructured.tags.map((tag) => tag.name),
      lastChangedAssignmentLabels: previousStructured.assignments.map(
        (assignment) => assignment.label,
      ),
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
