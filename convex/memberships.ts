import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  applicationRoles,
  requireIdentity,
  requireRole,
  type ApplicationRole,
} from "./auth";

const assignableRoles = applicationRoles.filter(
  (role): role is Exclude<ApplicationRole, "owner"> => role !== "owner",
);

const assignableRoleValidator = v.union(
  v.literal("manager"),
  v.literal("crew"),
);

function validatedUserId(userId: string) {
  const normalizedUserId = userId.trim();

  if (normalizedUserId.length === 0 || normalizedUserId.length > 191) {
    throw new Error("A valid member ID is required");
  }

  return normalizedUserId;
}

async function requireOwner(
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

  requireRole(membership?.role, ["owner"]);
  return identity;
}

/** Lists an event's members for its owner to manage. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireOwner(ctx, eventId);
    const memberships = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
      .collect();

    return memberships.map((membership) => ({
      id: membership._id,
      userId: membership.userId,
      role: membership.role,
    }));
  },
});

/** Adds a manager or crew member after checking the caller owns the event. */
export const add = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
    role: assignableRoleValidator,
  },
  handler: async (ctx, { eventId, userId, role }) => {
    await requireOwner(ctx, eventId);
    const normalizedUserId = validatedUserId(userId);
    const existing = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) =>
        index.eq("eventId", eventId).eq("userId", normalizedUserId),
      )
      .unique();

    if (existing !== null) {
      throw new Error("This person already has access to the event");
    }

    return ctx.db.insert("eventMemberships", {
      eventId,
      userId: normalizedUserId,
      role,
      createdAt: Date.now(),
    });
  },
});

/** Changes a non-owner member between manager and crew access. */
export const updateRole = mutation({
  args: {
    eventId: v.id("events"),
    membershipId: v.id("eventMemberships"),
    role: assignableRoleValidator,
  },
  handler: async (ctx, { eventId, membershipId, role }) => {
    await requireOwner(ctx, eventId);
    const membership = await ctx.db.get(membershipId);

    if (membership === null || membership.eventId !== eventId) {
      throw new Error("Member not found");
    }

    if (membership.role === "owner") {
      throw new Error("An event owner cannot be demoted");
    }

    await ctx.db.patch(membershipId, { role });
  },
});

/** Removes a non-owner member's event access. */
export const remove = mutation({
  args: {
    eventId: v.id("events"),
    membershipId: v.id("eventMemberships"),
  },
  handler: async (ctx, { eventId, membershipId }) => {
    await requireOwner(ctx, eventId);
    const membership = await ctx.db.get(membershipId);

    if (membership === null || membership.eventId !== eventId) {
      throw new Error("Member not found");
    }

    if (membership.role === "owner") {
      throw new Error("An event owner cannot be removed");
    }

    await ctx.db.delete(membershipId);
  },
});

export { assignableRoles, validatedUserId };
