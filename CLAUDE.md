# CLAUDE.md — Projekt-Kontext für Claude-Code-Sessions

Diese Datei wird bei jedem Session-Start automatisch geladen. Sie soll dir
schnell Orientierung geben: was das Projekt ist, in welchem Zustand es steckt,
und nach welchen Regeln hier gearbeitet wird. Details stehen in [README.md](README.md),
[DESIGN.md](DESIGN.md) und [DOCKER.md](DOCKER.md) — hier nur das Wesentliche.

## Was ist PromptPrinter?

SaaS-Tool, das rohe Ideen in **build-fertige Prompt-Pakete** verwandelt —
optimiert für Claude, ChatGPT, Lovable, Cursor, Stitch & Co. Zielgruppe:
Developer und Vibe-Coder. Solo-/Indie-Projekt, ein Gründer.

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
- **Nach jeder abgeschlossenen Änderung committen + pushen** — nicht auf Aufforderung warten.
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

---

## Mascot-System — Finn

Finn ist das zentrale Markenmerkmal. Das vollständige Spec steht in [MASCOT.md](MASCOT.md).

**14 States:** `idle | welcoming | curious | listening | thinking | researching |
building | organizing | explaining | delivering | celebrating | helping | waiting | sad`

**Schlüssel-Komponenten:**
- `src/components/brand/mascot-states.ts` — State-Registry (Single Source of Truth)
- `src/components/brand/mascot.tsx` — Base-Komponente mit `state?` prop
- `src/components/brand/animated-mascot.tsx` — AnimatePresence-Crossfade + Idle-Loops
- `public/mascot/dolphin-<state>.png` — 16 Assets total (original 4 + 12 neue)

**Animations-Presets:** `float | lean | nod | think | bob | cheer | peek | sigh`
Alle reduced-motion-safe. Keyframe-Arrays brauchen `TargetAndTransition`-Typ, nicht `Target`.

**State-Zuordnung (Landing Page):**
- Hero-Intro: `welcoming`
- Hero-Demo-Narration: `curious → thinking → building → delivering` (je Stage)
- Problem: `sad`
- HowItWorks: `building`
- ExampleOutput: `delivering`
- Pricing: `helping`
- FinalCTA: `celebrating`
- Footer: idle (Base-PNG via `<Mascot>`)

**App-State-Zuordnung:**
- Chat-Empty-State: `curious`
- Loader (`dolphin-loader.tsx`): `waiting`
- Success-Celebration: `celebrating`
- Toast success/error: `celebrating` / `sad`
- 404/Error-Pages: `sad`
- `global-error.tsx`: NICHT angefasst (raw `<img>`, Root-Boundary)

---

## Landing Page — Aktueller Zustand

**Aktuelle Seiten-Reihenfolge** (`src/app/page.tsx`):
```
Navbar → Hero → Problem → HowItWorks → ExampleOutput → ProductShowcase →
Integrations → PricingPreview → FAQ → FinalCTA → Footer
```

**Entfernte Sektionen** (bewusst gelöscht, nicht wiederherstellen):
- `FeaturesGrid` — wiederholte dieselben 4 Outputs wie ExampleOutput. Unique Content
  (Sicherheit, Marketing, Deployment) wurde als neue ExampleOutput-Tabs bewahrt.
- `Capabilities` — früh entfernt (war Jargon-lastig)

> **Update:** `HowItWorks` wurde auf Nutzerwunsch wieder eingebunden (nach `Problem`,
> vor `ExampleOutput`) — schließt den Story-Flow (Schmerz → so gehen wir vor → echtes
> Ergebnis). Flache `card-surface`-Karten + `building`-Finn heben es klar von der
> glänzenden Hero-Demo ab; damit ist die ursprüngliche Redundanz aufgelöst.

