import { describe, expect, it } from "vitest";

import {
  requireIdentity,
  requireRole,
  type ApplicationRole,
} from "../../convex/auth";
import { getCurrentUser } from "../../convex/currentUser";
import { create, get, validatedEventInput } from "../../convex/events";
import {
  create as createItineraryItem,
  archive as archiveItineraryItem,
  list as listItineraryItems,
  restore as restoreItineraryItem,
  update as updateItineraryItem,
  validatedItineraryInput,
} from "../../convex/itinerary";
import {
  claim as claimInvitations,
  create as createInvitation,
  normalizedEmail,
} from "../../convex/invitations";
import { safeUrl, text } from "../../convex/activity";

const owner: ApplicationRole = "owner";

describe("Convex authorization helpers", () => {
  it("returns a verified identity", async () => {
    const identity = await requireIdentity({
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|user_123",
          subject: "user_123",
          issuer: "issuer",
        }),
      },
    });

    expect(identity.tokenIdentifier).toBe("issuer|user_123");
  });

  it("rejects callers without an identity", async () => {
    await expect(
      requireIdentity({
        auth: { getUserIdentity: async () => null },
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("protects the current-user query and returns only verified identity data", async () => {
    await expect(
      getCurrentUser({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthenticated");

    await expect(
      getCurrentUser({
        auth: {
          getUserIdentity: async () => ({
            tokenIdentifier: "issuer|user_123",
            subject: "user_123",
            issuer: "issuer",
          }),
        },
      }),
    ).resolves.toEqual({
      subject: "user_123",
      tokenIdentifier: "issuer|user_123",
    });
  });

  it("permits only a membership role allowed by the function", () => {
    expect(requireRole(owner, ["owner", "manager"])).toBe("owner");
    expect(() => requireRole("crew", ["owner", "manager"])).toThrow(
      "Forbidden",
    );
    expect(() => requireRole(undefined, ["owner"])).toThrow("Forbidden");
  });

  it("normalizes event input before it is stored", () => {
    expect(
      validatedEventInput({
        name: "  Pine Ridge Rally  ",
        timeZone: "  America/New_York ",
      }),
    ).toEqual({ name: "Pine Ridge Rally", timeZone: "America/New_York" });
  });

  it("rejects incomplete event input", () => {
    expect(() => validatedEventInput({ name: "", timeZone: "UTC" })).toThrow(
      "Event name",
    );
    expect(() =>
      validatedEventInput({ name: "Spring Rally", timeZone: "" }),
    ).toThrow("time zone");
    expect(() =>
      validatedEventInput({ name: "Spring Rally", timeZone: "not-a-zone" }),
    ).toThrow("IANA");
  });

  it("rejects an unauthenticated event read before accessing data", async () => {
    await expect(
      get._handler({ auth: { getUserIdentity: async () => null } } as never, {
        eventId: "events:one" as never,
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("rejects an event read without a matching membership", async () => {
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|user_123",
          subject: "user_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => null }),
        }),
      },
    };

    await expect(
      get._handler(context as never, { eventId: "events:one" as never }),
    ).rejects.toThrow("Forbidden");
  });

  it("creates the event owner membership from the verified identity", async () => {
    const inserts: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|user_123",
          subject: "user_123",
          issuer: "issuer",
        }),
      },
      db: {
        insert: async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return table === "events" ? "events:one" : "eventMemberships:one";
        },
      },
    };

    await create._handler(context as never, {
      name: "  Pine Ridge Rally ",
      timeZone: "UTC",
    });

    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toMatchObject({
      table: "events",
      value: { name: "Pine Ridge Rally", createdBy: "user_123" },
    });
    expect(inserts[1]).toMatchObject({
      table: "eventMemberships",
      value: { eventId: "events:one", userId: "user_123", role: "owner" },
    });
  });

  it("normalizes movement input while preserving the event-local time", () => {
    expect(
      validatedItineraryInput({
        title: "  Depart for service area ",
        scheduledFor: "2026-10-16T08:30",
        location: " Service Park ",
        notes: "  Load spares first. ",
      }),
    ).toEqual({
      title: "Depart for service area",
      scheduledFor: "2026-10-16T08:30",
      location: "Service Park",
      notes: "Load spares first.",
    });
  });

  it("rejects an incomplete or invalid movement", () => {
    expect(() =>
      validatedItineraryInput({ title: "", scheduledFor: "2026-10-16T08:30" }),
    ).toThrow("Movement description");
    expect(() =>
      validatedItineraryInput({ title: "Depart", scheduledFor: "tomorrow" }),
    ).toThrow("planned date and time");
  });

  it("validates bounded activity text and safe source links", () => {
    expect(text("  Route update ", "Comment", 20)).toBe("Route update");
    expect(() => text("", "Comment", 20)).toThrow("Comment");
    expect(safeUrl("https://example.com/brief")).toBe(
      "https://example.com/brief",
    );
    expect(() => safeUrl("javascript:alert(1)")).toThrow("http or https");
  });

  it("allows members to read but not crew members to change an itinerary", async () => {
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|crew_123",
          subject: "crew_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: (table: string) => ({
          withIndex: () =>
            table === "eventMemberships"
              ? { unique: async () => ({ role: "crew" }) }
              : { collect: async () => [] },
        }),
      },
    };

    await expect(
      listItineraryItems._handler(context as never, {
        eventId: "events:one" as never,
      }),
    ).resolves.toEqual([]);
    await expect(
      createItineraryItem._handler(context as never, {
        eventId: "events:one" as never,
        title: "Depart",
        scheduledFor: "2026-10-16T08:30",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("updates only a movement that belongs to the selected event", async () => {
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|owner_123",
          subject: "owner_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "owner" }) }),
        }),
        get: async () => ({ eventId: "events:other" }),
      },
    };

    await expect(
      updateItineraryItem._handler(context as never, {
        itemId: "itineraryItems:one" as never,
        eventId: "events:one" as never,
        title: "Depart",
        scheduledFor: "2026-10-16T08:30",
      }),
    ).rejects.toThrow("Movement not found");
  });

  it("archives and restores only movements in the selected event", async () => {
    const patches: Array<Record<string, unknown>> = [];
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|owner_123",
          subject: "owner_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "owner" }) }),
        }),
        get: async () => ({ eventId: "events:one", archivedAt: 123 }),
        patch: async (_id: string, value: Record<string, unknown>) => {
          patches.push(value);
        },
      },
    };

    await restoreItineraryItem._handler(context as never, {
      itemId: "itineraryItems:one" as never,
      eventId: "events:one" as never,
    });

    expect(patches).toContainEqual(
      expect.objectContaining({ archivedAt: undefined }),
    );

    await archiveItineraryItem._handler(
      {
        ...context,
        db: { ...context.db, get: async () => ({ eventId: "events:one" }) },
      } as never,
      {
        itemId: "itineraryItems:one" as never,
        eventId: "events:one" as never,
      },
    );

    expect(patches).toContainEqual(
      expect.objectContaining({ archivedAt: expect.any(Number) }),
    );

    await expect(
      archiveItineraryItem._handler(
        {
          ...context,
          db: { ...context.db, get: async () => ({ eventId: "events:other" }) },
        } as never,
        {
          itemId: "itineraryItems:one" as never,
          eventId: "events:one" as never,
        },
      ),
    ).rejects.toThrow("Movement not found");
  });

  it("normalizes invitation email addresses", () => {
    expect(normalizedEmail("  Crew@Example.com ")).toBe("crew@example.com");
    expect(() => normalizedEmail("not-an-email")).toThrow("email address");
  });

  it("requires an event owner before creating an invitation", async () => {
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|crew_123",
          subject: "crew_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "crew" }) }),
        }),
      },
    };
    await expect(
      createInvitation._handler(context as never, {
        eventId: "events:one" as never,
        email: "crew@example.com",
        role: "crew",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("claims invitations only with a verified matching Clerk email", async () => {
    const patches: Array<Record<string, unknown>> = [];
    let queryCount = 0;
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|crew_123",
          subject: "crew_123",
          issuer: "issuer",
          email: "crew@example.com",
          emailVerified: true,
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({
            collect: async () => [
              {
                _id: "eventInvitations:one",
                eventId: "events:one",
                role: "crew",
              },
            ],
            unique: async () => {
              queryCount += 1;
              return queryCount === 1 ? null : null;
            },
          }),
        }),
        insert: async () => "eventMemberships:one",
        patch: async (_id: string, value: Record<string, unknown>) => {
          patches.push(value);
        },
      },
    };
    await claimInvitations._handler(context as never, {});
    expect(patches).toContainEqual(
      expect.objectContaining({ status: "accepted", acceptedBy: "crew_123" }),
    );
  });
});
