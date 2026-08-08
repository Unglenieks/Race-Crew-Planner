import { describe, expect, it } from "vitest";
import { readAnalyticsConfig } from "./analytics";

describe("readAnalyticsConfig", () => {
  it("does not enable analytics without a public PostHog key", () => {
    expect(readAnalyticsConfig({})).toBeUndefined();
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: "   " }),
    ).toBeUndefined();
  });

  it("stays disabled when the host is missing", () => {
    expect(
      readAnalyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key" }),
    ).toBeUndefined();
  });

  it("rejects malformed keys and non-ingest hosts", () => {
    expect(
      readAnalyticsConfig({
        NEXT_PUBLIC_POSTHOG_KEY: "wrong",
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
      }),
    ).toBeUndefined();
    expect(
      readAnalyticsConfig({
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
      }),
    ).toBeUndefined();
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
