import Link from "next/link";
import { ArrowLeft, Sparkles, GitBranch, Clock } from "lucide-react";
import { ProjectTabs, type ProjectOutputs } from "@/components/app/project-tabs";
import { FadeIn } from "@/components/motion/fade-in";

// In real implementation, fetch from Supabase by params.id
function getSampleOutputs(id: string): { name: string; outputs: ProjectOutputs } {
  return {
    name: "Streak Coach",
    outputs: {
      overview: `# Streak Coach — Overview

**ID** ${id}
**Status** Ready  •  **Outputs** 10/10  •  **Last updated** just now

## TL;DR
An AI-coached habit tracker that uses Claude to generate personalized micro-rewards
based on streak progress and behavioral patterns. Built mobile-first on Next.js 15
with a Supabase backend and Stripe-gated Pro features.

## Architecture sketch
\`\`\`
[Next.js App Router] ──▶ [Supabase Auth + Postgres + RLS]
        │
        ├─▶ [Anthropic Claude] — reward generation
        ├─▶ [Stripe]            — subscriptions
        └─▶ [Vercel Edge]       — CDN + edge runtime
\`\`\`

## Where to go next
- **Master Prompt** — paste into Claude to start scaffolding
- **Database Schema** — run in Supabase SQL editor first
- **Frontend Prompt** — drop into Lovable or v0
`,
      brief: `# Product Brief — Streak Coach

**Vision** A delightful daily habit tracker that uses AI to keep users emotionally
invested in their streaks through personalized micro-rewards.

**Target user**
- Self-improvement enthusiasts, 25–40
- Knowledge workers building routines
- Users who churned from Notion / Todoist habit setups

**Key differentiation**
- AI-generated rewards (not static lists)
- Streak visualization that feels alive
- One-tap daily check-ins, mobile-first

**KPIs**
- D7 retention ≥ 35%
- Avg active habits per user ≥ 3
- Free → Pro conversion ≥ 4%

**Risks**
- AI reward suggestions feeling generic — mitigated by training on user history
- Free tier abuse — mitigated by 3-habit cap + daily generation budget
`,
      prd: `# PRD — Streak Coach

## 1. Scope (v1)
- Habit CRUD with daily check-in
- AI-generated reward suggestions on streak milestones (Claude)
- Streak heatmap visualization
- Stripe subscriptions ($0 / $9 Pro / $19 Pro+)

## 2. User stories
- As a user, I can create up to 3 habits on the free tier.
- As a user, I check in once per day per habit; the UI confirms with motion.
- As a Pro user, I receive an AI-generated reward suggestion every 7-day streak.
- As a user, I see a heatmap of my last 90 days per habit.

## 3. Out-of-scope (v1)
- Social features
- Apple Health / Google Fit
- Native mobile apps

## 4. Acceptance criteria
- Time-to-first-check-in < 30 seconds from signup
- Reward generation P95 < 6 seconds
- Stripe subscription state reconciled within 60 seconds of webhook
`,
      master: `# Master Prompt (target: Claude 4.7)

You are an expert full-stack engineer building Streak Coach — an AI-coached habit
tracker. Operate as a senior implementer; ask before changing scope.

## Stack
- Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Stripe subscriptions
- Anthropic Claude (reward generation)

## Principles
1. Mobile-first, dark by default.
2. Server components by default; client only when needed.
3. Zod-validate every API boundary.
4. RLS on every user-touching table.
5. Never log secrets or PII.

## Tone
Be terse. Show, don't tell. Ship code that runs on the first try.`,
      frontend: `# Frontend Prompt (target: Lovable)

Build a mobile-first React UI for Streak Coach using Tailwind and shadcn/ui.

## Screens
1. **Today** — list of active habits with one-tap check-in
2. **Habit detail** — 90-day heatmap + AI reward feed
3. **Onboarding** — 3-step wizard
4. **Settings** — plan, notifications, theme

## Design tokens
- Background: #0A0A0A
- Surface: rgba(255,255,255,0.04)
- Accent gradient: #7C3AED → #06B6D4 → #3B82F6
- Radius: 16-20px
- Type: Inter (UI) + Geist Mono (data labels)

## Motion
- Use Framer Motion for streak counter increments
- Stagger habits on load (60ms intervals)
- Reward reveal: scale 0.96 → 1, opacity 0 → 1, 400ms ease-out`,
      backend: `# Backend Prompt (target: Claude Code)

Implement the Streak Coach API as Next.js App Router route handlers.

## Endpoints
- POST   /api/habits              — create
- GET    /api/habits              — list (user-scoped)
- PATCH  /api/habits/:id          — update
- DELETE /api/habits/:id          — delete
- POST   /api/habits/:id/checkin  — daily check-in
- POST   /api/rewards/generate    — Claude-backed reward generation

## Rules
- Zod schemas in /src/schemas; validate at the route boundary.
- Use the Supabase server client for DB access; trust RLS over manual checks.
- Rate limit /api/rewards/generate to 20/min/user via Upstash Redis.
- Return RFC 7807 problem+json on errors.`,
      schema: `-- Supabase migration
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text not null default 'free',
  created_at timestamptz default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily','weekly')),
  streak int not null default 0,
  longest_streak int not null default 0,
  last_check_in date,
  created_at timestamptz default now()
);
create index habits_user_idx on public.habits(user_id);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz default now(),
  unique (habit_id, day)
);
create index check_ins_habit_idx on public.check_ins(habit_id);

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.check_ins enable row level security;

create policy profiles_owner on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy habits_owner on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy check_ins_owner on public.check_ins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`,
      security: `# Security Checklist

## Auth
- [x] Supabase magic-link or password (min 8 chars)
- [x] PKCE flow for OAuth providers
- [x] Refresh tokens rotated server-side

## RLS
- [x] All user tables have RLS enabled
- [x] Policies tested with at least 2 user contexts

## Secrets
- [x] No NEXT_PUBLIC_ prefix on server secrets
- [x] .env in .gitignore
- [x] Stripe webhook secret verified

## Input
- [x] Zod schemas at every API boundary
- [x] Rate limits on AI endpoints
- [x] CSRF: SameSite=Lax cookies + same-origin check on mutations

## Output
- [x] No PII in logs
- [x] Responses sanitized when echoing user content`,
      marketing: `# Marketing Copy — Streak Coach

## Hero
**Headline:** Stay on streak. The AI does the cheerleading.
**Sub:** A habit tracker that rewards your consistency with personalized,
AI-generated micro-rewards — so the routine actually sticks.

## Features (3 pillars)
1. **Streaks that feel alive** — A heatmap that updates the moment you tap.
2. **Rewards tailored to you** — Claude reads your patterns and writes back.
3. **One tap a day** — Mobile-first; gone in 5 seconds, back tomorrow.

## Email subject lines
- "Day 7 — here's a small thing you earned 🎯"
- "Your streak is two days from a record"
- "Welcome to Streak Coach — let's build today"`,
      seo: `# SEO Plan — Streak Coach

## Primary keywords
- "habit tracker app"
- "ai habit tracker"
- "streak app"
- "best habit tracker 2026"

## Long-tail / intent
- "habit tracker that rewards you"
- "daily streak habit tracker iOS"
- "alternative to Streaks app"

## Page architecture
- / (hero, features, pricing) — primary
- /habits/[slug] — landing pages per habit type (read 30 min/day, hydrate, etc.)
- /blog — weekly post on habit science + product

## 30-day content sprint
- Week 1: "Why streaks work (and where they break)"
- Week 2: "AI vs static rewards — what we learned"
- Week 3: "The 5 habits our users actually keep"
- Week 4: "Mobile-first habit UI — a teardown"`,
      deployment: `# Deployment Guide

## 1. Provisioning
- **Vercel** project pointing at the GitHub repo (production = \`main\`)
- **Supabase** project (region matched to majority of users)
- **Stripe** account with the three price IDs created

## 2. Environment
Copy \`.env.example\` to Vercel project settings:
- \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`SUPABASE_SERVICE_ROLE_KEY\` (server only)
- \`ANTHROPIC_API_KEY\`
- \`STRIPE_SECRET_KEY\`, \`STRIPE_WEBHOOK_SECRET\`
- \`STRIPE_PRICE_PRO_MONTHLY\`, \`STRIPE_PRICE_TEAM_MONTHLY\`

## 3. Migrations
Run \`supabase/migrations/0001_init.sql\` against your project via the SQL editor
or \`supabase db push\`.

## 4. Webhook
Add a Stripe webhook → \`https://<your-domain>/api/stripe/webhook\` with these
events: \`customer.subscription.{created,updated,deleted}\`, \`invoice.paid\`.

## 5. Smoke test
- Sign up
- Create one habit
- Check in once
- Generate a reward (Pro flow)
- Subscribe / cancel in Stripe test mode`,
    },
  };
}

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  return { title: `Project ${id}` };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { name, outputs } = getSampleOutputs(id);

  return (
    <div className="max-w-[1200px]">
      <FadeIn>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300 mb-2">
                <Sparkles className="h-3 w-3" />
                Build packet
              </div>
              <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
                {name}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {id}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Updated just now
              </span>
            </div>
          </div>
        </div>
      </FadeIn>
      <ProjectTabs projectName={name} outputs={outputs} />
    </div>
  );
}
