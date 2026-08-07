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

const itineraryArgs = {
  eventId: v.id("events"),
  title: v.string(),
  scheduledFor: v.string(),
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

  return {
    title: normalizedTitle,
    scheduledFor,
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

  return membership;
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
    const membership = await requireEventMembership(ctx, eventId);
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
    }
  },
});

/** Restores a movement previously archived in the same event. */
export const restore = mutation({
  args: { itemId: v.id("itineraryItems"), eventId: v.id("events") },
  handler: async (ctx, { itemId, eventId }) => {
    const membership = await requireEventMembership(ctx, eventId);
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
    }
  },
});

/** Adds a movement; only event owners and managers can change the plan. */
export const create = mutation({
  args: itineraryArgs,
  handler: async (ctx, args) => {
    const membership = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const item = validatedItineraryInput(args);
    await requireLocationRecord(ctx, args.eventId, args.recordId);
    const now = Date.now();

    return await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
      recordId: args.recordId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Updates one movement after confirming it belongs to the selected event. */
export const update = mutation({
  args: { itemId: v.id("itineraryItems"), ...itineraryArgs },
  handler: async (ctx, args) => {
    const membership = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(args.itemId);

    if (existing === null || existing.eventId !== args.eventId) {
      throw new Error("Movement not found");
    }

    await requireLocationRecord(ctx, args.eventId, args.recordId);

    await ctx.db.patch(args.itemId, {
      ...validatedItineraryInput(args),
      recordId: args.recordId,
      updatedAt: Date.now(),
    });
  },
});
