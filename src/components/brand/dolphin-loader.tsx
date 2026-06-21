"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";

interface DolphinLoaderProps {
  /** Box size in px (the dolphin fills it; bubbles rise above). Default 36. */
  size?: number;
  /** Optional text to the right of the dolphin (e.g. "Schreibt…"). */
  label?: string;
  className?: string;
}

/**
 * Looping loading indicator built entirely from the transparent mascot PNG +
 * Framer Motion — so it's truly transparent on any theme, perfectly seamless,
 * and weighs nothing extra. The dolphin bobs and sways (swimming) while small
 * bubbles drift upward. Use anywhere the app is waiting.
 *
 * Respects prefers-reduced-motion: renders the static mascot, no movement.
 */
export function DolphinLoader({ size = 36, label, className }: DolphinLoaderProps) {
  const reduceMotion = useReducedMotion();
  const bubble = Math.max(2, Math.round(size * 0.12));

  return (
    <span
      role="status"
      aria-label={label ?? "Lädt…"}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {!reduceMotion &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute rounded-full bg-accent-text/40"
              style={{ width: bubble, height: bubble, left: `${28 + i * 20}%`, bottom: 2 }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.85, 0], y: -size * 0.85, scale: [0.5, 1, 0.7] }}
              transition={{
                duration: 1.9,
                repeat: Infinity,
                delay: i * 0.55,
                ease: "easeOut",
              }}
            />
          ))}
        <motion.span
          className="block"
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -size * 0.13, 0], rotate: [-4, 4, -4] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <Mascot state="waiting" size={size} />
        </motion.span>
      </span>
      {label && <span className="text-[13px] text-foreground/55">{label}</span>}
    </span>
  );
}
