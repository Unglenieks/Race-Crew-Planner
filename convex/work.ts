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
  priority: v.optional(
    v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
  ),
  dueContext: v.optional(v.string()),
  assigneeId: v.optional(v.string()),
  recordId: v.optional(v.union(v.id("eventRecords"), v.null())),
  itineraryItemId: v.optional(v.union(v.id("itineraryItems"), v.null())),
  status: v.optional(
    v.union(
      v.literal("open"),
      v.literal("inProgress"),
      v.literal("blocked"),
      v.literal("completed"),
    ),
  ),
};

type WorkItemInput = {
  title: string;
  notes?: string;
  priority?: "low" | "normal" | "high";
  dueContext?: string;
  assigneeId?: string;
  recordId?: Id<"eventRecords"> | null;
  itineraryItemId?: Id<"itineraryItems"> | null;
  status?: "open" | "inProgress" | "blocked" | "completed";
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
  recordId,
  itineraryItemId,
  status,
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
    recordId,
    itineraryItemId,
    status,
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

async function requireLinkedRecordsBelongToEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  item: ReturnType<typeof validatedWorkItemInput>,
) {
  if (item.recordId !== undefined && item.recordId !== null) {
    const record = await ctx.db.get(item.recordId as Id<"eventRecords">);
    if (record === null || record.eventId !== eventId) {
      throw new Error("Linked record not found");
    }
  }
  if (item.itineraryItemId !== undefined && item.itineraryItemId !== null) {
    const movement = await ctx.db.get(
      item.itineraryItemId as Id<"itineraryItems">,
    );
    if (movement === null || movement.eventId !== eventId) {
      throw new Error("Linked movement not found");
    }
  }
}

async function requireWorkItem(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  itemId: Id<"workItems">,
) {
  const item = await ctx.db.get(itemId);
  if (item === null || item.eventId !== eventId) {
    throw new Error("Work item not found");
  }
  return item;
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

/** Reads one event-owned item for its protected detail screen. */
export const get = query({
  args: { eventId: v.id("events"), itemId: v.id("workItems") },
  handler: async (ctx, { eventId, itemId }) => {
    await requireEventMembership(ctx, eventId);
    return await requireWorkItem(ctx, eventId, itemId);
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
    await requireLinkedRecordsBelongToEvent(ctx, args.eventId, item);
    const now = Date.now();

    return await ctx.db.insert("workItems", {
      eventId: args.eventId,
      ...item,
      status: item.status ?? "open",
      recordId: item.recordId ?? undefined,
      itineraryItemId: item.itineraryItemId ?? undefined,
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
    const existing = await requireWorkItem(ctx, args.eventId, args.itemId);
    const item = validatedWorkItemInput(args);
    await requireAssigneeMembership(ctx, args.eventId, item.assigneeId);
    await requireLinkedRecordsBelongToEvent(ctx, args.eventId, item);

    await ctx.db.patch(args.itemId, {
      ...item,
      status: item.status ?? existing.status,
      recordId:
        item.recordId === null
          ? undefined
          : (item.recordId ?? existing.recordId),
      itineraryItemId:
        item.itineraryItemId === null
          ? undefined
          : (item.itineraryItemId ?? existing.itineraryItemId),
      completedAt:
        item.status === undefined
          ? existing.completedAt
          : item.status === "completed"
            ? (existing.completedAt ?? Date.now())
            : undefined,
      completedBy:
        item.status === undefined
          ? existing.completedBy
          : item.status === "completed"
            ? (existing.completedBy ?? (await requireIdentity(ctx)).subject)
            : undefined,
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
    await requireWorkItem(ctx, eventId, itemId);

    await ctx.db.patch(itemId, {
      status: completed ? "completed" : "open",
      completedAt: completed ? Date.now() : undefined,
      completedBy: completed ? identity.subject : undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Replays a locally persisted completion exactly once. Authorization is checked
 * on every replay; the operation id is only an idempotency key, never a grant.
 */
export const setCompletionOffline = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("workItems"),
    completed: v.boolean(),
    operationId: v.string(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (
    ctx,
    { eventId, itemId, completed, operationId, expectedUpdatedAt },
  ) => {
    const { identity } = await requireEventMembership(ctx, eventId);
    const existing = await ctx.db
      .query("offlineOperations")
      .withIndex("by_eventId_operationId", (q) =>
        q.eq("eventId", eventId).eq("operationId", operationId),
      )
      .unique();
    if (existing !== null) return { replayed: true };
    const item = await requireWorkItem(ctx, eventId, itemId);
    if (item.updatedAt !== expectedUpdatedAt) {
      throw new Error("Work item changed while this update was offline");
    }
    await ctx.db.patch(itemId, {
      status: completed ? "completed" : "open",
      completedAt: completed ? Date.now() : undefined,
      completedBy: completed ? identity.subject : undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("offlineOperations", {
      eventId,
      operationId,
      createdBy: identity.subject,
      createdAt: Date.now(),
    });
    return { replayed: false };
  },
});

function commentBody(body: string) {
  const normalized = body.trim();
  if (normalized.length === 0 || normalized.length > 1000) {
    throw new Error("Comment must be between 1 and 1000 characters");
  }
  return normalized;
}

/** Lists comments only when the caller can read the referenced work item. */
export const listComments = query({
  args: { eventId: v.id("events"), itemId: v.id("workItems") },
  handler: async (ctx, { eventId, itemId }) => {
    await requireEventMembership(ctx, eventId);
    await requireWorkItem(ctx, eventId, itemId);
    const comments = await ctx.db
      .query("workItemComments")
      .withIndex("by_workItemId_createdAt", (q) => q.eq("workItemId", itemId))
      .collect();
    return await Promise.all(
      comments.map(async (comment) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", comment.authorId))
          .unique();
        return { ...comment, authorName: profile?.displayName };
      }),
    );
  },
});

/** Any member can leave a handoff note on an event work item. */
export const addComment = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("workItems"),
    body: v.string(),
  },
  handler: async (ctx, { eventId, itemId, body }) => {
    const { identity } = await requireEventMembership(ctx, eventId);
    await requireWorkItem(ctx, eventId, itemId);
    return await ctx.db.insert("workItemComments", {
      eventId,
      workItemId: itemId,
      body: commentBody(body),
      authorId: identity.subject,
      createdAt: Date.now(),
    });
  },
});
