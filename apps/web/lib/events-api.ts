import { makeFunctionReference } from "convex/server";

export type EventRole = "owner" | "manager" | "crew";

export type EventSummary = {
  id: string;
  name: string;
  timeZone: string;
  role: EventRole;
  isSample?: boolean;
};

export type ArchivedEventSummary = {
  id: string;
  name: string;
  timeZone: string;
  archivedAt: number;
  purgeAt: number;
};

export type ItineraryItem = {
  _id: string;
  title: string;
  scheduledFor: string;
  scheduledUntil?: string;
  location?: string;
  recordId?: string;
  notes?: string;
  movementTypeId?: string;
  movementTypeLabel?: string;
  tags?: Array<{ _id: string; name: string }>;
  assignments?: Array<{
    _id: string;
    targetKind: "member" | "team" | "operationalRole";
    label: string;
    targetUserId?: string;
    teamId?: string;
    operationalRoleId?: string;
  }>;
  sectionId?: string;
  operationalDay?: string;
  displayTime?: "standard" | "2400";
  timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
  travelContextId?: string;
  serviceIntervalId?: string;
  archivedAt?: number;
};

export type MovementDirectory = {
  types: Array<{
    _id: string;
    name: string;
    order: number;
    archivedAt?: number;
  }>;
  tags: Array<{ _id: string; name: string; archivedAt?: number }>;
  teams: Array<{ _id: string; name: string; archivedAt?: number }>;
  operationalRoles: Array<{ _id: string; name: string; archivedAt?: number }>;
  members: Array<{ userId: string; label: string }>;
};

export const recordTypes = [
  "venue",
  "place",
  "service",
  "vehicle",
  "equipment",
  "organization",
  "person",
] as const;

export type EventRecord = {
  _id: string;
  name: string;
  type: string;
  recordTypeId?: string;
  address?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  accessNotes?: string;
  hours?: string;
  contactDetail?: string;
  confirmationStatus?: "unconfirmed" | "confirmed";
  confirmationSource?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  fieldValues?: Record<string, string>;
  supportCategories?: Array<
    "fuel" | "grocery" | "parts" | "tire" | "medical" | "towing" | "other"
  >;
};
export type RecordField = {
  _id: string;
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  order: number;
};
export type RecordType = {
  _id: string;
  name: string;
  isLocation: boolean;
  archivedAt?: number;
};
export type RecordCategory = {
  _id: string;
  name: string;
  color: string;
  order: number;
  archivedAt?: number;
};
export type TravelContext = {
  _id: string;
  fromRecordId: string;
  toRecordId: string;
  estimate?: string;
  calculation?: string;
  routeNote?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  distanceMiles?: number;
  expectedDurationMinutes?: number;
  source?: string;
  routeNotes?: string;
  requiresReview?: boolean;
};
export type LogisticsOverview = {
  profile: {
    carNumber?: string;
    makeModel?: string;
    fuelCapacityGallons?: number;
    stageMpg?: number;
    transitMpg?: number;
    defaultFuelReservePercent: number;
    documentAccessCodes: Array<{
      label: string;
      kind: "document" | "accessCode";
      value: string;
    }>;
  } | null;
  legs: Array<{
    _id: string;
    name: string;
    order: number;
    stageCount: number;
    stageMiles: number;
    transitMiles: number;
    startOrder?: number;
    precedingCar?: string;
    reservePercent?: number;
    fuelOverrideGallons?: number;
    fuelOverrideReason?: string;
    fuel: {
      available: boolean;
      formula: string;
      plannedFuelGallons?: number;
      calculatedPlannedFuelGallons?: number;
      capacityShortfallGallons?: number;
      overrideApplied?: boolean;
    };
  }>;
  travelContexts: Array<
    TravelContext & {
      fromName: string;
      toName: string;
      movements: Array<{ _id: string; title: string }>;
    }
  >;
  serviceIntervals: Array<{
    _id: string;
    name: string;
    scheduledStart: string;
    scheduledEnd: string;
    allowedDurationMinutes: number;
    fuelContext?: string;
    serviceContext?: string;
    movements: Array<{ _id: string; title: string }>;
  }>;
  weatherForecasts: Array<{
    _id: string;
    forecastDate: string;
    conditions: string;
    temperatureLow?: number;
    temperatureHigh?: number;
    precipitationPercent?: number;
    windMph?: number;
    source: string;
    asOf: number;
  }>;
  contacts: Array<{
    _id: string;
    title: string;
    name: string;
    organization?: string;
    phone?: string;
    email?: string;
  }>;
  supportLocations: Array<{
    _id: string;
    name: string;
    address?: string;
    supportCategories: string[];
  }>;
};

