"use client";

import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  readDisplayPreference,
  readServerDisplayPreference,
  setDisplayPreference,
  subscribeToDeviceAppearance,
  subscribeToDisplayPreference,
  type DisplayPreference,
} from "@/lib/display-mode";

const options: Array<{
  preference: DisplayPreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { preference: "system", label: "Use device display", Icon: Monitor },
  { preference: "day", label: "Use day display", Icon: Sun },
  { preference: "night", label: "Use night display", Icon: Moon },
  {
    preference: "contrast",
    label: "Use high-contrast display",
    Icon: Contrast,
  },
];

export function DisplayModeControl() {
  const preference = useSyncExternalStore(
    subscribeToDisplayPreference,
    readDisplayPreference,
    readServerDisplayPreference,
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToDeviceAppearance(), []);

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

  const ActiveIcon =
    options.find((option) => option.preference === preference)?.Icon ?? Sun;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        size="sm"
        aria-label="Choose display mode"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ActiveIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Display</span>
      </Button>
      {isOpen ? (
        <div
          role="menu"
          aria-label="Display mode"
          className="absolute right-0 z-30 mt-2 grid w-56 gap-1 rounded-lg border border-line bg-card p-2 shadow-lg"
        >
          {options.map(({ preference: option, label, Icon }) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option}
              onClick={() => {
                setDisplayPreference(option);
                setIsOpen(false);
              }}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
              {label}
              {preference === option ? (
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
