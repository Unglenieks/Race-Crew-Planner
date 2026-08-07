import { describe, expect, it } from "vitest";
import { eventTimeZones, localTimeZone, timeZoneOptions } from "./time-zones";

describe("event time zones", () => {
  it("offers UTC and canonical IANA locations without ambiguous abbreviations", () => {
    expect(eventTimeZones).toContain("UTC");
    expect(eventTimeZones).toContain("America/Chicago");
    expect(eventTimeZones).not.toContain("CST");
    expect(eventTimeZones).not.toContain("EST");
  });

  it("lists UTC exactly once even if the runtime's own list includes it", () => {
    expect(eventTimeZones.filter((zone) => zone === "UTC")).toHaveLength(1);
  });

  it("resolves a usable local zone", () => {
    const local = localTimeZone();
    expect(local === "UTC" || local.includes("/")).toBe(true);
  });

  it("deduplicates option lists while preserving the promoted zone first", () => {
    expect(
      timeZoneOptions(["Europe/Berlin"], ["UTC", "Europe/Berlin", "UTC"]),
    ).toEqual(["Europe/Berlin", "UTC"]);
  });
});
