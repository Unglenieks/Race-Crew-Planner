import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveLocation: vi.fn(),
  saveMapLocation: vi.fn(),
}));

vi.mock("@/components/workspace/event-workspace", () => ({
  useEventWorkspace: () => ({
    event: { id: "events:one" },
    role: "owner",
  }),
}));
vi.mock("@/components/openstreetmap-map", () => ({
  OpenStreetMapMap: () => <div aria-label="OpenStreetMap venue map" />,
}));
vi.mock("@/lib/location-resolution", () => ({
  resolveLocation: mocks.resolveLocation,
}));
vi.mock("@/lib/events-api", () => ({
  recordsApi: {
    listMapLocations: "records:listMapLocations",
    saveMapLocation: "records:saveMapLocation",
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => mocks.saveMapLocation,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MapExplorer } from "./map-explorer";
import { SpectatorVenues } from "./spectator-venues";

describe("location authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLocation.mockResolvedValue({
      address: "1 Rally Way, Exampletown",
      latitude: 42,
      longitude: -71,
    });
    mocks.saveMapLocation.mockResolvedValue("eventRecords:one");
  });

  it("resolves an address and saves a main-map note without coordinate controls", async () => {
    render(<MapExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Service park" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Address or Plus Code/ }),
      {
        target: { value: "849VCWC8+R9 Mountain View" },
      },
    );
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Enter via the west gate." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Opening hours/ }), {
      target: {
        value: "Thu: 08:00-18:00\nFri: 08:00-12:00; 13:00-18:00",
      },
    });
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByLabelText("Longitude")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    await waitFor(() =>
      expect(mocks.saveMapLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "1 Rally Way, Exampletown",
          notes: "Enter via the west gate.",
          hours: "Thu: 08:00-18:00\nFri: 08:00-12:00; 13:00-18:00",
          latitude: 42,
          longitude: -71,
        }),
      ),
    );
    expect(mocks.resolveLocation).toHaveBeenCalledWith(
      "events:one",
      "849VCWC8+R9 Mountain View",
    );
  });

  it("uses the same responsive, coordinate-free flow for spectator venues", async () => {
    render(<SpectatorVenues />);
    fireEvent.click(screen.getByRole("button", { name: "Add venue" }));
    fireEvent.change(screen.getByLabelText("Venue name"), {
      target: { value: "Spectator stage" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Address or Plus Code/ }),
      {
        target: { value: "849VCWC8+R9 Mountain View" },
      },
    );
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Bring hearing protection." },
    });
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByLabelText("Longitude")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    await waitFor(() =>
      expect(mocks.saveMapLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "venue",
          notes: "Bring hearing protection.",
          latitude: 42,
          longitude: -71,
          spectatorVisible: true,
        }),
      ),
    );
  });
});
