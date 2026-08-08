import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";
import { resolveUserProfile } from "./userProfiles";
import { writeAudit } from "./audit";

const severity = v.union(v.literal("routine"), v.literal("critical"));
const deliveryStates = [
  "sent",
  "opened",
  "acknowledged",
  "acknowledgedElsewhere",
] as const;

type DeliveryState = (typeof deliveryStates)[number];

function normalizedReason(value: string) {
  const reason = value.trim();
  if (reason.length === 0 || reason.length > 500) {
    throw new Error(
      "A publication reason must be between 1 and 500 characters",
    );
  }
  return reason;
}

function normalizedNote(value: string | undefined) {
  const note = value?.trim();
  if (note === undefined || note.length === 0) return undefined;
  if (note.length > 500)
    throw new Error("Acknowledgement notes must be at most 500 characters");
  return note;
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

async function requirePublisher(ctx: MutationCtx, eventId: Id<"events">) {
  const { identity, membership } = await requireMembership(ctx, eventId);
  requireRole(membership.role, ["owner", "manager"]);
  return identity;
}

/** Lists the current event members a publisher may assign to a change. */
export const recipients = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { membership } = await requireMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const members = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (index) => index.eq("eventId", eventId))
      .collect();
    return await Promise.all(
      members.map(async (member) => {
        const profile = await resolveUserProfile(ctx, member.userId);
        return {
          userId: member.userId,
          role: member.role,
          name: profile.name,
        };
      }),
    );
  },
});

/** Publishes the current movement snapshot and assigns explicit recipients. */
export const publish = mutation({
  args: {
    eventId: v.id("events"),
    itemId: v.id("itineraryItems"),
    reason: v.string(),
    severity,
    recipientUserIds: v.array(v.string()),
  },
  handler: async (
    ctx,
    { eventId, itemId, reason, severity, recipientUserIds },
  ) => {
    const identity = await requirePublisher(ctx, eventId);
    const uniqueRecipients = [...new Set(recipientUserIds)];
    if (uniqueRecipients.length === 0)
      throw new Error("Choose at least one recipient");
    const item = await ctx.db.get(itemId);
    if (
      item === null ||
      item.eventId !== eventId ||
      item.archivedAt !== undefined
    ) {
      throw new Error("Movement not found");
    }

    for (const userId of uniqueRecipients) {
      const member = await ctx.db
        .query("eventMemberships")
        .withIndex("by_eventId_userId", (index) =>
          index.eq("eventId", eventId).eq("userId", userId),
        )
        .unique();
      if (member === null)
        throw new Error("A selected recipient is no longer on this event");
    }

    const priorPublications = await ctx.db
      .query("planChanges")
      .withIndex("by_itemId_publishedAt", (index) =>
        index.eq("itineraryItemId", itemId),
      )
      .collect();
    const prior = priorPublications.at(-1);
    const hasLastChangedSnapshot = item.lastChangedAt !== undefined;
    const now = Date.now();
    const changeId = await ctx.db.insert("planChanges", {
      eventId,
      itineraryItemId: itemId,
      title: item.title,
      scheduledFor: item.scheduledFor,
      scheduledUntil: item.scheduledUntil,
      location: item.location,
      recordId: item.recordId,
      notes: item.notes,
      previousTitle: hasLastChangedSnapshot
        ? item.lastChangedTitle
        : prior?.title,
      previousScheduledFor: hasLastChangedSnapshot
        ? item.lastChangedScheduledFor
        : prior?.scheduledFor,
      previousScheduledUntil: hasLastChangedSnapshot
        ? item.lastChangedScheduledUntil
        : prior?.scheduledUntil,
      previousLocation: hasLastChangedSnapshot
        ? item.lastChangedLocation
        : prior?.location,
      previousRecordId: hasLastChangedSnapshot
        ? item.lastChangedRecordId
        : prior?.recordId,
      previousNotes: hasLastChangedSnapshot
        ? item.lastChangedNotes
        : prior?.notes,
      reason: normalizedReason(reason),
      severity,
      publishedBy: identity.subject,
      publishedAt: now,
    });
    for (const userId of uniqueRecipients) {
      await ctx.db.insert("planChangeRecipients", {
        eventId,
        changeId,
        userId,
        state: "sent",
        sentAt: now,
      });
    }
    // A later publication of the same unchanged instruction should compare
    // against the previous publication, not keep presenting this edit again.
    await ctx.db.patch(itemId, {
      lastChangedTitle: undefined,
      lastChangedScheduledFor: undefined,
      lastChangedScheduledUntil: undefined,
      lastChangedLocation: undefined,
      lastChangedRecordId: undefined,
      lastChangedNotes: undefined,
      lastChangedAt: undefined,
    });
    await writeAudit(ctx, {
      eventId,
      actorId: identity.subject,
      kind: "movement.published",
      message: `Published movement change: ${item.title}`,
      objectType: "movement",
      objectId: itemId,
      objectLabel: item.title,
      href: `/events/${eventId}/plan/${itemId}#published-changes`,
      createdAt: now,
    });
    return changeId;
  },
});

