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
import { validatedItineraryInput } from "./itinerary";
import { isLocationRecord } from "./records";
import { seedMovementDefaults } from "./movements";

const sourceKind = v.union(
  v.literal("pdf"),
  v.literal("csv"),
  v.literal("xlsx"),
  v.literal("pasted"),
);
const movementType = v.union(
  v.literal("exact"),
  v.literal("approximate"),
  v.literal("range"),
  v.literal("allDay"),
  v.literal("unspecified"),
);
const issue = v.object({
  severity: v.union(v.literal("error"), v.literal("warning")),
  field: v.string(),
  message: v.string(),
});
const confidence = v.object({
  date: v.number(),
  time: v.number(),
  place: v.number(),
  description: v.number(),
  personnel: v.number(),
  movementType: v.number(),
  tags: v.number(),
});
const rowInput = {
  sourcePage: v.optional(v.number()),
  sourceRow: v.number(),
  rawValues: v.record(v.string(), v.string()),
  operationalDay: v.optional(v.string()),
  normalizedDate: v.optional(v.string()),
  normalizedTime: v.optional(v.string()),
  normalizedEndTime: v.optional(v.string()),
  placeText: v.optional(v.string()),
  proposedVenueId: v.optional(v.id("eventRecords")),
  description: v.string(),
  rawPersonnel: v.optional(v.string()),
  resolvedAssignments: v.array(v.string()),
  proposedMovementType: movementType,
  proposedTags: v.array(v.string()),
  fieldConfidence: confidence,
  issues: v.array(issue),
  warningsAccepted: v.boolean(),
};

function normalizedLabel(value: string) {
  return value.trim().toLocaleLowerCase();
}

function inferredMovementType(description: string) {
  const value = description.toLocaleLowerCase();
  if (/\b(fci|fco|mtc|time control)\b/.test(value)) return "Time control";
  if (/\bservice\b/.test(value)) return "Service";
  if (/\brecce\b/.test(value)) return "Recce";
  if (/\b(tech|scrutineering)\b/.test(value)) return "Scrutineering / tech";
  if (/\b(depart|departure|leaves?)\b/.test(value)) return "Departure";
  if (/\b(arrive|arrival|returns?)\b/.test(value)) return "Arrival";
  if (/parc expos/.test(value)) return "Parc exposé";
  if (/parc ferm/.test(value)) return "Parc fermé";
  if (/\bmeeting\b/.test(value)) return "Meeting";
  if (/\b(lodging|bedtime|wake up)\b/.test(value)) return "Lodging";
  if (/\b(breakfast|lunch|dinner|meal)\b/.test(value)) return "Meal";
  return undefined;
}

function inferredTags(description: string, proposed: string[]) {
  const codes = description.match(/\b(FCI|FCO|MTC)\b/gi) ?? [];
  return [
    ...new Set(
      [...proposed, ...codes].map((tag) => tag.trim()).filter(Boolean),
    ),
  ];
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
  return { identity, member };
}

async function manager(ctx: MutationCtx, eventId: Id<"events">) {
  const result = await membership(ctx, eventId);
  requireRole(result.member.role, ["owner", "manager"]);
  return result;
}

async function importForEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  importId: Id<"planImports">,
) {
  const imported = await ctx.db.get(importId);
  if (imported === null || imported.eventId !== eventId) {
    throw new Error("Import session not found");
  }
  return imported;
}

/** Lists the event's review sessions without exposing them outside membership. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await membership(ctx, eventId);
    return await ctx.db
      .query("planImports")
      .withIndex("by_eventId_createdAt", (q) => q.eq("eventId", eventId))
      .order("desc")
      .collect();
  },
});

/** Returns a single review grid after proving it belongs to this event. */
export const get = query({
  args: { eventId: v.id("events"), importId: v.id("planImports") },
  handler: async (ctx, { eventId, importId }) => {
    await membership(ctx, eventId);
    const imported = await importForEvent(ctx, eventId, importId);
    const rows = await ctx.db
      .query("planImportRows")
      .withIndex("by_importId_sourceRow", (q) => q.eq("importId", importId))
      .collect();
    return { ...imported, rows };
  },
});

