import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const trigger = v.union(
  v.literal("planChangePublished"),
  v.literal("workCompleted"),
);
const action = v.union(
  v.literal("createWorkItem"),
  v.literal("notifyAssignee"),
);

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
  return { identity, membership };
}

function validatedName(value: string) {
  const name = value.trim();
  if (name.length === 0 || name.length > 120) {
    throw new Error("Rule name must be between 1 and 120 characters");
  }
  return name;
}

function validatedItemTitle(
  value: string | undefined,
  actionValue: "createWorkItem" | "notifyAssignee",
) {
  const itemTitle = value?.trim();
  if (actionValue === "createWorkItem" && !itemTitle) {
    throw new Error("A created work item needs a title");
  }
  if (itemTitle !== undefined && itemTitle.length > 160) {
    throw new Error("A created work item title must be at most 160 characters");
  }
  return itemTitle || undefined;
}

/** Lists configured rules; evaluation and delivery are deliberately separate. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    return await ctx.db
      .query("workAutomationRules")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
  },
});

/** Owners and managers configure an event-local work automation rule. */
export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    trigger,
    action,
    itemTitle: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, name, trigger, action, itemTitle }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const now = Date.now();
    return await ctx.db.insert("workAutomationRules", {
      eventId,
      name: validatedName(name),
      trigger,
      action,
      itemTitle: validatedItemTitle(itemTitle, action),
      enabled: true,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Owners and managers can pause or resume a rule without deleting its history. */
export const setEnabled = mutation({
  args: {
    eventId: v.id("events"),
    ruleId: v.id("workAutomationRules"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { eventId, ruleId, enabled }) => {
    const { membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const rule = await ctx.db.get(ruleId);
    if (rule === null || rule.eventId !== eventId) {
      throw new Error("Rule not found");
    }
    await ctx.db.patch(ruleId, { enabled, updatedAt: Date.now() });
  },
});

export { validatedItemTitle, validatedName };
