import type { UserIdentity } from "convex/server";

type IdentityContext = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

/** Application roles are assigned by Convex-backed membership records. */
export const applicationRoles = ["owner", "manager", "crew"] as const;

export type ApplicationRole = (typeof applicationRoles)[number];

/**
 * Require a verified identity before reading or changing protected data.
 *
 * Clerk provides identity and session lifecycle. Role and resource checks must
 * be performed by the calling Convex function using application data.
 */
export async function requireIdentity(
  ctx: IdentityContext,
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new Error("Unauthenticated");
  }

  return identity;
}

/**
 * Require a role resolved from an application membership record.
 *
 * Callers must not pass a role supplied by a client request. Resolve it from
 * Convex data after `requireIdentity` has established the caller identity.
 */
export function requireRole(
  actualRole: ApplicationRole | undefined,
  allowedRoles: readonly ApplicationRole[],
): ApplicationRole {
  if (actualRole === undefined || !allowedRoles.includes(actualRole)) {
    throw new Error("Forbidden");
  }

  return actualRole;
}
