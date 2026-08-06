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
