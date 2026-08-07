import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventWorkspaceProvider } from "@/components/workspace/event-workspace";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/events/events:one/today",
}));
vi.mock("@/components/connection-status", () => ({
  ConnectionStatus: () => <p>Connection available</p>,
}));

import { MobileWorkspaceNavigation } from "./mobile-workspace-navigation";

const event = {
  id: "events:one",
  name: "North Ridge Rally",
  timeZone: "America/New_York",
  role: "owner" as const,
  isSample: false,
};

describe("MobileWorkspaceNavigation", () => {
  it("opens a keyboard-dismissible, role-aware workspace drawer", async () => {
    render(
      <EventWorkspaceProvider event={event} events={[event]}>
        <MobileWorkspaceNavigation />
      </EventWorkspaceProvider>,
    );

    const menu = screen.getByRole("button", {
      name: "Open workspace navigation",
    });
    fireEvent.click(menu);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("link", { name: /people/i })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(menu);
  });
});
