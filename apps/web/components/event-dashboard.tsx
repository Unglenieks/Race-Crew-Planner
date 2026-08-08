"use client";

import Link from "next/link";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { screenHref, visibleScreens } from "@/lib/screens";

export function EventDashboard() {
  const { event, role } = useEventWorkspace();
  const destinations = visibleScreens(role).filter(
    (screen) => screen.id !== "today",
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {destinations.map((screen) => {
        const Icon = screen.icon;
        return (
          <Link
            key={screen.id}
            href={screenHref(event.id, screen.id)}
            className="group rounded-xl border border-line bg-card p-5 shadow-sm transition-colors hover:border-green hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <Icon className="h-6 w-6 text-green-ink" aria-hidden="true" />
            <h2 className="mt-6 text-lg font-semibold text-ink group-hover:text-green-ink">
              {screen.label}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {screen.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
