"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Password field with a built-in show/hide toggle. Drop-in replacement for
// <Input type="password" /> — it owns the type, so callers must not pass one.
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        // Leave room for the toggle so long values never slide under it.
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={visible}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
