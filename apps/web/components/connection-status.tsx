"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  connectionStateDescription,
  connectionStateLabel,
  type ConnectionState,
} from "@/lib/connectivity";

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    const updateState = () => {
      setState(navigator.onLine ? "online" : "offline");
    };

    updateState();
    window.addEventListener("online", updateState);
    window.addEventListener("offline", updateState);

    return () => {
      window.removeEventListener("online", updateState);
      window.removeEventListener("offline", updateState);
    };
  }, []);

  const isOffline = state === "offline";
  const Icon = isOffline ? WifiOff : Wifi;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        isOffline
          ? "border-warning-ln bg-warning-bg text-warning-tx"
          : "border-line bg-card text-muted"
      }`}
      role="status"
      aria-live="polite"
      title={connectionStateDescription(state)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{connectionStateLabel(state)}</span>
    </div>
  );
}
