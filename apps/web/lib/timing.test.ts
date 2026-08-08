import { describe, expect, it } from "vitest";
import { displayMovementTime, movementTimeLabel } from "./timing";

describe("movement time display conventions", () => {
  it("renders every timing kind without implying false precision", () => {
    expect(
      displayMovementTime({
        _id: "1",
        title: "Exact",
        scheduledFor: "2026-10-16T23:21",
        timeKind: "exact",
      }),
    ).toBe("23:21");
    expect(
      displayMovementTime({
        _id: "2",
        title: "Approx",
        scheduledFor: "2026-10-16T23:21",
        timeKind: "approximate",
      }),
    ).toBe("~23:21");
    expect(
      movementTimeLabel({
        _id: "2",
        title: "Approx",
        scheduledFor: "2026-10-16T23:21",
        timeKind: "approximate",
      }),
    ).toBe("Approximate time: 23:21");
    expect(
      displayMovementTime({
        _id: "3",
        title: "Range",
        scheduledFor: "2026-10-16T19:00",
        scheduledUntil: "2026-10-16T21:00",
        timeKind: "range",
      }),
    ).toBe("19:00–21:00");
    expect(
      displayMovementTime({
        _id: "4",
        title: "Day",
        scheduledFor: "2026-10-16T00:00",
        timeKind: "allDay",
      }),
    ).toBe("All day");
    expect(
      displayMovementTime({
        _id: "5",
        title: "Close",
        scheduledFor: "2026-10-17T00:00",
        displayTime: "2400",
        timeKind: "exact",
      }),
    ).toBe("2400");
  });
});
