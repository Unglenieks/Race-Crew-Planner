import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { resolveUserProfile, syncIdentityProfile } from "./userProfiles";

const invitationRole = v.union(
  v.literal("manager"),
  v.literal("crew"),
  v.literal("spectator"),
);

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

async function claimForVerifiedEmail(
  ctx: MutationCtx,
  userId: string,
  verifiedEmail: string,
) {
  const email = normalizedEmail(verifiedEmail);
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
        index.eq("eventId", invitation.eventId).eq("userId", userId),
      )
      .unique();
    if (membership === null) {
      await ctx.db.insert("eventMemberships", {
        eventId: invitation.eventId,
        userId,
        role: invitation.role,
        createdAt: Date.now(),
      });
    } else if (membership.role === "crew" && invitation.role === "manager") {
      await ctx.db.patch(membership._id, { role: "manager" });
    }
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedBy: userId,
      acceptedAt: Date.now(),
    });
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (index) => index.eq("userId", userId))
    .unique();
  if (profile === null)
    await ctx.db.insert("userProfiles", {
      userId,
      email,
      updatedAt: Date.now(),
    });
  else await ctx.db.patch(profile._id, { email, updatedAt: Date.now() });

  return { claimedCount: invitations.length, requiresVerifiedEmail: false };
}

/** Stores only profile data asserted by verified Clerk JWT claims. */
export const syncProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await syncIdentityProfile(ctx, identity);
  },
});

/** Accepts all outstanding invitations matching the caller's verified email. */
export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    if (!identity.emailVerified || identity.email === undefined) {
      return { claimedCount: 0, requiresVerifiedEmail: true };
    }
    return await claimForVerifiedEmail(ctx, identity.subject, identity.email);
  },
});

/** Server-only fallback using Clerk Backend API verified primary-email data. */
export const claimVerifiedEmail = internalMutation({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    if (!userId.trim()) throw new Error("A Clerk user is required");
    return await claimForVerifiedEmail(ctx, userId, email);
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

/** Returns the crew roster to crew members; only owners see pending invitations. */
export const listContacts = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const identity = await requireIdentity(ctx);
    const caller = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) =>
        index.eq("eventId", eventId).eq("userId", identity.subject),
      )
      .unique();
    if (caller === null || caller.role === "spectator")
      throw new Error("Forbidden");
    const memberships = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
      .collect();
    const people = await Promise.all(
      memberships.map(async (membership) => {
        const profile = await resolveUserProfile(ctx, membership.userId);
        return {
          id: membership._id,
          type: "member" as const,
          role: membership.role,
          userId: membership.userId,
          name: profile.name,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          avatarUrl: profile.avatarUrl,
        };
      }),
    );
    if (caller.role !== "owner" && caller.role !== "manager") return people;
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