/** Shows a publisher the concrete reach state for every recipient. */
export const listForPublisher = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { membership } = await requireMembership(ctx, eventId);
    requireRole(membership.role, ["owner", "manager"]);
    const changes = await ctx.db
      .query("planChanges")
      .withIndex("by_eventId_publishedAt", (index) =>
        index.eq("eventId", eventId),
      )
      .collect();
    return await Promise.all(
      changes.reverse().map(async (change) => {
        const recipients = await ctx.db
          .query("planChangeRecipients")
          .withIndex("by_changeId", (index) => index.eq("changeId", change._id))
          .collect();
        const namedRecipients = await Promise.all(
          recipients.map(async (recipient) => {
            const profile = await resolveUserProfile(ctx, recipient.userId);
            return {
              ...recipient,
              name: profile.name,
              acknowledgedByName:
                recipient.acknowledgedBy === undefined
                  ? undefined
                  : (await resolveUserProfile(ctx, recipient.acknowledgedBy))
                      .name,
            };
          }),
        );
        return {
          ...change,
          publishedByName: (await resolveUserProfile(ctx, change.publishedBy))
            .name,
          recipients: namedRecipients,
        };
      }),
    );
  },
});

/**
 * Returns a movement's publication history and concrete delivery state.
 * Event membership is required because the history contains operational plan
 * changes and the people responsible for receiving them.
 */
export const listForMovement = query({
  args: { eventId: v.id("events"), itemId: v.id("itineraryItems") },
  handler: async (ctx, { eventId, itemId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const item = await ctx.db.get(itemId);
    if (item === null || item.eventId !== eventId) {
      throw new Error("Movement not found");
    }
    const changes = await ctx.db
      .query("planChanges")
      .withIndex("by_itemId_publishedAt", (index) =>
        index.eq("itineraryItemId", itemId),
      )
      .collect();

    return await Promise.all(
      changes.reverse().map(async (change) => {
        const recipients = await ctx.db
          .query("planChangeRecipients")
          .withIndex("by_changeId", (index) => index.eq("changeId", change._id))
          .collect();
        const namedRecipients = await Promise.all(
          recipients.map(async (recipient) => {
            const profile = await resolveUserProfile(ctx, recipient.userId);
            return {
              ...recipient,
              name: profile.name,
              acknowledgedByName:
                recipient.acknowledgedBy === undefined
                  ? undefined
                  : (await resolveUserProfile(ctx, recipient.acknowledgedBy))
                      .name,
            };
          }),
        );
        return {
          ...change,
          publishedByName: (await resolveUserProfile(ctx, change.publishedBy))
            .name,
          recipients: namedRecipients,
          currentRecipient: namedRecipients.find(
            (recipient) => recipient.userId === identity.subject,
          ),
        };
      }),
    );
  },
});

/** Marks delivery opened only when the assigned recipient reaches the change. */
export const markOpened = mutation({
  args: { eventId: v.id("events"), recipientId: v.id("planChangeRecipients") },
  handler: async (ctx, { eventId, recipientId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const recipient = await ctx.db.get(recipientId);
    if (
      recipient === null ||
      recipient.eventId !== eventId ||
      recipient.userId !== identity.subject
    ) {
      throw new Error("Change delivery not found");
    }
    if (recipient.state === "sent") {
      await ctx.db.patch(recipientId, {
        state: "opened",
        openedAt: Date.now(),
      });
      const change = await ctx.db.get(recipient.changeId);
      if (change !== null) {
        await writeAudit(ctx, {
          eventId,
          actorId: identity.subject,
          kind: "planChange.opened",
          message: `Opened plan change: ${change.title}`,
          objectType: "movement",
          objectId: change.itineraryItemId,
          objectLabel: change.title,
          href: `/events/${eventId}/plan/${change.itineraryItemId}#published-changes`,
        });
      }
    }
  },
});

/** Lists changes that need action from the verified recipient. */
export const listForMe = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const pending = await ctx.db
      .query("planChangeRecipients")
      .withIndex("by_userId_state", (index) =>
        index.eq("userId", identity.subject).eq("state", "sent"),
      )
      .collect();
    const opened = await ctx.db
      .query("planChangeRecipients")
      .withIndex("by_userId_state", (index) =>
        index.eq("userId", identity.subject).eq("state", "opened"),
      )
      .collect();
    const relevant = [...pending, ...opened].filter(
      (recipient) => recipient.eventId === eventId,
    );
    return await Promise.all(
      relevant.map(async (recipient) => ({
        recipient,
        change: await ctx.db.get(recipient.changeId),
      })),
    );
  },
});

