"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-[linear-gradient(135deg,#7C3AED_0%,#3B82F6_100%)] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_24px_-8px_rgba(124,58,237,0.45)] hover:brightness-110 hover:-translate-y-px",
        ghost:
          "border border-white/10 bg-white/[0.02] text-white/90 hover:bg-white/[0.06] hover:border-white/20",
        outline:
          "border border-white/15 bg-transparent text-white hover:bg-white/[0.04]",
        subtle:
          "bg-white/[0.04] text-white/85 hover:bg-white/[0.07]",
        destructive:
          "bg-red-500/90 text-white hover:bg-red-500",
        link: "text-white/80 underline-offset-4 hover:text-white hover:underline",
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
