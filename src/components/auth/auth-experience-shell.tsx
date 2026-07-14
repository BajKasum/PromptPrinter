"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/logo";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";

// Finn's side of the screen — bubbles rising and a few sparks drifting
// around him, same shared vocabulary as the landing page's sections.
const PANEL_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "10%", left: "16%", size: 14, delay: 0.2, duration: 3.4 },
  { kind: "bubble", top: "18%", left: "76%", size: 20, delay: 0.8, duration: 4.8 },
  { kind: "star", top: "32%", left: "84%", size: 10, delay: 1.4, duration: 3.1 },
  { kind: "bubble", top: "46%", left: "10%", size: 16, delay: 0.4, duration: 4.3 },
  { kind: "star", top: "58%", left: "22%", size: 11, delay: 1.7, duration: 3.6 },
  { kind: "bubble", top: "66%", left: "80%", size: 24, delay: 1.0, duration: 5.1 },
  { kind: "bubble", top: "82%", left: "28%", size: 14, delay: 0.6, duration: 4.5 },
  { kind: "star", top: "86%", left: "70%", size: 9, delay: 0.3, duration: 3.2 },
];

/**
 * Two-column auth layout shared by login, signup and the password-reset
 * screens. Left half (desktop): Finn's panel — a soft water-tinted surface
 * with the big animated dolphin, drifting bubbles/stars, and one line in his
 * voice. Right half: the form. On mobile the panel collapses to a small Finn
 * above the form. `overlay` renders at the root (e.g. success celebration).
 */
export function AuthExperienceShell({
  children,
  overlay,
  panelTitle = "Schön, dass du da bist.",
  panelSub = "Ich bin Finn. Erzähl mir deine Idee — ich mach einen fertigen Plan draus.",
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
  /** Headline on Finn's panel — one line in his own voice, per page. */
  panelTitle?: string;
  panelSub?: string;
}) {
  return (
    <div className="relative flex min-h-screen w-full bg-background text-foreground">
      {overlay}

      {/* Finn's panel — desktop only. */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-accent-subtle lg:flex lg:flex-col">
        {/* One soft light source from above (Finn's World: sunlight, not aquarium). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--background)/0.55)_0%,transparent_65%)]"
        />
        <Floaters items={PANEL_FLOATERS} />

        <div className="relative z-10 px-10 py-7">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-10 pb-24 text-center">
          <AnimatedMascot
            state="welcoming"
            motion="bob"
            size={240}
            priority
            alt="Finn begrüßt dich"
          />
          <div className="max-w-sm space-y-2.5">
            <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
              {panelTitle}
            </h2>
            <p className="text-[15px] leading-relaxed text-foreground/60">{panelSub}</p>
          </div>
        </div>
      </aside>

      {/* Form column. */}
      <div className="relative flex min-h-screen flex-1 flex-col">
        <header className="flex items-center px-6 py-6 md:px-10 lg:hidden">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md space-y-6"
          >
            {/* Small Finn for mobile — desktop has the big one on the left. */}
            <div className="flex justify-center lg:hidden">
              <AnimatedMascot state="welcoming" motion="bob" size={72} alt="" />
            </div>
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
