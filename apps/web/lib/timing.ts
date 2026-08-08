import type { ItineraryItem, PlanSection } from "./events-api";

export function calendarDay(
  item: Pick<ItineraryItem, "scheduledFor" | "operationalDay">,
) {
  return item.operationalDay ?? item.scheduledFor.slice(0, 10);
}

function localTime(value: string) {
  return value.split("T")[1] ?? "";
}

/** The compact operational convention used in the plan list. */
export function displayMovementTime(item: ItineraryItem) {
  if (item.timeKind === "allDay") return "All day";
  if (item.displayTime === "2400") return "2400";
  const start = localTime(item.scheduledFor);
  if (item.timeKind === "range") {
    return item.scheduledUntil === undefined
      ? `${start}–End time not recorded`
      : `${start}–${localTime(item.scheduledUntil)}`;
  }
  return item.timeKind === "approximate" ? `~${start}` : start;
}

export function movementTimeLabel(item: ItineraryItem) {
  const displayed = displayMovementTime(item);
  return item.timeKind === "approximate"
    ? `Approximate time: ${displayed.slice(1)}`
    : displayed;
}

export function operationalDayLabel(
  item: ItineraryItem,
  sections: PlanSection[],
) {
  const section = sections.find(
    (candidate) => candidate._id === item.sectionId,
  );
  return section?.name ?? calendarDay(item);
}
