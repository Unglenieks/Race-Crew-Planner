import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const dismiss = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/events-api", () => ({
  setupApi: { status: "setup:status", dismiss: "setup:dismiss" },
}));
vi.mock("convex/react", () => ({
  useQuery: () => [
    { id: "profile", completed: true, dismissed: false },
    { id: "movement", completed: true, dismissed: false },
    { id: "crew", completed: false, dismissed: false },
  ],
  useMutation: () => dismiss,
}));

import { EventSetupGuide } from "./event-setup-guide";

describe("EventSetupGuide", () => {
  it("tracks steps independently and dismisses only the chosen step", () => {
    render(
      <EventSetupGuide eventId="events:one" eventName="Rally" role="owner" />,
    );
    expect(screen.getByText("Add the first movement")).toBeDefined();
    expect(screen.getByText("Invite your crew")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss Add the first movement" }),
    );
    expect(dismiss).toHaveBeenCalledWith({
      eventId: "events:one",
      step: "movement",
    });
    expect(screen.getByText("Invite your crew")).toBeDefined();
  });
});
