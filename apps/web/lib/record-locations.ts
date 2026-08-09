import type { EventRecord, RecordType } from "@/lib/events-api";

/**
 * Record type names that behave as locations before an event configures its own
 * vocabulary. Kept in sync with the same list in `convex/records.ts`.
 */
export const builtInLocationTypes = ["venue", "place", "service"] as const;

type LocationCandidate = Pick<EventRecord, "type" | "recordTypeId">;
type TypeCandidate = Pick<RecordType, "_id" | "isLocation">;

/**
 * Mirrors `isLocationRecord` in `convex/records.ts` so the client never offers a
 * record the server would reject, and never hides one the server would accept.
 *
 * A configured record type is authoritative on its own: once a record points at
 * one, its `isLocation` flag decides and the built-in names are not consulted.
 * Archived types still resolve, so archiving a type cannot silently drop the
 * records that already use it out of location pickers.
 */
export function isLocationRecord(
  record: LocationCandidate,
  types: readonly TypeCandidate[],
): boolean {
  if (record.recordTypeId !== undefined) {
    const configured = types.find((type) => type._id === record.recordTypeId);
    return configured?.isLocation === true;
  }

  return builtInLocationTypes.includes(
    record.type as (typeof builtInLocationTypes)[number],
  );
}

/** Filters a record list down to the places a movement can use. */
export function locationRecords<Record extends LocationCandidate>(
  records: readonly Record[],
  types: readonly TypeCandidate[],
): Record[] {
  return records.filter((record) => isLocationRecord(record, types));
}
