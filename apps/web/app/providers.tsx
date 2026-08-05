"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex =
  convexUrl === undefined ? null : new ConvexReactClient(convexUrl);

/** Supplies Clerk's `convex` JWT template to authenticated Convex calls. */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  if (convex === null) {
    return children;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
