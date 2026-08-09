import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { writeAudit } from "./audit";

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
export const recordFieldTypes = ["text", "select"] as const;
const recordFieldType = v.union(v.literal("text"), v.literal("select"));
const supportCategory = v.union(
  v.literal("fuel"),
  v.literal("grocery"),
  v.literal("parts"),
  v.literal("tire"),
  v.literal("medical"),
  v.literal("towing"),
  v.literal("other"),
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
function normalizedSupportCategories(
  categories:
    | Array<
        "fuel" | "grocery" | "parts" | "tire" | "medical" | "towing" | "other"
      >
    | undefined,
) {
  return categories === undefined ? undefined : [...new Set(categories)];
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

function fieldKey(label: string) {
  const key = label
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (key.length === 0 || key.length > 48)
    throw new Error("Field label must contain letters or numbers");
  return key;
}

function validatedFieldOptions(
  type: (typeof recordFieldTypes)[number],
  options?: string[],
) {
  if (type === "text") return undefined;
  const normalized = [
    ...new Set((options ?? []).map((option) => option.trim())),
  ].filter(Boolean);
  if (normalized.length === 0 || normalized.length > 20)
    throw new Error("A select field needs between 1 and 20 options");
  if (normalized.some((option) => option.length > 80))
    throw new Error("Field options must be at most 80 characters");
  return normalized;
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
/**
 * Resolves a record type for *new* assignments, which must be active.
 *
 * Use `assignableTypeInEvent` when re-saving a record that already points at the
 * type, so archiving a type never locks its existing records out of editing.
 */
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

/**
 * Like `typeInEvent`, but tolerates an archived type when the record is already
 * using it. Archiving is a vocabulary decision about *future* records; it must
 * not turn every record that already carries the type into an unsaveable row.
 */
async function assignableTypeInEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  typeId: Id<"eventRecordTypes">,
  currentTypeId: Id<"eventRecordTypes"> | undefined,
) {
  if (typeId === currentTypeId) {
    const type = await ctx.db.get(typeId);
    if (type === null || type.eventId !== eventId)
      throw new Error("Record type not found");
    return type;
  }
  return await typeInEvent(ctx, eventId, typeId);
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

/**
 * Works out the coordinates to store, treating an omitted value as "leave alone"
 * and an explicit `null` as "clear". Latitude and longitude are validated as a
 * pair because half a coordinate is not a location.
 */
export function resolvedCoordinates(
  args: { latitude?: number | null; longitude?: number | null },
  existing: { latitude?: number; longitude?: number },
): { latitude: number | undefined; longitude: number | undefined } {
  const latitude =
    args.latitude === undefined
      ? existing.latitude
      : (args.latitude ?? undefined);
  const longitude =
    args.longitude === undefined
      ? existing.longitude
      : (args.longitude ?? undefined);

  if ((latitude === undefined) !== (longitude === undefined))
    throw new Error("Valid latitude and longitude are required together");
  if (
    latitude !== undefined &&
    longitude !== undefined &&
    (!Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180)
  )
    throw new Error("Valid latitude and longitude are required together");

  return { latitude, longitude };
}

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { member } = await membership(ctx, eventId);
    if (member.role === "spectator") throw new Error("Forbidden");
    return await ctx.db
      .query("eventRecords")
      .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

/**
 * Map-safe location projection. Spectators receive only locations their crew
 * chief explicitly marked visible; crew keep the full event location set.
 */
export const listMapLocations = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { member } = await membership(ctx, eventId);
    const records = await ctx.db
      .query("eventRecords")
      .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
      .collect();
    const locations = await Promise.all(
      records.map(async (record) =>
        (await isLocationRecord(ctx, record)) ? record : null,
      ),
    );
    return locations
      .filter((record): record is NonNullable<typeof record> => record !== null)
      .filter(
        (record) =>
          member.role !== "spectator" || record.spectatorVisible === true,
      )
      .map((record) => ({
        _id: record._id,
        name: record.name,
        type: record.type,
        address: record.address,
        notes: record.notes,
        accessNotes: record.accessNotes,
        hours: record.hours,
        latitude: record.latitude,
        longitude: record.longitude,
        supportCategories: record.supportCategories ?? [],
        kind:
          (record.supportCategories?.length ?? 0) > 0
            ? ("support" as const)
            : ("venue" as const),
        spectatorVisible: record.spectatorVisible === true,
      }));
  },
});

