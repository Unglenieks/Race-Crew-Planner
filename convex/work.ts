import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const workItemArgs = {
  eventId: v.id("events"),
  title: v.string(),
  notes: v.optional(v.string()),
  priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"))),
  dueContext: v.optional(v.string()),
  assigneeId: v.optional(v.string()),
};

type WorkItemInput = {
  title: string;
  notes?: string;
  priority?: "low" | "normal" | "high";
  dueContext?: string;
  assigneeId?: string;
};

function optionalText(value: string | undefined, maximum: number) {
  const normalized = value?.trim();

  if (normalized === undefined || normalized.length === 0) return undefined;
  if (normalized.length > maximum) {
    throw new Error(`Text must be at most ${maximum} characters`);
  }
  return normalized;
}

/** Validates the deliberately small work-item shape used by the first checklist. */
export function validatedWorkItemInput({
  title,
  notes,
  priority,
  dueContext,
  assigneeId,
}: WorkItemInput) {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0 || normalizedTitle.length > 160) {
    throw new Error(
      "Work item description must be between 1 and 160 characters",
    );
  }

  return {
    title: normalizedTitle,
    notes: optionalText(notes, 1000),
    priority: priority ?? "normal",
    dueContext: optionalText(dueContext, 160),
    assigneeId: optionalText(assigneeId, 200),
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
  return { identity, membership };
}

async function requireAssigneeMembership(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  assigneeId: string | undefined,
) {
  if (assigneeId === undefined) return;

  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q) =>
      q.eq("eventId", eventId).eq("userId", assigneeId),
    )
    .unique();

  if (membership === null) throw new Error("Assignee must belong to the event");
}

/** Lists the event checklist after verifying the caller belongs to the event. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    return await ctx.db
      .query("workItems")
      .withIndex("by_eventId_createdAt", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

/** Lists eligible assignees without exposing people outside the selected event. */
export const listAssignees = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const memberships = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (q) => q.eq("eventId", eventId))
      .collect();

    return await Promise.all(
      memberships.map(async (membership) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", membership.userId))
          .unique();
        return {
          userId: membership.userId,
          name: profile?.displayName,
          role: membership.role,
        };
      }),
    );
  },
});

/** Owners and managers create items for the shared event checklist. */
export const create = mutation({
  args: workItemArgs,
  handler: async (ctx, args) => {
    const { membership } = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const item = validatedWorkItemInput(args);
    await requireAssigneeMembership(ctx, args.eventId, item.assigneeId);
    const now = Date.now();

    return await ctx.db.insert("workItems", {
      eventId: args.eventId,
      ...item,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Owners and managers can edit the wording of an event work item. */
export const update = mutation({
  args: { itemId: v.id("workItems"), ...workItemArgs },
  handler: async (ctx, args) => {
    const { membership } = await requireEventMembership(ctx, args.eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const existing = await ctx.db.get(args.itemId);
    if (existing === null || existing.eventId !== args.eventId) {
      throw new Error("Work item not found");
    }
    const item = validatedWorkItemInput(args);
    await requireAssigneeMembership(ctx, args.eventId, item.assigneeId);

    await ctx.db.patch(args.itemId, {
      ...item,
      updatedAt: Date.now(),
    });
  },
});

/** Any event member can complete or reopen a shared checklist item. */
export const setCompletion = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("workItems"),
    completed: v.boolean(),
  },
  handler: async (ctx, { eventId, itemId, completed }) => {
    const { identity } = await requireEventMembership(ctx, eventId);
    const existing = await ctx.db.get(itemId);
    if (existing === null || existing.eventId !== eventId) {
      throw new Error("Work item not found");
    }

    await ctx.db.patch(itemId, {
      status: completed ? "completed" : "open",
      completedAt: completed ? Date.now() : undefined,
      completedBy: completed ? identity.subject : undefined,
      updatedAt: Date.now(),
    });
  },
});
