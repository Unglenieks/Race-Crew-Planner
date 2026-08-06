import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

export const recordTypes = [
  "venue",
  "place",
  "service",
  "vehicle",
  "equipment",
  "organization",
  "person",
] as const;

const recordType = v.union(
  v.literal("venue"),
  v.literal("place"),
  v.literal("service"),
  v.literal("vehicle"),
  v.literal("equipment"),
  v.literal("organization"),
  v.literal("person"),
);

const recordArgs = {
  eventId: v.id("events"),
  name: v.string(),
  type: recordType,
  address: v.optional(v.string()),
  notes: v.optional(v.string()),
};

type RecordInput = {
  name: string;
  type: (typeof recordTypes)[number];
  address?: string;
  notes?: string;
};

function optionalText(value: string | undefined, maximum: number) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return undefined;
  if (normalized.length > maximum) {
    throw new Error(`Text must be at most ${maximum} characters`);
  }
  return normalized;
}

/** Validates a small, event-owned operational record without imposing custom fields. */
export function validatedRecordInput({
  name,
  type,
  address,
  notes,
}: RecordInput) {
  const normalizedName = name.trim();
  if (normalizedName.length === 0 || normalizedName.length > 160) {
    throw new Error("Record name must be between 1 and 160 characters");
  }

  return {
    name: normalizedName,
    type,
    address: optionalText(address, 300),
    notes: optionalText(notes, 1000),
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
  if (membership === null) throw new Error("Forbidden");
  return membership;
}

/** Lists records only after checking the caller belongs to the selected event. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    return await ctx.db
      .query("eventRecords")
      .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

/** Owners and managers create operational records for their event. */
export const create = mutation({
  args: recordArgs,
  handler: async (ctx, args) => {
    const membership = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const now = Date.now();
    return await ctx.db.insert("eventRecords", {
      eventId: args.eventId,
      ...validatedRecordInput(args),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Owners and managers can update only records belonging to their event. */
export const update = mutation({
  args: { recordId: v.id("eventRecords"), ...recordArgs },
  handler: async (ctx, args) => {
    const membership = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(args.recordId);
    if (existing === null || existing.eventId !== args.eventId) {
      throw new Error("Record not found");
    }

    await ctx.db.patch(args.recordId, {
      ...validatedRecordInput(args),
      updatedAt: Date.now(),
    });
  },
});
