import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextResponse } from "next/server";

const createInvitation = makeFunctionReference<
  "mutation",
  { eventId: string; email: string; role: "manager" | "crew" },
  string
>("invitations:create");
const revokeInvitation = makeFunctionReference<
  "mutation",
  { eventId: string; invitationId: string },
  null
>("invitations:revoke");

export async function POST(request: Request) {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (token === null || convexUrl === undefined)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const payload: unknown = await request.json().catch(() => null);
  if (typeof payload !== "object" || payload === null)
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  const { eventId, email, role } = payload as Record<string, unknown>;
  if (
    typeof eventId !== "string" ||
    typeof email !== "string" ||
    (role !== "manager" && role !== "crew")
  )
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  try {
    const invitationId = await convex.mutation(createInvitation, {
      eventId,
      email,
      role,
    });
    try {
      const client = await clerkClient();
      await client.invitations.createInvitation({
        emailAddress: email.trim().toLowerCase(),
        ignoreExisting: true,
        publicMetadata: { racePlannerInvitation: invitationId },
        redirectUrl: "/",
      });
      return NextResponse.json({ invitationId }, { status: 201 });
    } catch {
      await convex.mutation(revokeInvitation, { eventId, invitationId });
      return NextResponse.json(
        { error: "Invitation delivery failed" },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invitation rejected" }, { status: 403 });
  }
}
