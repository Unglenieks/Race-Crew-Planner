export const analyticsEventNames = ["app_viewed"] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsConfig = {
  apiKey: string;
  host: string;
  environment: string;
  release: string;
};

type PublicEnvironment = Record<string, string | undefined>;

/**
 * Returns undefined until a public PostHog project key is configured. Keeping
 * this check at the boundary means local development never sends data by
 * accident.
 */
export function readAnalyticsConfig(
  environment: PublicEnvironment,
): AnalyticsConfig | undefined {
  const apiKey = environment.NEXT_PUBLIC_POSTHOG_KEY?.trim();

  if (apiKey === undefined || apiKey === "") {
    return undefined;
  }

  return {
    apiKey,
    host:
      environment.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
      "https://us.i.posthog.com",
    environment: environment.NEXT_PUBLIC_APP_ENV?.trim() || "development",
    release: environment.NEXT_PUBLIC_RELEASE_SHA?.trim() || "unknown",
  };
}
