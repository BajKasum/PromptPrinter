"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "prd", label: "PRD" },
  { id: "master", label: "Master Prompt" },
  { id: "frontend", label: "Frontend Prompt" },
  { id: "schema", label: "Schema" },
];

const content: Record<string, string> = {
  prd: `# Streak Coach — Product Requirements

## Vision
A delightful habit tracker that uses AI to suggest personalized micro-rewards
based on a user's streak progress and behavior patterns.

## Target Audience
- Self-improvement enthusiasts (25-40)
- Knowledge workers building daily routines
- Existing Notion / Todoist users seeking gamification

## Success Metrics
- D7 retention ≥ 35%
- Avg active habits per user ≥ 3
- Free→Pro conversion ≥ 4%

## In-Scope
- Habit CRUD with daily check-in
- AI-generated reward suggestions (Claude)
- Streak visualization with progressive UI
- Stripe-backed subscription gating

## Out-of-Scope (v1)
- Social features
- Apple Health / Google Fit integration
- Native mobile apps`,
  master: `You are an expert full-stack product engineer building "Streak Coach" — an
AI-powered habit tracker. Your job is to deliver complete, production-ready
implementations one feature at a time.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Stripe subscriptions
- Anthropic Claude for reward suggestions

## Principles
1. Mobile-first, dark mode by default.
2. Server components by default; client only when needed.
3. Zod-validate every API boundary.
4. RLS policies on every table touching user data.

## Voice
Be terse. Show, don't tell. Ship code that runs.`,
  frontend: `Design a mobile-first dashboard for "Streak Coach" using Tailwind + shadcn/ui.

## Screens
1. Today — list of active habits with check-in tap targets
2. Habit detail — calendar heatmap + AI reward feed
3. Onboarding — 3-step wizard

## Design tokens
- Background: #0A0A0A
- Surface: rgba(255,255,255,0.04)
- Accent gradient: violet → cyan → blue
- Radius: 16-20px
- Type: Inter (UI), Geist Mono (data)

## Motion
- Use Framer Motion for streak counter increments.
- Stagger habits on load with 60ms intervals.`,
  schema: `-- users handled by Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily','weekly')),
  streak int not null default 0,
  created_at timestamptz default now()
);
create index habits_user_idx on public.habits(user_id);

alter table public.habits enable row level security;
create policy habits_owner on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`,
};

export function ExampleOutput() {
  const [active, setActive] = useState("prd");
  const text = content[active];

  return (
    <section id="example" className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            Example output
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Real artifacts, not lorem ipsum.
          </h2>
          <p className="mt-4 text-[17px] text-white/55">
            Here&apos;s a slice of what a single idea produces — every tab is generated, structured,
            and ready to paste into your assistant.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="gradient-border rounded-2xl">
          <div className="rounded-2xl glass-strong overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "relative px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors",
                    active === t.id ? "text-white" : "text-white/55 hover:text-white"
                  )}
                >
                  {active === t.id && (
                    <motion.span
                      layoutId="tab-bg"
                      className="absolute inset-0 rounded-md bg-white/[0.06] border border-white/[0.08]"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-[200px_1fr]">
              <aside className="border-r border-white/[0.06] p-5 hidden md:block">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/40 mb-3">
                  Outputs
                </div>
                <ul className="space-y-1.5 text-[13px]">
                  {tabs.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        "px-2 py-1 rounded-md transition-colors cursor-pointer",
                        active === t.id ? "bg-white/[0.04] text-white" : "text-white/55 hover:text-white"
                      )}
                      onClick={() => setActive(t.id)}
                    >
                      {t.label}
                    </li>
                  ))}
                </ul>
              </aside>
              <AnimatePresence mode="wait">
                <motion.pre
                  key={active}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 text-[12.5px] leading-[1.7] font-mono text-white/75 whitespace-pre-wrap overflow-x-auto max-h-[420px] overflow-y-auto"
                >
                  {text}
                </motion.pre>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
