import { makeFunctionReference } from "convex/server";

export type EventRole = "owner" | "manager" | "crew";

export type EventSummary = {
  id: string;
  name: string;
  timeZone: string;
  role: EventRole;
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
  status: "open" | "completed";
  completedAt?: number;
  priority?: "low" | "normal" | "high";
  dueContext?: string;
  assigneeId?: string;
};

export type WorkAssignee = {
  userId: string;
  name?: string;
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
};

export type WorkAutomationRule = {
  _id: string;
  name: string;
  trigger: "planChangePublished" | "workCompleted";
  action: "createWorkItem" | "notifyAssignee";
  itemTitle?: string;
  enabled: boolean;
};

export type EventContact = {
  id: string;
  type: "member" | "invitation";
  role: "owner" | "manager" | "crew";
  userId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
};

export type PlanChangeRecipient = {
  _id: string;
  userId: string;
  state: "sent" | "opened" | "acknowledged" | "acknowledgedElsewhere";
  sentAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  acknowledgementNote?: string;
  name?: string;
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
  recipients: PlanChangeRecipient[];
};

export type FormField = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiSelect" | "boolean";
  required: boolean;
  instructions?: string;
  options?: string[];
};
export type FormTemplate = {
  _id: string;
  name: string;
  version: number;
  fields: FormField[];
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
  kind: "comment" | "source";
  message: string;
  createdAt: number;
};
export type EventComment = {
  _id: string;
  body: string;
  authorId: string;
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
export type PlanSection = {
  _id: string;
  name: string;
  kind: "day" | "session" | "leg";
  order: number;
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
  list: makeFunctionReference<"query", Record<string, never>, EventSummary[]>(
    "events:list",
  ),
};

export const itineraryApi = {
  list: makeFunctionReference<"query", { eventId: string }, ItineraryItem[]>(
    "itinerary:list",
  ),
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
      recordTypeId?: string;
      address?: string;
      notes?: string;
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
      latitude?: number;
      longitude?: number;
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

export const workApi = {
  list: makeFunctionReference<"query", { eventId: string }, WorkItem[]>(
    "work:list",
  ),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      notes?: string;
      priority?: "low" | "normal" | "high";
      dueContext?: string;
      assigneeId?: string;
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
    },
    null
  >("work:update"),
  setCompletion: makeFunctionReference<
    "mutation",
    { eventId: string; itemId: string; completed: boolean },
    null
  >("work:setCompletion"),
  listAssignees: makeFunctionReference<
    "query",
    { eventId: string },
    WorkAssignee[]
  >("work:listAssignees"),
};

export const workTemplatesApi = {
  list: makeFunctionReference<"query", { eventId: string }, WorkTemplate[]>(
    "workTemplates:list",
  ),
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
};

export const workAutomationApi = {
  list: makeFunctionReference<
    "query",
    { eventId: string },
    WorkAutomationRule[]
  >("workAutomation:list"),
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      name: string;
      trigger: WorkAutomationRule["trigger"];
      action: WorkAutomationRule["action"];
      itemTitle?: string;
    },
    string
  >("workAutomation:create"),
  setEnabled: makeFunctionReference<
    "mutation",
    { eventId: string; ruleId: string; enabled: boolean },
    null
  >("workAutomation:setEnabled"),
};

export const invitationsApi = {
  syncProfile: makeFunctionReference<"mutation", Record<string, never>, null>(
    "invitations:syncProfile",
  ),
  claim: makeFunctionReference<"mutation", Record<string, never>, null>(
    "invitations:claim",
  ),
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
