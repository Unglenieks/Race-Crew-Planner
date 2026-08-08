"use client";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectionStatus } from "@/components/connection-status";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import {
  findScreenByPath,
  getScreen,
  roleSatisfies,
  screenGroups,
  screenHref,
  type ScreenDefinition,
} from "@/lib/screens";

function NavLink({
  screen,
  eventId,
  isActive,
  onNavigate,
}: {
  screen: ScreenDefinition;
  eventId: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = screen.icon;

  return (
    <Link
      href={screenHref(eventId, screen.id)}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2 ${
        isActive
          ? "bg-soft text-green-ink"
          : "text-ink2 hover:bg-soft hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
      <span className="truncate">{screen.shortLabel}</span>
    </Link>
  );
}

/**
 * Shared navigation so the desktop sidebar and mobile drawer cannot drift in
 * their visible screens, role checks, or active-route treatment.
 */
export function WorkspaceNavigationLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { event, role } = useEventWorkspace();
  const pathname = usePathname();
  const activeScreenId = findScreenByPath(event.id, pathname)?.id;

  return (
    <nav className="flex-1 px-3" aria-label="Workspace screens">
      {screenGroups.map((group) => {
        const groupScreens = group.screenIds
          .map((id) => getScreen(id))
          .filter((screen) => roleSatisfies(role, screen.minRole));

        if (groupScreens.length === 0) return null;

        return (
          <div key={group.label ?? "primary"} className="mb-2">
            {group.label === null ? null : (
              <span className="mx-2 mb-1.5 mt-2 block font-mono text-[11px] uppercase tracking-wider text-faint">
                {group.label}
              </span>
            )}
            <div className="grid gap-0.5">
              {groupScreens.map((screen) => (
                <NavLink
                  key={screen.id}
                  screen={screen}
                  eventId={event.id}
                  isActive={screen.id === activeScreenId}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { event, events, role } = useEventWorkspace();

  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] flex-none flex-col overflow-auto border-r border-line bg-side md:flex">
      <div className="p-4 pb-2">
        <Link
          href="/events"
          className="mx-2 mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          <span className="inline-grid h-[27px] w-[27px] place-items-center rounded-lg bg-green text-sm font-bold text-lime">
            ⌁
          </span>
          race planner
        </Link>

        <Link
          href="/events"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-btnline bg-card px-3 py-2.5 text-left text-sm hover:border-ink2 focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
          aria-label={`Current event: ${event.name}. Switch event.`}
        >
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold text-ink">
              {event.name}
            </b>
            <small className="mt-0.5 block text-xs text-muted">
              {event.timeZone} · {role}
              {events.length > 1 ? ` · ${events.length} events` : ""}
            </small>
          </span>
          <ChevronsUpDown
            className="h-4 w-4 flex-none text-muted"
            aria-hidden="true"
          />
        </Link>
      </div>

      <WorkspaceNavigationLinks />

      <div className="mt-auto grid gap-2 border-t border-line p-4 pt-3">
        <ConnectionStatus />
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Race Planner v0.1.0
        </p>
      </div>
    </aside>
  );
}
