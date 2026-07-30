"use client";

import { motion } from "framer-motion";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";

// Denser and wider than the 4-item set this replaces: with two Finns now
// flanking the headline (below), the plain gap that used to sit on both sides
// of it needed more than four sparse points to not read as empty again.
// Spread across the FULL width on purpose, some past where the mascots stand,
// so the two don't look like they were dropped onto an otherwise bare canvas.
const HEADER_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "12%", left: "4%", size: 13, delay: 0, duration: 3.4 },
  { kind: "bubble", top: "22%", left: "16%", size: 15, delay: 0.5, duration: 4.2 },
  { kind: "star", top: "72%", left: "10%", size: 10, delay: 1.1, duration: 3.6 },
  { kind: "bubble", top: "58%", left: "22%", size: 12, delay: 0.8, duration: 4.6 },
  { kind: "star", top: "16%", left: "96%", size: 14, delay: 0.3, duration: 3.2 },
  { kind: "bubble", top: "28%", left: "84%", size: 20, delay: 0.6, duration: 4.7 },
  { kind: "star", top: "68%", left: "94%", size: 10, delay: 1.2, duration: 3.1 },
  { kind: "bubble", top: "78%", left: "80%", size: 16, delay: 0.3, duration: 4.3 },
];

/**
 * The opener for /pricing, the one page besides the landing page that needs a
 * header of its own.
 *
 * This replaces FinnGreeting, which put a 148px Finn and a speech bubble above
 * the headline here. That was too much: the mascot plus his greeting plus a
 * subline meant three stacked elements before the actual plans. So the
 * headline now stands on its own and gets to the plans faster — but a lone
 * centred line of text left the wide gap on either side of it looking bare
 * (flagged from a live screenshot), which is what the two Finns and the wider
 * floater spread below are for.
 *
 * The two mascots split the headline's own two sentences: "explaining" (he
 * already holds a piece of paper in his art) sits with "Bring deinen eigenen
 * Key mit", "helping" (an offered flipper) sits with "Oder ich übernehme das
 * für dich". Both `hidden lg:block` — there is no room for them once the
 * headline wraps to three lines on a phone, and centred text flanked by
 * nothing reads fine there anyway.
 */
export function PageHeader({ headline }: { headline: React.ReactNode }) {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="relative overflow-hidden pt-36 pb-14 focus:outline-none md:pt-44 md:pb-16"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg opacity-50" />
      <Floaters items={HEADER_FLOATERS} />

      <div className="container-x relative z-10 flex items-center justify-center gap-6 text-center">
        <motion.div
          initial={{ opacity: 0, x: -12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 lg:block"
        >
          <AnimatedMascot state="explaining" size={112} alt="" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          // No shrink-0 here, unlike the two mascots either side: at
          // narrower `lg` widths there isn't room for two 112px Finns AND a
          // full 768px headline, and the text is what should give — it wraps
          // to an extra line instead of pushing the mascots past the
          // container edge.
          className="max-w-3xl text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground md:text-[60px] md:leading-[1.05]"
        >
          {headline}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, x: 12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 lg:block"
        >
          <AnimatedMascot state="helping" size={112} alt="" />
        </motion.div>
      </div>
    </section>
  );
}
