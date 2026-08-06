import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

/** Built-ins preserve the directory and plan semantics while teams add their own vocabulary. */
export const recordTypes = [
  "venue",
  "place",
  "service",
  "vehicle",
  "equipment",
  "organization",
  "person",
] as const;
const legacyRecordType = v.union(
  v.literal("venue"),
  v.literal("place"),
  v.literal("service"),
  v.literal("vehicle"),
  v.literal("equipment"),
  v.literal("organization"),
  v.literal("person"),
);

function optionalText(
  value: string | undefined,
  maximum: number,
  label = "Text",
) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return undefined;
  if (normalized.length > maximum)
    throw new Error(`${label} must be at most ${maximum} characters`);
  return normalized;
}

function requiredText(value: string, maximum: number, label: string) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum)
    throw new Error(`${label} must be between 1 and ${maximum} characters`);
  return normalized;
}

export function validatedRecordInput(input: {
  name: string;
  type: (typeof recordTypes)[number];
  address?: string;
  notes?: string;
}) {
  return {
    name: requiredText(input.name, 160, "Record name"),
    type: input.type,
    address: optionalText(input.address, 300),
    notes: optionalText(input.notes, 1000),
  };
}

async function membership(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  const identity = await requireIdentity(ctx);
  const member = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q) =>
      q.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (member === null) throw new Error("Forbidden");
  return { member, identity };
}
async function manager(ctx: MutationCtx, eventId: Id<"events">) {
  const result = await membership(ctx, eventId);
  requireRole(result.member.role, ["owner", "manager"]);
  return result;
}
async function recordInEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  recordId: Id<"eventRecords">,
) {
  const record = await ctx.db.get(recordId);
  if (record === null || record.eventId !== eventId)
    throw new Error("Record not found");
  return record;
}
async function typeInEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  typeId: Id<"eventRecordTypes">,
) {
  const type = await ctx.db.get(typeId);
  if (
    type === null ||
    type.eventId !== eventId ||
    type.archivedAt !== undefined
  )
    throw new Error("Record type not found");
  return type;
}
async function categoryInEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  categoryId: Id<"eventRecordCategories">,
) {
  const category = await ctx.db.get(categoryId);
  if (
    category === null ||
    category.eventId !== eventId ||
    category.archivedAt !== undefined
  )
    throw new Error("Category not found");
  return category;
}
export async function isLocationRecord(
  ctx: QueryCtx | MutationCtx,
  record: { type: string; recordTypeId?: Id<"eventRecordTypes"> },
) {
  if (record.recordTypeId === undefined)
    return ["venue", "place", "service"].includes(record.type);
  const type = await ctx.db.get(record.recordTypeId);
  return type?.isLocation === true;
}

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await membership(ctx, eventId);
    return await ctx.db
      .query("eventRecords")
      .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

export const get = query({
  args: { eventId: v.id("events"), recordId: v.id("eventRecords") },
  handler: async (ctx, args) => {
    await membership(ctx, args.eventId);
    const record = await recordInEvent(ctx, args.eventId, args.recordId);
    const [assignments, outgoing, incoming] = await Promise.all([
      ctx.db
        .query("eventRecordCategoryAssignments")
        .withIndex("by_eventId_recordId", (q) =>
          q.eq("eventId", args.eventId).eq("recordId", args.recordId),
        )
        .collect(),
      ctx.db
        .query("travelContexts")
        .withIndex("by_fromRecordId", (q) =>
          q.eq("fromRecordId", args.recordId),
        )
        .collect(),
      ctx.db
        .query("travelContexts")
        .withIndex("by_toRecordId", (q) => q.eq("toRecordId", args.recordId))
        .collect(),
    ]);
    const categories = (
      await Promise.all(assignments.map((a) => ctx.db.get(a.categoryId)))
    ).filter((c) => c !== null && c.archivedAt === undefined);
    return {
      ...record,
      categories,
      travelContexts: [...outgoing, ...incoming],
    };
  },
});

export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    type: legacyRecordType,
    recordTypeId: v.optional(v.id("eventRecordTypes")),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const input = validatedRecordInput(args);
    const configuredType =
      args.recordTypeId === undefined
        ? undefined
        : await typeInEvent(ctx, args.eventId, args.recordTypeId);
    const now = Date.now();
    return await ctx.db.insert("eventRecords", {
      eventId: args.eventId,
      ...input,
      ...(configuredType === undefined
        ? {}
        : { recordTypeId: configuredType._id, type: configuredType.name }),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    recordId: v.id("eventRecords"),
    eventId: v.id("events"),
    name: v.string(),
    type: legacyRecordType,
    recordTypeId: v.optional(v.id("eventRecordTypes")),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await recordInEvent(ctx, args.eventId, args.recordId);
    const input = validatedRecordInput(args);
    const configuredType =
      args.recordTypeId === undefined
        ? undefined
        : await typeInEvent(ctx, args.eventId, args.recordTypeId);
    await ctx.db.patch(args.recordId, {
      ...input,
      ...(configuredType === undefined
        ? { recordTypeId: undefined }
        : { recordTypeId: configuredType._id, type: configuredType.name }),
      updatedAt: Date.now(),
    });
  },
});