/** Records that the verified recipient has read and will act on this change. */
export const acknowledge = mutation({
  args: { eventId: v.id("events"), recipientId: v.id("planChangeRecipients") },
  handler: async (ctx, { eventId, recipientId }) => {
    const { identity } = await requireMembership(ctx, eventId);
    const recipient = await ctx.db.get(recipientId);
    if (
      recipient === null ||
      recipient.eventId !== eventId ||
      recipient.userId !== identity.subject
    ) {
      throw new Error("Change acknowledgement not found");
    }
    if (
      recipient.state === "acknowledged" ||
      recipient.state === "acknowledgedElsewhere"
    ) {
      return;
    }
    await ctx.db.patch(recipientId, {
      state: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: identity.subject,
    });
    const change = await ctx.db.get(recipient.changeId);
    if (change !== null) {
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "planChange.acknowledged",
        message: `Acknowledged plan change: ${change.title}`,
        objectType: "movement",
        objectId: change.itineraryItemId,
        objectLabel: change.title,
        href: `/events/${eventId}/plan/${change.itineraryItemId}#published-changes`,
      });
    }
  },
});

/** Records a radio, phone, or in-person acknowledgement on a recipient's behalf. */
export const acknowledgeElsewhere = mutation({
  args: {
    eventId: v.id("events"),
    recipientId: v.id("planChangeRecipients"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, recipientId, note }) => {
    const identity = await requirePublisher(ctx, eventId);
    const recipient = await ctx.db.get(recipientId);
    if (recipient === null || recipient.eventId !== eventId)
      throw new Error("Change recipient not found");
    if (
      recipient.state === "acknowledged" ||
      recipient.state === "acknowledgedElsewhere"
    ) {
      return;
    }
    await ctx.db.patch(recipientId, {
      state: "acknowledgedElsewhere",
      acknowledgedAt: Date.now(),
      acknowledgedBy: identity.subject,
      acknowledgementNote: normalizedNote(note),
    });
    const change = await ctx.db.get(recipient.changeId);
    if (change !== null) {
      await writeAudit(ctx, {
        eventId,
        actorId: identity.subject,
        kind: "planChange.acknowledged",
        message: `Recorded acknowledgement for: ${change.title}`,
        objectType: "movement",
        objectId: change.itineraryItemId,
        objectLabel: change.title,
        href: `/events/${eventId}/plan/${change.itineraryItemId}#published-changes`,
      });
    }
  },
});

export { normalizedNote, normalizedReason, type DeliveryState };
