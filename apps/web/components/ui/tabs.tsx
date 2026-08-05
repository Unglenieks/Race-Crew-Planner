"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  baseId: string;
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("Tab components must be used within Tabs.");
  }

  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      children,
      className,
      defaultValue,
      value: valueProp,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledValue, setUncontrolledValue] =
      React.useState(defaultValue);
    const baseId = React.useId();
    const value = valueProp ?? uncontrolledValue;

    const setValue = React.useCallback(
      (nextValue: string) => {
        if (valueProp === undefined) {
          setUncontrolledValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
      [onValueChange, valueProp],
    );

    return (
      <TabsContext.Provider value={{ baseId, value, setValue }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onKeyDown, ...props }, ref) => {
  const { setValue, value } = useTabsContext();

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!keys.includes(event.key)) {
      onKeyDown?.(event);
      return;
    }

    const triggers = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[role=tab]:not(:disabled)",
      ),
    );
    const currentIndex = triggers.indexOf(event.target as HTMLButtonElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = triggers.length - 1;
    }

    event.preventDefault();
    const nextTrigger = triggers[nextIndex];
    nextTrigger.focus();
    setValue(nextTrigger.dataset.value ?? value);
    onKeyDown?.(event);
  }

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn("flex gap-1.5 overflow-x-auto pb-1", className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

const TabTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, children, value, onClick, ...props }, ref) => {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${context.baseId}-tab-${value}`}
      data-value={value}
      aria-controls={`${context.baseId}-panel-${value}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={cn(
        "flex-none rounded-lg border px-3 py-2 text-sm font-semibold font-sans cursor-pointer min-h-11 text-left leading-tight transition-colors focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2",
        active
          ? "bg-green border-green text-card"
          : "bg-card border-btnline text-ink2 hover:bg-soft",
        className,
      )}
      onClick={(event) => {
        context.setValue(value);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
TabTrigger.displayName = "TabTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, ...props }, ref) => {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      tabIndex={0}
      hidden={!active}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabTrigger, TabsContent };
