/**
 * Canonical IANA time zones, resolved defensively.
 *
 * `Intl.supportedValuesOf` is not available in every JavaScript runtime, so a
 * missing implementation must degrade to an empty list rather than throwing at
 * module scope and taking the whole bundle down.
 *
 * The returned list is only ever a *suggestion* list for the picker. The
 * authoritative check lives in `convex/events.ts`, which validates whatever the
 * caller actually submits.
 */
function canonicalTimeZones(): string[] {
  const supportedValuesOf = (
    Intl as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf !== "function") return [];
  try {
    return supportedValuesOf.call(Intl, "timeZone");
  } catch {
    return [];
  }
}

/**
 * UTC is listed first because `Intl.supportedValuesOf` omits it on most ICU
 * builds, and filtered out of the tail so a build that *does* include it cannot
 * produce a duplicate option.
 */
export const eventTimeZones: string[] = [
  "UTC",
  ...canonicalTimeZones().filter((zone) => zone !== "UTC"),
];

/**
 * The operator's own zone, which is a far better default for a new event than
 * UTC. Falls back to UTC when the runtime reports something unusable.
 */
export function localTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof resolved === "string" && resolved.includes("/")
      ? resolved
      : "UTC";
  } catch {
    return "UTC";
  }
}

/** Deduplicates while preserving order, so a detected zone can be promoted. */
export function timeZoneOptions(...zones: readonly string[][]): string[] {
  return [...new Set(zones.flat())];
}
