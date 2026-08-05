import { describe, expect, it } from "vitest";
import { readAnalyticsConfig } from "./analytics";

describe("readAnalyticsConfig", () => {
  it("does not enable analytics without a public PostHog key", () => {
    expect(readAnalyticsConfig({})).toBeUndefined();
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: "   " }),
    ).toBeUndefined();
  });

  it("uses safe defaults for optional public configuration", () => {
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key" }),
    ).toEqual({
      apiKey: "phc_test_key",
      host: "https://us.i.posthog.com",
      environment: "development",
      release: "unknown",
    });
  });

  it("keeps explicit host, environment, and release tagging", () => {
    expect(
      readAnalyticsConfig({
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_RELEASE_SHA: "a110c76",
      }),
    ).toMatchObject({
      host: "https://eu.i.posthog.com",
      environment: "preview",
      release: "a110c76",
    });
  });
});
