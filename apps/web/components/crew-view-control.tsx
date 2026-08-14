"use client";

import { Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

/** Lets operational users inspect the same client-side experience seen by each audience. */
export function CrewViewControl() {
  const { actualRole, viewAs, setViewAs } = useEventWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canViewAsCrew = actualRole === "owner" || actualRole === "manager";
  const canViewAsSpectator = actualRole !== "spectator";
  const options = [
    {
      value: null,
      label: canViewAsCrew ? "Crew Chief" : "Crew",
    },
    ...(canViewAsCrew ? [{ value: "crew" as const, label: "Crew" }] : []),
    { value: "spectator" as const, label: "Spectator" },
  ];

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!canViewAsSpectator) return null;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        size="sm"
        aria-label="Choose workspace view"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">View</span>
      </Button>
      {isOpen ? (
        <div
          role="menu"
          aria-label="Workspace view"
          className="absolute right-0 z-30 mt-2 grid w-44 gap-1 rounded-lg border border-line bg-card p-2 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value ?? "default"}
              type="button"
              role="menuitemradio"
              aria-checked={viewAs === option.value}
              onClick={() => {
                setViewAs(option.value);
                setIsOpen(false);
              }}
              className="flex min-h-11 items-center rounded-md px-3 text-left text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              {option.label}
              {viewAs === option.value ? (
                <span className="ml-auto text-xs font-normal text-muted">
                  Active
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