export const listFields = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await membership(ctx, args.eventId);
    return await ctx.db
      .query("eventRecordFields")
      .withIndex("by_eventId_order", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

async function validatedFieldValues(
  ctx: MutationCtx,
  eventId: Id<"events">,
  values: Record<string, string> | undefined,
) {
  const fields = await ctx.db
    .query("eventRecordFields")
    .withIndex("by_eventId_order", (q) => q.eq("eventId", eventId))
    .collect();
  const normalized: Record<string, string> = {};
  for (const field of fields) {
    const value = values?.[field.key]?.trim();
    if (value === undefined || value.length === 0) continue;
    if (value.length > 500) throw new Error(`${field.label} is too long`);
    if (field.type === "select" && !field.options?.includes(value))
      throw new Error(`${field.label} must use one of its configured options`);
    normalized[field.key] = value;
  }
  return Object.keys(normalized).length === 0 ? undefined : normalized;
}

export const createField = mutation({
  args: {
    eventId: v.id("events"),
    label: v.string(),
    type: recordFieldType,
    options: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const label = requiredText(args.label, 80, "Field label");
    const key = fieldKey(label);
    const existing = await ctx.db
      .query("eventRecordFields")
      .withIndex("by_eventId_key", (q) =>
        q.eq("eventId", args.eventId).eq("key", key),
      )
      .unique();
    if (existing !== null)
      throw new Error("A field with this name already exists");
    const fields = await ctx.db
      .query("eventRecordFields")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
    const now = Date.now();
    return await ctx.db.insert("eventRecordFields", {
      eventId: args.eventId,
      key,
      label,
      type: args.type,
      options: validatedFieldOptions(args.type, args.options),
      order: fields.length,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateField = mutation({
  args: {
    eventId: v.id("events"),
    fieldId: v.id("eventRecordFields"),
    label: v.string(),
    options: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const field = await ctx.db.get(args.fieldId);
    if (field === null || field.eventId !== args.eventId)
      throw new Error("Field not found");
    await ctx.db.patch(args.fieldId, {
      label: requiredText(args.label, 80, "Field label"),
      options: validatedFieldOptions(field.type, args.options),
      updatedAt: Date.now(),
    });
  },
});

export const reorderFields = mutation({
  args: {
    eventId: v.id("events"),
    fieldIds: v.array(v.id("eventRecordFields")),
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const fields = await ctx.db
      .query("eventRecordFields")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
    if (
      args.fieldIds.length !== fields.length ||
      new Set(args.fieldIds).size !== fields.length ||
      args.fieldIds.some((id) => !fields.some((field) => field._id === id))
    )
      throw new Error("Field order must include every field exactly once");
    await Promise.all(
      args.fieldIds.map((fieldId, order) =>
        ctx.db.patch(fieldId, { order, updatedAt: Date.now() }),
      ),
    );
  },
});

export const get = query({
  args: { eventId: v.id("events"), recordId: v.id("eventRecords") },
  handler: async (ctx, args) => {
    const { member } = await membership(ctx, args.eventId);
    if (member.role === "spectator") throw new Error("Forbidden");
    const record = await recordInEvent(ctx, args.eventId, args.recordId);
    const [assignments, fields] = await Promise.all([
      ctx.db
        .query("eventRecordCategoryAssignments")
        .withIndex("by_eventId_recordId", (q) =>
          q.eq("eventId", args.eventId).eq("recordId", args.recordId),
        )
        .collect(),
      ctx.db
        .query("eventRecordFields")
        .withIndex("by_eventId_order", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);
    const categories = (
      await Promise.all(assignments.map((a) => ctx.db.get(a.categoryId)))
    ).filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.archivedAt === undefined,
    );
    // Defensive de-duplication: a record must never show the same category twice
    // even if historic assignment rows duplicated it.
    const uniqueCategories = [
      ...new Map(categories.map((c) => [c._id, c])).values(),
    ];
    return {
      ...record,
      categories: uniqueCategories,
      fields,
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
    fieldValues: v.optional(v.record(v.string(), v.string())),
    supportCategories: v.optional(v.array(supportCategory)),
    spectatorVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const input = validatedRecordInput(args);
    const fieldValues =
      args.fieldValues === undefined
        ? undefined
        : await validatedFieldValues(ctx, args.eventId, args.fieldValues);
    const configuredType =
      args.recordTypeId === undefined
        ? undefined
        : await typeInEvent(ctx, args.eventId, args.recordTypeId);
    const now = Date.now();
    const recordId = await ctx.db.insert("eventRecords", {
      eventId: args.eventId,
      ...input,
      ...(configuredType === undefined
        ? {}
        : { recordTypeId: configuredType._id, type: configuredType.name }),
      ...(fieldValues === undefined ? {} : { fieldValues }),
      ...(args.supportCategories === undefined
        ? {}
        : {
            supportCategories: normalizedSupportCategories(
              args.supportCategories,
            ),
          }),
      ...(args.spectatorVisible === undefined
        ? {}
        : { spectatorVisible: args.spectatorVisible }),
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "record.created",
      message: `Created record: ${input.name}`,
      objectType: "record",
      objectId: recordId,
      objectLabel: input.name,
      href: `/events/${args.eventId}/records/${recordId}`,
      createdAt: now,
    });
    return recordId;
  },
});

export const update = mutation({
  args: {
    recordId: v.id("eventRecords"),
    eventId: v.id("events"),
    name: v.string(),
    type: legacyRecordType,
    /**
     * Absent leaves the configured type untouched; explicit `null` clears it and
     * falls back to the built-in `type`. Without this distinction any caller that
     * simply omitted the field silently stripped a record's team-defined type.
     */
    recordTypeId: v.optional(v.union(v.id("eventRecordTypes"), v.null())),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    fieldValues: v.optional(v.record(v.string(), v.string())),
    supportCategories: v.optional(v.array(supportCategory)),
    spectatorVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const existing = await recordInEvent(ctx, args.eventId, args.recordId);
    const input = validatedRecordInput(args);
    const fieldValues =
      args.fieldValues === undefined
        ? undefined
        : await validatedFieldValues(ctx, args.eventId, args.fieldValues);
    const requestedTypeId =
      args.recordTypeId === undefined
        ? existing.recordTypeId
        : args.recordTypeId;
    const configuredType =
      requestedTypeId === null || requestedTypeId === undefined
        ? undefined
        : await assignableTypeInEvent(
            ctx,
            args.eventId,
            requestedTypeId,
            existing.recordTypeId,
          );
    await ctx.db.patch(args.recordId, {
      ...input,
      ...(configuredType === undefined
        ? { recordTypeId: undefined }
        : { recordTypeId: configuredType._id, type: configuredType.name }),
      ...(args.fieldValues === undefined ? {} : { fieldValues }),
      ...(args.supportCategories === undefined
        ? {}
        : {
            supportCategories: normalizedSupportCategories(
              args.supportCategories,
            ),
          }),
      ...(args.spectatorVisible === undefined
        ? {}
        : { spectatorVisible: args.spectatorVisible }),
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "record.updated",
      message: `Updated record: ${input.name}`,
      objectType: "record",
      objectId: args.recordId,
      objectLabel: input.name,
      href: `/events/${args.eventId}/records/${args.recordId}`,
    });
  },
});

export const saveVenueDetails = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.id("eventRecords"),
    address: v.optional(v.string()),
    /**
     * Coordinates use the absent/`null` distinction as well. A caller that does
     * not collect coordinates must not erase ones another surface recorded.
     */
    latitude: v.optional(v.union(v.number(), v.null())),
    longitude: v.optional(v.union(v.number(), v.null())),
    accessNotes: v.optional(v.string()),
    hours: v.optional(v.string()),
    contactDetail: v.optional(v.string()),
    supportCategories: v.optional(v.array(supportCategory)),
    spectatorVisible: v.optional(v.boolean()),
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
    const coordinates = resolvedCoordinates(args, record);
    await ctx.db.patch(args.recordId, {
      address: optionalText(args.address, 300),
      ...coordinates,
      accessNotes: optionalText(args.accessNotes, 1000),
      hours: optionalText(args.hours, 240),
      contactDetail: optionalText(args.contactDetail, 300),
      ...(args.supportCategories === undefined
        ? {}
        : {
            supportCategories: normalizedSupportCategories(
              args.supportCategories,
            ),
          }),
      ...(args.spectatorVisible === undefined
        ? {}
        : { spectatorVisible: args.spectatorVisible }),
      confirmationStatus: args.confirmationStatus,
      confirmationSource: optionalText(args.confirmationSource, 500),
      verifiedAt: Date.now(),
      verifiedBy: identity.subject,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "record.updated",
      message: `Updated venue details: ${record.name}`,
      objectType: "record",
      objectId: args.recordId,
      objectLabel: record.name,
      href: `/events/${args.eventId}/records/${args.recordId}`,
    });
  },
});

/** Creates or updates a canonical map location in one authorized transaction. */
export const saveMapLocation = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.optional(v.id("eventRecords")),
    kind: v.union(v.literal("venue"), v.literal("support")),
    name: v.string(),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    hours: v.optional(v.string()),
    supportCategories: v.array(supportCategory),
    spectatorVisible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const now = Date.now();
    const input = validatedRecordInput({
      name: args.name,
      type: args.kind === "support" ? "service" : "venue",
      address: args.address,
    });
    const categories =
      normalizedSupportCategories(args.supportCategories) ?? [];
    const common = {
      address: optionalText(args.address, 300),
      ...resolvedCoordinates(args, {}),
      hours: optionalText(args.hours, 240),
      supportCategories: categories,
      spectatorVisible: args.spectatorVisible,
      verifiedAt: now,
      verifiedBy: identity.subject,
      updatedAt: now,
    };
    let recordId = args.recordId;
    if (recordId === undefined) {
      recordId = await ctx.db.insert("eventRecords", {
        eventId: args.eventId,
        ...input,
        ...common,
        confirmationStatus: "unconfirmed",
        createdAt: now,
      });
      await writeAudit(ctx, {
        eventId: args.eventId,
        actorId: identity.subject,
        kind: "record.created",
        message: `Created map location: ${input.name}`,
        objectType: "record",
        objectId: recordId,
        objectLabel: input.name,
        href: `/events/${args.eventId}/records/${recordId}`,
        createdAt: now,
      });
    } else {
      const record = await recordInEvent(ctx, args.eventId, recordId);
      if (!(await isLocationRecord(ctx, record)))
        throw new Error("Map locations require a location record");
      const coordinates = resolvedCoordinates(args, record);
      await ctx.db.patch(recordId, {
        name: input.name,
        ...common,
        ...coordinates,
      });
      await writeAudit(ctx, {
        eventId: args.eventId,
        actorId: identity.subject,
        kind: "record.updated",
        message: `Updated map location: ${input.name}`,
        objectType: "record",
        objectId: recordId,
        objectLabel: input.name,
        href: `/events/${args.eventId}/records/${recordId}`,
        createdAt: now,
      });
    }
    return recordId;
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

/** Restores an event-local record type without changing records that use it. */
export const restoreType = mutation({
  args: { eventId: v.id("events"), typeId: v.id("eventRecordTypes") },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const type = await ctx.db.get(args.typeId);
    if (type === null || type.eventId !== args.eventId)
      throw new Error("Record type not found");
    if (type.archivedAt !== undefined)
      await ctx.db.patch(args.typeId, {
        archivedAt: undefined,
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
export const archiveCategory = mutation({
  args: { eventId: v.id("events"), categoryId: v.id("eventRecordCategories") },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.eventId !== args.eventId)
      throw new Error("Category not found");
    if (category.archivedAt === undefined)
      await ctx.db.patch(args.categoryId, {
        archivedAt: Date.now(),
        updatedAt: Date.now(),
      });
  },
});
export const restoreCategory = mutation({
  args: { eventId: v.id("events"), categoryId: v.id("eventRecordCategories") },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.eventId !== args.eventId)
      throw new Error("Category not found");
    if (category.archivedAt !== undefined)
      await ctx.db.patch(args.categoryId, {
        archivedAt: undefined,
        updatedAt: Date.now(),
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
/**
 * Folds one category into another and archives the source.
 *
 * Records already carrying both categories must end up with a single assignment:
 * re-pointing every source row would leave duplicate rows that render twice and
 * that `removeCategory` can only delete one of at a time.
 *
 * Not yet reachable from the UI; kept correct so wiring it up is a UI-only change.
 */
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
    const [sourceAssignments, targetAssignments] = await Promise.all([
      ctx.db
        .query("eventRecordCategoryAssignments")
        .withIndex("by_categoryId", (q) =>
          q.eq("categoryId", args.sourceCategoryId),
        )
        .collect(),
      ctx.db
        .query("eventRecordCategoryAssignments")
        .withIndex("by_categoryId", (q) =>
          q.eq("categoryId", args.targetCategoryId),
        )
        .collect(),
    ]);
    const alreadyTargeted = new Set(
      targetAssignments.map((assignment) => assignment.recordId),
    );
    for (const assignment of sourceAssignments) {
      if (alreadyTargeted.has(assignment.recordId)) {
        await ctx.db.delete(assignment._id);
        continue;
      }
      alreadyTargeted.add(assignment.recordId);
      await ctx.db.patch(assignment._id, { categoryId: args.targetCategoryId });
    }
    await ctx.db.patch(args.sourceCategoryId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
