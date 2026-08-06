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

export type EventContact = {
  id: string;
  type: "member" | "invitation";
  role: "owner" | "manager" | "crew";
  userId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
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