export type WorkItem = {
  _id: string;
  title: string;
  notes?: string;
  status: "open" | "inProgress" | "blocked" | "completed";
  completedAt?: number;
  priority?: "low" | "normal" | "high";
  dueContext?: string;
  assigneeId?: string;
  assigneeName?: string;
  completedByName?: string;
  recordId?: string;
  itineraryItemId?: string;
  updatedAt: number;
};

export type WorkItemComment = {
  _id: string;
  body: string;
  authorId: string;
  authorName?: string;
  createdAt: number;
};

export type WorkAssignee = {
  userId: string;
  name: string;
  role: "owner" | "manager" | "crew";
};

export type WorkTemplateItem = {
  title: string;
  notes?: string;
  priority: "low" | "normal" | "high";
  dueContext?: string;
};

export type WorkTemplate = {
  _id: string;
  name: string;
  items: WorkTemplateItem[];
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

export type EventContact = {
  id: string;
  type: "member" | "invitation";
  role: "owner" | "manager" | "crew";
  userId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
};

export type PlanChangeRecipient = {
  _id: string;
  userId: string;
  state: "sent" | "opened" | "acknowledged" | "acknowledgedElsewhere";
  sentAt: number;
  openedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgementNote?: string;
  name: string;
};

export type PublishedPlanChange = {
  _id: string;
  itineraryItemId: string;
  title: string;
  scheduledFor: string;
  scheduledUntil?: string;
  recordId?: string;
  previousTitle?: string;
  previousScheduledFor?: string;
  previousScheduledUntil?: string;
  movementTypeLabel?: string;
  tagLabels?: string[];
  assignmentLabels?: string[];
  previousMovementTypeLabel?: string;
  previousTagLabels?: string[];
  previousAssignmentLabels?: string[];
  previousRecordId?: string;
  reason: string;
  severity: "routine" | "critical";
  publishedAt: number;
  publishedByName: string;
  recipients: PlanChangeRecipient[];
  currentRecipient?: PlanChangeRecipient;
};

export type FormField = {
  id: string;
  label: string;
  type:
    | "text"
    | "shortText"
    | "longText"
    | "number"
    | "date"
    | "select"
    | "multiSelect"
    | "boolean"
    | "person"
    | "recordLink"
    | "file"
    | "photo";
  required: boolean;
  instructions?: string;
  options?: string[];
};
export type FormTemplate = {
  _id: string;
  name: string;
  version: number;
  fields: FormField[];
  /**
   * True when a newer version exists. Such a template is only returned because
   * the caller still has an unfinished draft against it.
   */
  isSuperseded?: boolean;
};
export type FormSubmission = {
  _id: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  fields: FormField[];
  answers: Record<string, unknown>;
  status: "draft" | "submitted";
  submittedAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  canEdit?: boolean;
};
export type EventActivity = {
  _id: string;
  actorId: string;
  actorName?: string;
  kind: string;
  message: string;
  objectType?: string;
  objectId?: string;
  objectLabel?: string;
  href?: string;
  createdAt: number;
};
export type EventComment = {
  _id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};
export type EventSource = {
  _id: string;
  title: string;
  url?: string;
  excerpt?: string;
  authorId: string;
  createdAt: number;
};
export type EventFile = {
  _id: string;
  recordId?: string;
  workItemId?: string;
  itineraryItemId?: string;
  name: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  createdAt: number;
  url: string | null;
};
export type PlanSection = {
  _id: string;
  name: string;
  kind: "day" | "session" | "leg";
  order: number;
  operationalDate?: string;
  boundaryTime?: string;
};
export type PlanExport = {
  _id: string;
  filterDay?: string;
  /** Undefined identifies a brief made before the versioned crew-brief model. */
  schemaVersion?: number;
  eventName?: string;
  timeZone: string;
  items: Array<{
    itineraryItemId: string;
    title: string;
    scheduledFor: string;
    location?: string;
    movementTypeLabel?: string;
    tagLabels?: string[];
    assignmentLabels?: string[];
    scheduledUntil?: string;
    timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
    section?: { name: string; kind: "day" | "session" | "leg" };
    tags?: string[];
    venue?: PlanExportVenue;
    assignedTo?: string;
    notes?: string;
  }>;
  appendices?: {
    venues: PlanExportVenue[];
    officialContacts: PlanExportContact[];
    travel: PlanExportTravel[];
    fuel: PlanExportVenue[];
    weather: PlanExportVenue[];
    supportServices: PlanExportVenue[];
  };
  inclusionOptions?: CrewBriefInclusionOptions;
  logistics?: {
    documentAccessCodes: Array<{
      label: string;
      kind: "document" | "accessCode";
      value: string;
    }>;
  };
  generatedAt: number;
  generatedByName?: string;
  isSuperseded?: boolean;
};
export type CrewBriefInclusionOptions = {
  profile: boolean;
  rallyFuel: boolean;
  service: boolean;
  weather: boolean;
  travelRoutes: boolean;
  supportServices: boolean;
  documentAccessCodes: boolean;
  externalContactIds: string[];
};
export type PlanExportVenue = {
  name: string;
  address?: string;
  accessNotes?: string;
  hours?: string;
  contactDetail?: string;
  notes?: string;
  tags?: string[];
};
export type PlanExportContact = {
  name: string;
  role?: string;
  email?: string;
  phoneNumber?: string;
  contactDetail?: string;
  notes?: string;
};
export type PlanExportTravel = {
  from: string;
  to: string;
  estimate: string;
  calculation?: string;
  routeNote?: string;
};

export type PlanImportIssue = {
  severity: "error" | "warning";
  field: string;
  message: string;
};
export type PlanImportRow = {
  _id: string;
  sourcePage?: number;
  sourceRow: number;
  rawValues: Record<string, string>;
  operationalDay?: string;
  normalizedDate?: string;
  normalizedTime?: string;
  normalizedEndTime?: string;
  placeText?: string;
  proposedVenueId?: string;
  description: string;
  rawPersonnel?: string;
  resolvedAssignments: string[];
  proposedMovementType:
    "exact" | "approximate" | "range" | "allDay" | "unspecified";
  proposedTags: string[];
  fieldConfidence: {
    date: number;
    time: number;
    place: number;
    description: number;
    personnel: number;
    movementType: number;
    tags: number;
  };
  issues: PlanImportIssue[];
  warningsAccepted: boolean;
  importedMovementId?: string;
};
export type PlanImport = {
  _id: string;
  sourceKind: "pdf" | "csv" | "xlsx" | "pasted";
  sourceName: string;
  sourceFileId?: string;
  status: "reviewing" | "committed" | "rolledBack";
  detectedSections: string[];
  createdAt: number;
  committedMovementCount?: number;
  rows?: PlanImportRow[];
};

/**
 * Typed references for the event feature while the environment-owned Convex
 * codegen command is unavailable in an isolated worktree.
 */
export const eventsApi = {
  create: makeFunctionReference<
    "mutation",
    { name: string; timeZone: string },
    string
  >("events:create"),
  createSample: makeFunctionReference<
    "mutation",
    Record<string, never>,
    string
  >("events:createSample"),
  removeSample: makeFunctionReference<"mutation", { eventId: string }, null>(
    "events:removeSample",
  ),
  listArchived: makeFunctionReference<
    "query",
    Record<string, never>,
    ArchivedEventSummary[]
  >("events:listArchived"),
  archive: makeFunctionReference<"mutation", { eventId: string }, null>(
    "events:archive",
  ),
  restore: makeFunctionReference<"mutation", { eventId: string }, null>(
    "events:restore",
  ),
  permanentlyDelete: makeFunctionReference<
    "mutation",
    { eventId: string },
    null
  >("events:permanentlyDelete"),
  list: makeFunctionReference<"query", Record<string, never>, EventSummary[]>(
    "events:list",
  ),
};

export const itineraryApi = {
  list: makeFunctionReference<"query", { eventId: string }, ItineraryItem[]>(
    "itinerary:list",
  ),
  listArchived: makeFunctionReference<
    "query",
    { eventId: string },
    ItineraryItem[]
  >("itinerary:listArchived"),
  get: makeFunctionReference<
    "query",
    { eventId: string; itemId: string },
    ItineraryItem
  >("itinerary:get"),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      scheduledFor: string;
      scheduledUntil?: string;
      location?: string;
      recordId?: string;
      travelContextId?: string;
      serviceIntervalId?: string;
      notes?: string;
      movementTypeId?: string | null;
      sectionId?: string;
      operationalDay?: string;
      displayTime?: "standard" | "2400";
      timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
    },
    string
  >("itinerary:create"),
  createWithVenue: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      scheduledFor: string;
      scheduledUntil?: string;
      location?: string;
      notes?: string;
      travelContextId?: string;
      serviceIntervalId?: string;
      movementTypeId?: string | null;
      sectionId?: string;
      operationalDay?: string;
      displayTime?: "standard" | "2400";
      timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
      venueName: string;
      venueAddress?: string;
    },
    string
  >("itinerary:createWithVenue"),
  listUnlinked: makeFunctionReference<
    "query",
    { eventId: string },
    Array<{
      itemId: string;
      title: string;
      location?: string;
      candidates: Array<{
        recordId: string;
        name: string;
        type: string;
        address?: string;
        match: "exact" | "fuzzy";
        score: number;
      }>;
    }>
  >("itinerary:listUnlinked"),
  reconcileLinks: makeFunctionReference<
    "mutation",
    { eventId: string; links: Array<{ itemId: string; recordId: string }> },
    null
  >("itinerary:reconcileLinks"),
  createMany: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      items: Array<{
        eventId: string;
        title: string;
        scheduledFor: string;
        scheduledUntil?: string;
         location?: string;
         recordId?: string;
         travelContextId?: string;
         serviceIntervalId?: string;
         notes?: string;
         movementTypeId?: string | null;
         sectionId?: string;
         operationalDay?: string;
         displayTime?: "standard" | "2400";
         tagIds: string[];
         teamId?: string;
         timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
      }>;
    },
    string[]
  >("itinerary:createMany"),
  update: makeFunctionReference<
    "mutation",
    {
      itemId: string;
      eventId: string;
      title: string;
      scheduledFor: string;
      scheduledUntil?: string;
      location?: string;
      recordId?: string;
      travelContextId?: string;
      serviceIntervalId?: string;
      notes?: string;
      movementTypeId?: string | null;
      sectionId?: string;
      operationalDay?: string;
      displayTime?: "standard" | "2400";
      timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
    },
    null
  >("itinerary:update"),
  archive: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string },
    null
  >("itinerary:archive"),
  restore: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string },
    null
  >("itinerary:restore"),
};

