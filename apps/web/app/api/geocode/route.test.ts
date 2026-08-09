import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  setAuth: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ getToken: mocks.getToken }),
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = mocks.setAuth;
    query = mocks.query;
  },
}));

import { POST } from "./route";

describe("POST /api/geocode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getToken.mockResolvedValue("convex-token");
    mocks.query.mockResolvedValue(null);
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY = "test-key";
  });

  it("authorizes the manager and returns a normalized Plus Code result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "OK",
            results: [
              {
                formatted_address: "1600 Amphitheatre Pkwy, Mountain View, CA",
                geometry: { location: { lat: 37.422, lng: -122.084 } },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await POST(
      new Request("https://race-planner.test/api/geocode", {
        method: "POST",
        body: JSON.stringify({
          eventId: "events:one",
          query: "849VCWC8+R9 Mountain View",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {
      eventId: "events:one",
    });
    expect(mocks.setAuth).toHaveBeenCalledWith("convex-token");
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("address=849VCWC8%2BR9+Mountain+View"),
      }),
      { cache: "no-store" },
    );
    await expect(response.json()).resolves.toEqual({
      address: "1600 Amphitheatre Pkwy, Mountain View, CA",
      latitude: 37.422,
      longitude: -122.084,
    });
  });

  it("does not save a missing or unresolved location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
          status: 200,
        }),
      ),
    );

    const response = await POST(
      new Request("https://race-planner.test/api/geocode", {
        method: "POST",
        body: JSON.stringify({ eventId: "events:one", query: "not a place" }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining("not found") }),
    );
  });
});
