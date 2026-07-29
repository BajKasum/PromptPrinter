"use client";

import { motion } from "framer-motion";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";

const GREETING_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "12%", left: "8%", size: 14, delay: 0, duration: 3.4 },
  { kind: "bubble", top: "20%", left: "90%", size: 20, delay: 0.6, duration: 4.7 },
  { kind: "star", top: "58%", left: "94%", size: 10, delay: 1.2, duration: 3.1 },
  { kind: "bubble", top: "70%", left: "5%", size: 16, delay: 0.3, duration: 4.3 },
];

/**
 * The page opener for /features and /pricing: Finn says hello himself before
 * the page says anything else.
 *
 * Both pages used to start with a mono "eyebrow" pill and a headline — the
 * generic SaaS opener the brand principles in CLAUDE.md explicitly reject, and
 * on a page whose whole selling point is that a dolphin walks you through it,
 * a label was doing the job the mascot exists for.
 *
 * Deliberately simpler than hero.tsx's own greeting: that one anchors two
 * separately-positioned speech balloons to Finn's rendered box (desktop
 * diagonal, mobile below) because the hero is asymmetric. Here he sits centred
 * above his own words, so one bubble in normal flow is enough — no absolute
 * positioning to keep in sync at two breakpoints.
 */
export function FinnGreeting({
  state = "welcoming",
  greeting,
  headline,
  sub,
}: {
  state?: MascotState;
  /** Finn's own line, in his voice. Rendered in the speech bubble. */
  greeting: string;
  /** The page's actual H1. Accepts markup so a phrase can be accented. */
  headline: React.ReactNode;
  sub: string;
}) {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="relative overflow-hidden pt-32 md:pt-40 pb-12 focus:outline-none"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg opacity-50" />
      <Floaters items={GREETING_FLOATERS} />

      <div className="container-x relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatedMascot state={state} motion="bob" size={148} priority alt="" />
        </motion.div>

        {/* Speech bubble, tail pointing up at Finn. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-4 rounded-2xl border border-border bg-surface-raised px-4 py-2.5 shadow-card"
        >
          <span
            aria-hidden
            className="absolute -top-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-border bg-surface-raised"
          />
          <p className="text-[14px] leading-relaxed text-foreground/80">{greeting}</p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-8 max-w-3xl text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground md:text-[60px] md:leading-[1.05]"
        >
          {headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-5 max-w-2xl text-balance text-[17px] leading-[1.55] text-secondary"
        >
          {sub}
        </motion.p>
      </div>
    </section>
  );
}
