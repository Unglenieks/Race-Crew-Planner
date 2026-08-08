import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutations = {
  syncProfile: vi.fn().mockResolvedValue(null),
  claim: vi.fn().mockResolvedValue({
    claimedCount: 0,
    requiresVerifiedEmail: false,
  }),
  createSample: vi.fn().mockResolvedValue("events:sample"),
  removeSample: vi.fn().mockResolvedValue(null),
};
const push = vi.fn();
let events: unknown[] = [];

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
});

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));
vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    create: "events:create",
    list: "events:list",
    createSample: "events:createSample",
    removeSample: "events:removeSample",
  },
  invitationsApi: {
    syncProfile: "invitations:syncProfile",
    claim: "invitations:claim",
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => events,
  useMutation: (reference: string) => {
    if (reference === "events:createSample") return mutations.createSample;
    if (reference === "events:removeSample") return mutations.removeSample;
    if (reference === "invitations:syncProfile") return mutations.syncProfile;
    if (reference === "invitations:claim") return mutations.claim;
    return vi.fn();
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { EventSwitcher } from "./event-switcher";

describe("EventSwitcher first run", () => {
  afterEach(() => {
    events = [];
    push.mockReset();
    Object.values(mutations).forEach((mutation) => mutation.mockClear());
    mutations.claim.mockResolvedValue({
      claimedCount: 0,
      requiresVerifiedEmail: false,
    });
  });

  it("starts a populated sample event for a new account", async () => {
    render(<EventSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /explore a sample/i }));
    expect(mutations.createSample).toHaveBeenCalledWith({});
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith("/events/events:sample/today"),
    );
  });

  it("defaults new events to the browser time zone with a searchable input", () => {
    render(<EventSwitcher />);
    const input = screen.getByLabelText("Event time zone") as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);
    expect(input.getAttribute("list")).toBe("event-time-zone-options");
  });

  it("lets an owner remove their sample event from the event list", async () => {
    events = [
      {
        id: "events:sample",
        name: "Pine Ridge Rally — sample event",
        timeZone: "America/Denver",
        role: "owner",
        isSample: true,
      },
    ];
    render(<EventSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /remove sample/i }));
    await vi.waitFor(() =>
      expect(mutations.removeSample).toHaveBeenCalledWith({
        eventId: "events:sample",
      }),
    );
  });

  it("shows one actionable message when the account has no verified email", async () => {
    mutations.claim.mockResolvedValueOnce({
      claimedCount: 0,
      requiresVerifiedEmail: true,
    });
    render(<EventSwitcher />);
    expect(
      await screen.findByText(/add and verify a primary email/i),
    ).toBeDefined();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
