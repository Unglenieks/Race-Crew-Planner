import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events-api", () => ({
  activityApi: {
    list: "activity:list",
    addComment: "activity:addComment",
    addSource: "activity:addSource",
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    activity: [
      {
        _id: "eventActivity:one",
        message: "Updated movement: Crew call",
        actorName: "Morgan Manager",
        createdAt: 1,
        href: "/events/events:one/plan/itineraryItems:one",
      },
    ],
    comments: [
      {
        _id: "eventComments:one",
        body: "Confirm the access road before crew arrival.",
        authorName: "Alex Crew",
        createdAt: 1,
      },
    ],
    sources: [],
  }),
  useMutation: () => vi.fn(),
}));

import { ActivitySources } from "./activity-sources";

describe("ActivitySources history", () => {
  it("renders saved comment bodies and links audited objects", () => {
    render(<ActivitySources eventId="events:one" />);
    expect(
      screen.getByText("Confirm the access road before crew arrival."),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Updated movement: Crew call" })
        .getAttribute("href"),
    ).toBe("/events/events:one/plan/itineraryItems:one");
  });
});
