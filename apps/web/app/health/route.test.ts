import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /health", () => {
  it("returns an OK status", async () => {
    const response = GET();

    await expect(response.json()).resolves.toEqual({ status: "ok", issues: [] });
    expect(response.status).toBe(200);
  });

  it("reports deployed development credentials without returning their values", async () => {
    const previousEnvironment = process.env.RAILWAY_ENVIRONMENT_NAME;
    const previousKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_secret-value";

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "misconfigured",
      issues: ["clerk_development_key_deployed"],
    });
    expect(JSON.stringify(body)).not.toContain("pk_test_secret-value");

    if (previousEnvironment === undefined)
      delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = previousEnvironment;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousKey;
  });
});
