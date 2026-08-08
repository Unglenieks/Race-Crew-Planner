import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextResponse } from "next/server";
import { verifiedPrimaryEmail } from "@/lib/verified-email";

const claimVerifiedEmail = makeFunctionReference<
  "mutation",
  { userId: string; email: string },
  { claimedCount: number; requiresVerifiedEmail: boolean }
>("invitations:claimVerifiedEmail");

export async function POST() {
  const { userId } = await auth();
  if (userId === null)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await (await clerkClient()).users.getUser(userId);
  const email = verifiedPrimaryEmail(user);
  if (email === undefined)
    return NextResponse.json({
      claimedCount: 0,
      requiresVerifiedEmail: true,
    });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (!convexUrl || !adminKey)
    return NextResponse.json(
      { error: "Invitation claiming is not configured" },
      { status: 503 },
    );

  const convex = new ConvexHttpClient(convexUrl);
  (
    convex as ConvexHttpClient & { setAdminAuth: (token: string) => void }
  ).setAdminAuth(adminKey);
  const result = await convex.mutation(claimVerifiedEmail, { userId, email });
  return NextResponse.json(result);
}
