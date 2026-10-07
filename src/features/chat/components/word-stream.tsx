"use client";

import { motion } from "framer-motion";

// Die Mitschrift des Sprachmodus, ausgelagert aus voice-bar.tsx (Betriebs-Audit, Folgesitzung
// 2026-10-07, Dateigroesse).

/**
 * Renders text word by word, fading each new word in as it arrives.
 *
 * Keyed by position + word so only genuinely new words animate: the recogniser
 * revises the tail of the current phrase constantly, and keying by index alone
 * would re-run the animation on every already-settled word each time it does.
 */
export function WordStream({
  text,
  className,
  reduced,
}: {
  text: string;
  className?: string;
  reduced: boolean;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={reduced ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          // Word gap as a right margin rather than a character between the
          // spans: an inline-block collapses a trailing normal space, and a
          // non-breaking one stops the transcript wrapping at all, which
          // overflows the moment a sentence gets long on a phone.
          className="mr-[0.26em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
