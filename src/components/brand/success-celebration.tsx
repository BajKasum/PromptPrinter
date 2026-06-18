"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";

interface SuccessCelebrationProps {
  /** Headline, e.g. "Erfolgreich eingeloggt". */
  message: string;
  /** Optional second line. */
  description?: string;
  /** Called once the celebration is over — use it to navigate / dismiss. */
  onDone?: () => void;
  /** How long the overlay stays before calling onDone (ms). */
  durationMs?: number;
  className?: string;
}

// A small sparkle burst around the dolphin. Fixed offsets so it reads as a pop.
const SPARKLES = [
  { x: -64, y: -52, d: 0.15, s: 7 },
  { x: 60, y: -60, d: 0.22, s: 9 },
  { x: 78, y: 8, d: 0.3, s: 6 },
  { x: -78, y: 6, d: 0.26, s: 8 },
  { x: -42, y: 64, d: 0.34, s: 6 },
  { x: 48, y: 66, d: 0.18, s: 7 },
];

/**
 * Full-screen celebratory overlay, built from the transparent mascot PNG +
 * Framer Motion — the dolphin pops in with a little jump, a success check badge
 * snaps on, and sparkles burst. Reusable for any "it worked" moment (login,
 * signup confirmed, checkout, …). Mount it conditionally; it calls onDone after
 * `durationMs` so the caller can navigate.
 *
 * Reduced-motion users get the static mascot + check, no movement, same timing.
 */
export function SuccessCelebration({
  message,
  description,
  onDone,
  durationMs = 2200,
  className,
}: SuccessCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/85 px-6 text-center backdrop-blur-md",
        className
      )}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative">
          {!reduceMotion &&
            SPARKLES.map((sp, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 rounded-full bg-accent-text"
                style={{ width: sp.s, height: sp.s }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], x: sp.x, y: sp.y, scale: [0, 1, 0.5] }}
                transition={{ duration: 0.9, delay: sp.d, ease: "easeOut" }}
              />
            ))}

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 16 }}
            animate={
              reduceMotion
                ? { scale: 1, opacity: 1, y: 0 }
                : { scale: 1, opacity: 1, y: [16, -10, 0] }
            }
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
          >
            <Mascot size={150} priority />
          </motion.div>

          {/* Success check badge, snaps in over the dolphin's lower-right. */}
          <motion.span
            className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full border border-success/30 bg-success/15 backdrop-blur-sm"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.32 }}
          >
            <Check className="h-6 w-6 text-success" strokeWidth={2.4} />
          </motion.span>
        </div>

        <motion.p
          className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-foreground"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3 }}
        >
          {message}
        </motion.p>
        {description && (
          <motion.p
            className="mt-1.5 text-[13.5px] text-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.3 }}
          >
            {description}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
