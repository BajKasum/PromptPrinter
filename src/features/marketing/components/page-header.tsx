"use client";

import { m } from "framer-motion";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/shared/brand/floaters";

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
 * Der Seitenkopf von /skill, /terminal und /mcp: nur die Überschrift, zentriert,
 * damit der Inhalt darunter sofort folgt. Eine einzelne
 * zentrierte Zeile liesse den breiten Rand links und rechts leer wirken, dafür
 * stehen dort zwei Finns und die Sterne und Blasen oben.
 *
 * "explaining" (er hält in seinem Bild schon ein Blatt) steht links, "helping"
 * (die angebotene Flosse) rechts. Beide `hidden lg:block`: sobald die
 * Überschrift auf dem Handy umbricht, ist kein Platz für sie, und zentrierter
 * Text ohne Begleitung liest sich dort ohnehin gut.
 */
export function PageHeader({ headline }: { headline: React.ReactNode }) {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="relative overflow-hidden pt-36 pb-14 focus:outline-hidden md:pt-44 md:pb-16"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg opacity-50" />
      <Floaters items={HEADER_FLOATERS} />

      <div className="container-x relative z-10 flex items-center justify-center gap-6 text-center">
        <m.div
          initial={{ opacity: 0, x: -12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 lg:block"
        >
          <AnimatedMascot state="explaining" size={112} alt="" />
        </m.div>

        <h1
          // No shrink-0 here, unlike the two mascots either side: at
          // narrower `lg` widths there isn't room for two 112px Finns AND a
          // full 768px headline, and the text is what should give — it wraps
          // to an extra line instead of pushing the mascots past the
          // container edge.
          //
          // `enter-rise` statt motion.h1: die Überschrift ist das grösste
          // Element der Seite und muss ohne JavaScript sichtbar sein (siehe
          // .enter-rise in globals.css).
          className="enter-rise max-w-3xl text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground md:text-[60px] md:leading-[1.05]"
        >
          {headline}
        </h1>

        <m.div
          initial={{ opacity: 0, x: 12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 lg:block"
        >
          <AnimatedMascot state="helping" size={112} alt="" />
        </m.div>
      </div>
    </section>
  );
}
