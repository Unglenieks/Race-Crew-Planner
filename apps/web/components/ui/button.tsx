import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold font-sans transition-colors focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap min-h-[36px] px-3.5 py-2.5 text-sm leading-none cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper border border-ink hover:opacity-90",
        secondary: "bg-card text-ink2 border border-btnline hover:bg-soft",
        ghost:
          "bg-transparent text-ink2 border border-transparent hover:bg-soft",
        danger:
          "bg-danger-bg text-danger-tx border border-danger-ln hover:opacity-90",
        soft: "bg-soft text-green-ink border border-success-ln hover:opacity-90",
      },
      size: {
        sm: "text-xs min-h-[32px] px-2.5 py-1.5",
        md: "text-sm min-h-[36px] px-3.5 py-2.5",
        lg: "text-base min-h-[44px] px-5 py-3",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
