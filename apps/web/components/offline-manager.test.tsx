import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({
  getOfflinePackage: vi.fn(),
  saveOfflinePackage: vi.fn(),
}));
let queryResults: unknown[] = [];
let queryIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: () => queryResults[queryIndex++ % 3],
}));
vi.mock("@/lib/offline-queue", () => queue);

import { OfflineManager } from "./offline-manager";

const plan = [
  { _id: "plan:one", title: "Arrival", scheduledFor: "2026-08-09T09:00" },
];
const work = [
  {
    _id: "work:one",
    title: "Check radio",
    status: "open" as const,
    updatedAt: 42,
  },
];

function renderManager() {
  queryResults = [plan, work, []];
  queryIndex = 0;
  return render(<OfflineManager eventId="events:one" />);
}

describe("OfflineManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.getOfflinePackage.mockResolvedValue(undefined);
    queue.saveOfflinePackage.mockResolvedValue(undefined);
  });

  it("keeps offline storage failures visible without implying a reference saved", async () => {
    queue.saveOfflinePackage.mockRejectedValueOnce(new Error("quota exceeded"));
    renderManager();
    fireEvent.click(
      screen.getByRole("button", { name: /save current reference/i }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "could not be saved",
    );
    expect(screen.getByText("No local event reference saved.")).toBeTruthy();
  });

  it("stores structured movement labels without exposing queued-write controls", async () => {
    queryResults = [
      [
        {
          ...plan[0],
          movementTypeLabel: "Service",
          tags: [{ _id: "tag:mtc", name: "MTC" }],
          assignments: [
            { _id: "assignment:one", targetKind: "team", label: "RRC" },
          ],
        },
      ],
      work,
      [],
    ];
    queryIndex = 0;
    render(<OfflineManager eventId="events:one" />);
    fireEvent.click(
      screen.getByRole("button", { name: /save current reference/i }),
    );
    await waitFor(() =>
      expect(queue.saveOfflinePackage).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: [
            expect.objectContaining({
              movementTypeLabel: "Service",
              tagLabels: ["MTC"],
              assignmentLabels: ["RRC"],
            }),
          ],
        }),
      ),
    );
    expect(screen.queryByRole("button", { name: /apply local/i })).toBeNull();
  });
});
