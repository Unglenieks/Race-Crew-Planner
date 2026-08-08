import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutations = {
  publish: vi.fn().mockResolvedValue("planChanges:two"),
  markOpened: vi.fn().mockResolvedValue(null),
  acknowledge: vi.fn().mockResolvedValue(null),
  acknowledgeElsewhere: vi.fn().mockResolvedValue(null),
};

const recipients = [{ userId: "crew_123", name: "Alex Crew", role: "crew" }];
let currentRecipient = {
  _id: "planChangeRecipients:one",
  userId: "crew_123",
  name: "Alex Crew",
  state: "sent" as const,
  sentAt: 1,
};

vi.mock("@/lib/events-api", () => ({
  planChangesApi: {
    recipients: "planChanges:recipients",
    listForMovement: "planChanges:listForMovement",
    publish: "planChanges:publish",
    markOpened: "planChanges:markOpened",
    acknowledge: "planChanges:acknowledge",
    acknowledgeElsewhere: "planChanges:acknowledgeElsewhere",
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (reference === "planChanges:recipients") return recipients;
    return [
      {
        _id: "planChanges:one",
        itineraryItemId: "itineraryItems:one",
        title: "Crew call",
        scheduledFor: "2026-08-10T08:00",
        previousTitle: "Earlier crew call",
        previousScheduledFor: "2026-08-10T07:45",
        reason: "Route control delayed the start.",
        severity: "critical",
        publishedAt: 1,
        publishedByName: "Morgan Manager",
        recipients: [currentRecipient],
        currentRecipient,
      },
    ];
  },
  useMutation: (reference: string) => {
    if (reference === "planChanges:publish") return mutations.publish;
    if (reference === "planChanges:markOpened") return mutations.markOpened;
    if (reference === "planChanges:acknowledge") return mutations.acknowledge;
    return mutations.acknowledgeElsewhere;
  },
}));

import { PlanChangeDelivery } from "./plan-change-delivery";

const props = {
  eventId: "events:one",
  items: [
    {
      _id: "itineraryItems:one",
      title: "Crew call",
      scheduledFor: "2026-08-10T08:00",
    },
  ],
  movementId: "itineraryItems:one",
};

describe("PlanChangeDelivery", () => {
  afterEach(() => {
    Object.values(mutations).forEach((mutation) => mutation.mockClear());
    currentRecipient = {
      _id: "planChangeRecipients:one",
      userId: "crew_123",
      name: "Alex Crew",
      state: "sent",
      sentAt: 1,
    };
  });

  it("marks a reached change opened and gives its recipient an acknowledgement action", async () => {
    render(<PlanChangeDelivery {...props} role="crew" />);
    await vi.waitFor(() =>
      expect(mutations.markOpened).toHaveBeenCalledWith({
        eventId: "events:one",
        recipientId: "planChangeRecipients:one",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Review and acknowledge" }),
    ).toBeDefined();
    expect(screen.queryByText("Record radio / phone")).toBeNull();
  });

  it("keeps operator controls separate and collapses the publisher after success", async () => {
    render(<PlanChangeDelivery {...props} role="manager" />);
    expect(screen.getByText("Record radio / phone")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Publish change" }));
    fireEvent.change(screen.getByLabelText("Reason or source"), {
      target: { value: "Updated by route control" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: /publish and track/i })
        .closest("form")!,
    );
    await vi.waitFor(() => expect(mutations.publish).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("button", { name: "Publish another change" }),
    ).toBeDefined();
    expect(screen.queryByLabelText("Reason or source")).toBeNull();
  });
});
