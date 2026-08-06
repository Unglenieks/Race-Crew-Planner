import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./auth";

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
