export type AnalyticsConsent = "pending" | "granted" | "denied";

export const analyticsConsentStorageKey = "race-planner.analytics-consent";

let inMemoryConsent: AnalyticsConsent = "pending";

function parseConsent(value: string | null): AnalyticsConsent {
  return value === "granted" || value === "denied" ? value : "pending";
}

/**
 * Web Storage can be unavailable in restrictive browser contexts. Keep the
 * consent decision in memory so analytics remains safely disabled on failures.
 */
export function readAnalyticsConsent(storage: Pick<Storage, "getItem">) {
  try {
    inMemoryConsent = parseConsent(storage.getItem(analyticsConsentStorageKey));
  } catch {
    // Preserve the last known in-memory choice when storage is unavailable.
  }

  return inMemoryConsent;
}

/** Persists when possible and always preserves the visitor's current choice. */
export function writeAnalyticsConsent(
  consent: Exclude<AnalyticsConsent, "pending">,
  storage: Pick<Storage, "setItem">,
) {
  inMemoryConsent = consent;

  try {
    storage.setItem(analyticsConsentStorageKey, consent);
  } catch {
    // The in-memory value still governs this browser session.
  }
}