export const movementsApi = {
  ensureDefaults: makeFunctionReference<"mutation", { eventId: string }, null>(
    "movements:ensureDefaults",
  ),
  listDirectory: makeFunctionReference<
    "query",
    { eventId: string },
    MovementDirectory
  >("movements:listDirectory"),
  createType: makeFunctionReference<
    "mutation",
    { eventId: string; name: string },
    string
  >("movements:createType"),
  createTag: makeFunctionReference<
    "mutation",
    { eventId: string; name: string },
    string
  >("movements:createTag"),
  createTeam: makeFunctionReference<
    "mutation",
    { eventId: string; name: string },
    string
  >("movements:createTeam"),
  createOperationalRole: makeFunctionReference<
    "mutation",
    { eventId: string; name: string },
    string
  >("movements:createOperationalRole"),
  setTags: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string; tagIds: string[] },
    null
  >("movements:setTags"),
  setAssignments: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      itemId: string;
      assignments: Array<
        | { targetKind: "member"; targetUserId: string }
        | { targetKind: "team"; teamId: string }
        | { targetKind: "operationalRole"; operationalRoleId: string }
      >;
    },
    null
  >("movements:setAssignments"),
};

export const logisticsApi = {
  getOverview: makeFunctionReference<
    "query",
    { eventId: string },
    LogisticsOverview
  >("logistics:getOverview"),
  saveProfile: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      carNumber?: string;
      makeModel?: string;
      fuelCapacityGallons?: number;
      stageMpg?: number;
      transitMpg?: number;
      defaultFuelReservePercent: number;
      documentAccessCodes: Array<{
        label: string;
        kind: "document" | "accessCode";
        value: string;
      }>;
    },
    null
  >("logistics:saveProfile"),
  createLeg: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      name: string;
      order: number;
      stageCount: number;
      stageMiles: number;
      transitMiles: number;
      startOrder?: number;
      precedingCar?: string;
      reservePercent?: number;
      fuelOverrideGallons?: number;
      fuelOverrideReason?: string;
    },
    string
  >("logistics:createLeg"),
  createServiceInterval: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      name: string;
      scheduledStart: string;
      scheduledEnd: string;
      allowedDurationMinutes: number;
      fuelContext?: string;
      serviceContext?: string;
    },
    string
  >("logistics:createServiceInterval"),
  createWeatherForecast: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      forecastDate: string;
      conditions: string;
      temperatureLow?: number;
      temperatureHigh?: number;
      precipitationPercent?: number;
      windMph?: number;
      source: string;
      asOf: number;
    },
    string
  >("logistics:createWeatherForecast"),
  createExternalContact: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      name: string;
      organization?: string;
      phone?: string;
      email?: string;
    },
    string
  >("logistics:createExternalContact"),
};

