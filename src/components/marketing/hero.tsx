"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileText,
  Palette,
  Database,
  Server,
  Megaphone,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { cn } from "@/lib/utils";

// The four stages of the journey — the spine of the whole page.
const STAGES = ["Idee", "Plan", "Build", "Launch"];

export function Hero() {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="relative overflow-hidden pt-28 md:pt-36 pb-24 md:pb-32 focus:outline-none"
    >
      {/* Subtle grid backdrop — restrained, IDE-like. No glow. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] -z-10 grid-bg opacity-50" />

      <div className="container-x relative flex flex-col items-center text-center">
        {/* The dolphin welcomes you in — main character, front and centre. */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2"
        >
          <AnimatedMascot state="welcoming" size={132} priority />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-foreground/70">
              Dein Bau-Buddy · Live in der Beta
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-balance text-[40px] md:text-[64px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-4xl"
        >
          Beschreib deine Idee.{" "}
          <span className="gradient-text">Bekomm alles, um sie zu bauen.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-2xl text-balance text-[17px] md:text-[18px] leading-[1.6] text-foreground/60"
        >
          Sag PromptPrinter in einem Satz, was du bauen willst. Du bekommst einen
          kompletten Bauplan zurück — und die fertigen Anweisungen für jedes KI-Tool,
          das du nutzt. Keine leere Seite mehr.
        </motion.p>

        {/* The journey in four words — Idee → Plan → Build → Launch. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex items-center gap-2 md:gap-3"
        >
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2 md:gap-3">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] md:text-[13px] font-medium",
                  i === 0
                    ? "border-accent/40 bg-accent-subtle text-accent-text"
                    : "border-border bg-surface text-foreground/70"
                )}
              >
                {stage}
              </span>
              {i < STAGES.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-foreground/30" strokeWidth={2} />
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-col sm:flex-row items-center gap-3"
        >
          <Button asChild size="lg" variant="primary">
            <Link href="/signup">
              Idee kostenlos ausprobieren
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="#example">Beispiel ansehen</Link>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 text-xs font-mono uppercase tracking-[0.08em] text-foreground/35"
        >
          Kostenlos starten · Keine Kreditkarte · Jederzeit kündbar
        </motion.p>

        {/* Hero demo: one idea becoming a whole build package, live. */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 w-full max-w-4xl"
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}

// Ideas that cycle through the input — deliberately plain-language, the kind of
// thing a founder or student would actually type.
const IDEAS = [
  "Airbnb für Hundesitter",
  "Ein KI-Habit-Tracker mit Streak-Belohnungen",
  "Ein Marktplatz für lokale Künstler",
];

const OUTPUTS = [
  { Icon: FileText, label: "Produktplan" },
  { Icon: Palette, label: "App-Design" },
  { Icon: Database, label: "Datenbank" },
  { Icon: Server, label: "Backend" },
  { Icon: Megaphone, label: "Marketing" },
];

type Phase = "typing" | "generating" | "done";

// Finn narrates the transformation — he reacts to the live demo phase, so the
// mascot feels like he's actually doing the work in front of you.
const NARRATION: Record<Phase, { state: MascotState; line: string }> = {
  typing: { state: "curious", line: "Erzähl mir, was du bauen willst …" },
  generating: { state: "building", line: "Alles klar — ich baue dein Paket …" },
  done: { state: "delivering", line: "Fertig! Alles, um es zu bauen." },
};

function HeroDemo() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });

  const [ideaIndex, setIdeaIndex] = useState(0);
  const [typed, setTyped] = useState(reduce ? IDEAS[0].length : 0);
  const [phase, setPhase] = useState<Phase>(reduce ? "done" : "typing");
  const [revealed, setRevealed] = useState(reduce ? OUTPUTS.length : 0);

  const idea = IDEAS[ideaIndex];

  // Drive the little state machine: type the idea → generate → reveal outputs
  // one by one → hold → advance to the next idea. Pauses off-screen, and is
  // skipped entirely for users who prefer reduced motion.
  useEffect(() => {
    if (reduce || !inView) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    setTyped(0);
    setRevealed(0);
    setPhase("typing");

    // Type the idea character by character.
    const current = IDEAS[ideaIndex];
    for (let i = 1; i <= current.length; i++) {
      at(i * 45, () => setTyped(i));
    }

    const typedDone = current.length * 45 + 400;
    at(typedDone, () => setPhase("generating"));

    // Reveal each output card in sequence.
    for (let i = 1; i <= OUTPUTS.length; i++) {
      at(typedDone + 350 + i * 320, () => setRevealed(i));
    }

    const allDone = typedDone + 350 + OUTPUTS.length * 320 + 200;
    at(allDone, () => setPhase("done"));

    // Hold the finished state, then move to the next idea.
    at(allDone + 2600, () => setIdeaIndex((n) => (n + 1) % IDEAS.length));

    return () => timers.forEach(clearTimeout);
  }, [ideaIndex, inView, reduce]);

  return (
    <div ref={ref} className="relative gradient-border rounded-2xl">
      <div className="relative rounded-2xl glass-strong p-1.5 shadow-elevated">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-surface" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">
            PromptPrinter
          </span>
          <span className="font-mono text-[11px]">
            {phase === "done" ? (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <Check className="h-3 w-3" strokeWidth={2.4} />
                fertig
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-foreground/45">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {phase === "typing" ? "tippt…" : "baut…"}
              </span>
            )}
          </span>
        </div>

        {/* Body */}
        <div className="p-5 md:p-7 text-left">
          {/* Finn narrates his own demo — reacts to the live phase. */}
          <div className="mb-5 flex items-center gap-3">
            <AnimatedMascot
              state={NARRATION[phase].state}
              size={56}
              className="shrink-0"
              alt="Finn arbeitet an deiner Idee"
            />
            <div className="relative rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[13px] leading-snug text-foreground/80">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  {NARRATION[phase].line}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* The idea input */}
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
            Deine Idee
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="text-[15px] md:text-[16px] text-foreground/90">
              {idea.slice(0, typed)}
              {phase === "typing" && (
                <span className="ml-0.5 inline-block h-4 w-[2px] align-middle bg-accent animate-pulse" />
              )}
            </span>
            <span className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>

          {/* The transformation arrow */}
          <div className="my-4 flex items-center justify-center gap-2 text-foreground/35">
            <span className="h-px w-12 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
              wird zu
            </span>
            <span className="h-px w-12 bg-border" />
          </div>

          {/* The outputs lighting up */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {OUTPUTS.map(({ Icon, label }, i) => {
              const lit = i < revealed;
              return (
                <div
                  key={label}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-500",
                    lit
                      ? "border-accent/30 bg-accent-subtle"
                      : "border-border bg-surface opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-500",
                      lit ? "bg-accent/20 text-accent-text" : "bg-surface-hover text-foreground/40"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </div>
                  <span
                    className={cn(
                      "text-[12px] font-medium transition-colors duration-500",
                      lit ? "text-foreground" : "text-foreground/45"
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "absolute right-2 top-2 transition-all duration-300",
                      lit ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    )}
                  >
                    <Check className="h-3.5 w-3.5 text-accent-text" strokeWidth={2.6} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
