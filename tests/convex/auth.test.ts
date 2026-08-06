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
  get as getItineraryItem,
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
import {
  create as createWorkItem,
  get as getWorkItem,
  listAssignees as listWorkAssignees,
  setCompletion as setWorkItemCompletion,
  validatedWorkItemInput,
} from "../../convex/work";
import {
  apply as applyWorkTemplate,
  create as createWorkTemplate,
  validatedItems as validatedTemplateItems,
  validatedName as validatedTemplateName,
} from "../../convex/workTemplates";
import {
  create as createWorkAutomationRule,
  validatedItemTitle,
  validatedName as validatedRuleName,
} from "../../convex/workAutomation";
import {
  create as createRecord,
  get as getRecord,
  saveTravel,
  saveVenueDetails,
  update as updateRecord,
  validatedRecordInput,
} from "../../convex/records";
import {
  acknowledge as acknowledgePlanChange,
  normalizedReason,
  publish as publishPlanChange,
} from "../../convex/planChanges";
import {
  createTemplate,
  missingRequiredFields,
  validationIssues,
  validateFields,
} from "../../convex/forms";
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
    expect(() =>
      validatedEventInput({ name: "Spring Rally", timeZone: "CST" }),
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

  it("validates unique, named inspection fields and reports missing required answers", () => {
    const fields = validateFields([
      {
        id: " brakes ",
        label: " Brake condition ",
        type: "text",
        required: true,
      },
      { id: "passed", label: "Passed", type: "boolean", required: true },
    ]);
    expect(fields[0]).toMatchObject({ id: "brakes", label: "Brake condition" });
    expect(missingRequiredFields(fields, { brakes: "Good" })).toEqual([
      fields[1],
    ]);
    expect(() => validateFields([{ ...fields[0] }, { ...fields[0] }])).toThrow(
      "unique identifier",
    );
  });

  it("validates structured form answers against the captured field schema", () => {
    const fields = validateFields([
      {
        id: "temperature",
        label: "Temperature",
        type: "number",
        required: true,
      },
      {
        id: "condition",
        label: "Condition",
        type: "select",
        options: ["Dry", "Wet"],
        required: true,
      },
      {
        id: "issues",
        label: "Issues found",
        type: "multiSelect",
        options: ["Brakes", "Lights"],
        required: false,
      },
    ]);
    expect(
      validationIssues(fields, {
        temperature: "hot",
        condition: "Snow",
        issues: ["Brakes", "Unknown"],
        removed_field: "stale",
      }),
    ).toMatchObject({
      temperature: "Enter a number.",
      condition: "Choose one of the listed options.",
      issues: "Choose one or more listed options.",
      removed_field: "This answer is not part of this form.",
    });
    expect(
      validationIssues(fields, {
        temperature: 20,
        condition: "Dry",
        issues: ["Brakes"],
      }),
    ).toEqual({});
  });

  it("requires named, unique options for choice fields", () => {
    expect(() =>
      validateFields([
        {
          id: "condition",
          label: "Condition",
          type: "select",
          options: ["Dry", "Dry"],
          required: true,
        },
      ]),
    ).toThrow("options must be unique");
    expect(() =>
      validateFields([
        {
          id: "note",
          label: "Note",
          type: "text",
          options: ["Not allowed"],
          required: false,
        },
      ]),
    ).toThrow("Only choice fields");
  });

  it("does not let crew members create inspection templates", async () => {
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
      createTemplate._handler(context as never, {
        eventId: "events:one" as never,
        name: "Vehicle inspection",
        fields: [
          { id: "passed", label: "Passed", type: "boolean", required: true },
        ],
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("requires a meaningful, bounded reason before publishing a change", () => {
    expect(normalizedReason("  Route control delayed the start. ")).toBe(
      "Route control delayed the start.",
    );
    expect(() => normalizedReason(" ")).toThrow("publication reason");
    expect(() => normalizedReason("x".repeat(501))).toThrow(
      "publication reason",
    );
  });

  it("does not let crew members publish operational changes", async () => {
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
      publishPlanChange._handler(context as never, {
        eventId: "events:one" as never,
        itemId: "itineraryItems:one" as never,
        reason: "Route control delayed the start.",
        severity: "critical",
        recipientUserIds: ["crew_456"],
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("only lets the assigned person acknowledge a plan change", async () => {
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
        get: async () => ({
          eventId: "events:one",
          userId: "another_crew_member",
          state: "sent",
        }),
      },
    };
    await expect(
      acknowledgePlanChange._handler(context as never, {
        eventId: "events:one" as never,
        recipientId: "planChangeRecipients:one" as never,
      }),
    ).rejects.toThrow("Change acknowledgement not found");
  });

  it("normalizes the first checklist item shape", () => {
    expect(
      validatedWorkItemInput({
        title: "  Load spare wheel ",
        notes: "  Check the tie-down. ",
      }),
    ).toEqual({
      title: "Load spare wheel",
      notes: "Check the tie-down.",
      priority: "normal",
      dueContext: undefined,
      assigneeId: undefined,
    });
    expect(() =>
      validatedWorkItemInput({ title: "", notes: undefined }),
    ).toThrow("Work item description");
  });

  it("normalizes operational records without imposing optional details", () => {
    expect(
      validatedRecordInput({
        name: "  Service Park entrance ",
        type: "venue",
        address: "  North gate ",
        notes: "  Use the gravel access road. ",
      }),
    ).toEqual({
      name: "Service Park entrance",
      type: "venue",
      address: "North gate",
      notes: "Use the gravel access road.",
    });
    expect(() => validatedRecordInput({ name: "", type: "venue" })).toThrow(
      "Record name",
    );
  });

  it("does not reveal a record from another event", async () => {
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
        get: async () => ({ eventId: "events:other" }),
      },
    };
    await expect(
      getRecord._handler(context as never, {
        eventId: "events:one" as never,
        recordId: "eventRecords:other" as never,
      }),
    ).rejects.toThrow("Record not found");
  });

  it("does not let crew update venue or travel context", async () => {
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
      saveVenueDetails._handler(context as never, {
        eventId: "events:one" as never,
        recordId: "eventRecords:one" as never,
        confirmationStatus: "confirmed",
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      saveTravel._handler(context as never, {
        eventId: "events:one" as never,
        fromRecordId: "eventRecords:one" as never,
        toRecordId: "eventRecords:two" as never,
        estimate: "15 minutes",
      }),
    ).rejects.toThrow("Forbidden");
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

  it("returns a movement only when it belongs to the selected event", async () => {
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
        get: async () => ({ eventId: "events:one", title: "Arrive" }),
      },
    };

    await expect(
      getItineraryItem._handler(context as never, {
        eventId: "events:one" as never,
        itemId: "itineraryItems:one" as never,
      }),
    ).resolves.toMatchObject({ title: "Arrive" });

    await expect(
      getItineraryItem._handler(
        {
          ...context,
          db: { ...context.db, get: async () => ({ eventId: "events:other" }) },
        } as never,
        {
          eventId: "events:one" as never,
          itemId: "itineraryItems:one" as never,
        },
      ),
    ).rejects.toThrow("Movement not found");
  });

  it("rejects a location record from another event before saving a movement", async () => {
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
        get: async () => ({ eventId: "events:other", type: "venue" }),
      },
    };

    await expect(
      createItineraryItem._handler(context as never, {
        eventId: "events:one" as never,
        title: "Arrive at service park",
        scheduledFor: "2026-10-16T08:30",
        recordId: "eventRecords:one" as never,
      }),
    ).rejects.toThrow("Location record not found");
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

  it("lets crew complete work but not create it", async () => {
    const patches: Array<Record<string, unknown>> = [];
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
        get: async () => ({ eventId: "events:one" }),
        patch: async (_id: string, value: Record<string, unknown>) => {
          patches.push(value);
        },
      },
    };

    await setWorkItemCompletion._handler(context as never, {
      eventId: "events:one" as never,
      itemId: "workItems:one" as never,
      completed: true,
    });
    expect(patches).toContainEqual(
      expect.objectContaining({ status: "completed", completedBy: "crew_123" }),
    );

    await expect(
      createWorkItem._handler(context as never, {
        eventId: "events:one" as never,
        title: "Load spare wheel",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("accepts only an event member as a work assignee", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const memberships = new Map([
      ["manager_123", { role: "manager" }],
      ["crew_456", { role: "crew" }],
    ]);
    let requestedUserId = "";
    const indexBuilder = {
      eq: (_field: string, value: string) => {
        requestedUserId = value;
        return indexBuilder;
      },
    };
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|manager_123",
          subject: "manager_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: (
            _index: string,
            build: (index: typeof indexBuilder) => unknown,
          ) => ({
            unique: async () => {
              build(indexBuilder);
              return memberships.get(requestedUserId) ?? null;
            },
          }),
        }),
        insert: async (_table: string, value: Record<string, unknown>) => {
          inserts.push(value);
          return "workItems:one";
        },
      },
    };

    await createWorkItem._handler(context as never, {
      eventId: "events:one" as never,
      title: "Load spare wheel",
      assigneeId: "crew_456",
    });

    expect(inserts[0]).toMatchObject({
      assigneeId: "crew_456",
      priority: "normal",
    });
  });

  it("rejects an assignee outside the event and restricts the assignee list", async () => {
    let membershipQuery = 0;
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|manager_123",
          subject: "manager_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({
            unique: async () => {
              membershipQuery += 1;
              return membershipQuery === 1 ? { role: "manager" } : null;
            },
          }),
        }),
        insert: async () => "workItems:one",
      },
    };

    await expect(
      createWorkItem._handler(context as never, {
        eventId: "events:one" as never,
        title: "Load spare wheel",
        assigneeId: "outsider_789",
      }),
    ).rejects.toThrow("Assignee must belong to the event");

    await expect(
      listWorkAssignees._handler(
        { auth: { getUserIdentity: async () => null } } as never,
        { eventId: "events:one" as never },
      ),
    ).rejects.toThrow("Unauthenticated");
  });

  it("reads a work item only after checking event membership and ownership", async () => {
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
        get: async () => ({ eventId: "events:other" }),
      },
    };

    await expect(
      getWorkItem._handler(context as never, {
        eventId: "events:one" as never,
        itemId: "workItems:one" as never,
      }),
    ).rejects.toThrow("Work item not found");
  });

  it("validates and creates an event-local work template for a manager", async () => {
    const inserts: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|manager_123",
          subject: "manager_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "manager" }) }),
        }),
        insert: async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return "workTemplates:one";
        },
      },
    };

    await createWorkTemplate._handler(context as never, {
      eventId: "events:one" as never,
      name: "  Service arrival  ",
      items: [{ title: "  Set up awning ", priority: "high" }],
    });

    expect(inserts[0]).toMatchObject({
      table: "workTemplates",
      value: {
        eventId: "events:one",
        name: "Service arrival",
        createdBy: "manager_123",
        items: [{ title: "Set up awning", priority: "high" }],
      },
    });
    expect(() => validatedTemplateName(" ")).toThrow("Template name");
    expect(() => validatedTemplateItems([])).toThrow("template needs");
  });

  it("does not apply an archived or cross-event work template", async () => {
    const context = {
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|manager_123",
          subject: "manager_123",
          issuer: "issuer",
        }),
      },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "manager" }) }),
        }),
        get: async () => ({
          eventId: "events:other",
          items: [{ title: "Set up awning", priority: "normal" }],
        }),
      },
    };

    await expect(
      applyWorkTemplate._handler(context as never, {
        eventId: "events:one" as never,
        templateId: "workTemplates:one" as never,
      }),
    ).rejects.toThrow("Template not found");
  });

  it("limits automation rules to managers and requires work-item titles", async () => {
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
      createWorkAutomationRule._handler(context as never, {
        eventId: "events:one" as never,
        name: "Create recovery task",
        trigger: "planChangePublished",
        action: "createWorkItem",
      }),
    ).rejects.toThrow("Forbidden");
    expect(() => validatedItemTitle(" ", "createWorkItem")).toThrow(
      "needs a title",
    );
    expect(validatedRuleName("  Plan change follow-up ")).toBe(
      "Plan change follow-up",
    );
  });

  it("allows only managers to change records in their event", async () => {
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
        get: async () => ({ eventId: "events:other" }),
      },
    };

    await expect(
      createRecord._handler(context as never, {
        eventId: "events:one" as never,
        name: "Service Park",
        type: "venue",
      }),
    ).rejects.toThrow("Forbidden");

    const managerContext = {
      ...context,
      db: {
        ...context.db,
        query: () => ({
          withIndex: () => ({ unique: async () => ({ role: "manager" }) }),
        }),
      },
    };
    await expect(
      updateRecord._handler(managerContext as never, {
        eventId: "events:one" as never,
        recordId: "eventRecords:one" as never,
        name: "Service Park",
        type: "venue",
      }),
    ).rejects.toThrow("Record not found");
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
