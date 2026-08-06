import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const field = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(v.literal("text"), v.literal("boolean")),
  required: v.boolean(),
});

type FormField = {
  id: string;
  label: string;
  type: "text" | "boolean";
  required: boolean;
};
type Answers = Record<string, string | boolean | undefined>;

function validateFields(fields: FormField[]) {
  if (fields.length === 0 || fields.length > 30)
    throw new Error("A form needs between 1 and 30 fields");
  const ids = new Set<string>();
  return fields.map((item) => {
    const id = item.id.trim();
    const label = item.label.trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(id) || ids.has(id))
      throw new Error("Each field needs a unique identifier");
    if (label.length === 0 || label.length > 160)
      throw new Error("Field labels must be between 1 and 160 characters");
    ids.add(id);
    return { ...item, id, label };
  });
}

function validateTemplateName(name: string) {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 120)
    throw new Error("Template name must be between 1 and 120 characters");
  return normalized;
}

function missingRequiredFields(fields: FormField[], answers: Answers) {
  return fields.filter(
    (item) =>
      item.required &&
      (answers[item.id] === undefined || answers[item.id] === ""),
  );
}

async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (index) =>
      index.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (membership === null) throw new Error("Forbidden");
  return { identity, membership };
}

export const listTemplates = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireMembership(ctx, eventId);
    return ctx.db
      .query("formTemplates")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
  },
});

export const createTemplate = mutation({
  args: { eventId: v.id("events"), name: v.string(), fields: v.array(field) },
  handler: async (ctx, { eventId, name, fields }) => {
    const { identity, membership } = await requireMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    return ctx.db.insert("formTemplates", {
      eventId,
      name: validateTemplateName(name),
      version: 1,
      fields: validateFields(fields),
      createdBy: identity.subject,
      createdAt: Date.now(),
    });
  },
});

export const listMySubmissions = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    return ctx.db
      .query("formSubmissions")
      .withIndex("by_eventId_createdBy", (index) =>
        index.eq("eventId", eventId).eq("createdBy", identity.subject),
      )
      .collect();
  },
});

export const saveDraft = mutation({
  args: {
    eventId: v.id("events"),
    templateId: v.id("formTemplates"),
    submissionId: v.optional(v.id("formSubmissions")),
    answers: v.any(),
  },
  handler: async (ctx, { eventId, templateId, submissionId, answers }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const template = await ctx.db.get(templateId);
    if (template === null || template.eventId !== eventId)
      throw new Error("Form template not found");
    const now = Date.now();
    if (submissionId === undefined)
      return ctx.db.insert("formSubmissions", {
        eventId,
        templateId,
        templateName: template.name,
        templateVersion: template.version,
        fields: template.fields,
        answers,
        status: "draft",
        createdBy: identity.subject,
        createdAt: now,
        updatedAt: now,
      });
    const submission = await ctx.db.get(submissionId);
    if (
      submission === null ||
      submission.eventId !== eventId ||
      submission.createdBy !== identity.subject ||
      submission.status !== "draft"
    )
      throw new Error("Draft form not found");
    await ctx.db.patch(submissionId, { answers, updatedAt: now });
    return submissionId;
  },
});

export const submit = mutation({
  args: { eventId: v.id("events"), submissionId: v.id("formSubmissions") },
  handler: async (ctx, { eventId, submissionId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const submission = await ctx.db.get(submissionId);
    if (
      submission === null ||
      submission.eventId !== eventId ||
      submission.createdBy !== identity.subject ||
      submission.status !== "draft"
    )
      throw new Error("Draft form not found");
    const missing = missingRequiredFields(
      submission.fields,
      submission.answers as Answers,
    );
    if (missing.length > 0)
      throw new Error(
        `Complete required fields: ${missing.map((item) => item.label).join(", ")}`,
      );
    await ctx.db.patch(submissionId, {
      status: "submitted",
      submittedBy: identity.subject,
      submittedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export { missingRequiredFields, validateFields, validateTemplateName };
