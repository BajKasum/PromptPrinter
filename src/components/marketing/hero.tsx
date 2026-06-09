"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 md:pt-40 pb-24 md:pb-32">
      {/* Subtle grid backdrop — restrained, IDE-like. No glow. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] -z-10 grid-bg opacity-50" />

      <div className="container-x relative flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-accent-text" />
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-foreground/70">
              v2.0 Beta · Live
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-balance text-[44px] md:text-[68px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-4xl"
        >
          Aus rohen Ideen werden{" "}
          <span className="gradient-text">build-fertige Prompts.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-2xl text-balance text-[17px] leading-[1.6] text-foreground/60"
        >
          Generiere Produkt-Briefs, PRDs, technische Blueprints und optimierte Prompts —
          zugeschnitten auf Claude, ChatGPT, Lovable, Cursor, Stitch und mehr.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-col sm:flex-row items-center gap-3"
        >
          <Button asChild size="lg" variant="primary">
            <Link href="/signup">
              Jetzt starten
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
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-6 text-xs font-mono uppercase tracking-[0.08em] text-foreground/35"
        >
          Kostenlos starten · Keine Kreditkarte · Jederzeit kündbar
        </motion.p>

        {/* Hero demo: a prompt streaming together, live */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-5xl"
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}

type Tone = "accent" | "muted" | "default";

const STACK = ["Next.js 15", "Supabase", "Stripe", "Claude 4.7"];

const PROMPT_LINES: { text: ReactNode; tone?: Tone }[] = [
  { text: "# Master-Prompt — Streak Coach", tone: "accent" },
  {
    text: (
      <>
        Du bist ein erfahrener Produkt-Engineer und baust ein{" "}
        <em className="not-italic text-accent-text">streak-coach</em> mobile-first SaaS.
      </>
    ),
  },
  { text: "" },
  { text: "## Produkt-Kontext", tone: "muted" },
  { text: "- Ein Habit-Tracker, der Konsistenz belohnt" },
  { text: "- Personalisierte Mikro-Belohnungen über Claude" },
  { text: "- Tägliche Check-ins mit progressiver Streak-UI" },
  { text: "" },
  { text: "## Vorgaben", tone: "muted" },
  { text: "- Mobile-first, standardmässig dunkel" },
  { text: "- Supabase-Auth + RLS für Nutzerdaten" },
  { text: "- Stripe-Abos ($0 / $9 / $19)" },
  { text: "" },
  { text: "## Ausgabe", tone: "muted" },
  { text: "Plan → Schema → API → UI → Tests", tone: "accent" },
];

const TONE: Record<Tone, string> = {
  accent: "text-accent-text",
  muted: "text-foreground/45",
  default: "",
};

function HeroDemo() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });

  const total = PROMPT_LINES.length;
  const [revealed, setRevealed] = useState(reduce ? total : 0);
  const [done, setDone] = useState(reduce);
  const [cycle, setCycle] = useState(0);

  // Stream the prompt line by line, hold, then loop. Pauses when off-screen
  // and is skipped entirely when the user prefers reduced motion.
  useEffect(() => {
    if (reduce || !inView) return;
    setRevealed(0);
    setDone(false);
    let line = 0;
    let hold: ReturnType<typeof setTimeout>;
    const stream = setInterval(() => {
      line += 1;
      setRevealed(line);
      if (line >= total) {
        clearInterval(stream);
        setDone(true);
        hold = setTimeout(() => setCycle((c) => c + 1), 2800);
      }
    }, 150);
    return () => {
      clearInterval(stream);
      clearTimeout(hold);
    };
  }, [inView, reduce, cycle, total]);

  const cursorAt = reduce || done ? total - 1 : Math.max(0, revealed - 1);

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
            prompts/master.md
          </span>
          <span className="font-mono text-[11px]">
            {done ? (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <Check className="h-3 w-3" strokeWidth={2.4} />
                fertig · 2.4kb · 0.8s
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-foreground/45">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                generiert…
              </span>
            )}
          </span>
        </div>

        {/* Body */}
        <div className="grid md:grid-cols-[1fr_2fr] gap-0">
          <div className="border-r border-border p-5 space-y-3 text-left">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-1">
                Idee
              </div>
              <div className="text-[13px] text-foreground/85">
                Ein Habit-Tracker, der mit KI Mikro-Belohnungen basierend auf dem
                Streak-Fortschritt vorschlägt
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                Stack
              </div>
              <div key={cycle} className="flex flex-wrap gap-1.5">
                {STACK.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      "text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-surface border border-border text-foreground/70",
                      !reduce && "animate-fade-up"
                    )}
                    style={!reduce ? { animationDelay: `${i * 90}ms` } : undefined}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 text-left font-mono text-[12.5px] leading-[1.65] text-foreground/70 overflow-hidden">
            {PROMPT_LINES.map((l, i) => {
              const shown = reduce || i < revealed;
              return (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre transition-all duration-300 ease-out",
                    TONE[l.tone ?? "default"],
                    shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  )}
                >
                  {l.text === "" ? " " : l.text}
                  {i === cursorAt && shown && (
                    <span className="ml-0.5 inline-block h-3 w-1.5 align-middle bg-accent animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
