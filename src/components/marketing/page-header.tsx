"use client";

import { motion } from "framer-motion";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";

const HEADER_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "18%", left: "8%", size: 14, delay: 0, duration: 3.4 },
  { kind: "bubble", top: "28%", left: "90%", size: 20, delay: 0.6, duration: 4.7 },
  { kind: "star", top: "68%", left: "94%", size: 10, delay: 1.2, duration: 3.1 },
  { kind: "bubble", top: "76%", left: "5%", size: 16, delay: 0.3, duration: 4.3 },
];

/**
 * The opener for /pricing, the one page besides the landing page that needs a
 * header of its own.
 *
 * This replaces FinnGreeting, which put a 148px Finn and a speech bubble above
 * the headline here. That was too much: the mascot plus his greeting plus a
 * subline meant four stacked elements before the actual plans, and the plans
 * themselves already carry a Finn per card, with three more on the reassurance
 * row below. Finn is supposed to guide, not queue up. So the pricing page now
 * opens on its headline and gets to the plans faster; Finn's own introduction
 * happens once, in the landing page hero, which is where a first-time visitor
 * meets him anyway.
 *
 * What's kept from the old opener is the atmosphere — grid backdrop, drifting
 * floaters, the settling entrance — because that's the ambient layer, not a
 * character (DESIGN.md, "Ozean durch Licht, nicht Objekte").
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

      <div className="container-x relative z-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground md:text-[60px] md:leading-[1.05]"
        >
          {headline}
        </motion.h1>
      </div>
    </section>
  );
}
