# PromptPrinter

> Verwandelt rohe Ideen in build-fertige **Prompt-Pakete** — Master-Prompt, PRD,
> Schema, API, UI, Tests — optimiert für Claude, ChatGPT, Lovable, Cursor, Stitch & Co.

SaaS-Tool für Developer und Vibe-Coder, die eine Idee schnell in ausführbare
Build-Instruktionen übersetzen wollen.

## Tech-Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Supabase** — Auth, Postgres, Row-Level-Security
- **Stripe** — Billing (UI gebaut, Checkout/Webhook in Arbeit)
- **Gemini** (`@google/genai`) — Prompt-Generierung; ohne Key läuft der Stub-Modus
- **Tailwind** mit HSL-Token-System · **Framer Motion** · **next-themes**
- **Vitest** für Unit-Tests · **Docker** für Dev (Hot-Reload) und Prod (standalone)

## Schnellstart

```bash
# 1. Abhängigkeiten
npm install

# 2. Env anlegen (siehe „Environment" unten)
cp .env.example .env.local
#   → NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY und SUPABASE_SERVICE_ROLE_KEY eintragen

# 3. Datenbank-Migrationen einspielen
#    Supabase SQL-Editor oder CLI — die Dateien in supabase/migrations/ der
#    Reihe nach (0001 → 0010).

# 4. Dev-Server
npm run dev          # http://localhost:3000
```

Ohne `GEMINI_API_KEY` antworten `/api/chat` und `/api/generate` im **Stub-Modus**
(die Prompt-Vorlagen werden unverändert zurückgegeben) — der ganze Flow bleibt
testbar, ohne API-Quota zu verbrauchen.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload |
| `npm run build` | Production-Build (standalone) |
| `npm run start` | Gebauten Build starten |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (Unit-Tests) |
| `node scripts/take-screenshots.mjs` | Screenshots aller Seiten (lokal, braucht Chrome) |

## Environment

Vorlage: [`.env.example`](.env.example). Welche Datei wo gelesen wird:

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker (`docker-compose.dev.yml`), Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.yml`, via `env_file`) |
| `.env.example` | nur Vorlage (committed) |

**Regel:** Secrets niemals mit `NEXT_PUBLIC_*` prefixen — die landen sonst im
Client-Bundle. Server-seitige Keys (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
`STRIPE_*`) bleiben ohne Prefix.

## Docker

Siehe [`DOCKER.md`](DOCKER.md) — Dev (Hot-Reload, Port 3000) und Prod (standalone,
Port 3001) als jeweils ein Befehl.

## Design

Siehe [`DESIGN.md`](DESIGN.md) — Token-System, Theme-Regeln, Komponenten-Status.

## Qualität

Vor jedem Commit muss das volle Gate grün sein:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

[CI](.github/workflows/ci.yml) (`.github/workflows/ci.yml`) führt genau dieselbe
Kette bei jedem Push und PR aus.

## Projektstruktur

```
src/
  app/            App-Router-Routen
    (app)/        eingeloggter Bereich (Dashboard, Chat, Projekte, Settings …)
    (auth)/       Login, Signup, Passwort-Reset
    api/          Route-Handler (chat, generate, account)
  components/     UI-, App-, Marketing-, Onboarding-Komponenten
  lib/            Supabase-Clients, Rate-Limit, Pläne, Zod-Schemas, Utils
  prompts/        Prompt-Vorlagen + System-Prompts pro Artefakt
supabase/
  migrations/     SQL-Schema (RLS, Grants, gehärtete Funktionen)
```
