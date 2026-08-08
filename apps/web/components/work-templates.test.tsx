import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apply = vi.fn().mockResolvedValue(["workItems:one", "workItems:two"]);
vi.mock("@/lib/events-api", () => ({
  workTemplatesApi: {
    list: "workTemplates:list",
    listArchived: "workTemplates:listArchived",
    create: "workTemplates:create",
    apply: "workTemplates:apply",
    archive: "workTemplates:archive",
    restore: "workTemplates:restore",
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "workTemplates:list"
      ? [
          {
            _id: "workTemplates:one",
            name: "Service arrival",
            items: [
              { title: "Awning", priority: "normal" },
              { title: "Radios", priority: "high" },
            ],
          },
        ]
      : [],
  useMutation: (reference: string) =>
    reference === "workTemplates:apply" ? apply : vi.fn(),
}));

import { WorkTemplates } from "./work-templates";

describe("WorkTemplates apply confirmation", () => {
  it("shows item impact before applying", async () => {
    render(<WorkTemplates eventId="events:one" />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByText(/creates 2 new checklist items/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Create 2 items" }));
    await vi.waitFor(() =>
      expect(apply).toHaveBeenCalledWith({
        eventId: "events:one",
        templateId: "workTemplates:one",
      }),
    );
  });
});
