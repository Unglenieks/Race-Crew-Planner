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

export function timeZoneLabel(timeZone: string) {
  return timeZone.replaceAll("_", " ").replace("/", " / ");
}

export function eventDateKey(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function eventLocalDateTime(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

/** Formats a stored event-local wall time without applying the browser zone. */
export function formatEventDateTime(value: string, timeZone: string) {
  const [date = "", time = ""] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some(Number.isNaN)) return value;
  const label = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
  return `${label} (${timeZoneLabel(timeZone)})`;
}
