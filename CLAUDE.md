# CLAUDE.md, Projekt-Kontext für Claude-Code-Sessions

Diese Datei wird bei jedem Session-Start automatisch geladen. Sie soll dir
schnell Orientierung geben: was das Projekt ist, in welchem Zustand es steckt,
und nach welchen Regeln hier gearbeitet wird. Details stehen in [README.md](README.md),
[DESIGN.md](DESIGN.md) und [DOCKER.md](DOCKER.md), hier nur das Wesentliche.

> ⚠️ **Workspace-Redesign (2026-07): Phasen 1-4 + Wahrheits-Pass umgesetzt.**
> [REDESIGN.md](REDESIGN.md) ist das **verbindliche Zielmodell** und bleibt die
> Detailquelle (Datenmodell, Kontext-Injektions-Budget, offene Nachschritte).
> Kurzfassung des IST-Zustands:
>
> - **Nav zweigliedrig** (Chats/Projekte, kein „Start"), Sidebar einklappbar
>   (Cookie `pp-sidebar`, `Strg/⌘+B`) mit Recents. Login landet auf `/chats/new`.
> - **Eine Chat-Erfahrung**, keine Modus-Wahl (`conversations.mode` nur noch
>   intern). Kanonische Routen `/chats/new` + `/chats/[id]`; `/chat` und
>   `/dashboard` sind reine Redirects.
> - **Projekte sind Workspaces**: direkt anlegbar (`POST /api/projects`),
>   persistente Shell (`projects/[id]/layout.tsx`) mit Kontext-Rail
>   (Anweisungen, Struktur, Dateien, Ergebnisse-Karte), Hauptspalte wechselt
>   per Subroute (Übersicht, `chats/[cid]`, `results`). Mehrere Chats pro
>   Projekt.
> - **Produktionsweg entfernt (2026-07-16, siehe „Handoff entfernt" unten)**:
>   ~~jeder Projekt-Chat kann direkt ein Ergebnis erzeugen~~, das war der
>   Stand bis zur Entfernung der Handoff-Funktion. `/api/generate` existiert
>   weiter als Route, wird aber von keiner UI mehr aufgerufen.
> - **Dateien**: `project_files`-Tabelle + privater `project-files`-Bucket,
>   Upload/Löschen in der Rail, Allowlist `.md/.txt/.json/.csv`, max. 10 à
>   200 KB. `buildProjectContext` injiziert Anweisungen → Struktur → Dateien
>   → Idee/Artefakt, mit Budget (Details: REDESIGN.md §7).
> - **Wahrheits-Pass erledigt**: Landing (`ProductShowcase`) zeigt die echte
>   Nav ohne Modus-Badges, Settings-Copy korrigiert, toter Code
>   (`ProjectCard`-Komponente) entfernt.
>
> **Nachschritt erledigt:** „In Projekt verschieben" für bestehende globale
> Chats, Icon-Button in `chat-list.tsx` (nur global) öffnet einen
> Projekt-Picker (`move-to-project.tsx`), setzt `conversations.project_id`
> per RLS-scoped Client-Update, kein neuer API-Endpunkt.
>
> Offen, bewusst zurückgestellt: Settings-Tool-Defaults behalten-oder-
> streichen (Grundsatzfrage, kein bekannter Bruch).
> `buildProjectContext` injiziert Dateien jetzt nach Struktur, vor Idee/
> Artefakt: `.md` zuerst, Gesamtbudget 12.000 Zeichen, 3.000 pro Datei
> (Kostenpass 2026-07, siehe unten), nicht injizierte Dateien werden nur
> namentlich erwähnt. Projekt-Löschen räumt jetzt auch die Storage-Objekte
> auf (kein Leak).
>
> **Kostenpass (2026-07):** Default-Modell auf `glm-4.5-air` gesenkt (6×/3,6×
> günstiger als `glm-5-turbo` bei Input/Output, live gegen den Account
> geprüft), `DEFAULT_MAX_OUTPUT_TOKENS` 8192→6144, Chat trimmt die an das
> Modell gesendete Historie auf die letzten 12 Nachrichten (gespeichert wird
> weiterhin die volle Transkript), Projektkontext-Budgets in `buildProjectContext`
> halbiert (Dateien, Anweisungen, Idee, Artefakt-Referenz). Reine Parameter-
> optimierung, keine Produktänderung, Details in `src/lib/llm.ts` und
> `src/app/api/chat/route.ts`.
>
> **Kritik-Pass + BYOK + Refactoring (2026-07):** Auf Bitte um eine schonungslos
> kritische Bewertung der App als neuer Nutzer entstand eine lange Liste
> echter Lücken, alle abgearbeitet (Commits `977474a`..`bb923eb`):
>
> - **BYOK ist jetzt real, nicht nur versprochen** (`3a8f1b8`): Nutzer
>   hinterlegen in Settings (`api-keys.tsx`) eigene Anthropic-/OpenAI-/
>   Gemini-Keys, `POST/DELETE /api/settings/api-key`, AES-256-GCM-
>   verschlüsselt (`src/lib/crypto.ts` + Server-Secret
>   `API_KEY_ENCRYPTION_SECRET`, siehe `.env.example`), Tabelle
>   `user_api_keys` (Migration `0015_user_api_keys.sql`, **live gegen die
>   Supabase-DB angewendet**, nicht nur lokal committed). `llm.ts` kennt
>   jetzt 4 Provider: Z.ai (Server-Default), Gemini (Server-Zweit), Anthropic
>   + OpenAI (nur BYOK, kein Server-Key dafür vorgesehen). Ein eigener Key
>   übersteuert den Server-Key komplett und hebt sowohl das Generierungen- als
>   auch das Chat-Nachrichten-Limit auf (der Nutzer zahlt dann selbst).
> - **PDF-Export** für Pro eingelöst (`jspdf`, `src/lib/pdf-export.ts`);
>   „Priorisierte Warteschlange" (nie gebaut) aus dem Pricing gestrichen.
> - **Chat-Kostenrisiko geschlossen** (`826b753`): `/api/chat` hatte kein
>   Plan-Limit, nur den 120/h-Ratelimit, theoretisch ~86k Nachrichten/Monat
>   auf dem Server-Key. Jetzt `chatMessages` in `plans.ts` (Free 200/Monat,
>   Pro/Team 2000/Monat), BYOK hebt es auf, Anzeige in Settings + Billing.
> - **Datenschutzerklärung korrigiert** (`977474a`): nannte nur Google Gemini
>   als Auftragsbearbeiter, tatsächlich läuft die Generierung primär über
>   Z.ai, China als Drittland ergänzt (Standardvertragsklauseln statt
>   EU-US Data Privacy Framework, da kein Angemessenheitsbeschluss besteht).
> - **Zwei God-Objekte aufgelöst**, reine Verhalten-erhaltende Refactorings,
>   keine Logik-/Optikänderung: `api/generate/route.ts` 375→~130 Zeilen
>   (`b0975d3`, → `lib/generate-guards.ts`, `build-generate-content.ts`,
>   `run-generation.ts`, `persist-generation.ts`, geteiltes `lib/api-problem.ts`
>   jetzt auch von `api/chat/route.ts` genutzt, vorher zwei divergierende
>   Kopien); `chat.tsx` 667→260 Zeilen (`bb923eb`, → `chat-markdown.tsx`,
>   `chat-empty-state.tsx`, `chat-result-panel.tsx`, `chat-transcript.tsx`,
>   `chat-handoff-menu.tsx`, `chat-composer.tsx`, `lib/chat-variants.ts`,
>   `lib/use-copy-to-clipboard.ts`).
> - **Sidebar umgebaut** (`f453b81`): Pillen-Umschalter Chat/Projekt (nur eine
>   Liste sichtbar, routegetrieben über `pathname`) statt beide Listen
>   dauerhaft übereinander. Desktop (`sidebar.tsx`) und Mobile-Drawer
>   (`mobile-nav.tsx`, `4dc716f`) teilen sich seither `ACTIVE_ROW`/
>   `INACTIVE_ROW`/`TabSwitcher` aus `sidebar.tsx`, statt zweier Kopien, die
>   auseinanderdriften können. ⌘K durchsucht jetzt auch Chats (`64ec1cb`).
> - **Kleinere Fixes:** Navbar-Wortmarke zweifarbig + kollabiert beim
>   Scrollen (synchron mit dem 8px-Pillen-Trigger), Signup zeigt AGB/
>   Datenschutz-Hinweis + natives `minlength=8`, Hero-Demo-Fenster sagt
>   „· Demo" (sah wie ein echtes Eingabefeld aus), Stub-Antworten ohne
>   Entwickler-Jargon (kein „.env.local" mehr Richtung Endnutzer), FAQ
>   „Ist meine Idee sicher?" nennt jetzt den KI-Anbieter.
>
> **Rechtstexte ausgefüllt (2026-07-16):** [`src/lib/legal.ts`](src/lib/legal.ts)
> trägt jetzt echte Angaben (Kasum Bajrami, Riehenstrasse 80, 4058 Basel,
> Gerichtsstand Basel-Stadt, Privatperson ⇒ `companyId` bleibt leer). Vor dem
> Eintragen wurde der Nutzer explizit gefragt und hingewiesen, dass das Repo
> öffentlich ist und die Adresse damit dauerhaft in der Git-Historie steht,
> er hat sich bewusst für die echte Adresse entschieden. Impressum/AGB/
> Datenschutz sind damit inhaltlich vollständig. Einzig offen: `appHost`
> bleibt Platzhalter, bis die Hosting-Entscheidung gefallen ist (Punkt 2
> oben), das ist beabsichtigt, kein Versehen. Alles andere aus dem
> Kritik-Pass ist erledigt, keine bekannten offenen Findings mehr aus
> dieser Runde.
>
> **Landing-Aufräumung (2026-07-16):** Auf Zuruf aus Live-Screenshots drei
> Sektionen entschlackt (`499208c`): Trust-Badge-Zeile aus dem Hero raus
> (SaaS-Klischee), ExampleOutput-Header von Headline+Subtext+Zitat-Bubble+Finn
> auf Headline + eine Zeile gekürzt, Integrations-Pills von 12 auf die 8 am
> ehesten erkennbaren Tools reduziert. Danach (`df538a1`): **Problem-Sektion
> komplett entfernt** (Komponente gelöscht, nicht mehr in `page.tsx`, war
> zuvor als „nicht anfassen" markiert, jetzt überholt) und die
> ProductShowcase-Mini-Sidebar zeigte noch das Vor-Redesign-Muster (gestapelte
> Chats/Projekte-Zeilen + fixer „+ Neuer Chat"-Button); jetzt auf denselben
> Pillen-Umschalter wie die echte Sidebar umgestellt (`NavSwitcher`,
> singuläre Labels „Chat"/„Projekt"), Desktop und Mobile teilen sich die
> Komponente. Danach (`ed9ebee`): **`ExampleOutput` und `Integrations`
> ebenfalls komplett entfernt**, auf Nutzerwunsch, beide Komponenten
> gelöscht (nicht nur die Landing Page, auch `/features` nutzte beide und
> ist live via Footer-Link + Sitemap). Anchor-Links, die auf `#example`
> zeigten (Navbar „Funktionen", Hero-CTA „Erst mal zuschauen"), zeigen jetzt
> auf `#produkt` (ProductShowcase, das einzige verbleibende Proof-Element
> auf der Landing Page). Die untenstehenden Landing-Page-Abschnitte sind
> entsprechend angepasst.
>
> **App-UI-Pass (2026-07-16):** Zwei Screenshot-getriebene Funde in der
> eingeloggten App, nicht der Landing Page. Erstens (`5f84a37`): Sidebar-
> Chat-/Projektliste (`INACTIVE_ROW` in `sidebar.tsx`, geteilt mit
> `mobile-nav.tsx`) lag bei `text-foreground/55`, rechnerisch ~4.2:1 Kontrast,
> unter dem WCAG-AA-Minimum (4.5:1). Auf `/70` angehoben (~7.2:1), dieselbe
> Anhebung in der Command-Palette (lief über `text-muted-foreground`) und in
> der ChatList-Metazeile (`/45` → `/60`). Der listige Platzhalter „Chats,
> Projekte, Seiten, Aktionen…" (Command-Palette-Input + Topbar-Suchbutton)
> durch „Wonach suchst du?" ersetzt. Zweitens (`6404e66`): Die `is_admin`-
> Ausnahme (`plans.ts`, `effectiveLimits`) galt bisher nur für die
> monatlichen Plan-Kontingente, nicht für den stündlichen `rateLimit()` in
> `/api/chat`, `/api/generate`, `/api/projects` und `/api/settings/api-key`,
> der komplett unabhängig lief, der Betreiber-Account (is_admin=true, per
> Supabase-MCP verifiziert) wurde beim eigenen Testen genauso gedrosselt wie
> jeder andere Nutzer. Jetzt vor dem Rate-Limiter geprüft (bestehende
> Profil-Fetches wiederverwendet, `generate-guards.ts` gibt `isAdmin` jetzt
> im `GenerateAllowance`-Result zurück). Nebenbei gefunden: `/api/projects`
> nutzte noch rohes `PLAN_LIMITS` statt `effectiveLimits` für den
> Projekt-Cap, ebenfalls korrigiert. Der rohe englische Fehlertext „Rate
> limit exceeded. Try again later." (identisch in allen vier Routen) durch
> „Zu viele Anfragen, bitte warte kurz und versuch es erneut." ersetzt.
>
> ⚠️ **Handoff entfernt (2026-07-16, `ad0271e`), grundlegende Änderung:**
> Auf expliziten Nutzerwunsch, nach expliziter Rückfrage bestätigt (das
> "..."-Menü im Composer war der **einzige** Weg im ganzen Chat, aus einer
> Unterhaltung ein Ergebnis zu erzeugen), komplett gelöscht:
> `chat-handoff-menu.tsx`, `packet-bridge.tsx`, `prompt-save.tsx`,
> `use-handoff-flow.ts`, `build-progress.tsx` (dadurch verwaist), je mit
> Tests. `ChatConversationStrip` aus `chat-transcript.tsx` entfernt.
> `chat.tsx`/`chat-composer.tsx`/die vier `<Chat>`-Seiten von der reinen
> Handoff-Verkabelung befreit (`canHandoff`, `projectName`/
> `-Instructions`/`-Context`, `defaultTools`). `/api/generate` existiert
> als Route weiter, wird aber von keiner UI mehr aufgerufen. **Chats
> erzeugen damit nie mehr automatisch einen Prompt oder ein
> Software-Paket** — das widerspricht der Produktbeschreibung direkt unten
> ("verwandelt Ideen in build-fertige Prompt-Pakete"), die ist damit nicht
> mehr aktuell und wartet auf eine bewusste Neuformulierung, keine
> Vermutung meinerseits eingetragen.
>
> **Chat-Empty-State vereinfacht (`bd2b20f`, dieselbe Sitzung):** Zeigte
> vorher Finn + Erklärzeile + „Oder starte mit einem Beispiel" + 3
> Starter-Buttons, jetzt nur noch Finn + personalisierte Grußzeile ("Woran
> arbeiten wir, {Name}?", Name = `profiles.display_name` oder E-Mail-Präfix,
> wie im Topbar-Label). `sub`/`starters`/`REFINE_STARTERS` aus
> `chat-variants.ts` entfernt. Nebenbei den sichtbaren Sprung des Composers
> nach der ersten Nachricht behoben (Mindesthöhe lag nur auf dem Empty-State,
> nicht auf dem gemeinsamen Inhaltsbereich).
>
> **Kritik-Pass „F-1" behoben (2026-07-16):** Eine angeforderte schonungslose
> QA-Bewertung fand als Top-Befund, dass nach der Handoff-Entfernung mehrere
> Flächen noch den nicht mehr existierenden Chat→Ergebnis-Weg versprachen.
> Behoben, in dieser Reihenfolge: **Ergebnisse-Leerzustand** (`8de5264`,
> `results/page.tsx`) sagte „Öffne einen Chat und erzeug von dort dein
> erstes Ergebnis", führte aktiv in eine tote Aktion, Copy jetzt ohne
> Kausalbehauptung, Chat-Link bleibt als reine Navigation. **AGB §2/§4**
> (`973b4a3`) versprachen vertraglich „erzeugt strukturierte Prompt-
> Artefakte wie Brief, PRD, Master-Prompt…", eine Leistung, die die
> Software nicht mehr erbringt, rechtlich heikel; jetzt ehrliche
> Beschreibung als KI-gestützter Prompt-Chat. Die Produktbeschreibung
> direkt unten ist entsprechend aktualisiert, der ⚠️-Hinweis von zuvor ist
> damit aufgelöst. **Bewusst nicht in diesem Pass angefasst:** Landing-Page-
> Marketing (Hero-Demo „Dein Bau-Paket", ProductShowcase-Artefakt-Zahlen,
> `/features`), das ist ein separater Kreativ-/Positionierungs-Auftrag, kein
> mechanischer Korrektur-Fix, siehe 2nd-brain für den offenen Punkt.

## Was ist PromptPrinter?

SaaS-Tool mit einem **KI-gestützten Chat** (Finn), der beim Formulieren,
Strukturieren und Verfeinern von Prompts für andere KI-Tools hilft (Claude,
ChatGPT, Lovable, Cursor & Co.). Zielgruppe: Developer und Vibe-Coder.
Solo-/Indie-Projekt, ein Gründer.

> Bis 2026-07-16 lautete die Beschreibung hier „verwandelt Ideen in
> build-fertige Prompt-Pakete" — das setzte den Chat→Ergebnis-Handoff
> voraus, der an diesem Tag ersatzlos entfernt wurde (siehe oben). Diese
> Fassung beschreibt den tatsächlichen, aktuellen Funktionsumfang.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Supabase
(Auth/DB/RLS) · Gemini (`@google/genai`) · Tailwind (HSL-Token-System) ·
Framer Motion · next-themes · Vitest · Docker.

## ⚠️ Wichtig zu wissen, bevor du loslegst

1. **Modell-Provider ist Z.ai (GLM), plus BYOK.** Der komplette Modellzugriff
   ist in [`src/lib/llm.ts`](src/lib/llm.ts) gekapselt, Server-seitig:
   `ZAI_API_KEY` (Z.ai, Default-Modell `glm-4.5-air`, Kosten-Tier, via
   `ZAI_MODEL` überschreibbar) → `GEMINI_API_KEY` (Zweit-Provider) →
   **Stub-Modus** (Templates kommen unverändert zurück, ganzer Flow bleibt
   ohne Key testbar). Zusätzlich kann jeder Nutzer in den Einstellungen einen
   eigenen Anthropic-/OpenAI-/Gemini-Key hinterlegen (BYOK,
   [`src/lib/byok.ts`](src/lib/byok.ts) + `user_api_keys`-Tabelle,
   verschlüsselt via `API_KEY_ENCRYPTION_SECRET`), der übersteuert den
   Server-Key komplett und hebt Generierungen-/Chat-Nachrichten-Limits auf.
   Routen sprechen nie direkt mit einem Provider-SDK.
2. **Zahlungen → Lemon Squeezy, aber erst später.** Bezahlung läuft künftig über
   **Lemon Squeezy** (nicht Stripe). Das passiert **erst, nachdem die Website
   gehostet ist**, vorher nicht anfangen. Im Code liegt noch Stripe-Gerüst
   (UI, `stripe`-Dep, DB-Spalten `stripe_*`); das wird ersetzt, nicht ausgebaut.
3. **Env-Dateien nicht verwechseln:** `npm run dev` liest `.env.local`, der
   Prod-Docker-Container liest `.env` (via `env_file` in docker-compose.yml), das `--env-file .env.local` im Compose-Befehl steuert nur die
   ${VAR}-Interpolation, nicht die Container-Runtime-Vars. Ein API-Key muss
   also je nach Workflow in der richtigen Datei (oder beiden) stehen.

## Befehle

```bash
npm run dev          # Dev-Server (http://localhost:3000)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run test         # vitest run
npm run build        # Production-Build (standalone)
```

**Quality-Gate, vor JEDEM Commit muss das komplett grün sein:**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Die [CI](.github/workflows/ci.yml) fährt dieselbe Kette bei jedem Push/PR.

## Arbeitsregeln (verbindlich)

- **Git-Staging immer explizit per Dateiname**, nie `git add .` / `git add -A`.
- **Gate vor jedem Commit** (siehe oben), alles grün.
- **Commit-Trailer:** `Co-Authored-By: Claude <aktuelles Modell> <noreply@anthropic.com>`.
- **Nach jeder abgeschlossenen Änderung committen + pushen**, nicht auf Aufforderung warten.
- **Secrets nie mit `NEXT_PUBLIC_*`** prefixen, landen sonst im Client-Bundle.
  Server-Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`, …) ohne Prefix.
- **Keine rohen Hex-Farben** in Komponenten, nur semantische Token-Utilities
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
src/app/         Routen, (app) = eingeloggt, (auth) = Login/Signup, api/ = Handler
src/components/  ui / app / marketing / onboarding / brand / motion
src/lib/         Supabase-Clients, rate-limit, plans, Zod-schemas, utils
src/prompts/     Prompt-Vorlagen + System-Prompts pro Artefakt
supabase/migrations/  SQL, Schema, RLS, Grants, gehärtete Funktionen (0001→)
```

Sicherheits-Header sitzen in [next.config.ts](next.config.ts). Der DB-Layer
(RLS, Grants, `search_path`-Hardening) ist bewusst sorgfältig, beim Ändern den
Stil halten und neue Tabellen mit Policy + Grant versehen.

---

## Mascot-System, Finn

Finn ist das zentrale Markenmerkmal. Das vollständige Spec steht in [MASCOT.md](MASCOT.md).

**14 States:** `idle | welcoming | curious | listening | thinking | researching |
building | organizing | explaining | delivering | celebrating | helping | waiting | sad`

**Schlüssel-Komponenten:**
- `src/components/brand/mascot-states.ts`, State-Registry (Single Source of Truth)
- `src/components/brand/mascot.tsx`, Base-Komponente mit `state?` prop
- `src/components/brand/animated-mascot.tsx`, AnimatePresence-Crossfade + Idle-Loops
- `public/mascot/dolphin-<state>.png`, 16 Assets total (original 4 + 12 neue)

**Animations-Presets:** `float | lean | nod | think | bob | cheer | peek | sigh`
Alle reduced-motion-safe. Keyframe-Arrays brauchen `TargetAndTransition`-Typ, nicht `Target`.

**State-Zuordnung (Landing Page):**
- Hero-Intro: `welcoming`
- Hero-Demo-Narration: `curious → thinking → building → delivering` (je Stage)
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

## Landing Page, Aktueller Zustand

**Aktuelle Seiten-Reihenfolge** (`src/app/page.tsx`):
```
Navbar → Hero → HowItWorks → ProductShowcase → PricingPreview →
FAQ → FinalCTA → Footer
```

**Entfernte Sektionen** (bewusst gelöscht, nicht wiederherstellen):
- `FeaturesGrid`, wiederholte dieselben 4 Outputs wie ExampleOutput. Unique Content
  (Sicherheit, Marketing, Deployment) wurde als neue ExampleOutput-Tabs bewahrt
  (lebt noch auf `/features`, siehe unten).
- `Capabilities`, früh entfernt (war Jargon-lastig)
- `Problem` (Litany + trauriger Finn), auf Nutzerwunsch entfernt (2026-07-16,
  `df538a1`), Komponente gelöscht. War zuvor als „nicht anfassen" markiert.
- `ExampleOutput` und `Integrations`, auf Nutzerwunsch entfernt (2026-07-16,
  `ed9ebee`), beide Komponenten gelöscht. Betraf zwei Seiten: die Landing
  Page und `/features` (nutzte beide ebenfalls, live per Footer-Link +
  Sitemap). Anchor-Links, die auf `#example` zeigten (Navbar „Funktionen",
  Hero-CTA „Erst mal zuschauen"), zeigen jetzt auf `#produkt`
  (ProductShowcase), sonst wären sie ins Leere gelaufen.

> **Update:** `HowItWorks` folgt jetzt direkt auf `Hero`, `ProductShowcase`
> direkt danach auf `PricingPreview`. Schließt den Story-Flow (so gehen wir
> vor → dein Arbeitsplatz → Preis). Flache `card-surface`-Karten +
> `building`-Finn heben `HowItWorks` klar von der glänzenden Hero-Demo ab.

**Sektion-Dateien:**
| Datei | Zustand | Finn |
|---|---|---|
| `hero.tsx` | Asymmetrisch: Finn + Sprechblase links, Headline+CTAs rechts. Darunter HeroDemo (Idea→Plan→Build→Launch mit Stage-Narration). Trust-Badge-Zeile unter den CTAs entfernt, „Erst mal zuschauen" zeigt jetzt auf `#produkt`. Subtext auf einen kurzen Zweizeiler gekürzt + vergrößert (18/21px statt 16/18px), Demo-Fensterchrome ohne „PromptPrinter · Demo"-Label (2026-07-16). | `welcoming` + Stage-States |
| `how-it-works.tsx` | 3-Schritt-Prozess (Idee → kurz klären → startklar) in flachen card-surface-Karten; Step 2 mit Chat-Bubble. Direkt nach Hero, vor ProductShowcase. | `building` |
| `product-showcase.tsx` | Interaktive Workspace-Vorschau: Projects / Bibliothek / Generierungen. Mini-Sidebar nutzt denselben Pillen-Umschalter (`NavSwitcher`, "Chat"/"Projekt") wie die echte Sidebar, kein gefälschter „app.promptprinter.dev/…"-URL-Balken mehr (2026-07-16). Einziges verbleibendes „Schau es dir an"-Proof-Element auf der Landing Page. | Kein Finn |
| `pricing-preview.tsx` | 2 Tiers: Free/0€ (BYOK) · Pro/7€/Monat | `helping` |
| `faq.tsx` | 6 Trust-Fragen, vollständig de-jargoned | Kein Finn |
| `final-cta.tsx` | Persönlicher Abschluss, "Den Rest mach ich mit dir." | `celebrating` |
| `footer.tsx` | Finn's Farewell: kleiner Finn + "Schön, dass du da warst., Finn" + 5 echte Links | `idle` |
| `navbar.tsx` | Fix/blur-on-scroll, 2 Nav-Links: "Funktionen" (#produkt), "Preise" (#preise) |, |

**`/features`-Seite** (`src/app/features/page.tsx`, live via Footer-Link +
Sitemap): Navbar → Intro-Header → HowItWorks → FeaturesGrid → FinalCTA →
Footer. `ExampleOutput`/`Integrations` waren hier ebenfalls eingebunden,
mit der Landing-Page-Löschung (2026-07-16) auch hier entfernt.

---

## Brand-Prinzipien (aus laufenden Design-Entscheidungen)

- **Finn spricht in Ich-Form**, alle Marketing-Copy ist in Finn's Stimme, nicht Corporate-Voice.
- **Kein Jargon in Marketing-Texten**, PRD, Blueprint, Schema, Long-Context, Artefakt,
  RLS sind aus allen Landing-Page-Texten gestrichen. Nur im App-UI und FAQ (wo Nutzer
  es erwarten) erlaubt.
- **Keine SaaS-Template-Muster**, kein Feature-Grid, keine nummerierten Karten,
  keine corporate Footer-Spalten, keine Status-Pulse-Indikatoren.
- **Whitespace ist Absicht**, Litany-Prinzip: weniger Struktur = mehr emotionaler Impact.
- **Finn reist durch die Seite**, welcoming → building → delivering → helping → celebrating → idle.
  Er soll nicht als dekorativer Sticker wirken, sondern als Begleiter.
- **Footer = Finn's Abschluss**, die Seite beginnt mit Finn, sie endet mit Finn.

---

## Offene Punkte / Nächste Schritte

**Priorität 1: Das Workspace-Redesign**, Phasen 1-5 aus [REDESIGN.md](REDESIGN.md)
(Sidebar → Chat-Kanonisierung → Workspace v1 → Dateien → Handoff/Wahrheits-Pass).
Die Brand-Audit-Punkte unten bleiben gültig, laufen aber danach bzw. werden von
Phase 5 (Landing-Nachzug) teilweise miterledigt.

Noch nicht umgesetzt aus der Brand-Audit (Priorität absteigend):

1. **ProductShowcase**, Finn fehlt komplett in der längsten Sektion. "Alles, was wir
   zusammen bauen" ohne Finn im Raum ist ein Widerspruch. Idee: kleiner Finn im
   Mock-Sidebar oder als Avatar.
2. **Finn-Welt-Atmosphäre / Dark Mode**, Dark Mode wirkt kalt; der Charakter wirkt
   wie ein aufgeklebter Sticker auf einem generischen Canvas. Keine Verbindung zwischen
   Finn's Palette (Creme, Coral, Navy) und der Seiten-Palette.
3. **Sektions-Übergänge / Rhythmus**, alle Sektionen haben denselben `py-24/32`-Abstand,
   metronomischen Rhythmus. Keine dynamische Pacing. Litany bewies: engerer Beat = mehr Emotion.
4. **Mono-Eyebrow auf jeder Sektion** (`SCHAU ES DIR AN`, `DEIN ARBEITSPLATZ` etc.), SaaS-Template-Konvention. Finn würde einfach reden, nicht labeln.

**Nicht anfassen (stabil, fertig):**
- Mascot-State-System und alle 16 Assets
- Hero-Demo (Idea→Plan→Build→Launch)
- Footer (Finn's Farewell)
- Auth-Flow, DB-Migrationen, RLS-Policies