export const planImportsApi = {
  list: makeFunctionReference<"query", { eventId: string }, PlanImport[]>(
    "planImports:list",
  ),
  get: makeFunctionReference<
    "query",
    { eventId: string; importId: string },
    PlanImport & { rows: PlanImportRow[] }
  >("planImports:get"),
  stage: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      sourceKind: PlanImport["sourceKind"];
      sourceName: string;
      sourceFileId?: string;
      detectedSections: string[];
      rows: Array<Omit<PlanImportRow, "_id" | "importedMovementId">>;
    },
    string
  >("planImports:stage"),
  updateRow: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      importId: string;
      rowId: string;
    } & Omit<PlanImportRow, "_id" | "importedMovementId">,
    null
  >("planImports:updateRow"),
  commit: makeFunctionReference<
    "mutation",
    { eventId: string; importId: string },
    { importId: string; movementCount: number }
  >("planImports:commit"),
  rollback: makeFunctionReference<
    "mutation",
    { eventId: string; importId: string },
    { movementCount: number }
  >("planImports:rollback"),
};

export const recordsApi = {
  list: makeFunctionReference<"query", { eventId: string }, EventRecord[]>(
    "records:list",
  ),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      name: string;
      type: (typeof recordTypes)[number];
      recordTypeId?: string;
      address?: string;
      notes?: string;
      fieldValues?: Record<string, string>;
      supportCategories?: EventRecord["supportCategories"];
    },
    string
  >("records:create"),
  update: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      recordId: string;
      name: string;
      type: (typeof recordTypes)[number];
      /** Omit to keep the configured type, `null` to clear it. */
      recordTypeId?: string | null;
      address?: string;
      notes?: string;
      fieldValues?: Record<string, string>;
      supportCategories?: EventRecord["supportCategories"];
    },
    null
  >("records:update"),
  get: makeFunctionReference<
    "query",
    { eventId: string; recordId: string },
    EventRecord & {
      categories: RecordCategory[];
      travelContexts: TravelContext[];
      fields: RecordField[];
    }
  >("records:get"),
  saveVenueDetails: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      recordId: string;
      address?: string;
      /** Omit to keep stored coordinates, `null` to clear them. */
      latitude?: number | null;
      longitude?: number | null;
      accessNotes?: string;
      hours?: string;
      contactDetail?: string;
      confirmationStatus: "unconfirmed" | "confirmed";
      confirmationSource?: string;
    },
    null
  >("records:saveVenueDetails"),
  listTypes: makeFunctionReference<"query", { eventId: string }, RecordType[]>(
    "records:listTypes",
  ),
  listFields: makeFunctionReference<
    "query",
    { eventId: string },
    RecordField[]
  >("records:listFields"),
  createField: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      label: string;
      type: "text" | "select";
      options?: string[];
    },
    string
  >("records:createField"),
  updateField: makeFunctionReference<
    "mutation",
    { eventId: string; fieldId: string; label: string; options?: string[] },
    null
  >("records:updateField"),
  reorderFields: makeFunctionReference<
    "mutation",
    { eventId: string; fieldIds: string[] },
    null
  >("records:reorderFields"),
  createType: makeFunctionReference<
    "mutation",
    { eventId: string; name: string; isLocation: boolean },
    string
  >("records:createType"),
  archiveType: makeFunctionReference<
    "mutation",
    { eventId: string; typeId: string },
    null
  >("records:archiveType"),
  restoreType: makeFunctionReference<
    "mutation",
    { eventId: string; typeId: string },
    null
  >("records:restoreType"),
  listCategories: makeFunctionReference<
    "query",
    { eventId: string },
    RecordCategory[]
  >("records:listCategories"),
  createCategory: makeFunctionReference<
    "mutation",
    { eventId: string; name: string; color: string },
    string
  >("records:createCategory"),
  archiveCategory: makeFunctionReference<
    "mutation",
    { eventId: string; categoryId: string },
    null
  >("records:archiveCategory"),
  restoreCategory: makeFunctionReference<
    "mutation",
    { eventId: string; categoryId: string },
    null
  >("records:restoreCategory"),
  assignCategory: makeFunctionReference<
    "mutation",
    { eventId: string; recordId: string; categoryId: string },
    null
  >("records:assignCategory"),
  removeCategory: makeFunctionReference<
    "mutation",
    { eventId: string; recordId: string; categoryId: string },
    null
  >("records:removeCategory"),
  mergeCategory: makeFunctionReference<
    "mutation",
    { eventId: string; sourceCategoryId: string; targetCategoryId: string },
    null
  >("records:mergeCategory"),
  listTravel: makeFunctionReference<
    "query",
    { eventId: string },
    TravelContext[]
  >("records:listTravel"),
  saveTravel: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      travelId?: string;
      fromRecordId: string;
      toRecordId: string;
      estimate?: string;
      calculation?: string;
      routeNote?: string;
      distanceMiles?: number;
      expectedDurationMinutes?: number;
      source?: string;
      routeNotes?: string;
    },
    string | null
  >("records:saveTravel"),
};

