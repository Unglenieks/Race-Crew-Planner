import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  setAdminAuth: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_123" }),
  clerkClient: async () => ({ users: { getUser: mocks.getUser } }),
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth = mocks.setAdminAuth;
    mutation = mocks.mutation;
  },
}));

import { POST } from "./route";

describe("POST /api/event-invitations/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY = "test-admin-key";
  });

  it("claims with Clerk Backend API verified primary-email data", async () => {
    mocks.getUser.mockResolvedValue({
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "person@example.com",
          verification: { status: "verified" },
        },
      ],
    });
    mocks.mutation.mockResolvedValue({
      claimedCount: 1,
      requiresVerifiedEmail: false,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.setAdminAuth).toHaveBeenCalledWith("test-admin-key");
    expect(mocks.mutation).toHaveBeenCalledWith(expect.anything(), {
      userId: "user_123",
      email: "person@example.com",
    });
    await expect(response.json()).resolves.toEqual({
      claimedCount: 1,
      requiresVerifiedEmail: false,
    });
  });

  it("returns one actionable state when Clerk has no verified primary email", async () => {
    mocks.getUser.mockResolvedValue({
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "person@example.com",
          verification: { status: "unverified" },
        },
      ],
    });

    const response = await POST();

    await expect(response.json()).resolves.toEqual({
      claimedCount: 0,
      requiresVerifiedEmail: true,
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
});
