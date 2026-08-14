import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrewViewControl } from "./crew-view-control";
import {
  EventWorkspaceProvider,
  useEventWorkspace,
} from "./workspace/event-workspace";

const navigation = vi.hoisted(() => ({
  pathname: "/events/events:one/schedule",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

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
  beforeEach(() => {
    navigation.pathname = "/events/events:one/schedule";
    navigation.replace.mockReset();
  });
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
    expect(navigation.replace).toHaveBeenCalledWith("/events/events:one/today");
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
