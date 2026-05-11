import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 text-sm text-white placeholder:text-white/40 transition-colors duration-200",
        "focus:outline-none focus:border-violet-500/55 focus:ring-2 focus:ring-violet-500/20",
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
      "min-h-[120px] w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3 text-sm text-white placeholder:text-white/40 transition-colors duration-200 resize-y",
      "focus:outline-none focus:border-violet-500/55 focus:ring-2 focus:ring-violet-500/20",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