**Sektion-Dateien:**
| Datei | Zustand | Finn |
|---|---|---|
| `hero.tsx` | Asymmetrisch: Finn + Sprechblase links, Headline+CTAs rechts. Darunter HeroDemo (Idea→Plan→Build→Launch mit Stage-Narration). | `welcoming` + Stage-States |
| `problem.tsx` | Litany-Format: Headline + 3 bare Schmerzzeilen in gedämpftem Typ. Kein Grid. | `sad` (klein, desktop-only) |
| `how-it-works.tsx` | 3-Schritt-Prozess (Idee → kurz klären → startklar) in flachen card-surface-Karten; Step 2 mit Chat-Bubble. Nach Problem, vor ExampleOutput. | `building` |
| `example-output.tsx` | 6 Tabs (a11y: tablist/tab/tabpanel, Keyboard-Nav): Produktplan / KI-Anweisungen / App-Design / Datenbank / Sicherheit / Marketing | `delivering` |
| `product-showcase.tsx` | Interaktive Workspace-Vorschau: Projects / Bibliothek / Generierungen | Kein Finn |
| `integrations.tsx` | Slim Strip: eine Zeile + 12 Tool-Pills | Kein Finn |
| `pricing-preview.tsx` | 3 Tiers: Free/$0 · Pro/$19 · Team/$49 | `helping` |
| `faq.tsx` | 6 Trust-Fragen, vollständig de-jargoned | Kein Finn |
| `final-cta.tsx` | Persönlicher Abschluss, "Den Rest mach ich mit dir." | `celebrating` |
| `footer.tsx` | Finn's Farewell: kleiner Finn + "Schön, dass du da warst. — Finn" + 5 echte Links | `idle` |
| `navbar.tsx` | Fix/blur-on-scroll, 2 Nav-Links: "Funktionen" (#example), "Preise" (#preise) | — |

**Navbar-Anchor:** `#funktionen` wurde zu `#example` geändert (FeaturesGrid-Entfernung).

**ExampleOutput-Tabs** (6 gesamt):
- Produktplan, KI-Anweisungen, App-Design, Datenbank — Original-4
- Sicherheit, Marketing — neu hinzugefügt beim FeaturesGrid-Merge

---

## Brand-Prinzipien (aus laufenden Design-Entscheidungen)

- **Finn spricht in Ich-Form** — alle Marketing-Copy ist in Finn's Stimme, nicht Corporate-Voice.
- **Kein Jargon in Marketing-Texten** — PRD, Blueprint, Schema, Long-Context, Artefakt,
  RLS sind aus allen Landing-Page-Texten gestrichen. Nur im App-UI und FAQ (wo Nutzer
  es erwarten) erlaubt.
- **Keine SaaS-Template-Muster** — kein Feature-Grid, keine nummerierten Karten,
  keine corporate Footer-Spalten, keine Status-Pulse-Indikatoren.
- **Whitespace ist Absicht** — Litany-Prinzip: weniger Struktur = mehr emotionaler Impact.
- **Finn reist durch die Seite** — welcoming → sad → delivering → helping → celebrating → idle.
  Er soll nicht als dekorativer Sticker wirken, sondern als Begleiter.
- **Footer = Finn's Abschluss** — die Seite beginnt mit Finn, sie endet mit Finn.

---

## Offene Punkte / Nächste Schritte

Noch nicht umgesetzt aus der Brand-Audit (Priorität absteigend):

1. **ProductShowcase** — Finn fehlt komplett in der längsten Sektion. "Alles, was wir
   zusammen bauen" ohne Finn im Raum ist ein Widerspruch. Idee: kleiner Finn im
   Mock-Sidebar oder als Avatar.
2. **Finn-Welt-Atmosphäre / Dark Mode** — Dark Mode wirkt kalt; der Charakter wirkt
   wie ein aufgeklebter Sticker auf einem generischen Canvas. Keine Verbindung zwischen
   Finn's Palette (Creme, Coral, Navy) und der Seiten-Palette.
3. **Integrations-Sektion** — Copy ist in Finn's Stimme, aber visuelle Shell ist noch
   generischer SaaS-Baustein (zentrierte Pill-Kapsel). Kein Finn.
4. **Sektions-Übergänge / Rhythmus** — alle Sektionen haben denselben `py-24/32`-Abstand,
   metronomischen Rhythmus. Keine dynamische Pacing. Litany bewies: engerer Beat = mehr Emotion.
5. **Mono-Eyebrow auf jeder Sektion** (`SCHAU ES DIR AN`, `DEIN ARBEITSPLATZ` etc.) —
   SaaS-Template-Konvention. Finn würde einfach reden, nicht labeln.

**Nicht anfassen (stabil, fertig):**
- Mascot-State-System und alle 16 Assets
- Hero-Demo (Idea→Plan→Build→Launch)
- ExampleOutput-Tabs (alle 6)
- Problem-Litany
- Footer (Finn's Farewell)
- Auth-Flow, DB-Migrationen, RLS-Policies
