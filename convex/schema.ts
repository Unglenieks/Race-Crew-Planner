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
  userProfiles: defineTable({
    userId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  eventInvitations: defineTable({
    eventId: v.id("events"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("crew")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedBy: v.string(),
    createdAt: v.number(),
    acceptedBy: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_email", ["eventId", "email"])
    .index("by_email_status", ["email", "status"]),
  itineraryItems: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    /** A local date/time in the event's declared IANA time zone. */
    scheduledFor: v.string(),
    location: v.optional(v.string()),
    recordId: v.optional(v.id("eventRecords")),
    notes: v.optional(v.string()),
    /** Archive is reversible so a movement can be restored from its undo action. */
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_scheduledFor", ["eventId", "scheduledFor"]),
  eventRecords: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    type: v.union(
      v.literal("venue"),
      v.literal("place"),
      v.literal("service"),
      v.literal("vehicle"),
      v.literal("equipment"),
      v.literal("organization"),
      v.literal("person"),
    ),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_name", ["eventId", "name"]),
  workItems: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("completed")),
    priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"))),
    dueContext: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_createdAt", ["eventId", "createdAt"]),
});