export const filesApi = {
  generateUploadUrl: makeFunctionReference<
    "mutation",
    { eventId: string },
    string
  >("files:generateUploadUrl"),
  save: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      recordId?: string;
      workItemId?: string;
      itineraryItemId?: string;
      storageId: string;
      name: string;
    },
    string
  >("files:save"),
  list: makeFunctionReference<"query", { eventId: string }, EventFile[]>(
    "files:list",
  ),
  remove: makeFunctionReference<
    "mutation",
    { eventId: string; fileId: string },
    null
  >("files:remove"),
};

export const workApi = {
  list: makeFunctionReference<"query", { eventId: string }, WorkItem[]>(
    "work:list",
  ),
  get: makeFunctionReference<
    "query",
    { eventId: string; itemId: string },
    WorkItem
  >("work:get"),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      notes?: string;
      priority?: "low" | "normal" | "high";
      dueContext?: string;
      assigneeId?: string;
      recordId?: string | null;
      itineraryItemId?: string | null;
      status?: WorkItem["status"];
    },
    string
  >("work:create"),
  update: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      itemId: string;
      title: string;
      notes?: string;
      priority?: "low" | "normal" | "high";
      dueContext?: string;
      assigneeId?: string;
      recordId?: string | null;
      itineraryItemId?: string | null;
      status?: WorkItem["status"];
    },
    null
  >("work:update"),
  setCompletion: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string; completed: boolean },
    null
  >("work:setCompletion"),
  setCompletionOffline: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      itemId: string;
      completed: boolean;
      operationId: string;
      expectedUpdatedAt: number;
      expectedStatus: WorkItem["status"];
    },
    { outcome: "applied" | "replayed" | "alreadyApplied" }
  >("work:setCompletionOffline"),
  listAssignees: makeFunctionReference<
    "query",
    { eventId: string },
    WorkAssignee[]
  >("work:listAssignees"),
  listComments: makeFunctionReference<
    "query",
    { eventId: string; itemId: string },
    WorkItemComment[]
  >("work:listComments"),
  addComment: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string; body: string },
    string
  >("work:addComment"),
};

