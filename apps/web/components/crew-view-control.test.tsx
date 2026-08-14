import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrewViewControl } from "./crew-view-control";
import {
  EventWorkspaceProvider,
  useEventWorkspace,
} from "./workspace/event-workspace";

const managerEvent = {
  id: "events:one",
  name: "North Ridge Rally",
  timeZone: "America/New_York",
  role: "manager" as const,
};

function CurrentRole() {
  const { role } = useEventWorkspace();
  return <p>Rendered role: {role}</p>;
}

describe("CrewViewControl", () => {
  it("lets crew chiefs inspect the workspace as crew or spectator", () => {
    render(
      <EventWorkspaceProvider event={managerEvent} events={[managerEvent]}>
        <CrewViewControl />
        <CurrentRole />
      </EventWorkspaceProvider>,
    );

    const control = screen.getByLabelText("View as");
    expect(screen.getByText("Rendered role: manager")).toBeTruthy();

    fireEvent.change(control, { target: { value: "crew" } });

    expect(screen.getByText("Rendered role: crew")).toBeTruthy();

    fireEvent.change(control, { target: { value: "spectator" } });

    expect(screen.getByText("Rendered role: spectator")).toBeTruthy();
  });

  it("lets crew members inspect the spectator view without offering chief controls", () => {
    const crewEvent = { ...managerEvent, role: "crew" as const };
    render(
      <EventWorkspaceProvider event={crewEvent} events={[crewEvent]}>
        <CrewViewControl />
        <CurrentRole />
      </EventWorkspaceProvider>,
    );

    const control = screen.getByLabelText("View as");
    expect(screen.queryByRole("option", { name: "Crew Chief" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Crew" })).toBeTruthy();

    fireEvent.change(control, { target: { value: "spectator" } });

    expect(screen.getByDisplayValue("Spectator")).toBeTruthy();
    expect(screen.getByText("Rendered role: spectator")).toBeTruthy();
  });
});
