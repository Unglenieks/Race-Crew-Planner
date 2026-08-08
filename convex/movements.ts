import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { resolveUserProfile } from "./userProfiles";

const defaultMovementTypes = [
  "Departure",
  "Arrival",
  "Recce",
  "Scrutineering / tech",
  "Service",
  "Parc exposé",
  "Parc fermé",
  "Time control",
  "Meeting",
  "Lodging",
  "Meal",
];
const defaultTags = ["FCI", "FCO", "MTC", "Service A", "Service B"];
const defaultOperationalRoles = ["Driver", "Co-driver", "Crew Chief", "Media"];

type Ctx = QueryCtx | MutationCtx;
type AssignmentTarget =
  | { targetKind: "member"; targetUserId: string }
  | { targetKind: "team"; teamId: Id<"eventTeams"> }
  | {
      targetKind: "operationalRole";
      operationalRoleId: Id<"eventOperationalRoles">;
    };

function normalizedName(value: string, noun: string) {
  const name = value.trim();
  if (name.length === 0 || name.length > 80) {
    throw new Error(`${noun} must be between 1 and 80 characters`);
  }
  return name;
}

async function membership(ctx: Ctx, eventId: Id<"events">) {
  const identity = await requireIdentity(ctx);
  const record = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (index) =>
      index.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (record === null) throw new Error("Forbidden");
  return { identity, record };
}

async function requireManager(ctx: MutationCtx, eventId: Id<"events">) {
  const result = await membership(ctx, eventId);
  requireRole(result.record.role, ["owner", "manager"]);
  return result;
}

