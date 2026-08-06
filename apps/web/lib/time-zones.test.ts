import { describe, expect, it } from "vitest";
import { eventTimeZones } from "./time-zones";

describe("event time zones", () => {
  it("offers UTC and canonical IANA locations without ambiguous abbreviations", () => {
    expect(eventTimeZones).toContain("UTC");
    expect(eventTimeZones).toContain("America/Chicago");
    expect(eventTimeZones).not.toContain("CST");
    expect(eventTimeZones).not.toContain("EST");
  });
});
