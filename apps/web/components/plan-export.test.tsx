import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
let exports: unknown[] | undefined = [];

vi.mock("convex/react", () => ({
  useMutation: () => create,
  useQuery: () => exports,
}));

import { PlanExport, planExportCsv } from "./plan-export";

const items = [
  {
    _id: "itineraryItems:one",
    title: 'Crew "call"',
    scheduledFor: "2026-08-10T08:00",
    location: "Service park",
  },
];
const exportItems = [
  {
    itineraryItemId: "itineraryItems:one",
    title: 'Crew "call"',
    scheduledFor: "2026-08-10T08:00",
    location: "Service park",
  },
];

describe("PlanExport", () => {
  beforeEach(() => {
    exports = [];
    create.mockReset();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:brief"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("writes generation metadata and safely escaped movement rows into CSV", () => {
    expect(
      planExportCsv({
        _id: "planExports:one",
        timeZone: "America/Chicago",
        generatedAt: Date.UTC(2026, 7, 10, 12),
        items: exportItems,
      }),
    ).toContain('"Crew ""call"""');
    expect(
      planExportCsv({
        _id: "planExports:one",
        timeZone: "America/Chicago",
        generatedAt: Date.UTC(2026, 7, 10, 12),
        items: exportItems,
      }),
    ).toContain('"Generated","2026-08-10T12:00:00.000Z"');
  });

  it("saves the filtered export before downloading it", async () => {
    create.mockResolvedValueOnce({
      _id: "planExports:one",
      filterDay: "2026-08-10",
      timeZone: "America/Chicago",
      generatedAt: Date.UTC(2026, 7, 10, 12),
      items: exportItems,
    });
    render(
      <PlanExport
        eventId="events:one"
        items={items}
        timeZone="America/Chicago"
      />,
    );

    fireEvent.change(screen.getByLabelText("Show"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /download csv brief/i }),
    );

    expect(await screen.findByText(/saved to export history/i)).toBeTruthy();
    expect(create).toHaveBeenCalledWith({
      eventId: "events:one",
      filterDay: "2026-08-10",
    });
  });

  it("makes an older snapshot's superseded status explicit", () => {
    exports = [
      {
        _id: "planExports:old",
        generatedAt: 0,
        timeZone: "America/Chicago",
        items: exportItems,
        isSuperseded: true,
      },
    ];
    render(
      <PlanExport
        eventId="events:one"
        items={items}
        timeZone="America/Chicago"
      />,
    );

    expect(screen.getByText(/superseded — the plan changed/i)).toBeTruthy();
  });
});
