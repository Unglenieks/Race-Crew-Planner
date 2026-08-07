import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const invitationRole = v.union(v.literal("manager"), v.literal("crew"));

function normalizedEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new Error("A valid email address is required");
  }
  return value;
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

/** Stores only profile data asserted by verified Clerk JWT claims. */
export const syncProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (index) => index.eq("userId", identity.subject))
      .unique();
    const profile = {
      userId: identity.subject,
      displayName: identity.name?.trim() || undefined,
      email: identity.emailVerified
        ? identity.email?.trim().toLowerCase()
        : undefined,
      phoneNumber: identity.phoneNumberVerified
        ? identity.phoneNumber?.trim()
        : undefined,
      updatedAt: Date.now(),
    };
    if (existing === null) await ctx.db.insert("userProfiles", profile);
    else await ctx.db.patch(existing._id, profile);
  },
});

/** Accepts all outstanding invitations matching the caller's verified email. */
export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    if (!identity.emailVerified || identity.email === undefined) {
      throw new Error(
        "A verified email address is required to accept invitations",
      );
    }
    const email = normalizedEmail(identity.email);
    const invitations = await ctx.db
      .query("eventInvitations")
      .withIndex("by_email_status", (index) =>
        index.eq("email", email).eq("status", "pending"),
      )
      .collect();
    for (const invitation of invitations) {
      const membership = await ctx.db
        .query("eventMemberships")
        .withIndex("by_eventId_userId", (index) =>
          index
            .eq("eventId", invitation.eventId)
            .eq("userId", identity.subject),
        )
        .unique();
      if (membership === null) {
        await ctx.db.insert("eventMemberships", {
          eventId: invitation.eventId,
          userId: identity.subject,
          role: invitation.role,
          createdAt: Date.now(),
        });
      } else if (membership.role === "crew" && invitation.role === "manager") {
        await ctx.db.patch(membership._id, { role: "manager" });
      }
      await ctx.db.patch(invitation._id, {
        status: "accepted",
        acceptedBy: identity.subject,
        acceptedAt: Date.now(),
      });
    }
  },
});

/** Creates an event-scoped pending invitation after owner authorization. */
export const create = mutation({
  args: { eventId: v.id("events"), email: v.string(), role: invitationRole },
  handler: async (ctx, { eventId, email, role }) => {
    const identity = await requireOwner(ctx, eventId);
    const normalized = normalizedEmail(email);
    const existing = await ctx.db
      .query("eventInvitations")
      .withIndex("by_eventId_email", (index) =>
        index.eq("eventId", eventId).eq("email", normalized),
      )
      .unique();
    if (existing !== null && existing.status === "pending")
      throw new Error("This email already has a pending invitation");
    const values = {
      eventId,
      email: normalized,
      role,
      status: "pending" as const,
      invitedBy: identity.subject,
      createdAt: Date.now(),
      acceptedBy: undefined,
      acceptedAt: undefined,
    };
    if (existing === null) return ctx.db.insert("eventInvitations", values);
    await ctx.db.patch(existing._id, values);
    return existing._id;
  },
});

/** Revokes a pending invitation if the matching event owner asks to cancel it. */
export const revoke = mutation({
  args: { eventId: v.id("events"), invitationId: v.id("eventInvitations") },
  handler: async (ctx, { eventId, invitationId }) => {
    await requireOwner(ctx, eventId);
    const invitation = await ctx.db.get(invitationId);
    if (invitation === null || invitation.eventId !== eventId)
      throw new Error("Invitation not found");
    if (invitation.status === "pending")
      await ctx.db.patch(invitationId, { status: "revoked" });
  },
});

export const updateMemberRole = mutation({
  args: {
    eventId: v.id("events"),
    membershipId: v.id("eventMemberships"),
    role: invitationRole,
  },
  handler: async (ctx, { eventId, membershipId, role }) => {
    await requireOwner(ctx, eventId);
    const membership = await ctx.db.get(membershipId);
    if (membership === null || membership.eventId !== eventId)
      throw new Error("Member not found");
    if (membership.role === "owner")
      throw new Error("An event owner cannot be demoted");
    await ctx.db.patch(membershipId, { role });
  },
});

export const removeMember = mutation({
  args: { eventId: v.id("events"), membershipId: v.id("eventMemberships") },
  handler: async (ctx, { eventId, membershipId }) => {
    await requireOwner(ctx, eventId);
    const membership = await ctx.db.get(membershipId);
    if (membership === null || membership.eventId !== eventId)
      throw new Error("Member not found");
    if (membership.role === "owner")
      throw new Error("An event owner cannot be removed");
    await ctx.db.delete(membershipId);
  },
});

/** Returns active people and pending email invitations only to the event owner. */
export const listContacts = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireOwner(ctx, eventId);
    const memberships = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
      .collect();
    const people = await Promise.all(
      memberships.map(async (membership) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (index) =>
            index.eq("userId", membership.userId),
          )
          .unique();
        return {
          id: membership._id,
          type: "member" as const,
          role: membership.role,
          userId: membership.userId,
          name: profile?.displayName,
          email: profile?.email,
          phoneNumber: profile?.phoneNumber,
        };
      }),
    );
    const invitations = await ctx.db
      .query("eventInvitations")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
    return [
      ...people,
      ...invitations
        .filter((invitation) => invitation.status === "pending")
        .map((invitation) => ({
          id: invitation._id,
          type: "invitation" as const,
          role: invitation.role,
          email: invitation.email,
        })),
    ];
  },
});

export { normalizedEmail };
