import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity } from "./auth";
import { movementStructuredFields } from "./movements";

type ExportItem = {
  itineraryItemId: Id<"itineraryItems">;
  title: string;
  scheduledFor: string;
  location?: string;
  movementTypeLabel?: string;
  tagLabels?: string[];
  assignmentLabels?: string[];
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

async function itemSnapshot(
  ctx: QueryCtx | MutationCtx,
  item: {
    _id: Id<"itineraryItems">;
    title: string;
    scheduledFor: string;
    location?: string;
    movementTypeId?: Id<"eventMovementTypes">;
  },
): Promise<ExportItem> {
  const structured = await movementStructuredFields(ctx, item);
  return {
    itineraryItemId: item._id,
    title: item.title,
    scheduledFor: item.scheduledFor,
    location: item.location,
    movementTypeLabel: structured.movementTypeLabel,
    tagLabels: structured.tags.map((tag) => tag.name),
    assignmentLabels: structured.assignments.map(
      (assignment) => assignment.label,
    ),
  };
}

function sameItems(left: ExportItem[], right: ExportItem[]) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.itineraryItemId === right[index]?.itineraryItemId &&
        item.title === right[index]?.title &&
        item.scheduledFor === right[index]?.scheduledFor &&
        item.location === right[index]?.location &&
        item.movementTypeLabel === right[index]?.movementTypeLabel &&
        JSON.stringify(item.tagLabels ?? []) ===
          JSON.stringify(right[index]?.tagLabels ?? []) &&
        JSON.stringify(item.assignmentLabels ?? []) ===
          JSON.stringify(right[index]?.assignmentLabels ?? []),
    )
  );
}

async function currentItems(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  filterDay: string | undefined,
) {
  const items = await ctx.db
    .query("itineraryItems")
    .withIndex("by_eventId_scheduledFor", (index) =>
      index.eq("eventId", eventId),
    )
    .collect();
  const snapshots = items
    .filter(
      (item) =>
        item.archivedAt === undefined &&
        (filterDay === undefined || item.scheduledFor.startsWith(filterDay)),
    )
    .map((item) => itemSnapshot(ctx, item));
  return await Promise.all(snapshots);
}

/** Saves the exact active-plan snapshot that a member is about to download. */
export const create = mutation({
  args: { eventId: v.id("events"), filterDay: v.optional(v.string()) },
  handler: async (ctx, { eventId, filterDay: rawFilterDay }) => {
    const identity = await requireEventMembership(ctx, eventId);
    const filterDay = validatedFilterDay(rawFilterDay);
    const event = await ctx.db.get(eventId);
    if (event === null || event.archivedAt !== undefined) {
      throw new Error("Event not found");
    }
    const items = await currentItems(ctx, eventId, filterDay);
    const generatedAt = Date.now();
    const exportId = await ctx.db.insert("planExports", {
      eventId,
      filterDay,
      timeZone: event.timeZone,
      items,
      generatedAt,
      generatedBy: identity.subject,
    });
    return {
      _id: exportId,
      filterDay,
      timeZone: event.timeZone,
      items,
      generatedAt,
    };
  },
});

/** Lists prior export snapshots and truthfully marks those the plan has replaced. */
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
      exports.reverse().map(async (record) => ({
        ...record,
        isSuperseded: !sameItems(
          record.items,
          await currentItems(ctx, eventId, record.filterDay),
        ),
      })),
    );
  },
});

export { sameItems, validatedFilterDay };
