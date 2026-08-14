"use client";

import { useEffect } from "react";

/** Registers the small app-shell cache only after the authenticated app hydrates. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/service-worker.js")
      .catch(() => undefined);
  }, []);
  return null;
}
