import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventWorkspaceProvider } from "./event-workspace";

vi.mock("next/navigation", () => ({
  usePathname: () => "/events/events:one/work",
}));
vi.mock("@/components/connection-status", () => ({
  ConnectionStatus: () => <p>Online</p>,
}));

import { Sidebar } from "@/components/sidebar";
import { WorkspaceScreen } from "./workspace-screen";

const event = {
  id: "events:one",
  name: "North Ridge Rally",
  timeZone: "America/New_York",
  role: "owner" as const,
};

describe("workspace navigation accessibility", () => {
  it("keeps a persistent desktop rail and a single Work page h1", () => {
    const { container } = render(
      <EventWorkspaceProvider event={event} events={[event]}>
        <Sidebar />
        <WorkspaceScreen id="work">
          <h3>Checklist</h3>
        </WorkspaceScreen>
      </EventWorkspaceProvider>,
    );
    expect(container.querySelector("aside")?.className).toContain("md:flex");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Work & checklists" }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", {
        name: "North Ridge Rally, America/New_York, owner, 1 event. Switch event.",
      }),
    ).toBeDefined();
  });
});
