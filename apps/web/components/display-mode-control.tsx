"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DisplayMode = "system" | "day" | "night" | "contrast";

const modes: Array<{ mode: DisplayMode; label: string; Icon: typeof Sun }> = [
  { mode: "system", label: "Use device display", Icon: Sun },
  { mode: "day", label: "Use day display", Icon: Sun },
  { mode: "night", label: "Use night display", Icon: Moon },
  { mode: "contrast", label: "Use high-contrast display", Icon: Contrast },
];

function applyMode(mode: DisplayMode) {
  document.documentElement.dataset.displayMode = mode;
}

export function DisplayModeControl() {
  const [mode, setMode] = useState<DisplayMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem("race-planner-display-mode");
    return saved === "day" || saved === "night" || saved === "contrast"
      ? saved
      : "system";
  });

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  function selectMode(nextMode: DisplayMode) {
    setMode(nextMode);
    applyMode(nextMode);
    if (nextMode === "system") {
      window.localStorage.removeItem("race-planner-display-mode");
    } else {
      window.localStorage.setItem("race-planner-display-mode", nextMode);
    }
  }

  return (
    <div className="relative group">
      <Button
        type="button"
        size="sm"
        aria-label="Choose display mode"
        aria-haspopup="true"
        className="peer"
      >
        {mode === "night" ? (
          <Moon className="h-4 w-4" />
        ) : mode === "contrast" ? (
          <Contrast className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        Display
      </Button>
      <div className="invisible absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-lg border border-line bg-card p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {modes.map(({ mode: option, label, Icon }) => (
          <button
            key={option}
            type="button"
            onClick={() => selectMode(option)}
            aria-pressed={mode === option}
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
