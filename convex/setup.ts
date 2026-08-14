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
  v.literal("locations"),
  v.literal("contacts"),
  v.literal("legs"),
  v.literal("vehicle"),
  v.literal("noticeboard"),
  v.literal("spectatorVenues"),
  v.literal("priorityWork"),
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
    const [
      profile,
      movements,
      memberships,
      invitations,
      dismissals,
      records,
      recordTypes,
      logisticsProfile,
      legs,
      contacts,
      files,
      work,
    ] = await Promise.all([
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
      ctx.db
        .query("eventRecords")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventRecordTypes")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventLogisticsProfiles")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .unique(),
      ctx.db
        .query("rallyLegs")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("externalContacts")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("eventFiles")
        .withIndex("by_eventId_createdAt", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("workItems")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    const dismissed = new Set(dismissals.map((row) => row.step));
    const locationTypeIds = new Set(
      recordTypes.filter((type) => type.isLocation).map((type) => type._id),
    );
    const locations = records.filter(
      (record) =>
        (record.recordTypeId !== undefined &&
          locationTypeIds.has(record.recordTypeId)) ||
        record.type === "venue" ||
        record.type === "place",
    );
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
      {
        id: "locations" as const,
        completed:
          locations.length > 0 &&
          locations.every(
            (record) =>
              record.latitude !== undefined && record.longitude !== undefined,
          ),
        dismissed: dismissed.has("locations"),
      },
      {
        id: "contacts" as const,
        completed: contacts.length > 0,
        dismissed: dismissed.has("contacts"),
      },
      {
        id: "legs" as const,
        completed: legs.length > 0,
        dismissed: dismissed.has("legs"),
      },
      {
        id: "vehicle" as const,
        completed: Boolean(
          logisticsProfile?.makeModel &&
          logisticsProfile.fuelCapacityGallons &&
          logisticsProfile.stageMpg &&
          logisticsProfile.transitMpg,
        ),
        dismissed: dismissed.has("vehicle"),
      },
      {
        id: "noticeboard" as const,
        completed: files.length > 0,
        dismissed: dismissed.has("noticeboard"),
      },
      {
        id: "spectatorVenues" as const,
        completed: locations.some((record) => record.spectatorVisible === true),
        dismissed: dismissed.has("spectatorVenues"),
      },
      {
        id: "priorityWork" as const,
        completed: !work.some(
          (item) => item.priority === "high" && item.status !== "completed",
        ),
        dismissed: dismissed.has("priorityWork"),
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
