"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex =
  convexUrl === undefined ? null : new ConvexReactClient(convexUrl);

/** Supplies Clerk's `convex` JWT template to authenticated Convex calls. */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AnalyticsProvider>
      <ServiceWorkerRegistration />
      {convex === null ? (
        children
      ) : (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      )}
    </AnalyticsProvider>
  );
}
