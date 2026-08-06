import { describe, expect, it } from "vitest";
import { isLocationRecord, locationRecords } from "./record-locations";

const types = [
  { _id: "eventRecordTypes:post", isLocation: true },
  { _id: "eventRecordTypes:radio", isLocation: false },
  { _id: "eventRecordTypes:retired", isLocation: true, archivedAt: 10 },
];

describe("record locations", () => {
  it("treats the built-in place types as locations when no type is configured", () => {
    for (const type of ["venue", "place", "service"]) {
      expect(isLocationRecord({ type }, types)).toBe(true);
    }
    for (const type of ["vehicle", "equipment", "organization", "person"]) {
      expect(isLocationRecord({ type }, types)).toBe(false);
    }
  });

  it("lets a configured type decide instead of its display name", () => {
    expect(
      isLocationRecord(
        { type: "Marshal post", recordTypeId: "eventRecordTypes:post" },
        types,
      ),
    ).toBe(true);
    expect(
      isLocationRecord(
        { type: "Radio channel", recordTypeId: "eventRecordTypes:radio" },
        types,
      ),
    ).toBe(false);
  });

  it("does not fall back to built-in names once a type is configured", () => {
    // A configured non-location type named "venue" must stay a non-location.
    expect(
      isLocationRecord(
        { type: "venue", recordTypeId: "eventRecordTypes:radio" },
        types,
      ),
    ).toBe(false);
    // An unresolvable type is not silently promoted to a location.
    expect(
      isLocationRecord(
        { type: "venue", recordTypeId: "eventRecordTypes:missing" },
        types,
      ),
    ).toBe(false);
  });

  it("keeps records whose configured type was archived", () => {
    expect(
      isLocationRecord(
        { type: "Old paddock", recordTypeId: "eventRecordTypes:retired" },
        types,
      ),
    ).toBe(true);
  });

  it("filters a record list to selectable locations", () => {
    const records = [
      { _id: "a", type: "venue" },
      { _id: "b", type: "vehicle" },
      { _id: "c", type: "Marshal post", recordTypeId: "eventRecordTypes:post" },
      {
        _id: "d",
        type: "Radio channel",
        recordTypeId: "eventRecordTypes:radio",
      },
    ];

    expect(locationRecords(records, types).map((record) => record._id)).toEqual(
      ["a", "c"],
    );
  });
});