export type SetupStepStatus = {
  id: "profile" | "movement" | "crew";
  completed: boolean;
  dismissed: boolean;
};

export const setupApi = {
  status: makeFunctionReference<
    "query",
    { eventId: string },
    SetupStepStatus[]
  >("setup:status"),
  dismiss: makeFunctionReference<
    "mutation",
    { eventId: string; step: SetupStepStatus["id"] },
    null
  >("setup:dismiss"),
};

export const workTemplatesApi = {
  list: makeFunctionReference<"query", { eventId: string }, WorkTemplate[]>(
    "workTemplates:list",
  ),
  listArchived: makeFunctionReference<
    "query",
    { eventId: string },
    WorkTemplate[]
  >("workTemplates:listArchived"),
  create: makeFunctionReference<
    "mutation",
    { eventId: string; name: string; items: WorkTemplateItem[] },
    string
  >("workTemplates:create"),
  apply: makeFunctionReference<
    "mutation",
    { eventId: string; templateId: string },
    string[]
  >("workTemplates:apply"),
  archive: makeFunctionReference<
    "mutation",
    { eventId: string; templateId: string },
    null
  >("workTemplates:archive"),
  restore: makeFunctionReference<
    "mutation",
    { eventId: string; templateId: string },
    null
  >("workTemplates:restore"),
};

