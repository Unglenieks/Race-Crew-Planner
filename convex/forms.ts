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
  type: v.union(
    v.literal("text"),
    v.literal("number"),
    v.literal("date"),
    v.literal("select"),
    v.literal("multiSelect"),
    v.literal("boolean"),
  ),
  required: v.boolean(),
  instructions: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export type FormField = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiSelect" | "boolean";
  required: boolean;
  instructions?: string;
  options?: string[];
};
export type Answers = Record<string, unknown>;

function hasAnswer(value: unknown) {
  return !(
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validateFields(fields: FormField[]) {
  if (fields.length === 0 || fields.length > 30)
    throw new Error("A form needs between 1 and 30 fields");
  const ids = new Set<string>();
  return fields.map((item) => {
    const id = item.id.trim();
    const label = item.label.trim();
    const instructions = item.instructions?.trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(id) || ids.has(id))
      throw new Error("Each field needs a unique identifier");
    if (label.length === 0 || label.length > 160)
      throw new Error("Field labels must be between 1 and 160 characters");
    if (instructions !== undefined && instructions.length > 500)
      throw new Error("Field instructions must be 500 characters or fewer");
    const options = item.options?.map((option) => option.trim()) ?? [];
    if (item.type === "select" || item.type === "multiSelect") {
      if (options.length < 2 || options.length > 50 || options.some((x) => !x))
        throw new Error("Choice fields need between 2 and 50 named options");
      if (new Set(options).size !== options.length)
        throw new Error("Choice field options must be unique");
    } else if (options.length > 0) {
      throw new Error("Only choice fields can have options");
    }
    ids.add(id);
    return {
      id,
      label,
      type: item.type,
      required: item.required,
      ...(instructions ? { instructions } : {}),
      ...(options.length > 0 ? { options } : {}),
    };
  });
}

export function validateTemplateName(name: string) {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 120)
    throw new Error("Template name must be between 1 and 120 characters");
  return normalized;
}

/**
 * Why an answer is unacceptable, kept separate from the wording shown to people.
 *
 * `missing` is recoverable — a draft is allowed to be incomplete — while
 * `unknown` and `invalid` mean the payload does not fit the captured schema and
 * must never be stored. Behaviour must key off these codes, never off the
 * message text, so copy edits cannot change what the server accepts.
 */
export type IssueCode = "missing" | "unknown" | "invalid";
export type FieldIssue = { code: IssueCode; message: string };

const issueMessages: Record<string, string> = {
  unknown: "This answer is not part of this form.",
  missing: "This field is required.",
};

function invalidMessage(type: FormField["type"]) {
  switch (type) {
    case "text":
      return "Enter text.";
    case "number":
      return "Enter a number.";
    case "date":
      return "Enter a date.";
    case "boolean":
      return "Choose yes or no.";
    case "select":
      return "Choose one of the listed options.";
    case "multiSelect":
      return "Choose one or more listed options.";
  }
}

function isValidAnswer(item: FormField, value: unknown) {
  switch (item.type) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "boolean":
      return typeof value === "boolean";
    case "select":
      return (
        typeof value === "string" && item.options?.includes(value) === true
      );
    case "multiSelect":
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(
          (option) =>
            typeof option === "string" && item.options?.includes(option),
        )
      );
  }
}

/** Every problem with a payload, each tagged with a machine-readable code. */
export function codedIssues(
  fields: FormField[],
  answers: Answers,
): Record<string, FieldIssue> {
  const known = new Set(fields.map((item) => item.id));
  const issues: Record<string, FieldIssue> = {};

  for (const id of Object.keys(answers)) {
    if (!known.has(id))
      issues[id] = { code: "unknown", message: issueMessages.unknown };
  }

  for (const item of fields) {
    const value = answers[item.id];
    if (!hasAnswer(value)) {
      if (item.required)
        issues[item.id] = { code: "missing", message: issueMessages.missing };
      continue;
    }
    if (!isValidAnswer(item, value))
      issues[item.id] = {
        code: "invalid",
        message: invalidMessage(item.type),
      };
  }

  return issues;
}

