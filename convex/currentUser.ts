import { query } from "./_generated/server";
import { requireIdentity } from "./auth";

type IdentityContext = Parameters<typeof requireIdentity>[0];

/**
 * The minimal protected query used to verify the Clerk-to-Convex identity path.
 * Feature functions must perform their own resource and role checks after this.
 */
export async function getCurrentUser(identityContext: IdentityContext) {
  const identity = await requireIdentity(identityContext);

  return {
    subject: identity.subject,
    tokenIdentifier: identity.tokenIdentifier,
  };
}

export const get = query({
  args: {},
  handler: getCurrentUser,
});
