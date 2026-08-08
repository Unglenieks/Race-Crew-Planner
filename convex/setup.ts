import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity } from "./auth";

const setupStep = v.union(
  v.literal("profile"),
  v.literal("movement"),
  v.literal("crew"),
);

async function member(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
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

export const status = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { identity } = await member(ctx, eventId);
    const [profile, movements, memberships, invitations, dismissals] =
      await Promise.all([
        ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
          .unique(),
        ctx.db
          .query("itineraryItems")
          .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("eventMemberships")
          .withIndex("by_eventId_userId", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("eventInvitations")
          .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("eventSetupDismissals")
          .withIndex("by_eventId_userId", (q) =>
            q.eq("eventId", eventId).eq("userId", identity.subject),
          )
          .collect(),
      ]);
    const dismissed = new Set(dismissals.map((row) => row.step));
    return [
      {
        id: "profile" as const,
        completed: Boolean(profile?.displayName || profile?.email),
        dismissed: dismissed.has("profile"),
      },
      {
        id: "movement" as const,
        completed: movements.some(
          (movement) => movement.archivedAt === undefined,
        ),
        dismissed: dismissed.has("movement"),
      },
      {
        id: "crew" as const,
        completed:
          memberships.length > 1 ||
          invitations.some((invitation) => invitation.status === "pending"),
        dismissed: dismissed.has("crew"),
      },
    ];
  },
});

export const dismiss = mutation({
  args: { eventId: v.id("events"), step: setupStep },
  handler: async (ctx, { eventId, step }) => {
    const { identity } = await member(ctx, eventId);
    const existing = await ctx.db
      .query("eventSetupDismissals")
      .withIndex("by_eventId_userId_step", (q) =>
        q
          .eq("eventId", eventId)
          .eq("userId", identity.subject)
          .eq("step", step),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("eventSetupDismissals", {
        eventId,
        userId: identity.subject,
        step,
        dismissedAt: Date.now(),
      });
    }
  },
});
