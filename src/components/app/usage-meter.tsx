"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * One metric's real relationship to its cap, not just a number, the bar is
 * the point. Shared between Settings' quick-glance card and Billing's full
 * usage section so the same metric never looks like two different widgets.
 */
export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone =
    !unlimited && pct >= 100
      ? "from-red-500 to-red-400"
      : !unlimited && pct >= 80
        ? "from-amber-500 to-amber-400"
        : "from-accent to-accent-text";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-foreground/80">{label}</span>
        <span className="text-[13px] tabular-nums text-secondary">
          {unlimited ? (
            <>
              {used} <span className="text-tertiary">· Unbegrenzt</span>
            </>
          ) : (
            <>
              <span className="text-foreground/85">{used}</span>
              <span className="text-tertiary"> / {limit}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full rounded-full bg-gradient-to-r", tone)}
        />
      </div>
    </div>
  );
}
