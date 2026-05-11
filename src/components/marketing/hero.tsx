"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 md:pt-40 pb-24 md:pb-32">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[480px] w-[820px] rounded-full bg-violet-500/20 blur-[120px] opacity-60" />
        <div className="absolute top-40 right-[10%] h-[320px] w-[320px] rounded-full bg-cyan-500/20 blur-[120px] opacity-50" />
        <div className="absolute top-60 left-[10%] h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-[120px] opacity-50" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] -z-10 grid-bg opacity-50" />

      <div className="container-x relative flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-violet-300" />
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/70">
              v2.0 Beta · Live
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-balance text-[44px] md:text-[68px] leading-[1.05] tracking-[-0.04em] font-semibold text-white max-w-4xl"
        >
          Turn rough ideas into{" "}
          <span className="gradient-text">build-ready prompts.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-2xl text-balance text-[17px] leading-[1.6] text-white/60"
        >
          Generate product briefs, PRDs, technical blueprints, and optimized prompts
          tailored for Claude, ChatGPT, Lovable, Cursor, Stitch, and more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-col sm:flex-row items-center gap-3"
        >
          <Button asChild size="lg" variant="primary">
            <Link href="/signup">
              Start Printing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="#example">See Example</Link>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-6 text-xs font-mono uppercase tracking-[0.08em] text-white/35"
        >
          Free tier · No credit card · Cancel anytime
        </motion.p>

        {/* Hero artifact: simulated output */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-5xl"
        >
          <HeroArtifact />
        </motion.div>
      </div>
    </section>
  );
}

function HeroArtifact() {
  return (
    <div className="relative gradient-border rounded-2xl">
      <div className="relative rounded-2xl glass-strong p-1.5 shadow-elevated">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/40">
            prompts/master.md
          </span>
          <span className="font-mono text-[11px] text-white/35">2.4kb · 0.8s</span>
        </div>

        {/* Body */}
        <div className="grid md:grid-cols-[1fr_2fr] gap-0">
          <div className="border-r border-white/[0.06] p-5 space-y-3 text-left">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/40 mb-1">
                Idea
              </div>
              <div className="text-[13px] text-white/85">
                A habit tracker that uses AI to suggest micro-rewards based on streak progress
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.05]">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/40 mb-2">
                Stack
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Next.js 15", "Supabase", "Stripe", "Claude 4.7"].map((s) => (
                  <span
                    key={s}
                    className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/70"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5 text-left font-mono text-[12.5px] leading-[1.65] text-white/70 overflow-hidden">
            <Line className="text-violet-300/90">{`# Master Prompt — Streak Coach`}</Line>
            <Line>{`You are an expert product engineer building a `}<em className="text-cyan-300 not-italic">streak-coach</em>{` mobile-first SaaS.`}</Line>
            <Line>{``}</Line>
            <Line className="text-white/45">{`## Product context`}</Line>
            <Line>{`- A habit tracker rewarding consistency`}</Line>
            <Line>{`- Personalized micro-rewards via Claude`}</Line>
            <Line>{`- Daily check-ins with progressive streak UI`}</Line>
            <Line>{``}</Line>
            <Line className="text-white/45">{`## Constraints`}</Line>
            <Line>{`- Mobile-first, dark by default`}</Line>
            <Line>{`- Supabase auth + RLS for user data`}</Line>
            <Line>{`- Stripe subscriptions ($0 / $9 / $19)`}</Line>
            <Line>{``}</Line>
            <Line className="text-white/45">{`## Output`}</Line>
            <Line className="text-violet-300/90">{`Plan → Schema → API → UI → Tests`}<span className="ml-1 inline-block h-3 w-1.5 bg-violet-300/80 align-middle animate-pulse" /></Line>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`whitespace-pre ${className}`}>{children}</div>;
}
