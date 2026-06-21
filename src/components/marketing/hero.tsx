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
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { cn } from "@/lib/utils";

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
          Sag PromptPrinter in einem Satz, was du bauen willst. Schau zu, wie aus
          der Idee ein Plan, ein komplettes Bau-Paket und ein startklares Projekt
          wird — alles an einem Ort.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-6 text-xs font-mono uppercase tracking-[0.08em] text-foreground/35"
        >
          Kostenlos starten · Keine Kreditkarte · Jederzeit kündbar
        </motion.p>

        {/* Hero demo: one idea walking the whole journey, live. */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 w-full max-w-4xl"
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────

type StageKey = "idea" | "plan" | "build" | "launch";
const STAGES: { key: StageKey; label: string }[] = [
  { key: "idea", label: "Idee" },
  { key: "plan", label: "Plan" },
  { key: "build", label: "Build" },
  { key: "launch", label: "Launch" },
];

// Each demo is a real, plain-language idea with the plan + launch domain it
// would produce. Build artifacts are the same set every project gets.
const DEMOS = [
  {
    idea: "Airbnb für Hundesitter",
    domain: "hundesitter.app",
    plan: [
      ["Zielgruppe", "Hundebesitzer, die kurzfristig Betreuung suchen"],
      ["Kernfunktionen", "Suche, Buchung, Bezahlung, Bewertungen"],
      ["Erfolg", "100 vermittelte Buchungen im ersten Monat"],
    ],
  },
  {
    idea: "KI-Habit-Tracker mit Streaks",
    domain: "streakcoach.app",
    plan: [
      ["Zielgruppe", "Menschen, die feste Routinen aufbauen wollen"],
      ["Kernfunktionen", "Habits, Check-ins, KI-Mikrobelohnungen"],
      ["Erfolg", "35 % der Nutzer nach 7 Tagen noch aktiv"],
    ],
  },
  {
    idea: "Marktplatz für lokale Künstler",
    domain: "artlokal.app",
    plan: [
      ["Zielgruppe", "Lokale Künstler und ihre Sammler"],
      ["Kernfunktionen", "Shops, Zahlungen, Entdecken-Feed"],
      ["Erfolg", "50 aktive Shops in den ersten 30 Tagen"],
    ],
  },
];

const OUTPUTS = [
  { Icon: FileText, label: "Produktplan" },
  { Icon: Palette, label: "App-Design" },
  { Icon: Database, label: "Datenbank" },
  { Icon: Server, label: "Backend" },
  { Icon: Megaphone, label: "Marketing" },
];

const LAUNCH_CHECKS = [
  "Deployment für Vercel konfiguriert",
  "Umgebungsvariablen & Secrets gesetzt",
  "Datenbank migriert und startklar",
];

const NARRATION: Record<StageKey, { state: MascotState; line: string }> = {
  idea: { state: "curious", line: "Erzähl mir, was du bauen willst …" },
  plan: { state: "thinking", line: "Ich plane Zielgruppe, Funktionen und Stack …" },
  build: { state: "building", line: "Ich baue dein komplettes Bau-Paket …" },
  launch: { state: "delivering", line: "Fertig — bereit zum Launch!" },
};

// ── Demo component ─────────────────────────────────────────────────────────

function HeroDemo() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });

  const [demoIndex, setDemoIndex] = useState(0);
  const [stage, setStage] = useState(0); // 0..3
  const [typed, setTyped] = useState(0); // chars of idea
  const [planRevealed, setPlanRevealed] = useState(0);
  const [built, setBuilt] = useState(0);
  const [launchRevealed, setLaunchRevealed] = useState(0);
  const [live, setLive] = useState(false);

  const demo = DEMOS[demoIndex];
  const stageKey = STAGES[stage].key;

  // One scripted cycle: type the idea → reveal the plan → build artifacts →
  // launch checklist goes live → hold → next idea. Pauses off-screen; reduced
  // motion shows the finished launch state, no loop.
  useEffect(() => {
    if (reduce) {
      setStage(3);
      setTyped(DEMOS[demoIndex].idea.length);
      setPlanRevealed(DEMOS[demoIndex].plan.length);
      setBuilt(OUTPUTS.length);
      setLaunchRevealed(LAUNCH_CHECKS.length);
      setLive(true);
      return;
    }
    if (!inView) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const current = DEMOS[demoIndex];

    setStage(0);
    setTyped(0);
    setPlanRevealed(0);
    setBuilt(0);
    setLaunchRevealed(0);
    setLive(false);

    // Stage 1 — Idea: type it out.
    for (let i = 1; i <= current.idea.length; i++) at(i * 45, () => setTyped(i));
    let t = current.idea.length * 45 + 700;

    // Stage 2 — Plan: reveal each line.
    at(t, () => setStage(1));
    for (let i = 1; i <= current.plan.length; i++) {
      const d = t + i * 420;
      at(d, () => setPlanRevealed(i));
    }
    t += current.plan.length * 420 + 700;

    // Stage 3 — Build: light up artifacts.
    at(t, () => setStage(2));
    for (let i = 1; i <= OUTPUTS.length; i++) at(t + i * 300, () => setBuilt(i));
    t += OUTPUTS.length * 300 + 600;

    // Stage 4 — Launch: tick the checklist, then go live.
    at(t, () => setStage(3));
    for (let i = 1; i <= LAUNCH_CHECKS.length; i++) at(t + i * 380, () => setLaunchRevealed(i));
    t += LAUNCH_CHECKS.length * 380 + 500;
    at(t, () => setLive(true));

    // Hold the launched state, then move to the next idea.
    at(t + 2600, () => setDemoIndex((n) => (n + 1) % DEMOS.length));

    return () => timers.forEach(clearTimeout);
  }, [demoIndex, inView, reduce]);

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
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <Check className="h-3 w-3" strokeWidth={2.4} />
                live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-foreground/45">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Schritt {stage + 1}/4
              </span>
            )}
          </span>
        </div>

        {/* Active stepper — the real journey, visibly progressing. */}
        <div className="flex items-center gap-1.5 px-4 md:px-6 pt-4">
          {STAGES.map((s, i) => {
            const done = i < stage || (i === stage && live && i === 3);
            const active = i === stage;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono transition-colors duration-300",
                      done
                        ? "border-accent/40 bg-accent text-accent-foreground"
                        : active
                          ? "border-accent/50 bg-accent-subtle text-accent-text"
                          : "border-border bg-surface text-foreground/40"
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[12px] md:text-[13px] font-medium transition-colors duration-300",
                      active || done ? "text-foreground" : "text-foreground/40"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="relative mx-1 h-px flex-1 bg-border">
                    <span
                      className={cn(
                        "absolute inset-0 origin-left bg-accent transition-transform duration-500",
                        i < stage ? "scale-x-100" : "scale-x-0"
                      )}
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 md:p-7 text-left">
          {/* Finn narrates the current stage — reacts as the work happens. */}
          <div className="mb-5 flex items-center gap-3">
            <AnimatedMascot
              state={NARRATION[stageKey].state}
              size={52}
              className="shrink-0"
              alt="Finn arbeitet an deiner Idee"
            />
            <div className="relative rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[13px] leading-snug text-foreground/80">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={stageKey}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  {NARRATION[stageKey].line}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* The idea stays pinned at the top — it's the thread through every stage. */}
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
            Deine Idee
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="text-[15px] md:text-[16px] text-foreground/90">
              {demo.idea.slice(0, typed)}
              {stage === 0 && typed < demo.idea.length && (
                <span className="ml-0.5 inline-block h-4 w-[2px] align-middle bg-accent animate-pulse" />
              )}
            </span>
            <span className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>

          {/* Stage-specific content — morphs as the journey advances. */}
          <div className="mt-4 min-h-[176px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stageKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {stage === 0 && <StageHint />}
                {stage === 1 && <PlanStage plan={demo.plan} revealed={planRevealed} />}
                {stage === 2 && <BuildStage built={built} />}
                {stage === 3 && (
                  <LaunchStage revealed={launchRevealed} live={live} domain={demo.domain} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stage views ────────────────────────────────────────────────────────────

function StageHint() {
  return (
    <div className="flex h-[176px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">
        wird zu
      </span>
      <span className="text-[13px] text-foreground/55">
        Plan → Bau-Paket → startklares Projekt
      </span>
    </div>
  );
}

function PlanStage({ plan, revealed }: { plan: string[][]; revealed: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
        Produktplan
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {plan.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              "flex items-baseline gap-3 transition-all duration-300",
              i < revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-accent-text">
              {label}
            </span>
            <span className="text-[13.5px] leading-snug text-foreground/80">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildStage({ built }: { built: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
        Dein Bau-Paket
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {OUTPUTS.map(({ Icon, label }, i) => {
          const lit = i < built;
          return (
            <div
              key={label}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-500",
                lit ? "border-accent/30 bg-accent-subtle" : "border-border bg-surface opacity-50"
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
  );
}

function LaunchStage({
  revealed,
  live,
  domain,
}: {
  revealed: number;
  live: boolean;
  domain: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
        Bereit zum Launch
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {LAUNCH_CHECKS.map((c, i) => {
          const ok = i < revealed;
          return (
            <div key={c} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                  ok ? "bg-success/20 text-success" : "bg-surface-hover text-foreground/30"
                )}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span
                className={cn(
                  "text-[13px] transition-colors duration-300",
                  ok ? "text-foreground/80" : "text-foreground/35"
                )}
              >
                {c}
              </span>
            </div>
          );
        })}

        {/* The deployed URL bar — the payoff. */}
        <div
          className={cn(
            "mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-500",
            live ? "border-accent/30 bg-accent-subtle" : "border-border bg-surface opacity-50"
          )}
        >
          <Globe className="h-3.5 w-3.5 shrink-0 text-accent-text" strokeWidth={1.8} />
          <span className="font-mono text-[12.5px] text-foreground/80">{domain}</span>
          {live && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.08em] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              live
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
