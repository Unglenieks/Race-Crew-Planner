export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

type ResolutionFailure = { error?: string };

/** Resolves an address or Plus Code without exposing the provider API key. */
export async function resolveLocation(
  eventId: string,
  query: string,
): Promise<ResolvedLocation> {
  const response = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, query }),
  });
  const payload = (await response.json().catch(() => null)) as
    ResolvedLocation | ResolutionFailure | null;
  if (!response.ok)
    throw new Error(
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Location lookup failed. Try again.",
    );
  if (
    payload === null ||
    !("address" in payload) ||
    !("latitude" in payload) ||
    !("longitude" in payload) ||
    typeof payload.address !== "string" ||
    !Number.isFinite(payload.latitude) ||
    !Number.isFinite(payload.longitude)
  )
    throw new Error("Location lookup returned an invalid result. Try again.");
  return payload;
}
