"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { readAnalyticsConfig } from "@/lib/analytics";
import {
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

const analyticsConfig = readAnalyticsConfig({
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_RELEASE_SHA: process.env.NEXT_PUBLIC_RELEASE_SHA,
});

let hasInitializedAnalytics = false;

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("race-planner:analytics-consent", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("race-planner:analytics-consent", onStoreChange);
  };
}

/**
 * Initializes PostHog only after the visitor explicitly permits analytics.
 * Event names and properties must be added to docs/analytics-events.md first.
 */
export function AnalyticsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { isLoaded, user } = useUser();
  const consent = useSyncExternalStore(
    subscribeToConsent,
    () => readAnalyticsConsent(window.localStorage),
    () => "pending",
  );
  const capturedAppView = useRef(false);

  useEffect(() => {
    if (analyticsConfig === undefined || consent !== "granted" || !isLoaded) {
      return;
    }

    if (!hasInitializedAnalytics) {
      posthog.init(analyticsConfig.apiKey, {
        api_host: analyticsConfig.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        person_profiles: "never",
      });
      hasInitializedAnalytics = true;
    }

    posthog.opt_in_capturing();
    posthog.register({
      app_environment: analyticsConfig.environment,
      release_sha: analyticsConfig.release,
    });

    if (user !== null) {
      posthog.identify(user.id);
    }

    if (!capturedAppView.current) {
      posthog.capture("app_viewed");
      capturedAppView.current = true;
    }
  }, [consent, isLoaded, user]);

  function updateConsent(nextConsent: Exclude<AnalyticsConsent, "pending">) {
    writeAnalyticsConsent(nextConsent, window.localStorage);
    window.dispatchEvent(new Event("race-planner:analytics-consent"));

    if (nextConsent === "denied" && hasInitializedAnalytics) {
      posthog.opt_out_capturing();
    }
  }

  return (
    <>
      {children}
      {analyticsConfig !== undefined && consent === "pending" ? (
        <aside
          aria-label="Analytics consent"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-line bg-card p-4 shadow-lg"
        >
          <p className="text-sm font-semibold text-ink">Usage analytics</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Help improve Race Planner with the documented usage events. We never
            send credentials, race data, crew details, notes, or other protected
            content.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => updateConsent("granted")}>
              Allow analytics
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateConsent("denied")}
            >
              Decline
            </Button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
