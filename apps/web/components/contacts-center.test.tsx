import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createContacts: vi.fn(),
  overview: { contacts: [] },
  role: "manager" as "manager" | "crew",
}));

vi.mock("convex/react", () => ({
  useQuery: () => state.overview,
  useMutation: () => state.createContacts,
}));
vi.mock("@/components/event-contacts", () => ({
  EventContacts: () => <div>Team roster</div>,
}));
vi.mock("@/components/workspace/event-workspace", () => ({
  useEventWorkspace: () => ({
    event: {
      id: "events:one",
      name: "Test Rally",
      timeZone: "UTC",
      role: state.role,
    },
    role: state.role,
  }),
}));

import { ContactsCenter } from "./contacts-center";

describe("ContactsCenter", () => {
  beforeEach(() => {
    state.createContacts.mockReset();
    state.role = "manager";
    state.overview = { contacts: [] };
  });

  it("lets Crew Chiefs add an event contact in a table row", async () => {
    state.createContacts.mockResolvedValue(["contacts:one"]);
    render(<ContactsCenter />);

    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    fireEvent.change(screen.getByLabelText("Contact title"), {
      target: { value: "Service manager" },
    });
    fireEvent.change(screen.getByLabelText("Contact name"), {
      target: { value: "Sam Rivera" },
    });
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "Rally operations" },
    });
    fireEvent.change(screen.getByLabelText("Contact email"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contact phone"), {
      target: { value: "+1 555 0100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getAllByLabelText("Contact title")[1], {
      target: { value: "Medical lead" },
    });
    fireEvent.change(screen.getAllByLabelText("Contact name")[1], {
      target: { value: "Avery Chen" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add event contacts" }));

    await waitFor(() =>
      expect(state.createContacts).toHaveBeenCalledWith({
        eventId: "events:one",
        contacts: [
          {
            title: "Service manager",
            name: "Sam Rivera",
            organization: "Rally operations",
            email: "sam@example.com",
            phone: "+1 555 0100",
          },
          {
            title: "Medical lead",
            name: "Avery Chen",
            organization: undefined,
            email: undefined,
            phone: undefined,
          },
        ],
      }),
    );
    expect(screen.queryByLabelText("Contact title")).toBeNull();
  });

  it("does not expose contact entry to crew members", () => {
    state.role = "crew";
    render(<ContactsCenter />);

    expect(screen.queryByRole("button", { name: "Add contact" })).toBeNull();
  });
});
