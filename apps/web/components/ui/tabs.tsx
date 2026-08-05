import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex gap-1.5 overflow-x-auto pb-1", className)}
    {...props}
  />
));
Tabs.displayName = "Tabs";

const TabTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ className, active, children, ...props }, ref) => (
  <button
    ref={ref}
    role="tab"
    aria-selected={active}
    className={cn(
      "flex-none rounded-lg border px-3 py-2 text-sm font-semibold font-sans cursor-pointer min-h-[44px] text-left leading-tight transition-colors",
      active
        ? "bg-green border-green text-card"
        : "bg-card border-btnline text-ink2 hover:bg-soft",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
TabTrigger.displayName = "TabTrigger";

export { Tabs, TabTrigger };
