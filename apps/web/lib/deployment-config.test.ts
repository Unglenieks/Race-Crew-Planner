import { describe, expect, it } from "vitest";
import { deploymentConfigurationIssues } from "./deployment-config";

describe("deploymentConfigurationIssues", () => {
  it("does not require integrations for local development", () => {
    expect(deploymentConfigurationIssues({})).toEqual([]);
  });

  it("detects a deployed Clerk development key without exposing it", () => {
    expect(
      deploymentConfigurationIssues({
        RAILWAY_ENVIRONMENT_NAME: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_private-looking-value",
      }),
    ).toContain("clerk_development_key_deployed");
  });

  it("allows a development Clerk key in the Railway development lane", () => {
    expect(
      deploymentConfigurationIssues({
        RAILWAY_ENVIRONMENT_NAME: "development",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_development-value",
      }),
    ).toEqual([]);
  });

  it("detects incomplete and invalid analytics configuration", () => {
    expect(
      deploymentConfigurationIssues({ NEXT_PUBLIC_POSTHOG_KEY: "phc_key" }),
    ).toEqual(["analytics_configuration_incomplete"]);
    expect(
      deploymentConfigurationIssues({
        NEXT_PUBLIC_POSTHOG_KEY: "phc_key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
      }),
    ).toEqual(["analytics_configuration_invalid"]);
  });
});
