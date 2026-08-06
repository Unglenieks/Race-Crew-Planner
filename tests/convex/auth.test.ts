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
  list as listItineraryItems,
  update as updateItineraryItem,
  validatedItineraryInput,
} from "../../convex/itinerary";
import {
  add as addMembership,
  list as listMemberships,
  remove as removeMembership,
  updateRole as updateMembershipRole,
  validatedUserId,
} from "../../convex/memberships";

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

  it("normalizes member IDs and rejects empty values", () => {
    expect(validatedUserId("  user_crew_123  ")).toBe("user_crew_123");
    expect(() => validatedUserId(" ")).toThrow("member ID");
  });

  it("rejects unauthenticated and non-owner membership reads", async () => {
    await expect(
      listMemberships._handler(
        { auth: { getUserIdentity: async () => null } } as never,
        { eventId: "events:one" as never },
      ),
    ).rejects.toThrow("Unauthenticated");

    const crewContext = {
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
      listMemberships._handler(crewContext as never, {
        eventId: "events:one" as never,
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("lets an owner add a new manager or crew membership", async () => {
    const inserts: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    let queryCount = 0;
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
          withIndex: () => ({
            unique: async () => {
              queryCount += 1;
              return queryCount === 1 ? { role: "owner" } : null;
            },
          }),
        }),
        insert: async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return "eventMemberships:new";
        },
      },
    };

    await addMembership._handler(context as never, {
      eventId: "events:one" as never,
      userId: "  crew_456 ",
      role: "manager",
    });

    expect(inserts).toEqual([
      {
        table: "eventMemberships",
        value: expect.objectContaining({
          eventId: "events:one",
          userId: "crew_456",
          role: "manager",
        }),
      },
    ]);
  });

  it("does not let an owner change or remove a membership from another event", async () => {
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
        get: async () => ({ eventId: "events:other", role: "crew" }),
      },
    };

    await expect(
      updateMembershipRole._handler(context as never, {
        eventId: "events:one" as never,
        membershipId: "eventMemberships:other" as never,
        role: "manager",
      }),
    ).rejects.toThrow("Member not found");
    await expect(
      removeMembership._handler(context as never, {
        eventId: "events:one" as never,
        membershipId: "eventMemberships:other" as never,
      }),
    ).rejects.toThrow("Member not found");
  });

  it("does not let an owner remove the event owner", async () => {
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
        get: async () => ({ eventId: "events:one", role: "owner" }),
      },
    };

    await expect(
      removeMembership._handler(context as never, {
        eventId: "events:one" as never,
        membershipId: "eventMemberships:owner" as never,
      }),
    ).rejects.toThrow("owner cannot be removed");
  });
});
