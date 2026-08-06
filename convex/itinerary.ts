import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const itineraryArgs = {
  eventId: v.id("events"),
  title: v.string(),
  scheduledFor: v.string(),
  location: v.optional(v.string()),
  notes: v.optional(v.string()),
};

type ItineraryInput = {
  title: string;
  scheduledFor: string;
  location?: string;
  notes?: string;
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
}: ItineraryInput) {
  const normalizedTitle = title.trim();

  if (normalizedTitle.length === 0 || normalizedTitle.length > 160) {
    throw new Error(
      "Movement description must be between 1 and 160 characters",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledFor) ||
    Number.isNaN(Date.parse(`${scheduledFor}:00Z`))
  ) {
    throw new Error("A valid planned date and time is required");
  }

  return {
    title: normalizedTitle,
    scheduledFor,
    location: optionalText(location, 160),
    notes: optionalText(notes, 1000),
  };
}

async function requireEventMembership(ctx: any, eventId: any) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q: any) =>
      q.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();

  if (membership === null) {
    throw new Error("Forbidden");
  }

  return membership;
}

/** Lists the protected itinerary in chronological event-local order. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);

    return await ctx.db
      .query("itineraryItems")
      .withIndex("by_eventId_scheduledFor", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

/** Adds a movement; only event owners and managers can change the plan. */
export const create = mutation({
  args: itineraryArgs,
  handler: async (ctx, args) => {
    const membership = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const item = validatedItineraryInput(args);
    const now = Date.now();

    return await ctx.db.insert("itineraryItems", {
      eventId: args.eventId,
      ...item,
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

    await ctx.db.patch(args.itemId, {
      ...validatedItineraryInput(args),
      updatedAt: Date.now(),
    });
  },
});
