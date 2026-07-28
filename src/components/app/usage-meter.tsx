"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Deliberately hand-rolled rather than Intl.NumberFormat's own
// `notation: "compact"`: that depends on the runtime's bundled ICU
// compact-decimal data, and it isn't consistent — on this project's own
// toolchain, de-CH compacts millions ("1,2 Mio.") but not thousands
// (12345 stays "12'345"), a gap discovered while testing this exact function
// in Node's Vitest environment vs. a browser's full ICU. A fixed number
// format shouldn't depend on which ICU data happens to be linked in.
function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} Tsd.`;
  return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} Mio.`;
}

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
  // An admin account is exempt from the cap (plans.ts's effectiveLimits), so
  // `used` can grow to whatever it grows to over the account's lifetime —
  // unlike every capped account, where it's bounded by `limit` and stays
  // short. A plain `truncate` would just clip the digits with an ellipsis,
  // which reads as "the number got cut off, guess the rest"; a compact
  // format (12,3 Tsd.) stays a real number at a bounded width instead
  // (QA finding E-3). The full value is still one hover away via `title`.
  const displayUsed = compactNumber(used);
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
        <span className="text-[13px] tabular-nums text-secondary" title={String(used)}>
          {unlimited ? (
            <>
              {displayUsed} <span className="text-tertiary">· Unbegrenzt</span>
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