/** Creates a durable staging grid. It intentionally does not create movements. */
export const stage = mutation({
  args: {
    eventId: v.id("events"),
    sourceKind,
    sourceName: v.string(),
    sourceFileId: v.optional(v.id("eventFiles")),
    detectedSections: v.array(v.string()),
    rows: v.array(v.object(rowInput)),
  },
  handler: async (ctx, args) => {
    const { identity } = await manager(ctx, args.eventId);
    const sourceName = args.sourceName.trim();
    if (sourceName.length === 0 || sourceName.length > 160)
      throw new Error("Source name must be between 1 and 160 characters");
    if (args.rows.length === 0) throw new Error("No schedule rows were found");
    if (args.rows.length > 500)
      throw new Error("An import can contain at most 500 rows");
    if (args.sourceFileId !== undefined) {
      const file = await ctx.db.get(args.sourceFileId);
      if (file === null || file.eventId !== args.eventId)
        throw new Error("Source file not found");
    }
    const now = Date.now();
    const importId = await ctx.db.insert("planImports", {
      eventId: args.eventId,
      sourceKind: args.sourceKind,
      sourceName,
      sourceFileId: args.sourceFileId,
      status: "reviewing",
      detectedSections: args.detectedSections.slice(0, 30),
      createdBy: identity.subject,
      createdAt: now,
    });
    for (const row of args.rows) {
      await ctx.db.insert("planImportRows", {
        importId,
        ...row,
        description: row.description.trim(),
        updatedAt: now,
      });
    }
    await writeAudit(ctx, {
      eventId: args.eventId,
      actorId: identity.subject,
      kind: "planImport.staged",
      message: `Staged ${args.rows.length} plan rows from ${sourceName}`,
      objectType: "planImport",
      objectId: importId,
      objectLabel: sourceName,
      href: `/events/${args.eventId}/plan/import`,
      createdAt: now,
    });
    return importId;
  },
});

