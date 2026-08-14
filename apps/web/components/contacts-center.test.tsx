import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createContacts: vi.fn(),
  overview: { contacts: [] as unknown[] },
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

  it("lets Crew Chiefs add event contacts from the responsive card form", async () => {
    state.createContacts.mockResolvedValue(["contacts:one"]);
    render(<ContactsCenter />);

    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    fireEvent.change(screen.getAllByLabelText("Contact title")[0], {
      target: { value: "Service manager" },
    });
    fireEvent.change(screen.getAllByLabelText("Contact name")[0], {
      target: { value: "Sam Rivera" },
    });
    fireEvent.change(screen.getAllByLabelText("Organization")[0], {
      target: { value: "Rally operations" },
    });
    fireEvent.change(screen.getAllByLabelText("Contact email")[0], {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getAllByLabelText("Contact phone")[0], {
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

  it("keeps card actions accessible for a managed contact", () => {
    state.overview = {
      contacts: [
        {
          _id: "contacts:one",
          title: "Service manager",
          name: "Sam Rivera",
          organization: "Rally operations",
          email: "sam@example.com",
          phone: "+1 555 0100",
        },
      ],
    };
    render(<ContactsCenter />);

    expect(screen.getAllByRole("button", { name: "Edit" })).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Remove" })).not.toHaveLength(
      0,
    );
    expect(
      screen
        .getAllByRole("link", { name: /sam@example.com/i })[0]
        .getAttribute("href"),
    ).toBe("mailto:sam@example.com");
  });
});