/**
 * Problems that block *saving* as opposed to blocking submission. A draft may be
 * incomplete, so `missing` is excluded; a draft may never be malformed.
 */
export function blockingIssues(fields: FormField[], answers: Answers) {
  return Object.entries(codedIssues(fields, answers)).filter(
    ([, issue]) => issue.code !== "missing",
  );
}

/** Flattens to `id -> message`, for callers that only render the text. */
export function validationIssues(fields: FormField[], answers: Answers) {
  return Object.fromEntries(
    Object.entries(codedIssues(fields, answers)).map(([id, issue]) => [
      id,
      issue.message,
    ]),
  );
}

export function missingRequiredFields(fields: FormField[], answers: Answers) {
  return fields.filter((item) => item.required && !hasAnswer(answers[item.id]));
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

/**
 * Templates a member can still act on.
 *
 * Superseded versions are normally hidden, but one is still returned when the
 * caller has an unfinished draft against it. Without this, publishing a new
 * version silently strands in-progress inspections: the draft row survives but
 * no screen can reach it, so the work has to be redone from scratch.
 */
export const listTemplates = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const templates = await ctx.db
      .query("formTemplates")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
    const mySubmissions = await ctx.db
      .query("formSubmissions")
      .withIndex("by_eventId_createdBy", (index) =>
        index.eq("eventId", eventId).eq("createdBy", identity.subject),
      )
      .collect();
    const templatesWithMyDraft = new Set(
      mySubmissions
        .filter((submission) => submission.status === "draft")
        .map((submission) => submission.templateId),
    );

    return templates
      .filter(
        (template) =>
          template.isCurrent !== false ||
          templatesWithMyDraft.has(template._id),
      )
      .map((template) => ({
        ...template,
        // Lets the UI label a stranded draft instead of presenting a superseded
        // schema as if it were the live one.
        isSuperseded: template.isCurrent === false,
      }));
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
      isCurrent: true,
      fields: validateFields(fields),
      createdBy: identity.subject,
      createdAt: Date.now(),
    });
  },
});

export const createTemplateVersion = mutation({
  args: {
    eventId: v.id("events"),
    templateId: v.id("formTemplates"),
    name: v.string(),
    fields: v.array(field),
  },
  handler: async (ctx, { eventId, templateId, name, fields }) => {
    const { identity, membership } = await requireMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const template = await ctx.db.get(templateId);
    if (
      template === null ||
      template.eventId !== eventId ||
      template.isCurrent === false
    )
      throw new Error("Current form template not found");
    const versionId = await ctx.db.insert("formTemplates", {
      eventId,
      name: validateTemplateName(name),
      version: template.version + 1,
      rootTemplateId: template.rootTemplateId ?? template._id,
      isCurrent: true,
      fields: validateFields(fields),
      createdBy: identity.subject,
      createdAt: Date.now(),
    });
    await ctx.db.patch(templateId, { isCurrent: false });
    return versionId;
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
    if (
      typeof answers !== "object" ||
      answers === null ||
      Array.isArray(answers)
    )
      throw new Error("Form answers must be an object");
    // A draft may be incomplete but never malformed, so only non-`missing`
    // issues block the save. Keyed off issue codes, not message wording.
    const blocking = blockingIssues(template.fields, answers as Answers);
    if (blocking.length > 0)
      throw new Error(
        `Correct these answers before saving: ${blocking
          .map(
            ([id]) =>
              template.fields.find((field) => field.id === id)?.label ?? id,
          )
          .join(", ")}`,
      );
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
      submission.templateId !== templateId ||
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
    const issues = codedIssues(
      submission.fields,
      submission.answers as Answers,
    );
    const ids = Object.keys(issues);
    if (ids.length > 0)
      throw new Error(
        `Correct form fields: ${ids
          .map(
            (id) =>
              submission.fields.find((field) => field.id === id)?.label ?? id,
          )
          .join(", ")}`,
      );
    await ctx.db.patch(submissionId, {
      status: "submitted",
      submittedBy: identity.subject,
      submittedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
