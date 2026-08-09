import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/workspace/event-workspace", () => ({
  useEventWorkspace: () => ({ event: { id: "events:one" } }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { EventInfoSwitcher } from "./event-info-switcher";

describe("EventInfoSwitcher", () => {
  it("keeps both event-info destinations available with the current page marked", () => {
    render(<EventInfoSwitcher current="files" />);
    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("/events/events:one/event-info");
    expect(
      screen
        .getByRole("link", { name: "Files & sources" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