/** Edits one staging row; live movements remain untouched until commit. */
export const updateRow = mutation({
  args: {
    eventId: v.id("events"),
    importId: v.id("planImports"),
    rowId: v.id("planImportRows"),
    ...rowInput,
  },
  handler: async (ctx, args) => {
    await manager(ctx, args.eventId);
    const imported = await importForEvent(ctx, args.eventId, args.importId);
    if (imported.status !== "reviewing")
      throw new Error("This import is closed");
    const row = await ctx.db.get(args.rowId);
    if (row === null || row.importId !== args.importId)
      throw new Error("Import row not found");
    if (args.proposedVenueId !== undefined) {
      const venue = await ctx.db.get(args.proposedVenueId);
      if (
        venue === null ||
        venue.eventId !== args.eventId ||
        !(await isLocationRecord(ctx, venue))
      ) {
        throw new Error("Proposed venue not found");
      }
    }
    const {
      eventId: _eventId,
      importId: _importId,
      rowId: _rowId,
      ...rowPatch
    } = args;
    await ctx.db.patch(args.rowId, {
      ...rowPatch,
      description: rowPatch.description.trim(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Atomically turns a reviewed grid into live movements. A committed session is
 * returned unchanged on retry, and Convex transaction semantics prevent a
 * partially committed duplicate set.
 */
export const commit = mutation({
  args: { eventId: v.id("events"), importId: v.id("planImports") },
  handler: async (ctx, { eventId, importId }) => {
    const { identity } = await manager(ctx, eventId);
    const event = await ctx.db.get(eventId);
    if (event === null || event.archivedAt !== undefined)
      throw new Error("Event not found");
    const imported = await importForEvent(ctx, eventId, importId);
    if (imported.status === "committed") {
      return { importId, movementCount: imported.committedMovementCount ?? 0 };
    }
    if (imported.status === "rolledBack")
      throw new Error("This import was rolled back");
    const rows = await ctx.db
      .query("planImportRows")
      .withIndex("by_importId_sourceRow", (q) => q.eq("importId", importId))
      .collect();
    const blocked = rows.some(
      (row) =>
        row.issues.some((entry) => entry.severity === "error") ||
        (row.issues.some((entry) => entry.severity === "warning") &&
          !row.warningsAccepted),
    );
    if (blocked) {
      throw new Error(
        "Resolve errors and accept remaining warnings before importing",
      );
    }
    if (rows.length === 0) throw new Error("No rows are available to import");
    await seedMovementDefaults(ctx, eventId);
    const [movementTypes, existingTags, existingTeams] = await Promise.all([
      ctx.db
        .query("eventMovementTypes")
        .withIndex("by_eventId_order", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventMovementTags")
        .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventTeams")
        .withIndex("by_eventId_name", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    const tagsByName = new Map<
      string,
      { _id: Id<"eventMovementTags">; name: string }
    >(existingTags.map((tag) => [normalizedLabel(tag.name), tag]));
    const teamsByName = new Map<
      string,
      { _id: Id<"eventTeams">; name: string }
    >(existingTeams.map((team) => [normalizedLabel(team.name), team]));
    const now = Date.now();
    for (const row of rows) {
      if (
        row.normalizedDate === undefined ||
        row.normalizedTime === undefined
      ) {
        throw new Error(`Row ${row.sourceRow} needs a date and time`);
      }
      const rawTime =
        Object.entries(row.rawValues).find(([key]) =>
          ["time", "timein", "starttime", "scheduledfor"].includes(
            key.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""),
          ),
        )?.[1] ?? "";
      const displayAs2400 = /^\s*2400\b/.test(rawTime);
      const operationalDay = row.operationalDay ?? row.normalizedDate;
      const movementTypeName = inferredMovementType(row.description);
      const movementTypeId = movementTypes.find(
        (type) =>
          movementTypeName !== undefined &&
          normalizedLabel(type.name) === normalizedLabel(movementTypeName),
      )?._id;
      const item = validatedItineraryInput(
        {
          title: row.description,
          scheduledFor: displayAs2400
            ? `${operationalDay}T24:00`
            : `${row.normalizedDate}T${row.normalizedTime}`,
          scheduledUntil:
            row.proposedMovementType === "range" &&
            row.normalizedEndTime !== undefined
              ? `${row.normalizedDate}T${row.normalizedEndTime}`
              : undefined,
          location: row.placeText,
          timeKind: row.proposedMovementType,
          operationalDay,
          displayTime: displayAs2400 ? "2400" : "standard",
          movementTypeId,
        },
        event.timeZone,
      );
      if (row.proposedVenueId !== undefined) {
        const venue = await ctx.db.get(row.proposedVenueId);
        if (
          venue === null ||
          venue.eventId !== eventId ||
          !(await isLocationRecord(ctx, venue))
        ) {
          throw new Error(`Row ${row.sourceRow} has an invalid venue`);
        }
      }
      const movementId = await ctx.db.insert("itineraryItems", {
        eventId,
        importId,
        ...item,
        movementTypeId: item.movementTypeId ?? undefined,
        recordId: row.proposedVenueId,
        createdAt: now,
        updatedAt: now,
      });
      for (const name of inferredTags(row.description, row.proposedTags)) {
        const key = normalizedLabel(name);
        let tag = tagsByName.get(key);
        if (tag === undefined) {
          const tagId = await ctx.db.insert("eventMovementTags", {
            eventId,
            name,
            createdAt: now,
            updatedAt: now,
          });
          tag = { _id: tagId, name };
          tagsByName.set(key, tag);
        }
        await ctx.db.insert("movementTagAssignments", {
          eventId,
          itineraryItemId: movementId,
          tagId: tag._id,
          createdAt: now,
        });
      }
      const personnel = row.rawPersonnel?.trim();
      if (personnel !== undefined && personnel !== "" && personnel !== "-") {
        const key = normalizedLabel(personnel);
        let team = teamsByName.get(key);
        if (team === undefined) {
          const teamId = await ctx.db.insert("eventTeams", {
            eventId,
            name: personnel,
            createdAt: now,
            updatedAt: now,
          });
          team = { _id: teamId, name: personnel };
          teamsByName.set(key, team);
        }
        await ctx.db.insert("movementAssignments", {
          eventId,
          itineraryItemId: movementId,
          targetKind: "team",
          teamId: team._id,
          label: team.name,
          createdAt: now,
        });
      }
      await ctx.db.patch(row._id, {
        importedMovementId: movementId,
        updatedAt: now,
      });
    }
    await ctx.db.patch(importId, {
      status: "committed",
      committedAt: now,
      committedBy: identity.subject,
      committedMovementCount: rows.length,
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "planImport.committed",
      message: `Imported ${rows.length} reviewed plan movements from ${imported.sourceName}`,
      objectType: "planImport",
      objectId: importId,
      objectLabel: imported.sourceName,
      href: `/events/${eventId}/plan`,
      createdAt: now,
    });
    return { importId, movementCount: rows.length };
  },
});

/** Archives every movement from one import, preserving a reversible audit trail. */
export const rollback = mutation({
  args: { eventId: v.id("events"), importId: v.id("planImports") },
  handler: async (ctx, { eventId, importId }) => {
    const { identity } = await manager(ctx, eventId);
    const imported = await importForEvent(ctx, eventId, importId);
    if (imported.status !== "committed")
      throw new Error("Only committed imports can be rolled back");
    const movements = await ctx.db
      .query("itineraryItems")
      .withIndex("by_importId", (q) => q.eq("importId", importId))
      .collect();
    const now = Date.now();
    for (const movement of movements) {
      if (movement.archivedAt === undefined) {
        await ctx.db.patch(movement._id, { archivedAt: now, updatedAt: now });
      }
    }
    await ctx.db.patch(importId, {
      status: "rolledBack",
      rolledBackAt: now,
      rolledBackBy: identity.subject,
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "planImport.rolledBack",
      message: `Rolled back ${movements.length} movements imported from ${imported.sourceName}`,
      objectType: "planImport",
      objectId: importId,
      objectLabel: imported.sourceName,
      href: `/events/${eventId}/plan/import`,
      createdAt: now,
    });
    return { movementCount: movements.length };
  },
});
