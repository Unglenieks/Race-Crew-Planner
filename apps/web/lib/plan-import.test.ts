import { describe, expect, it } from "vitest";
import { parseDelimited, stageTabularRows } from "./plan-import";

describe("plan import tabular staging", () => {
  it("keeps quoted CSV values and creates reviewable range rows", () => {
    const parsed = stageTabularRows(
      parseDelimited(
        'Date,Time In,Location,Description,Personnel,Tags\n2026-02-06,1900 - 2100,"Rally HQ","Crew check-in, evening",RRC,check-in\n',
      ),
      [{ _id: "records:hq", name: "Rally HQ", type: "venue" }],
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      sourceRow: 2,
      normalizedDate: "2026-02-06",
      normalizedTime: "19:00",
      normalizedEndTime: "21:00",
      proposedMovementType: "range",
      proposedVenueId: "records:hq",
      description: "Crew check-in, evening",
      proposedTags: ["check-in"],
    });
    expect(parsed.rows[0].issues).toEqual([]);
  });

  it("makes missing required schedule values blocking errors", () => {
    const parsed = stageTabularRows(
      parseDelimited("Date,Time,Description\nnot a date,,\n"),
      [],
    );

    expect(parsed.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", field: "date" }),
        expect.objectContaining({ severity: "error", field: "time" }),
        expect.objectContaining({ severity: "error", field: "description" }),
      ]),
    );
  });
});
