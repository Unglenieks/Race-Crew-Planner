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
    notes: v.optional(v.string()),
    /** Archive is reversible so a movement can be restored from its undo action. */
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_scheduledFor", ["eventId", "scheduledFor"]),
  formTemplates: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    version: v.number(),
    fields: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.union(v.literal("text"), v.literal("boolean")),
        required: v.boolean(),
      }),
    ),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_eventId", ["eventId"]),
  formSubmissions: defineTable({
    eventId: v.id("events"),
    templateId: v.id("formTemplates"),
    templateName: v.string(),
    templateVersion: v.number(),
    fields: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.union(v.literal("text"), v.literal("boolean")),
        required: v.boolean(),
      }),
    ),
    answers: v.any(),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedBy: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_createdBy", ["eventId", "createdBy"]),
});
