import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { isBoundaryTime, isCalendarDate } from "./timeSemantics";

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
    operationalDate: v.optional(v.string()),
    boundaryTime: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { eventId, name, kind, operationalDate, boundaryTime },
  ) => {
    const record = await membership(ctx, eventId);
    requireRole(record.role, ["owner", "manager"]);
    const normalized = name.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw new Error("Section name must be between 1 and 120 characters");
    }
    if (operationalDate !== undefined && !isCalendarDate(operationalDate)) {
      throw new Error("Operational date must be a valid calendar date");
    }
    if (boundaryTime !== undefined && !isBoundaryTime(boundaryTime)) {
      throw new Error("Boundary time must use 24-hour HH:MM format");
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
      operationalDate,
      boundaryTime,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Edits an operational day, leg, or session without changing its position. */
export const update = mutation({
  args: {
    eventId: v.id("events"),
    sectionId: v.id("planSections"),
    name: v.string(),
    kind: v.union(v.literal("day"), v.literal("session"), v.literal("leg")),
    operationalDate: v.optional(v.string()),
    boundaryTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await membership(ctx, args.eventId);
    requireRole(record.role, ["owner", "manager"]);
    const section = await ctx.db.get(args.sectionId);
    if (section === null || section.eventId !== args.eventId) {
      throw new Error("Operational section not found");
    }
    const name = args.name.trim();
    if (name.length === 0 || name.length > 120) {
      throw new Error("Section name must be between 1 and 120 characters");
    }
    if (
      args.operationalDate !== undefined &&
      !isCalendarDate(args.operationalDate)
    ) {
      throw new Error("Operational date must be a valid calendar date");
    }
    if (args.boundaryTime !== undefined && !isBoundaryTime(args.boundaryTime)) {
      throw new Error("Boundary time must use 24-hour HH:MM format");
    }
    await ctx.db.patch(args.sectionId, {
      name,
      kind: args.kind,
      operationalDate: args.operationalDate,
      boundaryTime: args.boundaryTime,
      updatedAt: Date.now(),
    });
  },
});

/** Replaces the display order after proving every id belongs to this event. */
export const reorder = mutation({
  args: { eventId: v.id("events"), sectionIds: v.array(v.id("planSections")) },
  handler: async (ctx, { eventId, sectionIds }) => {
    const record = await membership(ctx, eventId);
    requireRole(record.role, ["owner", "manager"]);
    const sections = await ctx.db
      .query("planSections")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect();
    if (
      sectionIds.length !== sections.length ||
      new Set(sectionIds.map(String)).size !== sectionIds.length ||
      sections.some(
        (section) => !sectionIds.map(String).includes(String(section._id)),
      )
    ) {
      throw new Error(
        "Operational section order must include every section exactly once",
      );
    }
    await Promise.all(
      sectionIds.map((sectionId, order) =>
        ctx.db.patch(sectionId, { order, updatedAt: Date.now() }),
      ),
    );
  },
});
