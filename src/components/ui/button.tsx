"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary action is monochrome (black on light, white on dark).
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
        // Baby blue fill — use when an action should carry the brand accent.
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98]",
        ghost:
          "border border-border bg-transparent text-foreground/90 hover:bg-surface-hover hover:border-border-strong",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:bg-surface",
        subtle: "bg-surface text-foreground/90 hover:bg-surface-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
