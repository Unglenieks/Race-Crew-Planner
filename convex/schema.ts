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
    /** Sample events are owned by their creator and can be removed in one action. */
    isSample: v.optional(v.boolean()),
    /** Archived events remain recoverable for the configured retention window. */
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_archivedAt", ["archivedAt"]),
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
    avatarUrl: v.optional(v.string()),
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
  /** Deployment-visible proof that registered scheduled work is running. */
  schedulerHeartbeats: defineTable({
    name: v.string(),
    lastRanAt: v.number(),
  }).index("by_name", ["name"]),
  itineraryItems: defineTable({
    eventId: v.id("events"),
    /** The staged plan import that created this movement, if any. */
    importId: v.optional(v.id("planImports")),
    title: v.string(),
    /** A local date/time in the event's declared IANA time zone. */
    scheduledFor: v.string(),
    /** Local end date/time for range movements; legacy ranges may omit it. */
    scheduledUntil: v.optional(v.string()),
    location: v.optional(v.string()),
    recordId: v.optional(v.id("eventRecords")),
    notes: v.optional(v.string()),
    /** Snapshot immediately before the latest edit, used by contextual publish. */
    lastChangedTitle: v.optional(v.string()),
    lastChangedScheduledFor: v.optional(v.string()),
    lastChangedScheduledUntil: v.optional(v.string()),
    lastChangedLocation: v.optional(v.string()),
    lastChangedNotes: v.optional(v.string()),
    lastChangedAt: v.optional(v.number()),
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
    .index("by_eventId_scheduledFor", ["eventId", "scheduledFor"])
    .index("by_importId", ["importId"]),
  /**
   * A durable review session. Source binaries remain in eventFiles so they
   * retain the same event-scoped access controls as other evidence.
   */
  planImports: defineTable({
    eventId: v.id("events"),
    sourceKind: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("xlsx"),
      v.literal("pasted"),
    ),
    sourceName: v.string(),
    sourceFileId: v.optional(v.id("eventFiles")),
    status: v.union(
      v.literal("reviewing"),
      v.literal("committed"),
      v.literal("rolledBack"),
    ),
    detectedSections: v.array(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    committedAt: v.optional(v.number()),
    committedBy: v.optional(v.string()),
    committedMovementCount: v.optional(v.number()),
    rolledBackAt: v.optional(v.number()),
    rolledBackBy: v.optional(v.string()),
  }).index("by_eventId_createdAt", ["eventId", "createdAt"]),
  /** Rows are review artifacts, never live movements until explicitly committed. */
  planImportRows: defineTable({
    importId: v.id("planImports"),
    sourcePage: v.optional(v.number()),
    sourceRow: v.number(),
    rawValues: v.record(v.string(), v.string()),
    operationalDay: v.optional(v.string()),
    normalizedDate: v.optional(v.string()),
    normalizedTime: v.optional(v.string()),
    normalizedEndTime: v.optional(v.string()),
    placeText: v.optional(v.string()),
    proposedVenueId: v.optional(v.id("eventRecords")),
    description: v.string(),
    rawPersonnel: v.optional(v.string()),
    resolvedAssignments: v.array(v.string()),
    proposedMovementType: v.union(
      v.literal("exact"),
      v.literal("approximate"),
      v.literal("range"),
      v.literal("allDay"),
      v.literal("unspecified"),
    ),
    proposedTags: v.array(v.string()),
    fieldConfidence: v.object({
      date: v.number(),
      time: v.number(),
      place: v.number(),
      description: v.number(),
      personnel: v.number(),
      movementType: v.number(),
      tags: v.number(),
    }),
    issues: v.array(
      v.object({
        severity: v.union(v.literal("error"), v.literal("warning")),
        field: v.string(),
        message: v.string(),
      }),
    ),
    warningsAccepted: v.boolean(),
    importedMovementId: v.optional(v.id("itineraryItems")),
    updatedAt: v.number(),
  })
    .index("by_importId_sourceRow", ["importId", "sourceRow"])
    .index("by_importId", ["importId"]),
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
    /** Values for event-configured directory fields, keyed by the stable field key. */
    fieldValues: v.optional(v.record(v.string(), v.string())),
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
  /**
   * Evidence binaries live in Convex storage; this table holds only the
   * authorized event/record relationship and safe display metadata.
   */
  eventFiles: defineTable({
    eventId: v.id("events"),
    recordId: v.optional(v.id("eventRecords")),
    workItemId: v.optional(v.id("workItems")),
    itineraryItemId: v.optional(v.id("itineraryItems")),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_eventId_createdAt", ["eventId", "createdAt"])
    .index("by_eventId_recordId", ["eventId", "recordId"])
    .index("by_eventId_workItemId", ["eventId", "workItemId"])
    .index("by_eventId_itineraryItemId", ["eventId", "itineraryItemId"]),
  eventRecordFields: defineTable({
    eventId: v.id("events"),
    /** Stable key means renaming a field never loses its existing values. */
    key: v.string(),
    label: v.string(),
    type: v.union(v.literal("text"), v.literal("select")),
    options: v.optional(v.array(v.string())),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_order", ["eventId", "order"])
    .index("by_eventId_key", ["eventId", "key"]),
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
    status: v.union(
      v.literal("open"),
      v.literal("inProgress"),
      v.literal("blocked"),
      v.literal("completed"),
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    ),
    dueContext: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
    recordId: v.optional(v.id("eventRecords")),
    itineraryItemId: v.optional(v.id("itineraryItems")),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_createdAt", ["eventId", "createdAt"]),
  workTemplates: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    items: v.array(
      v.object({
        title: v.string(),
        notes: v.optional(v.string()),
        priority: v.union(
          v.literal("low"),
          v.literal("normal"),
          v.literal("high"),
        ),
        dueContext: v.optional(v.string()),
      }),
    ),
    archivedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
  workTemplateApplications: defineTable({
    eventId: v.id("events"),
    templateId: v.id("workTemplates"),
    appliedBy: v.string(),
    appliedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_templateId_appliedAt", ["templateId", "appliedAt"]),
  eventSetupDismissals: defineTable({
    eventId: v.id("events"),
    userId: v.string(),
    step: v.union(
      v.literal("profile"),
      v.literal("movement"),
      v.literal("crew"),
    ),
    dismissedAt: v.number(),
  })
    .index("by_eventId_userId", ["eventId", "userId"])
    .index("by_eventId_userId_step", ["eventId", "userId", "step"]),
  workItemComments: defineTable({
    eventId: v.id("events"),
    workItemId: v.id("workItems"),
    body: v.string(),
    authorId: v.string(),
    createdAt: v.number(),
  }).index("by_workItemId_createdAt", ["workItemId", "createdAt"]),
  /** Idempotency ledger for replayable offline work completions. */
  offlineOperations: defineTable({
    eventId: v.id("events"),
    operationId: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_eventId_operationId", ["eventId", "operationId"]),
  planChanges: defineTable({
    eventId: v.id("events"),
    itineraryItemId: v.id("itineraryItems"),
    title: v.string(),
    scheduledFor: v.string(),
    scheduledUntil: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    previousTitle: v.optional(v.string()),
    previousScheduledFor: v.optional(v.string()),
    previousScheduledUntil: v.optional(v.string()),
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
  /** A durable, authorized snapshot of a plan brief that was exported. */
  planExports: defineTable({
    eventId: v.id("events"),
    /** Undefined means the export included every active movement. */
    filterDay: v.optional(v.string()),
    timeZone: v.string(),
    items: v.array(
      v.object({
        itineraryItemId: v.id("itineraryItems"),
        title: v.string(),
        scheduledFor: v.string(),
        location: v.optional(v.string()),
      }),
    ),
    generatedAt: v.number(),
    generatedBy: v.string(),
  }).index("by_eventId_generatedAt", ["eventId", "generatedAt"]),
  formTemplates: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    version: v.number(),
    rootTemplateId: v.optional(v.id("formTemplates")),
    isCurrent: v.optional(v.boolean()),
    fields: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("shortText"),
          v.literal("longText"),
          v.literal("number"),
          v.literal("date"),
          v.literal("select"),
          v.literal("multiSelect"),
          v.literal("boolean"),
          v.literal("person"),
          v.literal("recordLink"),
          v.literal("file"),
          v.literal("photo"),
        ),
        required: v.boolean(),
        instructions: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
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
        type: v.union(
          v.literal("text"),
          v.literal("shortText"),
          v.literal("longText"),
          v.literal("number"),
          v.literal("date"),
          v.literal("select"),
          v.literal("multiSelect"),
          v.literal("boolean"),
          v.literal("person"),
          v.literal("recordLink"),
          v.literal("file"),
          v.literal("photo"),
        ),
        required: v.boolean(),
        instructions: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
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
    kind: v.union(
      // Legacy values remain readable while new writes use the typed vocabulary.
      v.literal("comment"),
      v.literal("source"),
      v.literal("comment.added"),
      v.literal("source.added"),
      v.literal("movement.created"),
      v.literal("movement.updated"),
      v.literal("movement.archived"),
      v.literal("movement.restored"),
      v.literal("movement.published"),
      v.literal("planImport.staged"),
      v.literal("planImport.committed"),
      v.literal("planImport.rolledBack"),
      v.literal("work.created"),
      v.literal("work.updated"),
      v.literal("work.completed"),
      v.literal("work.reopened"),
      v.literal("work.commented"),
      v.literal("record.created"),
      v.literal("record.updated"),
      v.literal("record.vocabularyChanged"),
      v.literal("record.travelUpdated"),
      v.literal("file.uploaded"),
      v.literal("file.removed"),
      v.literal("workTemplate.created"),
      v.literal("workTemplate.applied"),
      v.literal("workTemplate.archived"),
      v.literal("workTemplate.restored"),
      v.literal("inspection.templateCreated"),
      v.literal("inspection.templateUpdated"),
      v.literal("inspection.draftSaved"),
      v.literal("inspection.submitted"),
      v.literal("planChange.opened"),
      v.literal("planChange.acknowledged"),
    ),
    message: v.string(),
    objectType: v.optional(v.string()),
    objectId: v.optional(v.string()),
    objectLabel: v.optional(v.string()),
    href: v.optional(v.string()),
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
