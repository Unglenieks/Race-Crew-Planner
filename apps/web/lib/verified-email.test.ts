import { describe, expect, it } from "vitest";
import { verifiedPrimaryEmail } from "./verified-email";

describe("verifiedPrimaryEmail", () => {
  it("returns only the verified primary Clerk address", () => {
    expect(
      verifiedPrimaryEmail({
        primaryEmailAddressId: "primary",
        emailAddresses: [
          {
            id: "primary",
            emailAddress: " Person@Example.com ",
            verification: { status: "verified" },
          },
          {
            id: "other",
            emailAddress: "other@example.com",
            verification: { status: "verified" },
          },
        ],
      }),
    ).toBe("person@example.com");
  });

  it("rejects an unverified or missing primary address", () => {
    expect(
      verifiedPrimaryEmail({
        primaryEmailAddressId: "primary",
        emailAddresses: [
          {
            id: "primary",
            emailAddress: "person@example.com",
            verification: { status: "unverified" },
          },
        ],
      }),
    ).toBeUndefined();
  });
});
