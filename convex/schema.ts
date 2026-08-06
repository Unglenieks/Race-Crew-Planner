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
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
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
    sectionId: v.optional(v.id("planSections")),
    timeKind: v.optional(
      v.union(
        v.literal("exact"),
        v.literal("approximate"),
        v.literal("range"),
        v.literal("allDay"),
        v.literal("unspecified"),
      ),
    ),
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
    /** Legacy display type. New configured types are identified by recordTypeId. */
    type: v.string(),
    recordTypeId: v.optional(v.id("eventRecordTypes")),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accessNotes: v.optional(v.string()),
    hours: v.optional(v.string()),
    contactDetail: v.optional(v.string()),
    confirmationStatus: v.optional(
      v.union(v.literal("unconfirmed"), v.literal("confirmed")),
    ),
    confirmationSource: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_name", ["eventId", "name"]),
  eventRecordTypes: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    /** Lets a custom vocabulary participate safely in venue and travel flows. */
    isLocation: v.boolean(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_name", ["eventId", "name"]),
  eventRecordCategories: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    color: v.string(),
    order: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_order", ["eventId", "order"]),
  eventRecordCategoryAssignments: defineTable({
    eventId: v.id("events"),
    recordId: v.id("eventRecords"),
    categoryId: v.id("eventRecordCategories"),
    createdAt: v.number(),
  })
    .index("by_recordId", ["recordId"])
    .index("by_categoryId", ["categoryId"])
    .index("by_eventId_recordId", ["eventId", "recordId"]),
  travelContexts: defineTable({
    eventId: v.id("events"),
    fromRecordId: v.id("eventRecords"),
    toRecordId: v.id("eventRecords"),
    estimate: v.string(),
    calculation: v.optional(v.string()),
    routeNote: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_fromRecordId", ["fromRecordId"])
    .index("by_toRecordId", ["toRecordId"]),
  workItems: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("completed")),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    ),
    dueContext: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_createdAt", ["eventId", "createdAt"]),
  planChanges: defineTable({
    eventId: v.id("events"),
    itineraryItemId: v.id("itineraryItems"),
    title: v.string(),
    scheduledFor: v.string(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    previousTitle: v.optional(v.string()),
    previousScheduledFor: v.optional(v.string()),
    previousLocation: v.optional(v.string()),
    previousNotes: v.optional(v.string()),
    reason: v.string(),
    severity: v.union(v.literal("routine"), v.literal("critical")),
    publishedBy: v.string(),
    publishedAt: v.number(),
  })
    .index("by_eventId_publishedAt", ["eventId", "publishedAt"])
    .index("by_itemId_publishedAt", ["itineraryItemId", "publishedAt"]),
  planChangeRecipients: defineTable({
    eventId: v.id("events"),
    changeId: v.id("planChanges"),
    userId: v.string(),
    state: v.union(
      v.literal("sent"),
      v.literal("opened"),
      v.literal("acknowledged"),
      v.literal("acknowledgedElsewhere"),
    ),
    sentAt: v.number(),
    openedAt: v.optional(v.number()),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
    acknowledgementNote: v.optional(v.string()),
  })
    .index("by_changeId", ["changeId"])
    .index("by_changeId_userId", ["changeId", "userId"])
    .index("by_userId_state", ["userId", "state"]),
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
  eventActivity: defineTable({
    eventId: v.id("events"),
    actorId: v.string(),
    kind: v.union(v.literal("comment"), v.literal("source")),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_eventId_createdAt", ["eventId", "createdAt"]),
  eventComments: defineTable({
    eventId: v.id("events"),
    body: v.string(),
    authorId: v.string(),
    createdAt: v.number(),
  }).index("by_eventId_createdAt", ["eventId", "createdAt"]),
  eventSources: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    url: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    authorId: v.string(),
    createdAt: v.number(),
  }).index("by_eventId_createdAt", ["eventId", "createdAt"]),
  planSections: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    kind: v.union(v.literal("day"), v.literal("session"), v.literal("leg")),
    order: v.number(),
    createdAt: v.number(),
  }).index("by_eventId_order", ["eventId", "order"]),
});
