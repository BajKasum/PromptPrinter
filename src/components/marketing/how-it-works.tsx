"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Pencil, MessageSquare, PackageCheck } from "lucide-react";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Erzähl mir deine Idee",
    body: "Sag mir in einem Satz, was du bauen willst, egal wie grob. Ein paar Notizen reichen. Ich hol dich da ab, wo du gerade stehst.",
  },
  {
    n: "02",
    Icon: MessageSquare,
    title: "Wir klären es kurz",
    body: "Ich stell dir ein paar einfache Fragen und helf dir auch, wenn du Zielgruppe oder Technik noch gar nicht kennst.",
    chat: true,
  },
  {
    n: "03",
    Icon: PackageCheck,
    title: "Du bekommst alles, startklar",
    body: "Du bekommst einen kompletten Plan plus die fertigen Anweisungen für jedes KI-Tool. Ein Klick, kopiert, und du legst los.",
  },
];

// In place of NoteMage's leaves (a forest motif that doesn't fit a dolphin's
// world) — see components/brand/floaters.tsx for the shared component.
const FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "3%", left: "6%", size: 14, delay: 0, duration: 3.4 },
  { kind: "bubble", top: "9%", left: "91%", size: 18, delay: 0.5, duration: 4.6 },
  { kind: "star", top: "26%", left: "95%", size: 10, delay: 1.2, duration: 3 },
  { kind: "bubble", top: "45%", left: "3%", size: 15, delay: 0.2, duration: 4.2 },
  { kind: "star", top: "63%", left: "9%", size: 11, delay: 1.6, duration: 3.6 },
  { kind: "bubble", top: "79%", left: "92%", size: 22, delay: 0.8, duration: 5 },
  { kind: "star", top: "93%", left: "80%", size: 9, delay: 0.4, duration: 3.1 },
];

// A connecting segment between two step nodes, filling top-down once it
// scrolls into view. Uses useInView with a plain ref (real, stable geometry)
// rather than whileInView directly on the scaling element — a self-observing
// element whose own initial state is scaleY(0) has zero visual area, so its
// IntersectionObserver entry never reliably reports as visible.
function StepConnector({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // Vertical-only margin — a single value shrinks the root on all four
  // sides, and this rail sits close to the left edge of its (narrow)
  // column, so a symmetric shrink can exclude it horizontally regardless
  // of scroll position. Only the vertical buffer is the point here.
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  return (
    <div ref={ref} className="relative mt-2 w-[3px] grow overflow-hidden rounded-full">
      <div className="absolute inset-0 rounded-full bg-border" />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-0 rounded-full bg-accent"
        style={{ transformOrigin: "top" }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: inView ? 1 : 0 }}
        transition={{ duration: 0.7, delay: 0.25 + index * 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="container-x relative overflow-hidden pt-16 pb-24 md:pt-20 md:pb-32">
      <Floaters items={FLOATERS} />

      <FadeIn>
        <div className="relative z-10 mb-14 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              In drei Schritten von der Idee zum fertigen Plan.
            </h2>
            <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
              Kein Formular, kein Fachchinesisch. Du redest ganz normal, um den
              Rest kümmere ich mich.
            </p>
          </div>
          {/* The dolphin guides you through the process. */}
          <AnimatedMascot
            state="building"
            motion="bob"
            size={200}
            className="mx-auto shrink-0 md:mx-0"
            alt="Der Delfin führt dich durch die drei Schritte"
          />
        </div>
      </FadeIn>

      {/* A vertical step rail — a sequence, not three parallel cards. Each
          segment's fill grows top-down as its step scrolls into view, so the
          whole rail reads as one continuous path being drawn. */}
      <StaggerChildren className="relative z-10 mx-auto max-w-3xl">
        {steps.map(({ n, Icon, title, body, chat }, i) => {
          const last = i === steps.length - 1;
          return (
            <StaggerItem key={n}>
              <div className={cn("flex gap-5 md:gap-6", !last && "pb-8 md:pb-10")}>
                {/* Rail: glowing icon node + connector that fills to the next node */}
                <div className="flex flex-col items-center">
                  <motion.div
                    whileHover={reduceMotion ? undefined : { scale: 1.14 }}
                    whileTap={reduceMotion ? undefined : { scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-surface-raised shadow-[0_0_0_1px_hsl(var(--accent)/0.12),0_0_22px_3px_hsl(var(--accent)/0.28)] md:h-12 md:w-12"
                  >
                    {/* Pulsing glow ring — a slow radar ping, staggered per step
                        so the three nodes don't pulse in lockstep. */}
                    {!reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-accent/25"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.55, 0, 0.55] }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: "easeOut",
                          delay: i * 0.45,
                        }}
                      />
                    )}
                    <Icon className="relative z-10 h-5 w-5 text-accent-text" strokeWidth={1.8} />
                  </motion.div>

                  {!last && <StepConnector index={i} />}
                </div>

                {/* Content card — lifts and glows a little brighter on hover. */}
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="flex-1 rounded-2xl border border-border bg-surface-raised p-5 shadow-card transition-shadow duration-300 hover:border-accent/40 hover:shadow-elevated md:p-6"
                >
                  <div className="mb-1.5 font-mono text-[11px] tracking-[0.12em] text-foreground/35">
                    Schritt {n}
                  </div>
                  <h3 className="mb-2 text-[18px] font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="max-w-xl text-[14.5px] leading-[1.6] text-foreground/55">{body}</p>

                  {/* Step 2 shows the real conversational feel — same baby-blue
                      user bubble as the app. */}
                  {chat && (
                    <div className="mt-4 space-y-2.5">
                      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground/70">
                        Welche Datenbank nutzt du, und brauchst du von Anfang an Login?
                      </div>
                      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent-subtle px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground">
                        Supabase, und ja, E-Mail plus Google.
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerChildren>
    </section>
  );
}
