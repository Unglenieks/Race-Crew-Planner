import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocation } from "./location-resolution";

describe("resolveLocation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the event and location text to the protected resolver", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            address: "1 Rally Way",
            latitude: 42,
            longitude: -71,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(resolveLocation("events:one", "849VCWC8+R9")).resolves.toEqual(
      {
        address: "1 Rally Way",
        latitude: 42,
        longitude: -71,
      },
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/geocode",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ eventId: "events:one", query: "849VCWC8+R9" }),
      }),
    );
  });

  it("returns the server's actionable location error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Location not found." }), {
          status: 422,
        }),
      ),
    );

    await expect(resolveLocation("events:one", "unknown")).rejects.toThrow(
      "Location not found.",
    );
  });
});
