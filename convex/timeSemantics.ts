/** Event-local date and time helpers shared by itinerary validation tests. */

const localDateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: string) {
  const match = localDateTime.exec(value);
  if (match === null) return null;
  return match.slice(1).map(Number) as [number, number, number, number, number];
}

export function isCalendarDate(value: string) {
  const match = dateOnly.exec(value);
  if (match === null) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Allows 24:00 only at the end of an operational day, never 24:01. */
export function normalize2400(
  value: string,
  displayTime?: "standard" | "2400",
) {
  const match = localDateTime.exec(value);
  if (match === null) return value;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (hour !== 24 || minute !== 0) return value;
  if (!isCalendarDate(value.slice(0, 10))) return value;
  if (displayTime !== "2400") {
    throw new Error("24:00 requires the 2400 display convention");
  }
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return `${nextDay.getUTCFullYear().toString().padStart(4, "0")}-${(nextDay.getUTCMonth() + 1).toString().padStart(2, "0")}-${nextDay.getUTCDate().toString().padStart(2, "0")}T00:00`;
}

function formattedLocal(value: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function offsetAt(value: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(value);
  const name = formatted.find((entry) => entry.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? "");
  if (match === null) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

/**
 * Rejects impossible calendar values and local wall times skipped by daylight
 * saving time. Repeated fall-back times remain valid: the plan is deliberately
 * event-local and does not claim an instant-level distinction.
 */
export function isValidEventLocalDateTime(value: string, timeZone: string) {
  const parsed = parts(value);
  if (parsed === null) return false;
  const [year, month, day, hour, minute] = parsed;
  if (hour > 23 || minute > 59 || !isCalendarDate(value.slice(0, 10))) {
    return false;
  }
  try {
    const approximate = Date.UTC(year, month - 1, day, hour, minute);
    const offsets = new Set<number>();
    for (let elapsed = -30; elapsed <= 30; elapsed += 1) {
      offsets.add(
        offsetAt(new Date(approximate + elapsed * 60 * 60 * 1000), timeZone),
      );
    }
    return [...offsets].some(
      (offset) =>
        formattedLocal(new Date(approximate - offset * 60 * 1000), timeZone) ===
        value,
    );
  } catch {
    return false;
  }
}

export function isBoundaryTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
