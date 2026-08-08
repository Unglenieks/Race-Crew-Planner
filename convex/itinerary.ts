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
import { writeAudit } from "./audit";
import { movementStructuredFields } from "./movements";

const itineraryArgs = {
  eventId: v.id("events"),
  title: v.string(),
  scheduledFor: v.string(),
  scheduledUntil: v.optional(v.string()),
  location: v.optional(v.string()),
  recordId: v.optional(v.id("eventRecords")),
  notes: v.optional(v.string()),
  movementTypeId: v.optional(v.union(v.id("eventMovementTypes"), v.null())),
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
export function validatedItineraryInput({
  title,
  scheduledFor,
  scheduledUntil,
  location,
  notes,
  sectionId,
  timeKind,
  movementTypeId,
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
  if (recordId === undefined) return;
  const record = await ctx.db.get(recordId);
  if (
    record === null ||
    record.eventId !== eventId ||
    !(await isLocationRecord(ctx, record))
  ) {
    throw new Error("Location record not found");
  }
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
    const item = validatedItineraryInput(args);
    await requireLocationRecord(ctx, args.eventId, args.recordId);
    await requireMovementType(ctx, args.eventId, args.movementTypeId);
    const now = Date.now();

    const itemId = await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      movementTypeId: item.movementTypeId ?? undefined,
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

    await requireLocationRecord(ctx, args.eventId, args.recordId);
    await requireMovementType(ctx, args.eventId, args.movementTypeId);

    const item = validatedItineraryInput(args);
    const previousStructured = await movementStructuredFields(ctx, existing);
    await ctx.db.patch(args.itemId, {
      ...item,
      scheduledUntil:
        item.timeKind === "range" ? item.scheduledUntil : undefined,
      recordId: args.recordId,
      movementTypeId: item.movementTypeId ?? undefined,
      lastChangedTitle: existing.title,
      lastChangedScheduledFor: existing.scheduledFor,
      lastChangedScheduledUntil: existing.scheduledUntil,
      lastChangedLocation: existing.location,
      lastChangedNotes: existing.notes,
      lastChangedMovementTypeLabel: previousStructured.movementTypeLabel,
      lastChangedTagLabels: previousStructured.tags.map((tag) => tag.name),
      lastChangedAssignmentLabels: previousStructured.assignments.map(
        (assignment) => assignment.label,
      ),
      lastChangedAt: Date.now(),
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
