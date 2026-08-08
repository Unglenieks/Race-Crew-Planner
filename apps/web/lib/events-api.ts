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
  location?: string;
  recordId?: string;
  notes?: string;
  timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
  archivedAt?: number;
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
  estimate: string;
  calculation?: string;
  routeNote?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
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
  previousTitle?: string;
  previousScheduledFor?: string;
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
};
export type PlanExport = {
  _id: string;
  filterDay?: string;
  timeZone: string;
  items: Array<{
    itineraryItemId: string;
    title: string;
    scheduledFor: string;
    location?: string;
  }>;
  generatedAt: number;
  isSuperseded?: boolean;
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
      location?: string;
      recordId?: string;
      notes?: string;
      timeKind?: "exact" | "approximate" | "range" | "allDay" | "unspecified";
    },
    string
  >("itinerary:create"),
  update: makeFunctionReference<
    "mutation",
    {
      itemId: string;
      eventId: string;
      title: string;
      scheduledFor: string;
      location?: string;
      recordId?: string;
      notes?: string;
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
    },
    null
  >("records:update"),
  get: makeFunctionReference<
    "query",
    { eventId: string; recordId: string },
    EventRecord & {
      categories: RecordCategory[];
      travelContexts: TravelContext[];
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
      estimate: string;
      calculation?: string;
      routeNote?: string;
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
    },
    { replayed: boolean }
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
    { eventId: string; name: string; kind: "day" | "session" | "leg" },
    string
  >("planSections:create"),
};

export const planExportsApi = {
  create: makeFunctionReference<
    "mutation",
    { eventId: string; filterDay?: string },
    Omit<PlanExport, "isSuperseded">
  >("planExports:create"),
  list: makeFunctionReference<"query", { eventId: string }, PlanExport[]>(
    "planExports:list",
  ),
};