/** Creates the event-local starter vocabulary without sharing data across events. */
export async function seedMovementDefaults(
  ctx: MutationCtx,
  eventId: Id<"events">,
  now = Date.now(),
) {
  const existing = await ctx.db
    .query("eventMovementTypes")
    .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
    .collect();
  if (existing.length === 0) {
    for (const [order, name] of defaultMovementTypes.entries()) {
      await ctx.db.insert("eventMovementTypes", {
        eventId,
        name,
        order,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const [tags, roles] = await Promise.all([
    ctx.db
      .query("eventMovementTags")
      .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventOperationalRoles")
      .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
      .collect(),
  ]);
  if (tags.length === 0) {
    for (const name of defaultTags) {
      await ctx.db.insert("eventMovementTags", {
        eventId,
        name,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (roles.length === 0) {
    for (const name of defaultOperationalRoles) {
      await ctx.db.insert("eventOperationalRoles", {
        eventId,
        name,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

/** Lets pre-existing events receive the same defaults only when a manager asks. */
export const ensureDefaults = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireManager(ctx, eventId);
    await seedMovementDefaults(ctx, eventId);
  },
});

export const listDirectory = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await membership(ctx, eventId);
    const [types, tags, teams, operationalRoles, members] = await Promise.all([
      ctx.db
        .query("eventMovementTypes")
        .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventMovementTags")
        .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventTeams")
        .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventOperationalRoles")
        .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventMemberships")
        .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
        .collect(),
    ]);
    return {
      types,
      tags,
      teams,
      operationalRoles,
      members: await Promise.all(
        members.map(async (member) => ({
          userId: member.userId,
          label: (await resolveUserProfile(ctx, member.userId)).name,
        })),
      ),
    };
  },
});

async function createNamed(
  ctx: MutationCtx,
  eventId: Id<"events">,
  name: string,
  table: "eventMovementTags" | "eventTeams" | "eventOperationalRoles",
  noun: string,
) {
  await requireManager(ctx, eventId);
  const normalized = normalizedName(name, noun);
  const existing = await ctx.db
    .query(table)
    .withIndex("by_eventId_name", (index) => index.eq("eventId", eventId))
    .collect();
  if (
    existing.some(
      (entry) =>
        entry.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    )
  ) {
    throw new Error(`${noun} already exists for this event`);
  }
  const now = Date.now();
  return await ctx.db.insert(table, {
    eventId,
    name: normalized,
    createdAt: now,
    updatedAt: now,
  });
}

export const createType = mutation({
  args: { eventId: v.id("events"), name: v.string() },
  handler: async (ctx, { eventId, name }) => {
    await requireManager(ctx, eventId);
    const normalized = normalizedName(name, "Movement type");
    const existing = await ctx.db
      .query("eventMovementTypes")
      .withIndex("by_eventId_order", (index) => index.eq("eventId", eventId))
      .collect();
    if (
      existing.some(
        (entry) =>
          entry.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
      )
    ) {
      throw new Error("Movement type already exists for this event");
    }
    const now = Date.now();
    return await ctx.db.insert("eventMovementTypes", {
      eventId,
      name: normalized,
      order: existing.length,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const createTag = mutation({
  args: { eventId: v.id("events"), name: v.string() },
  handler: (ctx, args) =>
    createNamed(ctx, args.eventId, args.name, "eventMovementTags", "Tag"),
});
export const createTeam = mutation({
  args: { eventId: v.id("events"), name: v.string() },
  handler: (ctx, args) =>
    createNamed(ctx, args.eventId, args.name, "eventTeams", "Team"),
});
export const createOperationalRole = mutation({
  args: { eventId: v.id("events"), name: v.string() },
  handler: (ctx, args) =>
    createNamed(
      ctx,
      args.eventId,
      args.name,
      "eventOperationalRoles",
      "Operational role",
    ),
});

async function getMovement(
  ctx: Ctx,
  eventId: Id<"events">,
  itemId: Id<"itineraryItems">,
) {
  const item = await ctx.db.get(itemId);
  if (item === null || item.eventId !== eventId)
    throw new Error("Movement not found");
  return item;
}

export async function movementStructuredFields(
  ctx: Ctx,
  item: {
    _id: Id<"itineraryItems">;
    movementTypeId?: Id<"eventMovementTypes">;
  },
) {
  const [movementType, tagAssignments, assignments] = await Promise.all([
    item.movementTypeId === undefined ? null : ctx.db.get(item.movementTypeId),
    ctx.db
      .query("movementTagAssignments")
      .withIndex("by_itemId", (index) => index.eq("itineraryItemId", item._id))
      .collect(),
    ctx.db
      .query("movementAssignments")
      .withIndex("by_itemId", (index) => index.eq("itineraryItemId", item._id))
      .collect(),
  ]);
  const tags = (
    await Promise.all(
      tagAssignments.map((assignment) => ctx.db.get(assignment.tagId)),
    )
  )
    .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
    .map((tag) => ({ _id: tag._id, name: tag.name }));
  return {
    movementTypeLabel: movementType?.name,
    tags,
    assignments: assignments.map((assignment) => ({
      _id: assignment._id,
      targetKind: assignment.targetKind,
      label: assignment.label,
      targetUserId: assignment.targetUserId,
      teamId: assignment.teamId,
      operationalRoleId: assignment.operationalRoleId,
    })),
  };
}

export const setTags = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("itineraryItems"),
    tagIds: v.array(v.id("eventMovementTags")),
  },
  handler: async (ctx, { eventId, itemId, tagIds }) => {
    await requireManager(ctx, eventId);
    const item = await getMovement(ctx, eventId, itemId);
    const previous = await movementStructuredFields(ctx, item);
    const unique = [...new Set(tagIds)];
    const tags = await Promise.all(unique.map((tagId) => ctx.db.get(tagId)));
    if (
      tags.some(
        (tag) =>
          tag === null ||
          tag.eventId !== eventId ||
          tag.archivedAt !== undefined,
      )
    ) {
      throw new Error("Movement tag not found");
    }
    const current = await ctx.db
      .query("movementTagAssignments")
      .withIndex("by_itemId", (index) => index.eq("itineraryItemId", itemId))
      .collect();
    await Promise.all(
      current.map((assignment) => ctx.db.delete(assignment._id)),
    );
    const now = Date.now();
    for (const tagId of unique)
      await ctx.db.insert("movementTagAssignments", {
        eventId,
        itineraryItemId: itemId,
        tagId,
        createdAt: now,
      });
    await ctx.db.patch(itemId, {
      lastChangedMovementTypeLabel: previous.movementTypeLabel,
      lastChangedTagLabels: previous.tags.map((tag) => tag.name),
      lastChangedAssignmentLabels: previous.assignments.map(
        (assignment) => assignment.label,
      ),
      lastChangedAt: now,
      updatedAt: now,
    });
  },
});

const assignmentArgs = v.array(
  v.union(
    v.object({ targetKind: v.literal("member"), targetUserId: v.string() }),
    v.object({ targetKind: v.literal("team"), teamId: v.id("eventTeams") }),
    v.object({
      targetKind: v.literal("operationalRole"),
      operationalRoleId: v.id("eventOperationalRoles"),
    }),
  ),
);

async function assignmentLabel(
  ctx: MutationCtx,
  eventId: Id<"events">,
  target: AssignmentTarget,
) {
  if (target.targetKind === "member") {
    const member = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) =>
        index.eq("eventId", eventId).eq("userId", target.targetUserId),
      )
      .unique();
    if (member === null)
      throw new Error("Assigned member is not on this event");
    return {
      label: (await resolveUserProfile(ctx, target.targetUserId)).name,
      targetUserId: target.targetUserId,
    };
  }
  if (target.targetKind === "team") {
    const team = await ctx.db.get(target.teamId);
    if (
      team === null ||
      team.eventId !== eventId ||
      team.archivedAt !== undefined
    )
      throw new Error("Assigned team not found");
    return { label: team.name, teamId: team._id };
  }
  const operationalRole = await ctx.db.get(target.operationalRoleId);
  if (
    operationalRole === null ||
    operationalRole.eventId !== eventId ||
    operationalRole.archivedAt !== undefined
  )
    throw new Error("Assigned operational role not found");
  return {
    label: operationalRole.name,
    operationalRoleId: operationalRole._id,
  };
}

export const setAssignments = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("itineraryItems"),
    assignments: assignmentArgs,
  },
  handler: async (ctx, { eventId, itemId, assignments }) => {
    await requireManager(ctx, eventId);
    const item = await getMovement(ctx, eventId, itemId);
    const previous = await movementStructuredFields(ctx, item);
    const keys = new Set<string>();
    for (const assignment of assignments) {
      const key =
        assignment.targetKind === "member"
          ? `member:${assignment.targetUserId}`
          : assignment.targetKind === "team"
            ? `team:${assignment.teamId}`
            : `role:${assignment.operationalRoleId}`;
      if (keys.has(key))
        throw new Error("Each assignment can appear only once");
      keys.add(key);
    }
    const labels = await Promise.all(
      assignments.map((assignment) =>
        assignmentLabel(ctx, eventId, assignment),
      ),
    );
    const current = await ctx.db
      .query("movementAssignments")
      .withIndex("by_itemId", (index) => index.eq("itineraryItemId", itemId))
      .collect();
    await Promise.all(
      current.map((assignment) => ctx.db.delete(assignment._id)),
    );
    const now = Date.now();
    for (const [index, assignment] of assignments.entries()) {
      await ctx.db.insert("movementAssignments", {
        eventId,
        itineraryItemId: itemId,
        targetKind: assignment.targetKind,
        ...labels[index],
        createdAt: now,
      });
    }
    await ctx.db.patch(itemId, {
      lastChangedMovementTypeLabel: previous.movementTypeLabel,
      lastChangedTagLabels: previous.tags.map((tag) => tag.name),
      lastChangedAssignmentLabels: previous.assignments.map(
        (assignment) => assignment.label,
      ),
      lastChangedAt: now,
      updatedAt: now,
    });
  },
});
