import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const maximumFileSize = 10 * 1024 * 1024;
const acceptedContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

async function member(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("eventMemberships")
    .withIndex("by_eventId_userId", (q) =>
      q.eq("eventId", eventId).eq("userId", identity.subject),
    )
    .unique();
  if (membership === null) throw new Error("Forbidden");
  return { identity, membership };
}

function safeName(value: string) {
  const name = value.trim();
  if (name.length === 0 || name.length > 160)
    throw new Error("File name must be between 1 and 160 characters");
  return name;
}

function acceptedFile(contentType: string, size: number) {
  if (!acceptedContentTypes.has(contentType))
    throw new Error("Files must be a PDF, image, or plain-text file");
  if (size <= 0 || size > maximumFileSize)
    throw new Error("Files must be between 1 byte and 10 MB");
}

/** A short-lived upload URL, issued only to a verified event member. */
export const generateUploadUrl = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await member(ctx, eventId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Commits an uploaded binary to an event only after checking its actual Convex
 * storage metadata. The client never chooses an access URL or bypasses event
 * membership.
 */
export const save = mutation({
  args: {
    eventId: v.id("events"),
    recordId: v.optional(v.id("eventRecords")),
    storageId: v.id("_storage"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await member(ctx, args.eventId);
    if (args.recordId !== undefined) {
      const record = await ctx.db.get(args.recordId);
      if (record === null || record.eventId !== args.eventId)
        throw new Error("Record not found");
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (metadata === null) throw new Error("Uploaded file not found");
    const contentType = metadata.contentType ?? "";
    acceptedFile(contentType, metadata.size);
    return await ctx.db.insert("eventFiles", {
      eventId: args.eventId,
      ...(args.recordId === undefined ? {} : { recordId: args.recordId }),
      storageId: args.storageId,
      name: safeName(args.name),
      contentType,
      size: metadata.size,
      uploadedBy: identity.subject,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await member(ctx, eventId);
    const files = await ctx.db
      .query("eventFiles")
      .withIndex("by_eventId_createdAt", (q) => q.eq("eventId", eventId))
      .collect();
    return await Promise.all(
      files.reverse().map(async (file) => ({
        ...file,
        url: await ctx.storage.getUrl(file.storageId),
      })),
    );
  },
});

/** Managers can remove a file from an event. The binary is deleted as well. */
export const remove = mutation({
  args: { eventId: v.id("events"), fileId: v.id("eventFiles") },
  handler: async (ctx, { eventId, fileId }) => {
    const { membership } = await member(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const file = await ctx.db.get(fileId);
    if (file === null || file.eventId !== eventId) throw new Error("File not found");
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(fileId);
  },
});

export { acceptedFile, maximumFileSize };
