import type { UserIdentity } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const pendingProfileLabel = "Profile pending";

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/** Canonical mapping from verified Clerk claims into application profile data. */
export function profileFromIdentity(identity: UserIdentity) {
  const email = identity.emailVerified
    ? clean(identity.email)?.toLowerCase()
    : undefined;
  return {
    userId: identity.subject,
    displayName: clean(identity.name),
    email,
    phoneNumber: identity.phoneNumberVerified
      ? clean(identity.phoneNumber)
      : undefined,
    avatarUrl: clean(identity.pictureUrl),
  };
}

export async function syncIdentityProfile(
  ctx: MutationCtx,
  identity: UserIdentity,
) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .unique();
  const asserted = profileFromIdentity(identity);
  const values = {
    ...asserted,
    // Optional token claims must not erase previously verified profile data.
    displayName: asserted.displayName ?? existing?.displayName,
    email: asserted.email ?? existing?.email,
    // An explicit false comes from Clerk after a phone is removed or becomes
    // unverified. An omitted claim remains backward compatible with older JWTs.
    phoneNumber:
      identity.phoneNumberVerified === false
        ? undefined
        : (asserted.phoneNumber ?? existing?.phoneNumber),
    avatarUrl: asserted.avatarUrl ?? existing?.avatarUrl,
    updatedAt: Date.now(),
  };
  if (existing === null) await ctx.db.insert("userProfiles", values);
  else await ctx.db.patch(existing._id, values);
  return values;
}

export async function resolveUserProfile(
  ctx: QueryCtx | MutationCtx,
  userId: string,
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return {
    name: profile?.displayName ?? profile?.email ?? pendingProfileLabel,
    email: profile?.email,
    phoneNumber: profile?.phoneNumber,
    avatarUrl: profile?.avatarUrl,
  };
}
