"use client";

import { Check, Copy } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

// Deterministic bubble burst (not randomized per render) — Finn's ocean in
// miniature, the same accent/accent-warm alternation Floaters uses for its
// ambient star/bubble mix. Directions, sizes and stagger mirror the
// "Copy-Moment" prototype built in Claude Design.
const BUBBLES = [
  { bx: -10, by: -15, size: 5, delay: 0, warm: false },
  { bx: 7, by: -19, size: 4, delay: 0.045, warm: true },
  { bx: -3, by: -21, size: 3.5, delay: 0.09, warm: false },
  { bx: 12, by: -11, size: 4.5, delay: 0.02, warm: true },
  { bx: -14, by: -6, size: 3, delay: 0.12, warm: false },
];

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * The shared "it's copied" moment: the icon morphs into a hand-drawn
 * checkmark with a small burst of Finn's-ocean bubbles. Built in Claude
 * Design (Copy-Moment.dc.html) for the prompt block's copy button — the one
 * true "Prompt kopieren" moment — deliberately not applied to every copy
 * button in the app, so it stays a highlight rather than background noise.
 *
 * Renders the same two-node shape (icon, label) as the plain
 * `{copied ? <Check/> : <Copy/>} {label}` fragment it replaces, so the
 * caller's own button layout (flex, gap, hover styles) is untouched.
 */
export function CopyMoment({
  copied,
  copyCount,
  idleLabel,
  copiedLabel = "Kopiert",
  iconClassName = "h-3.5 w-3.5",
}: {
  copied: boolean;
  /** From useCopyToClipboard — restarts the flourish even on a rapid re-click while still "copied". */
  copyCount: number;
  idleLabel: string;
  copiedLabel?: string;
  iconClassName?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  if (!copied) {
    return (
      <>
        <Copy className={iconClassName} />
        {idleLabel}
      </>
    );
  }

  if (reduceMotion) {
    return (
      <>
        <Check className={`${iconClassName} text-success`} />
        {copiedLabel}
      </>
    );
  }

  return (
    <>
      <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-success">
        <motion.span
          key={copyCount}
          className="inline-flex"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.38, delay: 0.08, ease: EASE_OUT_EXPO }}
            />
          </svg>
        </motion.span>
        {BUBBLES.map((b, i) => (
          <motion.span
            key={`${copyCount}-${i}`}
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 rounded-full border ${
              b.warm ? "border-accent-warm/80 bg-accent-warm/60" : "border-accent/70 bg-accent/55"
            }`}
            style={{ width: b.size, height: b.size, marginLeft: -b.size / 2, marginTop: -b.size / 2 }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], x: b.bx, y: b.by, scale: 1 }}
            transition={{ duration: 0.62, delay: b.delay, ease: EASE_OUT_EXPO }}
          />
        ))}
      </span>
      <span className="text-success">{copiedLabel}</span>
    </>
  );
}
