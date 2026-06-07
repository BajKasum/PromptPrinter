"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Light/dark switch. Guards on `mounted` so the icon never mismatches between
// server (no theme yet) and client hydration.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
      title={isDark ? "Helles Design" : "Dunkles Design"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
        ) : (
          <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        )
      ) : (
        <span className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
