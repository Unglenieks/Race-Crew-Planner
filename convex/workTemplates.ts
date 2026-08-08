import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { validatedWorkItemInput } from "./work";
import { writeAudit } from "./audit";

const priority = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
);
const templateItem = v.object({
  title: v.string(),
  notes: v.optional(v.string()),
  priority,
  dueContext: v.optional(v.string()),
});

type TemplateItem = {
  title: string;
  notes?: string;
  priority: "low" | "normal" | "high";
  dueContext?: string;
};

export const templateApplyCooldownMs = 30_000;

async function requireEventMembership(
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

function validatedName(value: string) {
  const name = value.trim();
  if (name.length === 0 || name.length > 120) {
    throw new Error("Template name must be between 1 and 120 characters");
  }
  return name;
}

function validatedItems(value: TemplateItem[]) {
  if (value.length === 0 || value.length > 100) {
    throw new Error("A template needs between 1 and 100 items");
  }
  return value.map(({ title, notes, priority, dueContext }) => {
    const item = validatedWorkItemInput({
      title,
      notes,
      priority,
      dueContext,
    });
    return {
      title: item.title,
      notes: item.notes,
      priority: item.priority,
      dueContext: item.dueContext,
    };
  });
}

/** Lists active, event-local checklist templates for an event member. */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const templates = await ctx.db
      .query("workTemplates")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
    return templates.filter((template) => template.archivedAt === undefined);
  },
});

/** Lists archived templates separately so the active picker stays truthful. */
export const listArchived = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventMembership(ctx, eventId);
    const templates = await ctx.db
      .query("workTemplates")
      .withIndex("by_eventId", (index) => index.eq("eventId", eventId))
      .collect();
    return templates.filter((template) => template.archivedAt !== undefined);
  },
});

/** Owners and managers create reusable, event-local checklist templates. */
export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    items: v.array(templateItem),
  },
  handler: async (ctx, { eventId, name, items }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const now = Date.now();
    const templateName = validatedName(name);
    const templateId = await ctx.db.insert("workTemplates", {
      eventId,
      name: templateName,
      items: validatedItems(items),
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "workTemplate.created",
      message: `Created work template: ${templateName}`,
      objectType: "workTemplate",
      objectId: templateId,
      objectLabel: templateName,
      href: `/events/${eventId}/work/templates`,
    });
    return templateId;
  },
});

/** Applies an active template by creating independent work items for its event. */
export const apply = mutation({
  args: { eventId: v.id("events"), templateId: v.id("workTemplates") },
  handler: async (ctx, { eventId, templateId }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const template = await ctx.db.get(templateId);
    if (
      template === null ||
      template.eventId !== eventId ||
      template.archivedAt !== undefined
    ) {
      throw new Error("Template not found");
    }
    const now = Date.now();
    const latestApplication = await ctx.db
      .query("workTemplateApplications")
      .withIndex("by_templateId_appliedAt", (q) =>
        q.eq("templateId", templateId),
      )
      .order("desc")
      .first();
    if (
      latestApplication !== null &&
      latestApplication.appliedBy === identity.subject &&
      now - latestApplication.appliedAt < templateApplyCooldownMs
    ) {
      throw new Error(
        "This template was just applied. Wait before applying it again",
      );
    }
    const itemIds = await Promise.all(
      template.items.map((item) =>
        ctx.db.insert("workItems", {
          eventId,
          ...item,
          status: "open",
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
    await ctx.db.insert("workTemplateApplications", {
      eventId,
      templateId,
      appliedBy: identity.subject,
      appliedAt: now,
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "workTemplate.applied",
      message: `Applied work template: ${template.name} (${itemIds.length} items)`,
      objectType: "workTemplate",
      objectId: templateId,
      objectLabel: template.name,
      href: `/events/${eventId}/work`,
    });
    return itemIds;
  },
});

/** Hides a template from future use while preserving its existing work items. */
export const archive = mutation({
  args: { eventId: v.id("events"), templateId: v.id("workTemplates") },
  handler: async (ctx, { eventId, templateId }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const template = await ctx.db.get(templateId);
    if (template === null || template.eventId !== eventId) {
      throw new Error("Template not found");
    }
    await ctx.db.patch(templateId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "workTemplate.archived",
      message: `Archived work template: ${template.name}`,
      objectType: "workTemplate",
      objectId: templateId,
      objectLabel: template.name,
    });
  },
});

/** Restores a template to the active apply list. Existing work is unchanged. */
export const restore = mutation({
  args: { eventId: v.id("events"), templateId: v.id("workTemplates") },
  handler: async (ctx, { eventId, templateId }) => {
    const { identity, membership } = await requireEventMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const template = await ctx.db.get(templateId);
    if (template === null || template.eventId !== eventId)
      throw new Error("Template not found");
    if (template.archivedAt !== undefined) {
      await ctx.db.patch(templateId, {
        archivedAt: undefined,
        updatedAt: Date.now(),
      });
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "workTemplate.restored",
        message: `Restored work template: ${template.name}`,
        objectType: "workTemplate",
        objectId: templateId,
        objectLabel: template.name,
        href: `/events/${eventId}/work/templates`,
      });
    }
  },
});

export { validatedItems, validatedName };
