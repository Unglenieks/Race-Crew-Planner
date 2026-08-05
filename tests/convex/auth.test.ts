import { describe, expect, it } from "vitest";

import {
  requireIdentity,
  requireRole,
  type ApplicationRole,
} from "../../convex/auth";
import { getCurrentUser } from "../../convex/currentUser";

const owner: ApplicationRole = "owner";

describe("Convex authorization helpers", () => {
  it("returns a verified identity", async () => {
    const identity = await requireIdentity({
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "issuer|user_123",
          subject: "user_123",
          issuer: "issuer",
        }),
      },
    });

    expect(identity.tokenIdentifier).toBe("issuer|user_123");
  });

  it("rejects callers without an identity", async () => {
    await expect(
      requireIdentity({
        auth: { getUserIdentity: async () => null },
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("protects the current-user query and returns only verified identity data", async () => {
    await expect(
      getCurrentUser({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthenticated");

    await expect(
      getCurrentUser({
        auth: {
          getUserIdentity: async () => ({
            tokenIdentifier: "issuer|user_123",
            subject: "user_123",
            issuer: "issuer",
          }),
        },
      }),
    ).resolves.toEqual({
      subject: "user_123",
      tokenIdentifier: "issuer|user_123",
    });
  });

  it("permits only a membership role allowed by the function", () => {
    expect(requireRole(owner, ["owner", "manager"])).toBe("owner");
    expect(() => requireRole("crew", ["owner", "manager"])).toThrow(
      "Forbidden",
    );
    expect(() => requireRole(undefined, ["owner"])).toThrow("Forbidden");
  });
});
