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
