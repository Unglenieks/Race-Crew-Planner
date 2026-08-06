import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity } from "./auth";

async function requireMember(
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
  return identity;
}
function text(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum)
    throw new Error(`${label} must be between 1 and ${maximum} characters`);
  return normalized;
}
function optionalText(value: string | undefined, maximum: number) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return undefined;
  if (normalized.length > maximum)
    throw new Error(`Text must be at most ${maximum} characters`);
  return normalized;
}
function safeUrl(value: string | undefined) {
  const url = optionalText(value, 1000);
  if (url === undefined) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("A valid http or https source link is required");
  }
}

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireMember(ctx, eventId);
    const [activity, comments, sources] = await Promise.all([
      ctx.db
        .query("eventActivity")
        .withIndex("by_eventId_createdAt", (index) =>
          index.eq("eventId", eventId),
        )
        .collect(),
      ctx.db
        .query("eventComments")
        .withIndex("by_eventId_createdAt", (index) =>
          index.eq("eventId", eventId),
        )
        .collect(),
      ctx.db
        .query("eventSources")
        .withIndex("by_eventId_createdAt", (index) =>
          index.eq("eventId", eventId),
        )
        .collect(),
    ]);
    return {
      activity: activity.reverse(),
      comments: comments.reverse(),
      sources: sources.reverse(),
    };
  },
});

export const addComment = mutation({
  args: { eventId: v.id("events"), body: v.string() },
  handler: async (ctx, { eventId, body }) => {
    const identity = await requireMember(ctx, eventId);
    const now = Date.now();
    const message = text(body, "Comment", 2000);
    const id = await ctx.db.insert("eventComments", {
      eventId,
      body: message,
      authorId: identity.subject,
      createdAt: now,
    });
    await ctx.db.insert("eventActivity", {
      eventId,
      actorId: identity.subject,
      kind: "comment",
      message: "Added a comment",
      createdAt: now,
    });
    return id;
  },
});

export const addSource = mutation({
  args: {
    eventId: v.id("events"),
    title: v.string(),
    url: v.optional(v.string()),
    excerpt: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, title, url, excerpt }) => {
    const identity = await requireMember(ctx, eventId);
    const now = Date.now();
    const sourceTitle = text(title, "Source title", 160);
    const id = await ctx.db.insert("eventSources", {
      eventId,
      title: sourceTitle,
      url: safeUrl(url),
      excerpt: optionalText(excerpt, 2000),
      authorId: identity.subject,
      createdAt: now,
    });
    await ctx.db.insert("eventActivity", {
      eventId,
      actorId: identity.subject,
      kind: "source",
      message: `Added source: ${sourceTitle}`,
      createdAt: now,
    });
    return id;
  },
});

export { safeUrl, text };
