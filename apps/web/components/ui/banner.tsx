import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const bannerVariants = cva(
  "flex gap-3 items-start p-3.5 rounded-lg text-sm leading-relaxed border flex-wrap",
  {
    variants: {
      variant: {
        info: "bg-info-bg text-info-tx border-info-ln",
        warning: "bg-warning-bg text-warning-tx border-warning-ln",
        danger: "bg-danger-bg text-danger-tx border-danger-ln",
        success: "bg-success-bg text-success-tx border-success-ln",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const bannerHeadVariants = cva(
  "text-xs font-bold uppercase tracking-wider block mb-1",
  {
    variants: {
      variant: {
        info: "text-info-tx",
        warning: "text-warning-tx",
        danger: "text-danger-tx",
        success: "text-success-tx",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export interface BannerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bannerVariants> {
  label?: string;
}

function Banner({
  className,
  variant,
  label,
  children,
  ...props
}: BannerProps) {
  return (
    <div className={cn(bannerVariants({ variant }), className)} {...props}>
      <div className="flex-1 min-w-0">
        {label && (
          <span className={bannerHeadVariants({ variant })}>{label}</span>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}

export { Banner };
