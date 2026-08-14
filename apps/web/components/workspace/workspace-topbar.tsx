"use client";

import { UserButton } from "@clerk/nextjs";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { DisplayModeControl } from "@/components/display-mode-control";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { screenHref, type ScreenDefinition } from "@/lib/screens";
import { useAttention } from "@/lib/use-attention";

export function AttentionBadge({ eventId }: { eventId: string }) {
  const { count, isLoading } = useAttention(eventId);

  return (
    <>
      <span id="attention-description" className="sr-only">
        {isLoading
          ? "Checking items requiring attention."
          : `${count} items requiring attention.`}
      </span>
      <Link
        href={screenHref(eventId, "attention")}
        className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2 ${
          count > 0
            ? "border-warning-ln bg-warning-bg text-warning-tx"
            : "border-line bg-card text-muted"
        }`}
        aria-describedby="attention-description"
      >
        <BellRing className="h-4 w-4 flex-none" aria-hidden="true" />
        <span className="hidden sm:inline">Attention</span>
        <span className="font-bold">{isLoading ? "…" : count}</span>
      </Link>
    </>
  );
}

export function WorkspaceTopbar({ screen }: { screen: ScreenDefinition }) {
  const { event, role } = useEventWorkspace();

  return (
    <header className="sticky top-0 z-20 hidden min-h-16 flex-wrap items-center gap-2 border-b border-line bg-topbg px-6 py-2.5 md:flex">
      <nav aria-label="Breadcrumb" className="mr-auto min-w-0">
        <ol className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <li className="min-w-0">
            <Link
              href="/events"
              className="truncate text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              {event.name}
            </Link>
          </li>
          <li aria-hidden="true" className="text-faint">
            /
          </li>
          <li
            className="truncate font-semibold text-green-ink"
            aria-current="page"
          >
            {screen.shortLabel}
          </li>
        </ol>
      </nav>
      {role === "spectator" ? null : <AttentionBadge eventId={event.id} />}
      <DisplayModeControl />
      <UserButton />
    </header>
  );
}
