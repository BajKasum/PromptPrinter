# PromptPrinter

> Turn rough ideas into build-ready prompts. AI-powered SaaS that generates product briefs, PRDs, technical specifications, and optimized prompts for Claude, ChatGPT, Lovable, Cursor, Stitch, and more.

![status](https://img.shields.io/badge/status-beta-violet) ![next](https://img.shields.io/badge/Next.js-15-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue)

## Overview

PromptPrinter turns a one-line idea into a complete build packet:

- **Product Brief** — vision, audience, KPIs, risks
- **PRD** — scope, stories, acceptance criteria
- **Master Prompt** — tuned for Claude / ChatGPT / Gemini
- **Frontend Prompt** — tuned for Lovable / Stitch / Figma / v0
- **Backend Prompt** — tuned for Claude Code / Cursor / Windsurf
- **Database Schema** — production-ready SQL with RLS
- **Security Checklist** — OWASP-aligned, project-specific
- **Marketing Copy** — hero, features, emails
- **SEO Plan** — keywords, architecture, 30-day sprint
- **Deployment Guide** — provisioning, env, runbook

The UI was designed end-to-end with the [Stitch MCP](https://stitch.googleapis.com) (see the design system & screen reference inside the running Stitch project), then implemented faithfully in code.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui-style** primitives
- **Framer Motion** — page transitions, staggered reveals, micro-interactions
- **Supabase** — auth, Postgres, RLS, storage
- **Stripe** — subscriptions (Free / Pro / Team)
- **Anthropic Claude** (primary) and **OpenAI** (optional) for generation
- **Zod** + **React Hook Form** — validation everywhere

## Quickstart

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# ANTHROPIC_API_KEY (at minimum) — the rest are optional for local dev.

# 3. Run database migration
# In Supabase dashboard → SQL editor, paste & run:
#   supabase/migrations/0001_init.sql

# 4. Dev
npm run dev
# → http://localhost:3000
```

Without API keys configured, the app still runs — `/api/generate` returns the prompt templates themselves (useful for testing the UI flow).

## Project layout

```
src/
  app/
    (auth)/login|signup        — auth shell
    (app)/dashboard|projects|new|settings|billing
    api/generate               — POST endpoint (Zod + rate limit + Claude)
    auth/callback              — OAuth/magic-link callback
    page.tsx                   — landing
    features|pricing/page.tsx
  components/
    marketing/                 — landing + pricing + features sections
    app/                       — sidebar, topbar, wizard, project-tabs
    brand/logo.tsx             — double-P monogram
    motion/fade-in.tsx         — Framer Motion primitives
    ui/                        — button, card, input, label
    auth/auth-form.tsx
  lib/
    supabase/{client,server,middleware}.ts
    schemas.ts                 — Zod schemas
    rate-limit.ts              — in-memory limiter (swap for Upstash in prod)
    utils.ts                   — cn(), relativeTime(), downloadFile()
  prompts/                     — artifact prompt templates (one per output)
  middleware.ts                — Supabase session refresh + route guard
supabase/migrations/0001_init.sql
```

## Environment

See [`.env.example`](./.env.example). Server-only variables MUST NOT have the `NEXT_PUBLIC_` prefix.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for auth | from Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for auth | from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | for webhooks | server-only |
| `ANTHROPIC_API_KEY` | for real generation | server-only |
| `OPENAI_API_KEY` | optional | server-only |
| `STRIPE_SECRET_KEY` | for billing | server-only |
| `STRIPE_WEBHOOK_SECRET` | for billing | server-only |
| `STRIPE_PRICE_PRO_MONTHLY` | for billing | from Stripe dashboard |
| `STRIPE_PRICE_TEAM_MONTHLY` | for billing | from Stripe dashboard |

## Deployment

The app is deployment-target-agnostic; Vercel is the path of least resistance.

1. Push to a GitHub repo.
2. Import to Vercel — framework auto-detects.
3. Paste env vars (see above) in **Project Settings → Environment Variables**.
4. Run `supabase/migrations/0001_init.sql` in your Supabase project.
5. Add a Stripe webhook → `https://<domain>/api/stripe/webhook` (subscription events).
6. Smoke test: sign up → create project → generate.

## Scripts

```bash
npm run dev        # dev server (next dev)
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## License

MIT — see [LICENSE](./LICENSE).
