import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200",
        "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[120px] w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 resize-y",
      "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