export const invitationsApi = {
  syncProfile: makeFunctionReference<
    "mutation",
    Record<string, never>,
    unknown
  >("invitations:syncProfile"),
  claim: makeFunctionReference<
    "mutation",
    Record<string, never>,
    { claimedCount: number; requiresVerifiedEmail: boolean }
  >("invitations:claim"),
  listContacts: makeFunctionReference<
    "query",
    { eventId: string },
    EventContact[]
  >("invitations:listContacts"),
  revoke: makeFunctionReference<
    "mutation",
    { eventId: string; invitationId: string },
    null
  >("invitations:revoke"),
  updateMemberRole: makeFunctionReference<
    "mutation",
    { eventId: string; membershipId: string; role: "manager" | "crew" },
    null
  >("invitations:updateMemberRole"),
  removeMember: makeFunctionReference<
    "mutation",
    { eventId: string; membershipId: string },
    null
  >("invitations:removeMember"),
};

export const planChangesApi = {
  recipients: makeFunctionReference<
    "query",
    { eventId: string },
    Array<{ userId: string; role: "owner" | "manager" | "crew"; name: string }>
  >("planChanges:recipients"),
  publish: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      itemId: string;
      reason: string;
      severity: "routine" | "critical";
      recipientUserIds: string[];
    },
    string
  >("planChanges:publish"),
  listForPublisher: makeFunctionReference<
    "query",
    { eventId: string },
    PublishedPlanChange[]
  >("planChanges:listForPublisher"),
  listForMovement: makeFunctionReference<
    "query",
    { eventId: string; itemId: string },
    PublishedPlanChange[]
  >("planChanges:listForMovement"),
  listForMe: makeFunctionReference<
    "query",
    { eventId: string },
    Array<{
      recipient: PlanChangeRecipient;
      change: PublishedPlanChange | null;
    }>
  >("planChanges:listForMe"),
  acknowledge: makeFunctionReference<
    "mutation",
    { eventId: string; recipientId: string },
    null
  >("planChanges:acknowledge"),
  markOpened: makeFunctionReference<
    "mutation",
    { eventId: string; recipientId: string },
    null
  >("planChanges:markOpened"),
  acknowledgeElsewhere: makeFunctionReference<
    "mutation",
    { eventId: string; recipientId: string; note?: string },
    null
  >("planChanges:acknowledgeElsewhere"),
};

