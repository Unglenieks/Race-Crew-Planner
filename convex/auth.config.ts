import type { AuthConfig } from "convex/server";

/** Validates tokens issued by the Clerk JWT template named `convex`. */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
