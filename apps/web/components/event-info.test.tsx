import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "manager" as "manager" | "spectator",
}));

vi.mock("@/lib/events-api", () => ({
  logisticsApi: {
    getOverview: "logistics:getOverview",
    getSpectatorOverview: "logistics:getSpectatorOverview",
    createLeg: "logistics:createLeg",
    updateLeg: "logistics:updateLeg",
    removeLeg: "logistics:removeLeg",
    saveProfile: "logistics:saveProfile",
  },
  recordsApi: { listMapLocations: "records:listMapLocations" },
}));
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (reference: string) => {
    if (reference === "records:listMapLocations") return [];
    return {
      profile: { documentAccessCodes: [] },
      weatherForecasts: [],
      legs: [
        {
          _id: "legs:one",
          name: "Friday loop",
          order: 0,
          stageMiles: 12.5,
          transitMiles: 7.5,
          startOrder: 14,
          precedingCar: "13",
          fuel: { plannedFuelGallons: 3.4 },
          stages: [
            { name: "SS 1", miles: 5 },
            { name: "SS 2", miles: 7.5 },
          ],
        },
      ],
    };
  },
}));
vi.mock("@/components/workspace/event-workspace", () => ({
  useEventWorkspace: () => ({
    event: { id: "events:one", timeZone: "UTC" },
    role: state.role,
  }),
}));
vi.mock("@/components/event-info-switcher", () => ({
  EventInfoSwitcher: () => null,
}));

import { EventInfo } from "./event-info";

describe("EventInfo compact legs", () => {
  beforeEach(() => {
    state.role = "manager";
  });

  it("represents stage details and overall totals in the compact leg cards", () => {
    render(<EventInfo />);

    const cards = within(screen.getByLabelText("Leg cards"));
    expect(cards.getByText(/Friday loop/)).toBeTruthy();
    expect(cards.getByText("Planned fuel")).toBeTruthy();
    expect(screen.getByLabelText("Overall mileage").textContent).toContain(
      "12.5 mi",
    );
    expect(screen.getAllByText("View 2 stages").length).toBeGreaterThan(0);
  });

  it("does not expose private order or fuel values to spectators", () => {
    state.role = "spectator";
    render(<EventInfo />);

    const cards = within(screen.getByLabelText("Leg cards"));
    expect(cards.queryByText("Planned fuel")).toBeNull();
    expect(cards.queryByText("Start order")).toBeNull();
    expect(cards.queryByText("Car ahead")).toBeNull();
    expect(screen.getByLabelText("Overall mileage")).toBeTruthy();
  });
});
