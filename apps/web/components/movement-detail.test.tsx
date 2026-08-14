import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const update = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/events-api", () => ({
  itineraryApi: {
    get: "itinerary:get",
    update: "itinerary:update",
    archive: "itinerary:archive",
  },
  movementsApi: {
    listDirectory: "movements:listDirectory",
    ensureDefaults: "movements:ensureDefaults",
  },
  recordsApi: { list: "records:list", listTypes: "records:listTypes" },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: string) => {
    if (reference === "itinerary:get")
      return {
        _id: "items:one",
        title: "Service",
        scheduledFor: "2026-08-14T09:00",
        timeKind: "exact",
        location: "Long venue",
        recordId: "records:one",
        spectatorVisible: false,
      };
    if (reference === "records:list")
      return [
        {
          _id: "records:one",
          name: "A very long venue name that must truncate in the available field width",
          type: "venue",
          address: "123 An exceptionally long address for the selected venue",
        },
      ];
    if (reference === "records:listTypes") return [];
    return { types: [] };
  },
  useMutation: (reference: string) =>
    reference === "itinerary:update" ? update : vi.fn().mockResolvedValue(null),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("edit=1"),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { MovementDetail } from "./movement-detail";

describe("MovementDetail venue link", () => {
  it("keeps Clear available for a long selected venue and clears the saved link", async () => {
    render(
      <MovementDetail
        eventId="events:one"
        itemId="items:one"
        role="manager"
        timeZone="UTC"
      />,
    );

    expect(
      screen.getAllByText(/A very long venue name/).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Save movement" }).closest("form")!,
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ recordId: undefined }),
      ),
    );
  });
});
