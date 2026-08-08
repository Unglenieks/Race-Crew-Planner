export const analyticsEventNames = ["app_viewed"] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsConfig = {
  apiKey: string;
  host: string;
  environment: string;
  release: string;
};

type PublicEnvironment = Record<string, string | undefined>;

export function isValidPostHogHost(value: string | undefined) {
  if (value === undefined || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      (url.hostname === "us.i.posthog.com" ||
        url.hostname === "eu.i.posthog.com")
    );
  } catch {
    return false;
  }
}

/**
 * Returns undefined until a public PostHog project key is configured. Keeping
 * this check at the boundary means local development never sends data by
 * accident.
 */
export function readAnalyticsConfig(
  environment: PublicEnvironment,
): AnalyticsConfig | undefined {
  const apiKey = environment.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = environment.NEXT_PUBLIC_POSTHOG_HOST?.trim();

  if (
    apiKey === undefined ||
    apiKey === "" ||
    !apiKey.startsWith("phc_") ||
    !isValidPostHogHost(host)
  ) {
    return undefined;
  }

  return {
    apiKey,
    host: host!,
    environment: environment.NEXT_PUBLIC_APP_ENV?.trim() || "development",
    release: environment.NEXT_PUBLIC_RELEASE_SHA?.trim() || "unknown",
  };
}
