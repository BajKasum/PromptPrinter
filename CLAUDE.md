# CLAUDE.md — Projekt-Kontext für Claude-Code-Sessions

Diese Datei wird bei jedem Session-Start automatisch geladen. Sie soll dir
schnell Orientierung geben: was das Projekt ist, in welchem Zustand es steckt,
und nach welchen Regeln hier gearbeitet wird. Details stehen in [README.md](README.md),
[DESIGN.md](DESIGN.md) und [DOCKER.md](DOCKER.md) — hier nur das Wesentliche.

## Was ist PromptPrinter?

SaaS-Tool, das rohe Ideen in **build-fertige Prompt-Pakete** verwandelt
(Master-Prompt, PRD, Schema, API, UI, Tests u.a.) — optimiert für Claude,
ChatGPT, Lovable, Cursor, Stitch & Co. Zielgruppe: Developer und Vibe-Coder.
Solo-/Indie-Projekt, ein Gründer.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Supabase
(Auth/DB/RLS) · Gemini (`@google/genai`) · Tailwind (HSL-Token-System) ·
Framer Motion · next-themes · Vitest · Docker.

## ⚠️ Wichtig zu wissen, bevor du loslegst

1. **Stub-Modus ist Absicht.** Es ist **kein `GEMINI_API_KEY` gesetzt** — bewusst,
   bis die App fertig ist. `/api/chat` und `/api/generate` fallen ohne Key auf
   Templates/Stub-Antworten zurück. **Nichts auf echten KI-Output ausrichten**,
   solange der Key fehlt.
2. **Zahlungen → Lemon Squeezy, aber erst später.** Bezahlung läuft künftig über
   **Lemon Squeezy** (nicht Stripe). Das passiert **erst, nachdem die Website
   gehostet ist** — vorher nicht anfangen. Im Code liegt noch Stripe-Gerüst
   (UI, `stripe`-Dep, DB-Spalten `stripe_*`); das wird ersetzt, nicht ausgebaut.
3. **Model-ID prüfen vor Go-Live.** Default ist `gemini-3.5-flash`
   (`GEMINI_MODEL`-überschreibbar). Vor dem Key-Flip gegen die aktuelle GA-API
   verifizieren.

## Befehle

```bash
npm run dev          # Dev-Server (http://localhost:3000)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run test         # vitest run
npm run build        # Production-Build (standalone)
```

**Quality-Gate — vor JEDEM Commit muss das komplett grün sein:**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Die [CI](.github/workflows/ci.yml) fährt dieselbe Kette bei jedem Push/PR.

## Arbeitsregeln (verbindlich)

- **Git-Staging immer explizit per Dateiname** — nie `git add .` / `git add -A`.
- **Gate vor jedem Commit** (siehe oben), alles grün.
- **Commit-Trailer:** `Co-Authored-By: Claude <aktuelles Modell> <noreply@anthropic.com>`.
- **Secrets nie mit `NEXT_PUBLIC_*`** prefixen — landen sonst im Client-Bundle.
  Server-Keys (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, …) ohne Prefix.
- **Keine rohen Hex-Farben** in Komponenten — nur semantische Token-Utilities
  (siehe [DESIGN.md](DESIGN.md)).
- **User-scoped Queries:** RLS scope + zusätzlich explizit `.eq("user_id", …)`
  (Defense-in-depth), v.a. wo Counts Limits durchsetzen.

## Env-Dateien

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker, Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.yml`) |
| `.env.example` | Vorlage (committed) |

`.env*` (außer `.example`) sind gitignored. Schema in [.env.example](.env.example).

## Struktur (Kurzform)

```
src/app/         Routen — (app) = eingeloggt, (auth) = Login/Signup, api/ = Handler
src/components/  ui / app / marketing / onboarding / brand / motion
src/lib/         Supabase-Clients, rate-limit, plans, Zod-schemas, utils
src/prompts/     Prompt-Vorlagen + System-Prompts pro Artefakt
supabase/migrations/  SQL — Schema, RLS, Grants, gehärtete Funktionen (0001→)
```

Sicherheits-Header sitzen in [next.config.ts](next.config.ts). Der DB-Layer
(RLS, Grants, `search_path`-Hardening) ist bewusst sorgfältig — beim Ändern den
Stil halten und neue Tabellen mit Policy + Grant versehen.
