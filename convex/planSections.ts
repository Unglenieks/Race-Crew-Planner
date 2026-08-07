import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

async function membership(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  const identity = await requireIdentity(ctx);
  const record = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (index) =>
      index.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();

  if (record === null) throw new Error("Forbidden");
  return record;
}

/** Lists sections for the selected event in their saved display order. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await membership(ctx, eventId);
    return await ctx.db
      .query("planSections")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect();
  },
});

/** Owners and managers add a plan section within their selected event. */
export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    kind: v.union(v.literal("day"), v.literal("session"), v.literal("leg")),
  },
  handler: async (ctx, { eventId, name, kind }) => {
    const record = await membership(ctx, eventId);
    requireRole(record.role, ["owner", "manager"]);
    const normalized = name.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw new Error("Section name must be between 1 and 120 characters");
    }
    const existing = await ctx.db
      .query("planSections")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect();

    return await ctx.db.insert("planSections", {
      eventId,
      name: normalized,
      kind,
      order: existing.length,
      createdAt: Date.now(),
    });
  },
});
