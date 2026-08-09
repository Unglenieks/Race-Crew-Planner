"use client";

import Link from "next/link";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

export function EventInfoSwitcher({
  current,
}: {
  current: "overview" | "files";
}) {
  const { event } = useEventWorkspace();
  const linkClass =
    "flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2";
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-line pb-3"
      aria-label="Event information sections"
    >
      <Link
        href={`/events/${event.id}/event-info`}
        aria-current={current === "overview" ? "page" : undefined}
        className={`${linkClass} ${current === "overview" ? "bg-green text-card" : "border border-btnline bg-card text-ink2 hover:bg-soft"}`}
      >
        Overview
      </Link>
      <Link
        href={`/events/${event.id}/files`}
        aria-current={current === "files" ? "page" : undefined}
        className={`${linkClass} ${current === "files" ? "bg-green text-card" : "border border-btnline bg-card text-ink2 hover:bg-soft"}`}
      >
        Files &amp; sources
      </Link>
    </nav>
  );
}
