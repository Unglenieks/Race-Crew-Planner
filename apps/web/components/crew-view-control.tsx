"use client";

import { Eye } from "lucide-react";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

/** Lets operational users inspect the same client-side experience seen by each audience. */
export function CrewViewControl() {
  const { actualRole, viewAs, setViewAs } = useEventWorkspace();
  const canViewAsCrew = actualRole === "owner" || actualRole === "manager";
  const canViewAsSpectator = actualRole !== "spectator";

  if (!canViewAsSpectator) return null;

  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-btnline bg-card px-3 text-xs font-semibold text-ink2">
      <Eye className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">View as</span>
      <select
        aria-label="View as"
        value={viewAs ?? "default"}
        onChange={(event) => {
          const value = event.target.value;
          setViewAs(
            value === "default" ? null : (value as "crew" | "spectator"),
          );
        }}
        className="min-w-0 bg-transparent text-xs font-semibold outline-none"
      >
        <option value="default">{canViewAsCrew ? "Crew Chief" : "Crew"}</option>
        {canViewAsCrew ? <option value="crew">Crew</option> : null}
        <option value="spectator">Spectator</option>
      </select>
    </label>
  );
}
