import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: () => overview,
  useMutation: () => vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { LogisticsOverview } from "./logistics-overview";

const overview = {
  profile: null,
  legs: [
    {
      _id: "leg:1",
      name: "Day one",
      order: 0,
      stageCount: 2,
      stageMiles: 20,
      transitMiles: 40,
      fuel: {
        available: true,
        formula: "formula",
        plannedFuelGallons: 9,
        capacityShortfallGallons: 1,
      },
    },
  ],
  serviceIntervals: [
    {
      _id: "service:1",
      name: "Midday service",
      scheduledStart: "2026-08-08T12:00",
      scheduledEnd: "2026-08-08T12:30",
      allowedDurationMinutes: 30,
      movements: [],
    },
  ],
  weatherForecasts: [
    {
      _id: "weather:1",
      forecastDate: "2026-08-08",
      conditions: "Rain",
      source: "NWS",
      asOf: Date.now() - 13 * 60 * 60 * 1000,
    },
  ],
  contacts: [],
  supportLocations: [],
};

describe("LogisticsOverview", () => {
  it("keeps a crew brief read-only while flagging stale weather", () => {
    render(<LogisticsOverview eventId="events:one" role="crew" />);
    expect(screen.getByText(/crew brief/i)).toBeTruthy();
    expect(screen.getByText(/stale \(over 12 hours\)/i)).toBeTruthy();
    expect(screen.queryByText("Edit profile")).toBeNull();
  });
});
