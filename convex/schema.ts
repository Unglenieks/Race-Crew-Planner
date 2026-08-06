import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Application tables are introduced with the feature that owns them.
 *
 * Each table must have Convex validators for every persisted field and indexes
 * for its supported query paths. Application roles and memberships belong in
 * this schema, not in client-side state or Clerk metadata.
 */
export default defineSchema({
  events: defineTable({
    name: v.string(),
    timeZone: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
  }).index("by_createdBy", ["createdBy"]),
  eventMemberships: defineTable({
    eventId: v.id("events"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("crew")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_eventId_userId", ["eventId", "userId"]),
  itineraryItems: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    /** A local date/time in the event's declared IANA time zone. */
    scheduledFor: v.string(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_scheduledFor", ["eventId", "scheduledFor"]),
});
