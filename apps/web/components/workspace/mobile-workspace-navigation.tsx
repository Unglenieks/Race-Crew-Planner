"use client";

import { ChevronsUpDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConnectionStatus } from "@/components/connection-status";
import { CrewViewControl } from "@/components/crew-view-control";
import { DisplayModeControl } from "@/components/display-mode-control";
import { UserButton } from "@clerk/nextjs";
import { WorkspaceNavigationLinks } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { AttentionBadge } from "@/components/workspace/workspace-topbar";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Small screens keep the event switcher and workspace navigation reachable
 * without consuming the page width with the desktop sidebar.
 */
export function MobileWorkspaceNavigation() {
  const { event, events, role } = useEventWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="sticky top-0 z-30 h-14 border-b border-line bg-side lg:hidden">
      <div className="flex h-full items-center justify-between gap-3 px-4">
        <Link
          href="/events"
          className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
          aria-label={`${event.name}, ${event.timeZone}, ${role}, ${events.length} ${events.length === 1 ? "event" : "events"}. Switch event.`}
        >
          <span className="inline-grid h-7 w-7 flex-none place-items-center rounded-lg bg-green text-sm font-bold text-lime">
            ⌁
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {event.name}
            </span>
            <span className="block truncate text-xs text-muted">
              {event.timeZone} · {role}
              {events.length > 1 ? ` · ${events.length} events` : ""}
            </span>
          </span>
          <ChevronsUpDown
            className="h-4 w-4 flex-none text-muted"
            aria-hidden="true"
          />
        </Link>
        <div className="flex items-center gap-2">
          {role === "spectator" ? null : <AttentionBadge eventId={event.id} />}
          <Button
            ref={menuButtonRef}
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={isOpen}
            aria-controls="workspace-mobile-navigation"
            aria-label={
              isOpen
                ? "Menu: close workspace navigation"
                : "Menu: open workspace navigation"
            }
            onClick={() => setIsOpen((open) => !open)}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            Menu
          </Button>
        </div>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/45"
            aria-label="Close workspace navigation"
            onClick={() => closeMenu(true)}
          />
          <aside
            id="workspace-mobile-navigation"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-mobile-navigation-title"
            className="relative flex h-full w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-auto border-r border-line bg-side shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line p-4">
              <p
                id="workspace-mobile-navigation-title"
                className="font-semibold text-ink"
              >
                Workspace navigation
              </p>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => closeMenu(true)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Close
              </Button>
            </div>
            <div className="p-4 pb-2">
              <Link
                href="/events"
                className="flex min-h-11 items-center gap-2 rounded-lg border border-btnline bg-card px-3 py-2.5 text-left text-sm hover:border-ink2 focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                onClick={() => closeMenu()}
                aria-label={`${event.name}, ${event.timeZone}, ${role}, ${events.length} ${events.length === 1 ? "event" : "events"}. Switch event.`}
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-semibold text-ink">
                    {event.name}
                  </b>
                  <small className="mt-0.5 block text-xs text-muted">
                    {event.timeZone} · {role}
                  </small>
                </span>
                <ChevronsUpDown
                  className="h-4 w-4 flex-none text-muted"
                  aria-hidden="true"
                />
              </Link>
            </div>
            <WorkspaceNavigationLinks onNavigate={() => closeMenu()} />
            <div className="grid gap-3 border-t border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Display and account
              </p>
              <CrewViewControl />
              <DisplayModeControl />
              <div className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-card px-3">
                <UserButton />
                <span className="text-sm font-medium text-ink">Account</span>
              </div>
            </div>
            <div className="mt-auto grid gap-2 border-t border-line p-4 pt-3">
              <ConnectionStatus />
              <p className="font-mono text-[11px] leading-relaxed text-muted">
                Race Planner v0.1.0
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
