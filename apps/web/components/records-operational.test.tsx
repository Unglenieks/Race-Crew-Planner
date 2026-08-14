import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/workspace/event-workspace", () => ({
  useEventWorkspace: () => ({
    event: { id: "events:one" },
    role: "owner",
  }),
}));
vi.mock("@/lib/events-api", () => ({
  recordsApi: {
    get: "records:get",
    listCategories: "records:listCategories",
    listTypes: "records:listTypes",
    saveVenueDetails: "records:saveVenueDetails",
    assignCategory: "records:assignCategory",
    removeCategory: "records:removeCategory",
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: string) => {
    if (reference === "records:get")
      return {
        _id: "eventRecords:one",
        name: "Service vehicle",
        type: "venue",
        notes: "Original notes\nSecond line",
        fieldValues: {
          operational_status: "Ready",
          future_boolean: "true",
          manual: "https://example.com/manual",
        },
        fields: [
          {
            _id: "eventRecordFields:status",
            key: "operational_status",
            label: "Operational status",
            type: "select",
            order: 0,
          },
        ],
        categories: [],
      };
    return [];
  },
  useMutation: () => vi.fn(),
}));

import { RecordDetail } from "./records-operational";

describe("RecordDetail fields", () => {
  it("shows notes, configured values, links, and unknown future fields", () => {
    render(<RecordDetail recordId="eventRecords:one" />);
    expect(screen.getAllByText(/Original notes/)).toHaveLength(2);
    expect(screen.getByText("Operational status")).toBeDefined();
    expect(screen.getByText("Ready")).toBeDefined();
    expect(screen.getByText("Yes")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "https://example.com/manual" }),
    ).toBeDefined();
    expect(screen.queryByText("Categories")).toBeNull();
    expect(screen.queryByText("Records & venues")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to map" }).getAttribute("href"),
    ).toBe("/events/events:one/map");
    expect(
      (screen.getByLabelText("Venue name") as HTMLInputElement).value,
    ).toBe("Service vehicle");
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).value,
    ).toBe("Original notes\nSecond line");
    expect(
      screen.getByRole("textbox", { name: /^Opening hours/ }).tagName,
    ).toBe("TEXTAREA");
    expect(screen.queryByLabelText("Contact detail")).toBeNull();
  });
});
