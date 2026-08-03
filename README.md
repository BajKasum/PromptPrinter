# PromptPrinter

> Der KI-Chat, der deinen Stack schon kennt. Finn stellt die Rückfragen, die
> dein Bau-Tool nie stellt, und liefert dann den fertigen Prompt für Lovable,
> Cursor, v0, Claude Code, Bolt & Co.

SaaS-Tool für Vibe-Coder, die Prompts in KI-Bau-Tools füttern. Kernversprechen:
keine Credits verbrennen — die Vollständigkeits-Fragen (Ziel-Tool, Kern-Screens,
Datenmodell, Auth, Design-Richtung) kommen einmal vorher statt als drei
Nachbesserungs-Runden hinterher.

> **Hinweis (2026-08-03):** Dieser Abschnitt beschrieb bis eben noch
> „Prompt-Pakete, Master-Prompt, PRD, Schema, API, UI, Tests" — die
> Generierungs-Pipeline, die am 2026-07-17 ersatzlos entfernt wurde. Aufgefallen
> ist das ausgerechnet beim ersten echten Lauf des Projekt-Gedächtnisses gegen
> dieses Repo selbst: die Analyse fasste das Produkt korrekt so zusammen, wie
> die README es beschrieb, also falsch.

## Projekt-Gedächtnis (AI Project Brain)

Ein Projekt kann Dateien tragen (README, `package.json`, Lockfile, `tsconfig`,
`next.config`, SQL, API-Dokus, Screenshots) und ein öffentliches
GitHub-Repository. Einmal analysieren, und PromptPrinter kennt danach
Framework, Sprache, Architektur, Datenbank, Design-System, Coding-Style und
Konventionen — jeder Chat des Projekts trägt das automatisch mit, der Stack
muss nie wieder erklärt werden.

Der Kern ist die Ökonomie dahinter: die Rohdateien wanderten vorher bei *jedem*
Chat-Zug erneut in den Systemprompt, damit das Modell den Stack jedes Mal aufs
Neue ableitet. Jetzt passiert das einmal, und was mitreist, ist ein
2500-Zeichen-Block. Das Datei-Budget sinkt dadurch von 12000 auf 6000 Zeichen —
unterm Strich weniger Kontext pro Zug bei mehr Wissen.

- Analyse: [`src/server/brain/`](src/server/brain) (GitHub-Import, Destillation)
- Quellensammlung: [`src/features/projects/lib/brain-sources.ts`](src/features/projects/lib/brain-sources.ts)
- Injektion: [`src/features/projects/lib/project-context.ts`](src/features/projects/lib/project-context.ts)
- Route: `POST/DELETE /api/projects/[id]/brain`
- Tabelle: `project_brains` (Migration 0037), bewusst nur mit `select`-Grant —
  geschrieben wird ausschliesslich serverseitig, sonst könnte sich jeder sein
  „analysiertes" Ergebnis aus der Browser-Konsole schreiben.

**Keine Embeddings, bewusst.** Siehe [CLAUDE.md](CLAUDE.md) für die Begründung
und die Bedingung, unter der sich das ändern würde.

## Tech-Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Supabase**, Auth, Postgres, Row-Level-Security
- **Stripe**, Billing (UI gebaut, Checkout/Webhook in Arbeit)
- **Z.ai (GLM)**, Prompt-Generierung, Gemini als Zweit-Provider; ohne Key läuft der Stub-Modus
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
#    Supabase SQL-Editor oder CLI, die Dateien in supabase/migrations/ der
#    Reihe nach (0001 → 0038).

# 4. Dev-Server
npm run dev          # http://localhost:3000
```

Ohne `ZAI_API_KEY` (bzw. `GEMINI_API_KEY` als Zweit-Provider) antwortet
`/api/chat` im **Stub-Modus** (eine Demo-Antwort), der Flow bleibt testbar, ohne
API-Quota zu verbrauchen. Der Modellzugriff ist in
[`src/server/llm.ts`](src/server/llm.ts) gekapselt (Z.ai primär, Gemini
sekundär).

Die Gedächtnis-Analyse hat bewusst **keinen** Stub: eine erfundene Faktenliste
wäre schlimmer als gar keine, weil sie danach in jeden Prompt dieses Projekts
wandert. Ohne Provider-Key sagt sie ab, auch lokal.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload |
| `npm run build` | Production-Build (standalone) |
| `npm run start` | Gebauten Build starten |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (Unit-Tests) |
| `node scripts/take-screenshots.mjs` | Screenshots aller Seiten in Light+Dark → `screenshots_Docs/` (braucht laufenden Dev-Server, Chrome und `SCREENSHOT_EMAIL`/`SCREENSHOT_PASSWORD` in `.env.local`) |

## Environment

Vorlage: [`.env.example`](.env.example). Welche Datei wo gelesen wird:

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker (`docker-compose.yml`), Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.prod.yml`, via `env_file`) |
| `.env.example` | nur Vorlage (committed) |

**Regel:** Secrets niemals mit `NEXT_PUBLIC_*` prefixen, die landen sonst im
Client-Bundle. Server-seitige Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`,
`STRIPE_*`) bleiben ohne Prefix.

### Deploy-Checkliste

Diese sieben Variablen sind in Produktion **Pflicht**, nicht optional. Fehlt eine,
bricht der Start mit einer Meldung ab, die sie benennt (`src/lib/env.ts`, geprüft
beim Boot über `src/instrumentation.ts`):

| Variable | Warum sie load-bearing ist |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ohne Supabase keine Anmeldung, keine Daten |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dito |
| `SUPABASE_SERVICE_ROLE_KEY` | Kontolöschung (`/api/account`) braucht Admin-Rechte |
| `NEXT_PUBLIC_APP_URL` | Sonst verlinken Bestätigungs- und Reset-Mails auf `localhost:3000` |
| `API_KEY_ENCRYPTION_SECRET` | BYOK wirft beim Speichern eines eigenen Keys |
| `UPSTASH_REDIS_REST_URL` | **Ohne Upstash antworten ALLE API-Routen mit 429** |
| `UPSTASH_REDIS_REST_TOKEN` | dito |

Der Upstash-Punkt ist der unangenehmste: `src/server/security/rate-limit.ts` scheitert in
Produktion bewusst geschlossen, statt auf einen Limiter zurückzufallen, der über
mehrere Instanzen hinweg gar nichts mehr begrenzt. Der resultierende 429 sieht
nach Rate-Limit aus, nicht nach fehlender Konfiguration — deshalb der
Start-Abbruch statt einer stillen Fehlfunktion.

Ohne `ZAI_API_KEY`/`GEMINI_API_KEY` startet die App, warnt aber: der Chat läuft
dann im Stub-Modus und liefert eine Demo-Antwort statt einer echten.

## Docker

Siehe [`DOCKER.md`](docs/DOCKER.md), Dev (Hot-Reload, Port 3000) und Prod (standalone,
Port 3001) als jeweils ein Befehl.

## Design

Siehe [`DESIGN.md`](docs/DESIGN.md), Token-System, Theme-Regeln, Komponenten-Status.

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