export const formsApi = {
  listTemplates: makeFunctionReference<
    "query",
    { eventId: string },
    FormTemplate[]
  >("forms:listTemplates"),
  createTemplate: makeFunctionReference<
    "mutation",
    { eventId: string; name: string; fields: FormField[] },
    string
  >("forms:createTemplate"),
  createTemplateVersion: makeFunctionReference<
    "mutation",
    { eventId: string; templateId: string; name: string; fields: FormField[] },
    string
  >("forms:createTemplateVersion"),
  listMySubmissions: makeFunctionReference<
    "query",
    { eventId: string },
    FormSubmission[]
  >("forms:listMySubmissions"),
  listSubmissions: makeFunctionReference<
    "query",
    { eventId: string; status?: "draft" | "submitted" },
    FormSubmission[]
  >("forms:listSubmissions"),
  getSubmission: makeFunctionReference<
    "query",
    { eventId: string; submissionId: string },
    FormSubmission
  >("forms:getSubmission"),
  saveDraft: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      templateId: string;
      submissionId?: string;
      answers: Record<string, unknown>;
    },
    string
  >("forms:saveDraft"),
  submit: makeFunctionReference<
    "mutation",
    { eventId: string; submissionId: string },
    null
  >("forms:submit"),
};
export const activityApi = {
  list: makeFunctionReference<
    "query",
    { eventId: string },
    {
      activity: EventActivity[];
      comments: EventComment[];
      sources: EventSource[];
    }
  >("activity:list"),
  addComment: makeFunctionReference<
    "mutation",
    { eventId: string; body: string },
    string
  >("activity:addComment"),
  addSource: makeFunctionReference<
    "mutation",
    { eventId: string; title: string; url?: string; excerpt?: string },
    string
  >("activity:addSource"),
};
export const planSectionsApi = {
  list: makeFunctionReference<"query", { eventId: string }, PlanSection[]>(
    "planSections:list",
  ),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      name: string;
      kind: "day" | "session" | "leg";
      operationalDate?: string;
      boundaryTime?: string;
    },
    string
  >("planSections:create"),
  update: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      sectionId: string;
      name: string;
      kind: "day" | "session" | "leg";
      operationalDate?: string;
      boundaryTime?: string;
    },
    null
  >("planSections:update"),
  reorder: makeFunctionReference<
    "mutation",
    { eventId: string; sectionIds: string[] },
    null
  >("planSections:reorder"),
};

export const planExportsApi = {
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      filterDay?: string;
      inclusionOptions?: CrewBriefInclusionOptions;
    },
    Omit<PlanExport, "isSuperseded">
  >("planExports:create"),
  list: makeFunctionReference<"query", { eventId: string }, PlanExport[]>(
    "planExports:list",
  ),
};
