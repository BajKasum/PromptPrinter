"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";
import { cn } from "@/lib/utils";

// Spread across the whole hero, top to bottom, so both the intro mascot and
// the demo card below feel like they share the same drifting water.
const HERO_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "4%", left: "10%", size: 15, delay: 0, duration: 3.5 },
  { kind: "bubble", top: "8%", left: "88%", size: 20, delay: 0.6, duration: 4.8 },
  { kind: "star", top: "22%", left: "94%", size: 10, delay: 1.3, duration: 3.1 },
  { kind: "bubble", top: "38%", left: "4%", size: 16, delay: 0.3, duration: 4.4 },
  { kind: "star", top: "55%", left: "3%", size: 11, delay: 1.7, duration: 3.7 },
  { kind: "bubble", top: "68%", left: "95%", size: 24, delay: 0.9, duration: 5.2 },
  { kind: "star", top: "82%", left: "8%", size: 9, delay: 0.5, duration: 3.2 },
  { kind: "bubble", top: "92%", left: "90%", size: 17, delay: 1.1, duration: 4.6 },
];

export function Hero() {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="relative overflow-hidden pt-24 md:pt-36 pb-20 md:pb-32 focus:outline-none"
    >
      {/* Subtle grid backdrop, restrained, IDE-like. No glow. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] -z-10 grid-bg opacity-50" />
      <Floaters items={HERO_FLOATERS} />

      <div className="container-x relative z-10">
        {/* Finn is here and talking to you, the first guide on the page, not a
            logo in the corner. Asymmetric on purpose: he stands beside his words. */}
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:gap-12 md:text-left">
          <motion.div
            initial={{ opacity: 0, x: -16, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0"
          >
            <AnimatedMascot
              state="welcoming"
              motion="bob"
              size={216}
              priority
              className="[&_img]:h-[156px] [&_img]:w-[156px] md:[&_img]:h-[216px] md:[&_img]:w-[216px]"
            />
          </motion.div>

          <div className="max-w-2xl">
            {/* His opening line lives in a real speech bubble, Finn is speaking,
                with a tail pointing back at him (up on mobile, left on desktop). */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-5 inline-block rounded-2xl border border-border bg-surface px-5 py-3 md:py-3.5 text-left shadow-card"
            >
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-t border-border bg-surface md:hidden"
              />
              <span
                aria-hidden
                className="absolute left-0 top-8 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-border bg-surface md:block"
              />
              <p className="text-[15px] md:text-[16px] leading-snug text-foreground/90">
                Schön, dass du da bist. Ich bin{" "}
                <span className="font-semibold text-foreground">Finn</span>, dein Bau-Buddy.
              </p>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-balance text-[32px] md:text-[54px] leading-[1.08] md:leading-[1.05] tracking-[-0.04em] font-semibold text-foreground"
            >
              Erzähl mir deine Idee.{" "}
              <span className="text-accent-text">Ich bau den Plan mit dir.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 text-balance text-[18px] md:text-[21px] leading-[1.5] md:leading-[1.55] text-foreground/60"
            >
              Erzähl mir, was du bauen willst. Ich bereite dir den fertigen
              Prompt auf.
            </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start"
        >
          <Button asChild size="lg" variant="primary">
            <Link href="/signup">
              Leg mit Finn los
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="#produkt">Erst mal zuschauen</Link>
          </Button>
        </motion.div>
          </div>
        </div>

        {/* Hero demo: one idea walking the whole journey, live. */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-16 w-full max-w-4xl"
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────

type StageKey = "idea" | "clarify" | "prompt";
const STAGES: { key: StageKey; label: string }[] = [
  { key: "idea", label: "Idee" },
  { key: "clarify", label: "Rückfrage" },
  { key: "prompt", label: "Prompt" },
];

// Each demo is a real, plain-language idea that walks through what actually
// happens today: Finn asks only what this specific idea needs clarifying
// (here, one thing each), then delivers the finished, paste-ready prompt,
// tailored to the named target assistant. This mirrors src/prompts/system.ts's
// CHAT_SYSTEM_PROMPT (a bundled question covering only what applies, not a
// fixed checklist), not an invented pipeline.
const DEMOS = [
  {
    idea: "Airbnb für Hundesitter",
    target: "Lovable",
    question: "Für wen zuerst, Hundebesitzer oder Sitter?",
    answer: "Für Besitzer, die kurzfristig jemanden brauchen.",
    prompt: [
      "Rolle: erfahrener Product Engineer.",
      "Baue einen Marktplatz, der Hundebesitzer mit",
      "verfügbaren Sittern in der Nähe verbindet.",
      "Kernfunktionen: Suche, Buchung, Bezahlung,",
      "Bewertungen nach dem Termin.",
      "Zielgruppe: Besitzer, die kurzfristig",
      "Betreuung suchen.",
    ],
  },
  {
    idea: "KI-Habit-Tracker mit Streaks",
    target: "Claude",
    question: "Sollen die KI-Anstupser eher locker-witzig oder ernsthaft-coachig klingen?",
    answer: "Locker und ein bisschen witzig.",
    prompt: [
      "Rolle: Produkt-Coach, locker und ein",
      "bisschen witzig im Ton.",
      "Baue eine Habit-Tracking-App mit Streaks",
      "und kurzen KI-Anstupsern nach jedem Check-in.",
      "Kernfunktionen: Habits anlegen, tägliche",
      "Check-ins, Streak-Zähler, Mikro-Belohnungen.",
    ],
  },
  {
    idea: "Marktplatz für lokale Künstler",
    target: "ChatGPT",
    question: "Verkaufen die Künstler direkt in der App, oder erstmal nur ein Schaufenster?",
    answer: "Erstmal nur Schaufenster, Verkauf kommt später.",
    prompt: [
      "Rolle: erfahrener Product Engineer.",
      "Baue ein Schaufenster für lokale Künstler,",
      "noch ohne eingebauten Checkout.",
      "Kernfunktionen: Profile, Werk-Galerien,",
      "Entdecken-Feed nach Stadt.",
      "Zielgruppe: lokale Künstler und ihre",
      "Sammler.",
    ],
  },
];

const NARRATION: Record<StageKey, { state: MascotState; line: string }> = {
  idea: { state: "curious", line: "Erzähl mir, was du bauen willst …" },
  clarify: { state: "listening", line: "Nur kurz nachgefragt, damit's wirklich passt …" },
  prompt: { state: "delivering", line: "Fertig, kopier ihn dir direkt …" },
};

// ── Demo component ─────────────────────────────────────────────────────────

function HeroDemo() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });

  const [demoIndex, setDemoIndex] = useState(0);
  const [stage, setStage] = useState(0); // 0..2
  const [typed, setTyped] = useState(0); // chars of idea
  const [clarifyRevealed, setClarifyRevealed] = useState(0); // 0 none, 1 question, 2 +answer
  const [promptRevealed, setPromptRevealed] = useState(0); // lines of the prompt
  const [copied, setCopied] = useState(false);

  const demo = DEMOS[demoIndex];
  const stageKey = STAGES[stage].key;

  // One scripted cycle: type the idea → Finn asks, the user answers → the
  // finished prompt reveals line by line → auto-"copied" → hold → next idea.
  // Pauses off-screen; reduced motion shows the finished, copied prompt, no
  // loop.
  useEffect(() => {
    if (reduce) {
      setStage(2);
      setTyped(DEMOS[demoIndex].idea.length);
      setClarifyRevealed(2);
      setPromptRevealed(DEMOS[demoIndex].prompt.length);
      setCopied(true);
      return;
    }
    if (!inView) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const current = DEMOS[demoIndex];

    setStage(0);
    setTyped(0);
    setClarifyRevealed(0);
    setPromptRevealed(0);
    setCopied(false);

    // Stage 1, Idea: type it out.
    for (let i = 1; i <= current.idea.length; i++) at(i * 45, () => setTyped(i));
    let t = current.idea.length * 45 + 700;

    // Stage 2, Rückfrage: Finn asks, then the user answers.
    at(t, () => setStage(1));
    at(t + 500, () => setClarifyRevealed(1));
    at(t + 1500, () => setClarifyRevealed(2));
    t += 2400;

    // Stage 3, Prompt: reveal it line by line, then "copy" it.
    at(t, () => setStage(2));
    for (let i = 1; i <= current.prompt.length; i++) at(t + i * 260, () => setPromptRevealed(i));
    t += current.prompt.length * 260 + 500;
    at(t, () => setCopied(true));

    // Hold the copied state, then move to the next idea.
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
          <span className="font-mono text-[11px]">
            {copied ? (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <Check className="h-3 w-3" strokeWidth={2.4} />
                kopiert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-foreground/45">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Schritt {stage + 1}/3
              </span>
            )}
          </span>
        </div>

        {/* Active stepper, the real journey, visibly progressing. */}
        <div className="flex items-center gap-1.5 px-4 md:px-6 pt-4">
          {STAGES.map((s, i) => {
            const done = i < stage || (i === stage && copied && i === STAGES.length - 1);
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
          {/* Finn narrates the current stage, reacts as the work happens. */}
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

          {/* The idea stays pinned at the top, it's the thread through every stage. */}
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
            Deine Idee
          </div>
          <div className="flex select-none items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
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

          {/* Stage-specific content, morphs as the journey advances. */}
          <div className="mt-4 min-h-[200px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stageKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {stage === 0 && <StageHint />}
                {stage === 1 && (
                  <ClarifyStage
                    question={demo.question}
                    answer={demo.answer}
                    revealed={clarifyRevealed}
                  />
                )}
                {stage === 2 && (
                  <PromptStage
                    lines={demo.prompt}
                    target={demo.target}
                    revealed={promptRevealed}
                    copied={copied}
                  />
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
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">
        wird zu
      </span>
      <span className="text-[13px] text-foreground/55">Eine Rückfrage → dein fertiger Prompt</span>
    </div>
  );
}

function ClarifyStage({
  question,
  answer,
  revealed,
}: {
  question: string;
  answer: string;
  revealed: number;
}) {
  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-snug text-foreground/85 transition-all duration-300",
          revealed >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        {question}
      </div>
      <div
        className={cn(
          "ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-accent/25 bg-accent-subtle px-3.5 py-2.5 text-[13px] leading-snug text-foreground/85 transition-all duration-300",
          revealed >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        {answer}
      </div>
    </div>
  );
}

// Mirrors chat-markdown.tsx's real CodeBlock chrome (label left, copy button
// right) on purpose, so this demo doubles as an honest preview of the actual
// chat UI, not a separate invented mockup.
function PromptStage({
  lines,
  target,
  revealed,
  copied,
}: {
  lines: string[];
  target: string;
  revealed: number;
  copied: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/45">
            Prompt
          </span>
          <span className="rounded-full border border-accent/25 bg-accent-subtle px-2 py-0.5 text-[10.5px] text-accent-text">
            Für {target}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11.5px] transition-colors duration-300",
            copied ? "text-success" : "text-foreground/40"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2.6} />
              Kopiert
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" strokeWidth={2} />
              Prompt kopieren
            </>
          )}
        </span>
      </div>
      <div className="space-y-1 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground/80">
        {lines.map((line, i) => (
          <div
            key={line}
            className={cn(
              "transition-all duration-300",
              i < revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
