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

    const control = screen.getByRole("button", {
      name: "Choose workspace view",
    });
    expect(screen.getByText("Rendered role: manager")).toBeTruthy();

    fireEvent.click(control);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Crew" }));

    expect(screen.getByText("Rendered role: crew")).toBeTruthy();

    fireEvent.click(control);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Spectator" }));

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

    const control = screen.getByRole("button", {
      name: "Choose workspace view",
    });
    fireEvent.click(control);
    expect(
      screen.queryByRole("menuitemradio", { name: "Crew Chief" }),
    ).toBeNull();
    expect(screen.getByRole("menuitemradio", { name: /^Crew/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Spectator" }));

    expect(screen.getByText("Rendered role: spectator")).toBeTruthy();
  });

  it("does not render a view control for spectators", () => {
    const spectatorEvent = { ...managerEvent, role: "spectator" as const };
    render(
      <EventWorkspaceProvider event={spectatorEvent} events={[spectatorEvent]}>
        <CrewViewControl />
      </EventWorkspaceProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Choose workspace view" }),
    ).toBeNull();
  });
});
