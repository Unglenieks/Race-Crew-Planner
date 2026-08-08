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
    /** Optional operational context, validated by itinerary mutations. */
    travelContextId: v.optional(v.id("travelContexts")),
    serviceIntervalId: v.optional(v.id("serviceIntervals")),
    notes: v.optional(v.string()),
    /** Event-local operational classification, separate from permission roles. */
    movementTypeId: v.optional(v.id("eventMovementTypes")),
    /** Snapshot immediately before the latest edit, used by contextual publish. */
    lastChangedTitle: v.optional(v.string()),
    lastChangedScheduledFor: v.optional(v.string()),
    lastChangedScheduledUntil: v.optional(v.string()),
    lastChangedLocation: v.optional(v.string()),
    lastChangedRecordId: v.optional(v.id("eventRecords")),
    lastChangedNotes: v.optional(v.string()),
    lastChangedMovementTypeLabel: v.optional(v.string()),
    lastChangedTagLabels: v.optional(v.array(v.string())),
    lastChangedAssignmentLabels: v.optional(v.array(v.string())),
    lastChangedAt: v.optional(v.number()),
    sectionId: v.optional(v.id("planSections")),
    /**
     * The operational date the operator assigned this movement to. It need not
     * be the calendar date embedded in scheduledFor (for example, 00:45 can
     * still belong to Friday's running order).
     */
    operationalDay: v.optional(v.string()),
    /** Preserve a printed 2400 while scheduledFor sorts as next-day 00:00. */
    displayTime: v.optional(v.union(v.literal("standard"), v.literal("2400"))),
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
  /** Configurable movement classifications such as departure and service. */
  eventMovementTypes: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    order: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId_order", ["eventId", "order"])
    .index("by_eventId_name", ["eventId", "name"]),
  /** Event-local teams are operational targets, never permission groups. */
  eventTeams: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId_name", ["eventId", "name"]),
  /** Operational jobs are distinct from owner/manager/crew application roles. */
  eventOperationalRoles: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId_name", ["eventId", "name"]),
  /** Normalized event-local codes/tags, e.g. FCI, FCO, MTC, Service A. */
  eventMovementTags: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId_name", ["eventId", "name"]),
  movementTagAssignments: defineTable({
    eventId: v.id("events"),
    itineraryItemId: v.id("itineraryItems"),
    tagId: v.id("eventMovementTags"),
    createdAt: v.number(),
  })
    .index("by_itemId", ["itineraryItemId"])
    .index("by_eventId_itemId", ["eventId", "itineraryItemId"]),
  /** Labels are captured here so later team/job/profile renames cannot rewrite history. */
  movementAssignments: defineTable({
    eventId: v.id("events"),
    itineraryItemId: v.id("itineraryItems"),
    targetKind: v.union(
      v.literal("member"),
      v.literal("team"),
      v.literal("operationalRole"),
    ),
    targetUserId: v.optional(v.string()),
    teamId: v.optional(v.id("eventTeams")),
    operationalRoleId: v.optional(v.id("eventOperationalRoles")),
    label: v.string(),
    createdAt: v.number(),
  })
    .index("by_itemId", ["itineraryItemId"])
    .index("by_eventId_itemId", ["eventId", "itineraryItemId"]),
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
    /** Operational support capabilities at this canonical location. */
    supportCategories: v.optional(
      v.array(
        v.union(
          v.literal("fuel"),
          v.literal("grocery"),
          v.literal("parts"),
          v.literal("tire"),
          v.literal("medical"),
          v.literal("towing"),
          v.literal("other"),
        ),
      ),
    ),
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
    /** Legacy free-text estimate retained until each row is reviewed. */
    estimate: v.optional(v.string()),
    calculation: v.optional(v.string()),
    routeNote: v.optional(v.string()),
    distanceMiles: v.optional(v.number()),
    expectedDurationMinutes: v.optional(v.number()),
    source: v.optional(v.string()),
    routeNotes: v.optional(v.string()),
    /** Legacy or incomplete rows are surfaced for review. */
    requiresReview: v.optional(v.boolean()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_fromRecordId", ["fromRecordId"])
    .index("by_toRecordId", ["toRecordId"]),
  eventLogisticsProfiles: defineTable({
    eventId: v.id("events"),
    carNumber: v.optional(v.string()),
    makeModel: v.optional(v.string()),
    fuelCapacityGallons: v.optional(v.number()),
    stageMpg: v.optional(v.number()),
    transitMpg: v.optional(v.number()),
    defaultFuelReservePercent: v.number(),
    documentAccessCodes: v.array(
      v.object({
        label: v.string(),
        kind: v.union(v.literal("document"), v.literal("accessCode")),
        value: v.string(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
  rallyLegs: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    order: v.number(),
    stageCount: v.number(),
    stageMiles: v.number(),
    transitMiles: v.number(),
    startOrder: v.optional(v.number()),
    precedingCar: v.optional(v.string()),
    reservePercent: v.optional(v.number()),
    fuelOverrideGallons: v.optional(v.number()),
    fuelOverrideReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_order", ["eventId", "order"]),
  serviceIntervals: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    allowedDurationMinutes: v.number(),
    fuelContext: v.optional(v.string()),
    serviceContext: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId_scheduledStart", ["eventId", "scheduledStart"]),
  weatherForecasts: defineTable({
    eventId: v.id("events"),
    forecastDate: v.string(),
    conditions: v.string(),
    temperatureLow: v.optional(v.number()),
    temperatureHigh: v.optional(v.number()),
    precipitationPercent: v.optional(v.number()),
    windMph: v.optional(v.number()),
    source: v.string(),
    asOf: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId_forecastDate", ["eventId", "forecastDate"]),
  externalContacts: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    name: v.string(),
    organization: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
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
    /** Canonical venue relationship at the time this change was published. */
    recordId: v.optional(v.id("eventRecords")),
    notes: v.optional(v.string()),
    movementTypeLabel: v.optional(v.string()),
    tagLabels: v.optional(v.array(v.string())),
    assignmentLabels: v.optional(v.array(v.string())),
    previousTitle: v.optional(v.string()),
    previousScheduledFor: v.optional(v.string()),
    previousScheduledUntil: v.optional(v.string()),
    previousLocation: v.optional(v.string()),
    previousRecordId: v.optional(v.id("eventRecords")),
    previousNotes: v.optional(v.string()),
    previousMovementTypeLabel: v.optional(v.string()),
    previousTagLabels: v.optional(v.array(v.string())),
    previousAssignmentLabels: v.optional(v.array(v.string())),
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
    /** Missing only on exports created before versioned crew briefs existed. */
    schemaVersion: v.optional(v.number()),
    /** Copied at generation time so a renamed event cannot rewrite history. */
    eventName: v.optional(v.string()),
    timeZone: v.string(),
    items: v.array(
      v.object({
        itineraryItemId: v.id("itineraryItems"),
        title: v.string(),
        scheduledFor: v.string(),
        location: v.optional(v.string()),
        movementTypeLabel: v.optional(v.string()),
        tagLabels: v.optional(v.array(v.string())),
        assignmentLabels: v.optional(v.array(v.string())),
        scheduledUntil: v.optional(v.string()),
        timeKind: v.optional(
          v.union(
            v.literal("exact"),
            v.literal("approximate"),
            v.literal("range"),
            v.literal("allDay"),
            v.literal("unspecified"),
          ),
        ),
        section: v.optional(
          v.object({
            name: v.string(),
            kind: v.union(
              v.literal("day"),
              v.literal("session"),
              v.literal("leg"),
            ),
          }),
        ),
        tags: v.optional(v.array(v.string())),
        venue: v.optional(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            accessNotes: v.optional(v.string()),
            hours: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
        assignedTo: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    /** Optional so snapshots written by the original, minimal export still validate. */
    appendices: v.optional(
      v.object({
        venues: v.array(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            accessNotes: v.optional(v.string()),
            hours: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
        officialContacts: v.array(
          v.object({
            name: v.string(),
            role: v.optional(v.string()),
            email: v.optional(v.string()),
            phoneNumber: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
          }),
        ),
        travel: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            estimate: v.string(),
            calculation: v.optional(v.string()),
            routeNote: v.optional(v.string()),
          }),
        ),
        fuel: v.array(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            accessNotes: v.optional(v.string()),
            hours: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
        weather: v.array(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            accessNotes: v.optional(v.string()),
            hours: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
        supportServices: v.array(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            accessNotes: v.optional(v.string()),
            hours: v.optional(v.string()),
            contactDetail: v.optional(v.string()),
            notes: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
    /** Explicit choices made before this private crew brief was generated. */
    inclusionOptions: v.optional(
      v.object({
        profile: v.boolean(),
        rallyFuel: v.boolean(),
        service: v.boolean(),
        weather: v.boolean(),
        travelRoutes: v.boolean(),
        supportServices: v.boolean(),
        documentAccessCodes: v.boolean(),
        externalContactIds: v.array(v.id("externalContacts")),
      }),
    ),
    /** Logistics values frozen with the brief. Never resolve these from live data. */
    logistics: v.optional(
      v.object({
        profile: v.optional(
          v.object({
            carNumber: v.optional(v.string()),
            makeModel: v.optional(v.string()),
            fuelCapacityGallons: v.optional(v.number()),
            stageMpg: v.optional(v.number()),
            transitMpg: v.optional(v.number()),
          }),
        ),
        legs: v.array(
          v.object({
            name: v.string(),
            stageCount: v.number(),
            stageMiles: v.number(),
            transitMiles: v.number(),
            startOrder: v.optional(v.number()),
            precedingCar: v.optional(v.string()),
            plannedFuelGallons: v.optional(v.number()),
            formula: v.string(),
            overrideReason: v.optional(v.string()),
          }),
        ),
        services: v.array(
          v.object({
            name: v.string(),
            scheduledStart: v.string(),
            scheduledEnd: v.string(),
            allowedDurationMinutes: v.number(),
            fuelContext: v.optional(v.string()),
            serviceContext: v.optional(v.string()),
          }),
        ),
        weather: v.array(
          v.object({
            forecastDate: v.string(),
            conditions: v.string(),
            temperatureLow: v.optional(v.number()),
            temperatureHigh: v.optional(v.number()),
            precipitationPercent: v.optional(v.number()),
            windMph: v.optional(v.number()),
            source: v.string(),
            asOf: v.number(),
          }),
        ),
        travel: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            distanceMiles: v.optional(v.number()),
            expectedDurationMinutes: v.optional(v.number()),
            source: v.optional(v.string()),
            routeNotes: v.optional(v.string()),
          }),
        ),
        supportServices: v.array(
          v.object({
            name: v.string(),
            address: v.optional(v.string()),
            categories: v.array(v.string()),
          }),
        ),
        documentAccessCodes: v.array(
          v.object({
            label: v.string(),
            kind: v.union(v.literal("document"), v.literal("accessCode")),
            value: v.string(),
          }),
        ),
        contacts: v.array(
          v.object({
            contactId: v.id("externalContacts"),
            title: v.string(),
            name: v.string(),
            organization: v.optional(v.string()),
            phone: v.optional(v.string()),
            email: v.optional(v.string()),
          }),
        ),
      }),
    ),
    generatedAt: v.number(),
    generatedBy: v.string(),
    generatedByName: v.optional(v.string()),
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
      v.literal("logistics.updated"),
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
    /** Optional calendar anchor; a section remains useful without one. */
    operationalDate: v.optional(v.string()),
    /** The local boundary at which this operating day rolls over. */
    boundaryTime: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_eventId_order", ["eventId", "order"]),
});
