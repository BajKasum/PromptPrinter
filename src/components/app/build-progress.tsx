"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildStep = {
  key: string;
  /** What's actually being produced right now — the sub-caption under the active group. */
  label: string;
  /** Groups steps into the same rows the result later shows as tabs (results/page.tsx's
   * SOFTWARE_TABS groups) — the wait and the result share one mental model. */
  group: string;
  /** Rough estimated seconds for this step — a pacing aid, not a measurement. */
  seconds: number;
};

interface BuildProgressProps {
  steps: BuildStep[];
  /** Flip true once the real request actually resolves — snaps every step to
   * done immediately, wherever the estimate had gotten to. The estimate only
   * ever fills idle waiting time; it never gates real completion, and real
   * completion always cuts the estimate short, never the other way round. */
  complete: boolean;
}

/**
 * A calm, honest stand-in for real per-artifact progress. There is no
 * streaming API behind /api/generate — this can't know which artifact the
 * server is actually on. What it CAN know: the server processes artifacts in
 * exactly this order (chatCompleteSequential walks the prompts object in
 * insertion order, which matches `steps` here), so the sequence shown is
 * real, only the per-step timing is estimated. If the real call outruns the
 * estimate, the last group stays visibly "active" with a reassurance line
 * instead of looking finished or stuck.
 */
export function BuildProgress({ steps, complete }: BuildProgressProps) {
  const [elapsedIndex, setElapsedIndex] = useState(0);
  const [overrun, setOverrun] = useState(false);
  const timers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (complete) return;
    let cumulative = 0;
    steps.forEach((step, i) => {
      cumulative += step.seconds * 1000;
      if (i === steps.length - 1) {
        timers.current.push(window.setTimeout(() => setOverrun(true), cumulative));
      } else {
        timers.current.push(window.setTimeout(() => setElapsedIndex(i + 1), cumulative));
      }
    });
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // `steps` is a fixed array from the caller for the lifetime of one build —
    // only `complete` (real completion) should ever restart this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const doneUpTo = complete ? steps.length : elapsedIndex;
  const activeStep = !complete && doneUpTo < steps.length ? steps[doneUpTo] : null;

  const groups: { name: string; from: number; to: number }[] = [];
  steps.forEach((step, i) => {
    const last = groups[groups.length - 1];
    if (last && last.name === step.group) {
      last.to = i;
    } else {
      groups.push({ name: step.group, from: i, to: i });
    }
  });

  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const groupDone = doneUpTo > g.to;
        const groupActive = !groupDone && doneUpTo >= g.from && doneUpTo <= g.to;
        return (
          <div key={g.name} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                groupDone
                  ? "border-success/30 bg-success/10 text-success"
                  : groupActive
                    ? "border-accent/50 bg-accent-subtle"
                    : "border-border bg-surface"
              )}
            >
              {groupDone && <Check className="h-3 w-3" />}
              {groupActive &&
                (reduceMotion ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
                ) : (
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-accent-text"
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
            </span>
            <span
              className={cn(
                "text-[13px]",
                groupDone
                  ? "text-foreground/55"
                  : groupActive
                    ? "font-medium text-foreground"
                    : "text-foreground/35"
              )}
            >
              {g.name}
            </span>
            {groupActive && activeStep && (
              <span className="truncate text-[12px] text-foreground/45">— {activeStep.label}</span>
            )}
          </div>
        );
      })}
      {overrun && !complete && (
        <p role="status" className="pt-1 text-[12px] text-foreground/45">
          Bei umfangreichen Ideen dauert das schon mal länger — Finn bleibt dran.
        </p>
      )}
    </div>
  );
}
