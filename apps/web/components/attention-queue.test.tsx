import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/use-attention", () => ({
  useAttention: () => ({
    assignedWork: [],
    unacknowledged: [
      {
        recipient: { _id: "planChangeRecipients:one", state: "sent" },
        change: {
          _id: "planChanges:one",
          itineraryItemId: "itineraryItems:affected",
          title: "Delayed crew call",
          severity: "critical",
        },
      },
    ],
    count: 1,
    isLoading: false,
  }),
}));

import { AttentionQueue } from "./attention-queue";

describe("AttentionQueue plan changes", () => {
  it("links acknowledgement work directly to the affected movement", () => {
    render(<AttentionQueue eventId="events:one" />);
    const link = screen.getByRole("link", { name: "Review and acknowledge" });
    expect(link.getAttribute("href")).toBe(
      "/events/events:one/plan/itineraryItems:affected#published-changes",
    );
  });
});
