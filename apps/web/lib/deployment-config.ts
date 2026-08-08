import { isValidPostHogHost } from "./analytics";

type Environment = Record<string, string | undefined>;

export function deploymentConfigurationIssues(environment: Environment) {
  const issues: string[] = [];
  const deployed = Boolean(
    environment.RAILWAY_ENVIRONMENT_NAME || environment.RAILWAY_PROJECT_ID,
  );
  const clerkKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const posthogKey = environment.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const posthogHost = environment.NEXT_PUBLIC_POSTHOG_HOST?.trim();

  if (deployed && !clerkKey) issues.push("clerk_publishable_key_missing");
  if (deployed && clerkKey?.startsWith("pk_test_"))
    issues.push("clerk_development_key_deployed");

  if (Boolean(posthogKey) !== Boolean(posthogHost))
    issues.push("analytics_configuration_incomplete");
  else if (
    posthogKey &&
    (!posthogKey.startsWith("phc_") || !isValidPostHogHost(posthogHost))
  )
    issues.push("analytics_configuration_invalid");

  return issues;
}
