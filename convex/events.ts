import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireIdentity, requireRole } from "./auth";

const eventArgs = {
  name: v.string(),
  timeZone: v.string(),
};

/**
 * `Region/Location` shape, which every IANA zone name outside `UTC` follows.
 * Requiring the separator is what rejects ambiguous abbreviations such as
 * `CST`, `EST`, and `GMT+5`, which `Intl.DateTimeFormat` would otherwise accept.
 */
const ianaTimeZonePattern = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/;

/**
 * Resolves the canonical zone list once, tolerating runtimes that do not expose
 * `Intl.supportedValuesOf`. The Convex default runtime is a custom V8 embedding
 * rather than Node, so this must never be assumed to exist: if it is missing we
 * fall back to probing `Intl.DateTimeFormat`, which every runtime here provides.
 */
function canonicalTimeZones(): ReadonlySet<string> | null {
  const supportedValuesOf = (
    Intl as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf !== "function") return null;
  try {
    return new Set(supportedValuesOf.call(Intl, "timeZone"));
  } catch {
    return null;
  }
}

function isKnownTimeZone(timeZone: string) {
  const canonical = canonicalTimeZones();
  if (canonical !== null && canonical.has(timeZone)) return true;
  // Canonical lists omit valid IANA link names such as `Asia/Calcutta`, so a
  // successful format is still accepted once the shape check has passed.
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isSupportedEventTimeZone(timeZone: string) {
  if (timeZone === "UTC") return true;
  if (!ianaTimeZonePattern.test(timeZone)) return false;
  return isKnownTimeZone(timeZone);
}

function validatedEventInput({
  name,
  timeZone,
}: {
  name: string;
  timeZone: string;
}) {
  const normalizedName = name.trim();
  const normalizedTimeZone = timeZone.trim();

  if (normalizedName.length === 0 || normalizedName.length > 120) {
    throw new Error("Event name must be between 1 and 120 characters");
  }

  if (normalizedTimeZone.length === 0 || normalizedTimeZone.length > 100) {
    throw new Error("A valid event time zone is required");
  }

  if (!isSupportedEventTimeZone(normalizedTimeZone)) {
    throw new Error("A valid IANA event time zone is required");
  }

  return { name: normalizedName, timeZone: normalizedTimeZone };
}

/** Creates an event and its owner membership in one authorized transaction. */
export const create = mutation({
  args: eventArgs,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const event = validatedEventInput(args);
    const createdAt = Date.now();
    const eventId = await ctx.db.insert("events", {
      ...event,
      createdAt,
      createdBy: identity.subject,
    });

    await ctx.db.insert("eventMemberships", {
      eventId,
      userId: identity.subject,
      role: "owner",
      createdAt,
    });

    return eventId;
  },
});

/**
 * Creates a useful, event-local walkthrough without bypassing the application's
 * data model. It deliberately uses ordinary records, fields, plan items, and
 * work so the sample stays representative as those screens evolve.
 */
export const createSample = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const createdAt = Date.now();
    const eventId = await ctx.db.insert("events", {
      name: "Pine Ridge Rally — sample event",
      timeZone: "America/Denver",
      isSample: true,
      createdAt,
      createdBy: identity.subject,
    });
    await ctx.db.insert("eventMemberships", {
      eventId,
      userId: identity.subject,
      role: "owner",
      createdAt,
    });

    await ctx.db.insert("eventRecordFields", {
      eventId,
      key: "readiness",
      label: "Readiness",
      type: "select",
      options: ["Ready", "Needs follow-up"],
      order: 0,
      createdAt,
      updatedAt: createdAt,
    });
    const venueId = await ctx.db.insert("eventRecords", {
      eventId,
      name: "North service park",
      type: "venue",
      address: "42 Pine Ridge Road",
      notes: "Check access before the first crew arrival.",
      fieldValues: { readiness: "Ready" },
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("eventRecords", {
      eventId,
      name: "Fuel and supplies",
      type: "service",
      notes: "Confirm the delivery window with the supplier.",
      fieldValues: { readiness: "Needs follow-up" },
      createdAt,
      updatedAt: createdAt,
    });
    const departureId = await ctx.db.insert("itineraryItems", {
      eventId,
      title: "Crew call at service park",
      scheduledFor: "2026-09-18T07:30",
      location: "North service park",
      recordId: venueId,
      notes: "Review the day plan and radio check.",
      timeKind: "exact",
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("workItems", {
      eventId,
      title: "Confirm service-park access",
      notes: "Use the sample record to see the readiness field in action.",
      status: "open",
      priority: "high",
      recordId: venueId,
      itineraryItemId: departureId,
      createdAt,
      updatedAt: createdAt,
    });
    return eventId;
  },
});

const eventTables = [
  "eventFiles",
  "eventRecordCategoryAssignments",
  "travelContexts",
  "workItemComments",
  "planChangeRecipients",
  "planChanges",
  "formSubmissions",
  "formTemplates",
  "eventActivity",
  "eventComments",
  "eventSources",
  "planSections",
  "workItems",
  "workTemplates",
  "itineraryItems",
  "eventRecords",
  "eventRecordFields",
  "eventRecordTypes",
  "eventRecordCategories",
  "eventInvitations",
  "eventMemberships",
] as const;

async function deleteEventRows(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  for (const table of eventTables) {
    const rows = await ctx.db
      .query(table)
      .filter((q) => q.eq(q.field("eventId"), eventId))
      .collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  }
}

/** Removes only an owner's sample event and all of its event-local data. */
export const removeSample = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const identity = await requireIdentity(ctx);
    const event = await ctx.db.get(eventId);
    if (event === null || !event.isSample) throw new Error("Sample event not found");
    if (event.createdBy !== identity.subject) throw new Error("Forbidden");
    const membership = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (q) =>
        q.eq("eventId", eventId).eq("userId", identity.subject),
      )
      .unique();
    requireRole(membership?.role, ["owner"]);
    await deleteEventRows(ctx, eventId);
    await ctx.db.delete(eventId);
  },
});

/** Lists only events where the verified caller has an application membership. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const memberships = await ctx.db
      .query("eventMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    const events = await Promise.all(
      memberships.map(async (membership) => {
        const event = await ctx.db.get(membership.eventId);
        return event === null
          ? null
          : {
              id: event._id,
              name: event.name,
              timeZone: event.timeZone,
              role: membership.role,
              isSample: event.isSample === true,
            };
      }),
    );

    return events.filter((event) => event !== null);
  },
});

/** Reads an event only after resolving the caller's membership in Convex. */
export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const identity = await requireIdentity(ctx);
    const membership = await ctx.db
      .query("eventMemberships")
      .withIndex("by_eventId_userId", (q) =>
        q.eq("eventId", eventId).eq("userId", identity.subject),
      )
      .unique();

    if (membership === null) {
      throw new Error("Forbidden");
    }

    const event = await ctx.db.get(eventId);
    if (event === null) {
      throw new Error("Event not found");
    }

    return {
      id: event._id,
      name: event.name,
      timeZone: event.timeZone,
      role: membership.role,
    };
  },
});

export { validatedEventInput };
