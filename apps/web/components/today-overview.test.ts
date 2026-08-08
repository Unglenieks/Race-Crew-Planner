import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("@/lib/events-api", () => ({
  itineraryApi: { list: "itinerary:list" },
}));

import { todayMovementState } from "./today-overview";

describe("todayMovementState", () => {
  it("uses the event date and keeps tomorrow out of today's list", () => {
    const items = [
      {
        _id: "today",
        title: "Evening service",
        scheduledFor: "2026-08-07T19:00",
      },
      {
        _id: "tomorrow",
        title: "Morning departure",
        scheduledFor: "2026-08-08T08:00",
      },
    ];
    const state = todayMovementState(
      items,
      "America/Los_Angeles",
      new Date("2026-08-08T01:00:00Z"),
    );
    expect(state.today).toBe("2026-08-07");
    expect(state.todaysItems.map((item) => item._id)).toEqual(["today"]);
    expect(state.nextItem?._id).toBe("today");

    const later = todayMovementState(
      items,
      "America/Los_Angeles",
      new Date("2026-08-08T03:00:00Z"),
    );
    expect(later.todaysItems.map((item) => item._id)).toEqual(["today"]);
    expect(later.nextItem?._id).toBe("tomorrow");
  });
});
