import { makeFunctionReference } from "convex/server";

export type EventSummary = {
  id: string;
  name: string;
  timeZone: string;
  role: "owner" | "manager" | "crew";
};

export type ItineraryItem = {
  _id: string;
  title: string;
  scheduledFor: string;
  location?: string;
  recordId?: string;
  notes?: string;
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
  type: (typeof recordTypes)[number];
  address?: string;
  notes?: string;
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
  type: "text" | "boolean";
  required: boolean;
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
  answers: Record<string, string | boolean | undefined>;
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
  create: makeFunctionReference<
    "mutation",
    {
      eventId: string;
      title: string;
      scheduledFor: string;
      location?: string;
      recordId?: string;
      notes?: string;
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
      type: EventRecord["type"];
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
      type: EventRecord["type"];
      address?: string;
      notes?: string;
    },
    null
  >("records:update"),
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
      answers: Record<string, string | boolean | undefined>;
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
