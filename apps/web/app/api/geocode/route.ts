import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextResponse } from "next/server";

const authorizeMapLocationSave = makeFunctionReference<
  "query",
  { eventId: string },
  null
>("records:authorizeMapLocationSave");

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

function locationQuery(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  const { eventId, query } = payload as Record<string, unknown>;
  if (typeof eventId !== "string" || typeof query !== "string") return null;
  const normalized = query.trim();
  if (normalized.length === 0 || normalized.length > 300) return null;
  return { eventId, query: normalized };
}

export async function POST(request: Request) {
  const payload = locationQuery(await request.json().catch(() => null));
  if (payload === null)
    return NextResponse.json(
      { error: "Enter an address or Plus Code of up to 300 characters." },
      { status: 400 },
    );

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (token === null || convexUrl === undefined)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  try {
    await convex.query(authorizeMapLocationSave, { eventId: payload.eventId });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Location lookup is not configured." },
      { status: 503 },
    );

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", payload.query);
  url.searchParams.set("key", key);
  let geocoded: GoogleGeocodeResponse;
  try {
    const response = await fetch(url, { cache: "no-store" });
    geocoded = (await response.json()) as GoogleGeocodeResponse;
    if (!response.ok)
      return NextResponse.json(
        { error: "Location lookup is temporarily unavailable." },
        { status: 502 },
      );
  } catch {
    return NextResponse.json(
      { error: "Location lookup is temporarily unavailable." },
      { status: 502 },
    );
  }

  const result = geocoded.results?.[0];
  const latitude = result?.geometry?.location?.lat;
  const longitude = result?.geometry?.location?.lng;
  if (
    geocoded.status !== "OK" ||
    result?.formatted_address === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  )
    return NextResponse.json(
      {
        error:
          "Location not found. Try a fuller address or a Plus Code with its city or region.",
      },
      { status: 422 },
    );

  return NextResponse.json({
    address: result.formatted_address,
    latitude,
    longitude,
  });
}
