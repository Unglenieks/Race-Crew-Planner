import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold font-sans whitespace-nowrap leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-bg text-neutral-tx border-neutral-ln",
        success: "bg-success-bg text-success-tx border-success-ln",
        warning: "bg-warning-bg text-warning-tx border-warning-ln",
        info: "bg-info-bg text-info-tx border-info-ln",
        danger: "bg-danger-bg text-danger-tx border-danger-ln",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
