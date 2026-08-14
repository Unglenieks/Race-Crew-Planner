"use client";

import type { ReactNode } from "react";
import { getScreen, type ScreenId } from "@/lib/screens";

/**
 * Consistent heading and spacing for every workspace screen. The title and
 * description come from the screen registry so navigation, breadcrumb, and
 * page heading can never disagree.
 */
export function WorkspaceScreen({
  id,
  actions,
  children,
}: {
  id: ScreenId;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const screen = getScreen(id);

  return (
    <section aria-labelledby={`screen-${id}-heading`} className="min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id={`screen-${id}-heading`}
            className="font-serif text-[clamp(24px,3vw,32px)] font-semibold leading-tight tracking-tight text-ink"
          >
            {screen.label}
          </h1>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">
            {screen.description}
          </p>
        </div>
        {actions === undefined ? null : (
          <div className="min-w-0">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}
