"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
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

// Confetti burst around the dolphin — token-colored pieces flung outward, then
// drifting down. x/y are end offsets in px from the dolphin's center.
const CONFETTI = [
  { x: -130, y: -70, r: -50, d: 0.0, c: "bg-accent", w: 8, h: 8 },
  { x: 125, y: -90, r: 40, d: 0.06, c: "bg-warning", w: 7, h: 11 },
  { x: -90, y: -120, r: 20, d: 0.12, c: "bg-success", w: 9, h: 9 },
  { x: 95, y: -120, r: -30, d: 0.04, c: "bg-destructive", w: 7, h: 7 },
  { x: -150, y: 10, r: 60, d: 0.1, c: "bg-accent-text", w: 8, h: 10 },
  { x: 150, y: 0, r: -45, d: 0.14, c: "bg-success", w: 8, h: 8 },
  { x: -60, y: 130, r: 35, d: 0.18, c: "bg-warning", w: 9, h: 9 },
  { x: 70, y: 125, r: -25, d: 0.08, c: "bg-accent", w: 7, h: 11 },
  { x: 20, y: -140, r: 50, d: 0.16, c: "bg-accent", w: 7, h: 7 },
  { x: -20, y: 150, r: -55, d: 0.22, c: "bg-destructive", w: 8, h: 8 },
  { x: 135, y: 70, r: 30, d: 0.2, c: "bg-warning", w: 8, h: 10 },
  { x: -135, y: 75, r: -35, d: 0.12, c: "bg-success", w: 7, h: 9 },
];

/**
 * Full-screen celebratory overlay: the happy dolphin pops in amid a confetti
 * burst over a blurred backdrop, then onDone fires after `durationMs`. Used for
 * every "it worked" moment (login, signup, password updated, …). Reduced-motion
 * users get the static dolphin (no confetti) with the same timing.
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
      <div className="relative">
        {!reduceMotion &&
          CONFETTI.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              className={cn("absolute left-1/2 top-1/2 rounded-[1px]", p.c)}
              style={{ width: p.w, height: p.h }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{
                x: p.x,
                y: [0, p.y - 20, p.y],
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0.7],
                rotate: p.r,
              }}
              transition={{ duration: 1.6, delay: p.d, ease: "easeOut" }}
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
          <Mascot state="celebrating" size={184} priority />
        </motion.div>
      </div>

      <motion.p
        className="mt-5 text-[19px] font-semibold tracking-[-0.01em] text-foreground"
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
    </motion.div>
  );
}
