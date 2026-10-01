# Setup, Betrieb und Aufbau

Für den Betreiber des Projekts. Die [Lizenz](../LICENSE) erlaubt anderen nur das
Ansehen des Codes, nicht das Ausführen. Was PromptPrinter ist und kann, steht
im [README](../README.md).

## Tech-Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Supabase**, Auth, Postgres, Row-Level-Security
- **Lemon Squeezy**, Billing (Checkout + Webhook live)
- **Z.ai (GLM)** als Standard-Modell, Gemini als Zweit-Provider, dazu eigene
  Keys der Nutzer (Anthropic, OpenAI, Gemini, OpenAI-kompatible Endpunkte);
  ohne Key läuft der Stub-Modus
- **Upstash Redis**, Rate-Limiting · **Vercel**, Hosting
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
#    Supabase SQL-Editor oder CLI, ALLE Dateien in supabase/migrations/ der
#    Reihe nach, von 0001 aufwärts (kein Endpunkt hier genannt, der sonst bei
#    jeder neuen Migration erneut veraltet, M-23 im Audit vom 06.09.2026).

# 4. Dev-Server
npm run dev          # http://localhost:3000
```

Ohne `ZAI_API_KEY` (bzw. `GEMINI_API_KEY` als Zweit-Provider) antwortet
`/api/chat` im **Stub-Modus** (eine Demo-Antwort), der Flow bleibt testbar, ohne
API-Quota zu verbrauchen. Der Modellzugriff ist in
[`src/server/llm.ts`](../src/server/llm.ts) gekapselt (Z.ai primär, Gemini
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

Vorlage: [`.env.example`](../.env.example). Welche Datei wo gelesen wird:

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker (`docker-compose.yml`), Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.prod.yml`, via `env_file`) |
| `.env.example` | nur Vorlage (committed) |

**Regel:** Secrets niemals mit `NEXT_PUBLIC_*` prefixen, die landen sonst im
Client-Bundle. Server-seitige Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`,
`LEMON_SQUEEZY_WEBHOOK_SECRET`) bleiben ohne Prefix.

### Deploy-Checkliste

Diese sieben Variablen sind in Produktion **Pflicht**, nicht optional. Fehlt eine,
bricht der Start mit einer Meldung ab, die sie benennt (`src/server/env.ts`, geprüft
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

Optional, aber für die Suche nützlich: `GOOGLE_SITE_VERIFICATION` und
`BING_SITE_VERIFICATION` (Inhaber-Nachweis für Search Console und Bing, siehe
`.env.example`).

## Docker

Siehe [`DOCKER.md`](DOCKER.md), Dev (Hot-Reload, Port 3000) und Prod (standalone,
Port 3001) als jeweils ein Befehl.

## Design

Siehe [`DESIGN.md`](DESIGN.md), Token-System, Theme-Regeln, Komponenten-Status.

## Qualität

Vor jedem Commit muss das volle Gate grün sein:

```bash
npm audit --audit-level=high && npm run typecheck && npm run lint && npm run test && npm run build
```

[CI](../.github/workflows/ci.yml) führt genau dieselbe Kette bei jedem Push auf
jeden Branch und bei jedem Pull Request aus.

## Projektstruktur

Details und Layer-Regeln: [CLAUDE.md](../CLAUDE.md).

```
src/
  app/            NUR Routing. (marketing) = öffentlich, (app) = eingeloggt,
                  (auth) = Login/Signup, api/ = Route-Handler.
  features/       Vertikale Schnitte, je components/ hooks/ lib/:
                  auth · chat · marketing · projects · prompts · settings
  shell/          App-Rahmen (Sidebar, Mobile-Nav, Command-Palette)
  server/         Nie im Browser (`import "server-only"`): security/, brain/,
                  http/, supabase/, llm.ts, env.ts, byok.ts
  shared/         Von überall nutzbar: ui/ brand/ motion/ providers/ lib/
tests/
  guards/         Repo-weite Invarianten (Kontrast, Schichtgrenzen, Routen, SEO, …)
supabase/
  migrations/     SQL-Schema (RLS, Grants, gehärtete Funktionen)
```

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

- Analyse: [`src/server/brain/`](../src/server/brain) (GitHub-Import, Destillation)
- Quellensammlung: [`src/features/projects/lib/brain-sources.ts`](../src/features/projects/lib/brain-sources.ts)
- Injektion: [`src/features/projects/lib/project-context.ts`](../src/features/projects/lib/project-context.ts)
- Route: `POST/DELETE /api/projects/[id]/brain`
- Tabelle: `project_brains` (Migration 0037), bewusst nur mit `select`-Grant —
  geschrieben wird ausschliesslich serverseitig, sonst könnte sich jeder sein
  „analysiertes" Ergebnis aus der Browser-Konsole schreiben.

**Keine Embeddings, bewusst.** Siehe [CLAUDE.md](../CLAUDE.md) für die Begründung
und die Bedingung, unter der sich das ändern würde.
