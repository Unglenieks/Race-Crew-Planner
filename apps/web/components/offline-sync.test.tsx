import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({
  getOfflinePackage: vi.fn().mockResolvedValue({ lastSuccessfulSyncAt: 1 }),
  listQueuedChanges: vi.fn().mockResolvedValue([]),
  markSuccessfulSync: vi.fn(),
  removeQueuedChange: vi.fn(),
  updateQueuedChange: vi.fn(),
}));

vi.mock("@/lib/offline-queue", () => queue);
vi.mock("@/lib/events-api", () => ({
  workApi: { setCompletionOffline: "work:setCompletionOffline" },
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));

import { OfflineSync } from "./offline-sync";

describe("OfflineSync status", () => {
  it("uses an in-flow compact status instead of a floating overlay", async () => {
    render(<OfflineSync eventId="events:one" />);
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Offline changes synced at");
    expect(status.className).not.toContain("fixed");
  });
});
