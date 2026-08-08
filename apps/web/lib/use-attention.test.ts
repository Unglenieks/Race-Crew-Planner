import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ useAuth: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("@/lib/events-api", () => ({
  planChangesApi: {},
  workApi: {},
}));

import { assignedAttentionWork } from "./use-attention";

describe("assignedAttentionWork", () => {
  it("keeps open, in-progress, and blocked work until completion", () => {
    const work = ["open", "inProgress", "blocked", "completed"].map(
      (status) => ({
        _id: status,
        title: status,
        status,
        assigneeId: "user_1",
        updatedAt: 1,
      }),
    );
    expect(
      assignedAttentionWork(work as never, "user_1").map((item) => item.status),
    ).toEqual(["open", "inProgress", "blocked"]);
  });
});
