import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replayCompletion, queue } = vi.hoisted(() => ({
  replayCompletion: vi.fn(),
  queue: {
    getOfflinePackage: vi.fn(),
    listQueuedChanges: vi.fn(),
    markSuccessfulSync: vi.fn(),
    removeQueuedChange: vi.fn(),
    saveOfflinePackage: vi.fn(),
  },
}));
let queryResults: unknown[] = [];
let queryIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: () => queryResults[queryIndex++ % 3],
  useMutation: () => replayCompletion,
}));
vi.mock("@/lib/offline-queue", () => queue);

import { OfflineManager } from "./offline-manager";

const plan = [
  {
    _id: "plan:one",
    title: "Arrival",
    scheduledFor: "2026-08-09T09:00",
  },
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
    queue.listQueuedChanges.mockResolvedValue([]);
    queue.getOfflinePackage.mockResolvedValue(undefined);
    queue.saveOfflinePackage.mockResolvedValue(undefined);
    queue.removeQueuedChange.mockResolvedValue(undefined);
    queue.markSuccessfulSync.mockResolvedValue({
      eventId: "events:one",
      lastSuccessfulSyncAt: 123,
    });
    replayCompletion.mockResolvedValue({ outcome: "applied" });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("keeps an offline storage failure visible instead of implying the package saved", async () => {
    queue.saveOfflinePackage.mockRejectedValueOnce(new Error("quota exceeded"));
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "could not be saved",
    );
    expect(screen.getByText("No offline package saved.")).toBeTruthy();
  });

  it("lets the operator explicitly apply a resolved conflict using the latest version", async () => {
    queue.listQueuedChanges.mockResolvedValue([
      {
        id: "operation:one",
        eventId: "events:one",
        label: "Complete Check radio",
        createdAt: 1,
        status: "needsResolution",
        kind: "workCompletion",
        payload: {
          itemId: "work:one",
          completed: true,
          expectedUpdatedAt: 1,
          serverStatusAtQueue: "open",
        },
      },
    ]);
    renderManager();

    fireEvent.click(
      await screen.findByRole("button", { name: /apply local/i }),
    );

    await waitFor(() =>
      expect(replayCompletion).toHaveBeenCalledWith({
        eventId: "events:one",
        operationId: "operation:one",
        itemId: "work:one",
        completed: true,
        expectedUpdatedAt: 42,
        expectedStatus: "open",
      }),
    );
    expect(queue.removeQueuedChange).toHaveBeenCalledWith("operation:one");
  });
});