export const saveVenueDetails = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.id("eventRecords"),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accessNotes: v.optional(v.string()),
    hours: v.optional(v.string()),
    contactDetail: v.optional(v.string()),
    confirmationStatus: v.union(
      v.literal("unconfirmed"),
      v.literal("confirmed"),
    ),
    confirmationSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const record = await recordInEvent(ctx, args.eventId, args.recordId);
    if (!(await isLocationRecord(ctx, record)))
      throw new Error("Venue details require a location record");
    if (
      (args.latitude === undefined) !== (args.longitude === undefined) ||
      (args.latitude !== undefined &&
        (args.latitude < -90 ||
          args.latitude > 90 ||
          args.longitude! < -180 ||
          args.longitude! > 180))
    )
      throw new Error("Valid latitude and longitude are required together");
    await ctx.db.patch(args.recordId, {
      address: optionalText(args.address, 300),
      latitude: args.latitude,
      longitude: args.longitude,
      accessNotes: optionalText(args.accessNotes, 1000),
      hours: optionalText(args.hours, 240),
      contactDetail: optionalText(args.contactDetail, 300),
      confirmationStatus: args.confirmationStatus,
      confirmationSource: optionalText(args.confirmationSource, 500),
      verifiedAt: Date.now(),
      verifiedBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const listTypes = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await membership(ctx, args.eventId);
    return await ctx.db
      .query("eventRecordTypes")
      .withIndex("by_eventId_name", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});
export const createType = mutation({
  args: { eventId: v.id("events"), name: v.string(), isLocation: v.boolean() },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const now = Date.now();
    return await ctx.db.insert("eventRecordTypes", {
      eventId: args.eventId,
      name: requiredText(args.name, 80, "Type name"),
      isLocation: args.isLocation,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const archiveType = mutation({
  args: { eventId: v.id("events"), typeId: v.id("eventRecordTypes") },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await typeInEvent(ctx, args.eventId, args.typeId);
    await ctx.db.patch(args.typeId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listCategories = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await membership(ctx, args.eventId);
    return await ctx.db
      .query("eventRecordCategories")
      .withIndex("by_eventId_order", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});
export const createCategory = mutation({
  args: { eventId: v.id("events"), name: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const all = await ctx.db
      .query("eventRecordCategories")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
    const now = Date.now();
    return await ctx.db.insert("eventRecordCategories", {
      eventId: args.eventId,
      name: requiredText(args.name, 80, "Category name"),
      color: optionalText(args.color, 32) ?? "slate",
      order: all.length,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const assignCategory = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.id("eventRecords"),
    categoryId: v.id("eventRecordCategories"),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    await recordInEvent(ctx, args.eventId, args.recordId);
    await categoryInEvent(ctx, args.eventId, args.categoryId);
    const current = await ctx.db
      .query("eventRecordCategoryAssignments")
      .withIndex("by_eventId_recordId", (q) =>
        q.eq("eventId", args.eventId).eq("recordId", args.recordId),
      )
      .collect();
    if (!current.some((a) => a.categoryId === args.categoryId))
      await ctx.db.insert("eventRecordCategoryAssignments", {
        ...args,
        createdAt: Date.now(),
      });
  },
});
export const removeCategory = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.id("eventRecords"),
    categoryId: v.id("eventRecordCategories"),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const current = await ctx.db
      .query("eventRecordCategoryAssignments")
      .withIndex("by_eventId_recordId", (q) =>
        q.eq("eventId", args.eventId).eq("recordId", args.recordId),
      )
      .collect();
    const assignment = current.find((a) => a.categoryId === args.categoryId);
    if (assignment !== undefined) await ctx.db.delete(assignment._id);
  },
});
export const mergeCategory = mutation({
  args: {
    eventId: v.id("events"),
    sourceCategoryId: v.id("eventRecordCategories"),
    targetCategoryId: v.id("eventRecordCategories"),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    if (args.sourceCategoryId === args.targetCategoryId)
      throw new Error("Choose a different category");
    await categoryInEvent(ctx, args.eventId, args.sourceCategoryId);
    await categoryInEvent(ctx, args.eventId, args.targetCategoryId);
    const assignments = await ctx.db
      .query("eventRecordCategoryAssignments")
      .withIndex("by_categoryId", (q) =>
        q.eq("categoryId", args.sourceCategoryId),
      )
      .collect();
    for (const assignment of assignments)
      await ctx.db.patch(assignment._id, { categoryId: args.targetCategoryId });
    await ctx.db.patch(args.sourceCategoryId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listTravel = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await membership(ctx, args.eventId);
    return await ctx.db
      .query("travelContexts")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});
export const saveTravel = mutation({
  args: {
    eventId: v.id("events"),
    travelId: v.optional(v.id("travelContexts")),
    fromRecordId: v.id("eventRecords"),
    toRecordId: v.id("eventRecords"),
    estimate: v.string(),
    calculation: v.optional(v.string()),
    routeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    if (args.fromRecordId === args.toRecordId)
      throw new Error("Travel needs two different places");
    const [from, to] = await Promise.all([
      recordInEvent(ctx, args.eventId, args.fromRecordId),
      recordInEvent(ctx, args.eventId, args.toRecordId),
    ]);
    if (
      !(await isLocationRecord(ctx, from)) ||
      !(await isLocationRecord(ctx, to))
    )
      throw new Error("Travel context requires location records");
    const data = {
      fromRecordId: args.fromRecordId,
      toRecordId: args.toRecordId,
      estimate: requiredText(args.estimate, 120, "Estimate"),
      calculation: optionalText(args.calculation, 240),
      routeNote: optionalText(args.routeNote, 1000),
      updatedAt: Date.now(),
    };
    if (args.travelId === undefined)
      return await ctx.db.insert("travelContexts", {
        eventId: args.eventId,
        ...data,
        createdBy: identity.subject,
        createdAt: data.updatedAt,
      });
    const existing = await ctx.db.get(args.travelId);
    if (existing === null || existing.eventId !== args.eventId)
      throw new Error("Travel context not found");
    await ctx.db.patch(args.travelId, data);
  },
});
