"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Keeps read-only offline mode visible wherever an event workspace is open. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 border-b border-warning-ln bg-warning-bg px-4 py-2 text-center text-sm text-warning-tx"
      role="status"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      <span>
        Offline: previously loaded event data may be stale. Changes cannot be
        saved until you reconnect.
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry connection
      </Button>
    </div>
  );
}
