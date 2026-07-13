"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";

export type FloaterSpec = {
  kind: "star" | "bubble";
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
};

/**
 * Ambient decoration adrift around a section — Finn's ocean (rising bubbles)
 * plus a few playful sparks. Each caller passes its own tailored `items` (a
 * fixed, deterministic layout, not randomized per render) so density and
 * spread match that section's own size instead of every section reusing one
 * identical constellation. Renders nothing under prefers-reduced-motion.
 * Needs a `relative` (and usually `overflow-hidden`) ancestor to contain it.
 */
export function Floaters({ items }: { items: FloaterSpec[] }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((f, i) => (
        <motion.span
          key={i}
          className="absolute hidden sm:block"
          style={{ top: f.top, left: f.left }}
          animate={{ y: [0, -16, 0], opacity: [0.3, 0.85, 0.3] }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {f.kind === "star" ? (
            <Star
              style={{ width: f.size, height: f.size }}
              className="text-accent-warm"
              fill="currentColor"
              strokeWidth={0}
            />
          ) : (
            <span
              style={{ width: f.size, height: f.size }}
              className="block rounded-full border border-accent/40 bg-accent/10"
            />
          )}
        </motion.span>
      ))}
    </div>
  );
}
