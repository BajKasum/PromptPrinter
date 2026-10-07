# CLAUDE.md, Projekt-Kontext für Claude-Code-Sessions

Diese Datei wird bei jedem Session-Start automatisch geladen. Sie soll dir
schnell Orientierung geben: was das Projekt ist, in welchem Zustand es steckt,
und nach welchen Regeln hier gearbeitet wird. Details stehen in [README.md](README.md) (Überblick),
[SETUP.md](docs/SETUP.md) (Setup, Deploy-Checkliste, Struktur), [DESIGN.md](docs/DESIGN.md)
und [DOCKER.md](docs/DOCKER.md), hier nur das Wesentliche.

## IST-Zustand (Stand 2026-10-07)

Gegenwart, keine Historie. Der Verlauf steht datiert in [docs/CHANGELOG-2026.md](docs/CHANGELOG-2026.md)
(*warum* etwas so ist: Entscheidungen, Messungen, entfernte Features; nach dem Stichwort suchen). Das
Zielmodell des Workspace-Umbaus bleibt [REDESIGN.md](docs/REDESIGN.md).

**Produkt**

- **Nav:** Chats | Projekte (Pillen-Umschalter in der Sidebar, einklappbar, Cookie
  `pp-sidebar`, Strg/⌘+B). Das Konto sitzt unten in der Sidebar (Einstellungen,
  Nutzung, Gespeicherte Prompts, Abrechnung, Sprache, Hilfe). ⌘K ist die
  Befehlspalette, ohne sichtbaren Button. Login landet auf `/chats/new`; `/chat` und
  `/dashboard` leiten um.
- **Ein Chat (Finn):** eine gebündelte Rückfrage (Ziel-Tool, Kern-Screens, Datenmodell,
  Auth, Design), dann ein fertiger, aufs Ziel-Tool zugeschnittener Prompt im
  Codeblock. Systemprompt: `src/server/system-prompt.ts`. Streaming per SSE, Antwort
  neu erzeugen, eigene Frage bearbeiten, Sprachmodus (Web Speech API), Fotos und
  Dateien als Anhänge (dauerhaft gespeichert).
- **Projekte sind Workspaces:** Anweisungen, Struktur, Dateien, mehrere Chats, das
  **Gedächtnis** (einmalige Analyse von Dateien und einem öffentlichen GitHub-Repo,
  Tabelle `project_brains`) und gespeicherte Prompts ("Ergebnisse", ohne
  Auto-Generieren).
- **Pläne:** Free chattet nur mit eigenem Key, Pro mit Server-Key und Kontingent.
  **BYOK** (Anthropic, OpenAI, Gemini am Key-Format erkannt, dazu jeder
  OpenAI-kompatible Endpunkt) hebt das Chat-Limit auf. Zahlung über Lemon Squeezy
  (Webhook `/api/webhooks/lemonsqueezy`).
- **Sprachen:** die eingeloggte App gibt es auf de/en/fr/it/es
  (`src/shared/i18n/messages/`), Landing, Auth-Seiten und Rechtstexte bleiben deutsch.
- **Öffentlich:** Landing (Hero, HowItWorks, ProductShowcase, FinalCTA), `/pricing`,
  Hilfe `/docs`, `/ueber`, `/kontakt`, `/vergleich` mit drei Vergleichen und die
  Rechtstexte (Impressum, AGB, Datenschutz, Cookies, Nutzungsrichtlinie,
  Rückerstattung).
- **Entfernt, nicht wiederherstellen:** die Generierungs-Pipeline (`/api/generate`,
  Paket-Prompts, 10-Tab-Ergebnisse), Modus-Wahl, Ziel-Tool-Auswahl, Erst-Login-Tour,
  Topbar, Profilbild-Upload, `/features`, die Sektionen Problem, ExampleOutput,
  Integrations, FeaturesGrid und PricingBridge. Gründe im Changelog.

**Technik**

- **Modellzugang** nur in `src/server/llm/` (Einstieg `index.ts`). Z.ai (Standard `glm-4.5-air`) und
  Gemini auf dem Server, Anthropic und OpenAI nur per BYOK. Ohne Key antwortet der
  Chat im Stub-Modus, nur in Entwicklung (`next start` verweigert ihn).
  `llm-retry.ts` wiederholt vorübergehende Fehler (3 Versuche), `llm-failover.ts`
  weicht bei einem Ausfall von Z.ai auf Gemini aus (nur mit beiden Server-Keys,
  Leistungsschalter in Redis, eigenes Tagesbudget). Jeder Anbieter-Aufruf geht
  durch diese Hüllen.
- **Auth:** Supabase. Die anonymen Aktionen (Anmelden, Registrieren, Reset) laufen
  über `/api/auth` mit serverseitiger Turnstile-Prüfung. **Supabases eigenes
  CAPTCHA bleibt aus** (ein Token ist einmal einlösbar, zwei Prüfer brächen jeden
  Login). Reset und Bestätigung laufen über `/auth/callback` (`token_hash` + `type`,
  `src/features/auth/lib/recovery-session.ts`), die Mail-Vorlagen liegen in
  `supabase/templates/`.
- **Daten:** Supabase (Irland, `eu-west-1`), RLS auf allen Tabellen, `anon` ohne
  Rechte. Billing, Gedächtnis und Anhänge schreibt nur der Server (Service-Role).
  Migrationen 0001 bis 0046 in `supabase/migrations/`, alle in Produktion angewendet
  (0001 von Hand eingespielt, fehlt in der Migrationsliste der Datenbank).
- **Betrieb:** Vercel (Funktionen in `dub1`, Node 24), Upstash Redis (Ratenlimit,
  Kontingent, Tagesbudget, Failover-Schalter), strukturierte Logs
  (`src/server/observability`), `/api/health`. Der Alarm-Webhook ist gebaut, aber
  ohne URL.
- **Ladezeit-Messung:** Vercel Speed Insights, `<SiteSpeedInsights />` im Root-Layout
  (`src/shared/providers/site-speed-insights.tsx`), nur im Produktions-Build. Adressen
  werden vor dem Senden gekürzt (`src/shared/lib/speed-insights-event.ts`: Query und
  Fragment weg, jede UUID wird `[id]`). Skript und Messwerte laufen über `'self'`;
  **wer `scriptSrc` oder `endpoint` auf einen fremden Host stellt, zieht
  `src/server/security/csp.ts` mit** (`csp.test.ts`). Genannt in Datenschutz (Ziffern
  2, 3, 4, 6) und `/cookies` (Ziffern 1, 3), wer ändert, was gesendet wird, zieht beide
  Texte mit. Kein Env-Wert, kein Dashboard-Schalter. Kosten, Grenzen, Prüfung:
  `docs/SETUP.md`, "Geschwindigkeitsmessung", Changelog 2026-10-06.
- **Qualität:** das Gate (siehe "Befehle"), rund 160 Testdateien, Guards in
  `tests/guards/` (Schichten, Routen, Cookies, SEO, Kontrast, Node-Version,
  Mail-Vorlagen, Dependabot, zod-Import), Browser-Smoketests `e2e/` gegen einen lokalen
  Supabase-Stack mit Postfach. CI: `ci.yml` (jeder Branch), `e2e.yml`, `docker.yml`,
  `audit.yml` (täglich, meldet per Issue). Dependabot wöchentlich, kein Auto-Merge. Node 24 überall (`.nvmrc`).
- **Keine Embeddings, bewusst.** Begründung und die Bedingung, unter der sich das
  ändern würde: [docs/SETUP.md](docs/SETUP.md), Abschnitt "Projekt-Gedächtnis".

**Offen** (Quellen: Vault, `02 Projekte/PromptPrinter/`: Betriebs-Audit 2026-10-04,
Auth-Mails Plan 2026-10-06; Stand der Umsetzung je Punkt im Changelog)

- **Kritisch, nicht Teil der M-Punkte:** K1 Backup und Tarife (Supabase Free, Vercel Hobby),
  K2 `ALERT_WEBHOOK_URL`, K3 der Bezahlweg: gegen die Doku und im Browser-Test mit selbst
  signierten Ereignissen belegt (#73), ein echtes Ereignis steht aus.
- **Wartet auf Kasum:** `GITHUB_TOKEN`, bezahlter `GEMINI_API_KEY`, die vier `STRIPE_*`-Variablen
  in Vercel löschen, Entscheid zum Fehler-Tracker; **Auth-Mails** (Befund 2026-10-07 im Changelog:
  kein eigener SMTP, "Confirm email" aus, Standard-Vorlage): Mail-Anbieter buchen, DNS, Vorlagen aus
  `supabase/templates/` einfügen; **Lemon Squeezy** nachsehen (Testmodus oder Live, Webhook-URL,
  Preise brutto oder netto); "Dependabot security updates" einschalten; Entscheid zu #51
  (`lucide-react` 1.x, 23 von 70 Symbolen anders gezeichnet) und #24 (Key-Assistent); die
  `braces`-Ausnahme in `scripts/audit-gate.mjs` (läuft am 2026-11-04 ab, das Issue warnt ab dem 28.10.).
- **Juristisch zu prüfen:** Übermittlung an Z.ai, EU-Vertreter (Art. 27 DSGVO), Sprachmodus
  (Google/Microsoft), der Satz zum Ausweich-Anbieter, Speed Insights (Aufbewahrung bei Vercel
  nicht belegt), jeder neue Empfänger (Mail-Anbieter, Fehler-Tracker).
- **Speed Insights:** am 2026-10-07 keine Messwerte (kaum echte Besuche).
- **Über 400 Zeilen:** nur `hero.tsx` (Nicht-anfassen-Liste), Obergrenzen in
  `tests/guards/file-size.test.ts`.

## Was ist PromptPrinter?

SaaS-Tool mit einem **KI-gestützten Chat** (Finn) für Vibe-Coder, die Prompts
in KI-Bau-Tools füttern (Lovable, Cursor, v0, Claude Code, Bolt, Replit &
Co.). Kernversprechen: nicht Credits verbrennen — Finn stellt in einer
gebündelten Rückfrage die Dinge, die das Bau-Tool selbst nicht abfragt
(Ziel-Tool, Kern-Screens, Datenmodell, Auth, Design-Richtung), bevor der
fertige, aufs Ziel-Tool zugeschnittene Prompt kommt. Solo-/Indie-Projekt,
ein Gründer.

> Bis 2026-07-16 lautete die Beschreibung hier „verwandelt Ideen in
> build-fertige Prompt-Pakete" — das setzte den Chat→Ergebnis-Handoff
> voraus, der an diesem Tag ersatzlos entfernt wurde (siehe oben). Am
> 2026-07-22 die Positionierung nach einer Grill-me-Session bewusst
> geschärft (vorher „Developer und Vibe-Coder" allgemein + „everyday
> goals" im System-Prompt, siehe „Finn-Umbau" unten): eine Nische statt
> zwei Zielgruppen gleichzeitig zu bedienen.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Supabase
(Auth/DB/RLS) · Z.ai/GLM (primär) + Gemini (`@google/genai`, sekundär) ·
Tailwind (HSL-Token-System) · Framer Motion · next-themes · Vitest · Docker.

## ⚠️ Wichtig zu wissen, bevor du loslegst

1. **Modell-Provider: Z.ai (GLM) ist der Standard, Gemini der Zweit-Provider und
   Failover, dazu BYOK.** Der komplette Modellzugriff steckt in
   [`src/server/llm/`](src/server/llm/index.ts). Auswahl: eigener Key des Nutzers →
   `ZAI_API_KEY` (Standard `glm-4.5-air`, über `ZAI_MODEL` änderbar) →
   `GEMINI_API_KEY` → **Stub-Modus** (nur in Entwicklung, der Flow bleibt ohne Key
   testbar). Ein eigener Key ([`byok.ts`](src/server/byok.ts), Tabelle
   `user_api_keys`, verschlüsselt mit `API_KEY_ENCRYPTION_SECRET`) übersteuert den
   Server-Key komplett und hebt das Chat-Limit auf. Routen sprechen nie direkt mit
   einem Provider-SDK, und kein Aufruf geht an `llm-retry.ts` und `llm-failover.ts`
   vorbei.
2. **Zahlungen laufen über Lemon Squeezy, live seit 2026-08.** Checkout, Webhook
   (`/api/webhooks/lemonsqueezy`) und Kundenportal sind gebaut und produktiv.
   Stripe ist aus Code und Datenbank entfernt (Migration `0043`, am 2026-10-05
   angewendet). Vercel trägt noch vier ungenutzte `STRIPE_*`-Variablen.
3. **Env-Dateien nicht verwechseln:** `npm run dev` liest `.env.local`, der
   Prod-Docker-Container liest `.env` (via `env_file` in
   `docker-compose.prod.yml`). Das `--env-file .env.local` im Compose-Befehl steuert
   nur die `${VAR}`-Interpolation, nicht die Laufzeit-Variablen des Containers. Ein
   API-Key muss je nach Workflow in der richtigen Datei (oder beiden) stehen.
4. **`docker-compose.yml` ist der Dev-Stack, nicht Produktion.** Produktion braucht
   zwingend `-f docker-compose.prod.yml` (siehe [DOCKER.md](docs/DOCKER.md)); der
   blanke `docker compose up --build` baute früher stillschweigend das strikte
   Produktions-Image und brach ohne Upstash und Verschlüsselungs-Secret beim Start ab.

## Befehle

```bash
npm run dev          # Dev-Server (http://localhost:3000)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run test         # vitest run
npm run build        # Production-Build (standalone)
npm run test:e2e     # Browser-Smoketests, braucht Docker + `supabase start` (docs/SETUP.md)
```

**Quality-Gate, vor JEDEM Commit muss das komplett grün sein:**

```bash
npm run audit:gate && npm run typecheck && npm run lint && npm run test && npm run build
```

- Die [CI](.github/workflows/ci.yml) fährt dieselbe Kette bei jedem Push auf **jeden**
  Branch und bei jedem PR. Der Audit steht dort VOR allem anderen: schlägt er an,
  laufen die übrigen Schritte nicht. Deshalb gehört er ins lokale Gate.
- **`audit:gate` ist `npm audit --audit-level=high` mit einer befristeten
  Ausnahmeliste** ([`scripts/audit-gate.mjs`](scripts/audit-gate.mjs)). Aktuell steht
  dort GHSA-vfj7-8cjw-p6xm (`braces`, keine gepatchte Version, hängt nur an
  Build-Werkzeugen und ist im ausgelieferten `.next/standalone` nicht enthalten),
  **befristet bis 2026-11-04**. Danach scheitert das Gate wieder und jemand
  entscheidet: Upstream-Fix, Tailwind 4 (Breaking Change) oder Verlängerung mit neuer
  Begründung. Einträge nur mit Beleg, dass der Fund die ausgelieferte App nicht
  erreicht, nie "später". Der tägliche Lauf `audit.yml` meldet die Frist sieben Tage
  vorher per Issue.
- **Die Schritte des Gates nie durch `| tail` oder `| head` leiten.** Eine Pipe gibt
  den Exit-Code des letzten Befehls zurück, und der ist immer 0: ein roter
  `npm audit` sah so einen Lauf lang grün aus. Ausgabe in eine Datei schreiben und
  den Exit-Code des Schritts selbst prüfen.
- **Beim lokalen Build die Platzhalter wie die CI setzen**
  (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`), sonst zieht der Build die
  echte `.env.local`.
- **Vor dem Gate zwischen Branches `.next` leeren** (`rm -rf .next`): es hält Typen
  für Routen, die es auf dem anderen Branch nicht gibt, und der Typecheck scheitert
  daran.
- **Bricht der Build mit `ENOENT … .next/…` ab,** läuft parallel ein Dev-Server:
  `next dev` und `next build` teilen sich `.next`. Dev-Server stoppen, Build
  wiederholen. Ein Wettlauf, keine kaputte Zustandsdatei, deshalb bewusst kein
  `prebuild`, das `.next` löscht.
- **Stehen die Testzeiten plötzlich in Minuten statt Millisekunden,** zuerst den
  Rechner prüfen (Standby), nicht den Code.
- **Browser-Tests** laufen gegen einen lokalen Supabase-Stack (Ablauf in
  [SETUP.md](docs/SETUP.md), "Ende-zu-Ende-Tests"). Startet Docker Desktop nicht,
  belegt der E2E-Lauf der CI denselben Commit. Hilfsskripte für Patches lieber mit
  dem Write-Werkzeug in den Scratchpad schreiben als als langes Heredoc.

## Arbeitsregeln (verbindlich)

- **Git-Staging immer explizit per Dateiname**, nie `git add .` / `git add -A`.
- **Gate vor jedem Commit** (siehe oben), alles grün.
- **Commit-Trailer:** `Co-Authored-By: Claude <aktuelles Modell> <noreply@anthropic.com>`.
- **Nie direkt auf `main` arbeiten** (Kasums Regel seit 2026-09-23). Jede Arbeit auf
  einem eigenen Branch (`fix/…`, `feat/…`, `docs/…`, `ci/…`), für jedes Problem ein
  eigener. **Branches nie löschen**, weder lokal noch auf GitHub (kein
  `--delete-branch`). **Nie force-pushen.** Soll ein offener Branch den neuen `main`
  aufnehmen, `git merge main` statt Rebase (der Rebase-Merge des PR schreibt die
  Commits ohnehin neu).
- **Nach `main` nur per Pull Request mit "Rebase and merge"** (seit 2026-09-29).
  Ablauf pro Branch:
  1. Frischen Branch von aktuellem `main` anlegen (`git pull` vorher). **Nie vom
     vorherigen Feature-Branch abzweigen**, sonst trägt der neue PR dessen Commits
     noch einmal mit (die Commits auf `main` haben nach dem Rebase andere IDs).
  2. Committen, Gate grün, Branch pushen.
  3. `gh pr create --base main` mit kurzer Beschreibung.
  4. CI auf dem PR grün abwarten, dann `gh pr merge <nr> --rebase`. **Ein grüner
     Lauf, der älter als ein paar Stunden ist, zählt nicht:** vorher
     `gh run rerun <id>` und das Ergebnis abwarten, denn der Merge schreibt einen
     neuen Commit auf `main`, dessen Lauf den Stand von jetzt prüft (ein neues
     Advisory färbte so schon einen Commit auf `main` rot).
  5. Lokal `git checkout main && git pull`, erst danach der nächste Branch.

  Auf `main` hat jeder Commit eine eigene Concurrency-Gruppe, ein Kreuz dort ist also
  kein abgebrochener Lauf. Wer eines sieht: `gh run rerun <id>`, aber erst wenn auf
  `main` kein anderer Lauf läuft.

  **Warum Rebase-Merge und kein Fast-Forward:** GitHub zählt Commits, die zuerst auf
  einem Branch lagen und dann per Fast-Forward nach `main` kamen, großenteils nicht
  in Kasums Contributions. "Rebase and merge" schreibt sie auf `main` neu, jeder
  zählt (am 01.10.2026 nachgemessen). **Ungezählte Commits nachträglich zählen
  lassen** geht über einen Wechsel des Standard-Branches; Ablauf und Messungen:
  [Changelog, Anhang](docs/CHANGELOG-2026.md#anhang-aus-claudemd-ausgelagert-am-2026-10-06).
  Dabei **nichts auf `main` pushen oder mergen**, solange der Wechsel läuft.
- **Nach jeder abgeschlossenen Änderung committen und pushen**, nicht auf Aufforderung
  warten.
- **Dependabot-PRs** (wöchentlich) nie ohne Kasums Entscheidung mergen, es gibt
  bewusst keinen Auto-Merge. **Nie mergen:** der Vercel-Bot-Branch
  `vercel/install-vercel-web-analytics-…` (PR #1, Draft). Web Analytics ist ein anderes
  Produkt als Speed Insights und steht nicht in Datenschutz und `/cookies`.
- **Mutationstest für jede neue Schranke:** Schranke kaputt machen, der Test muss
  anschlagen, danach den Quelltext aus der Sicherung wiederherstellen (nicht
  `git checkout` auf Dateien mit eigenen ungesicherten Änderungen).
- **Rechtstexte** (Impressum, AGB, Datenschutz, Cookies, Nutzungsrichtlinie) nicht
  ungefragt ändern: Änderung vorschlagen, Kasum entscheidet, juristisch prüfen
  lassen. **Tarife, Secrets, Umgebungsvariablen, Vercel-Einstellungen und Migrationen
  auf Produktion** nur nach seinem ausdrücklichen Ja (lesend prüfen, ändern, lesend
  verifizieren).
- **Secrets nie mit `NEXT_PUBLIC_*`** prefixen, landen sonst im Client-Bundle.
  Server-Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`, …) ohne Prefix.
- **Keine rohen Hex-Farben** in Komponenten, nur semantische Token-Utilities (siehe
  [DESIGN.md](docs/DESIGN.md)).
- **User-scoped Queries:** RLS scope + zusätzlich explizit `.eq("user_id", …)`
  (Defense-in-depth), v. a. wo Counts Limits durchsetzen.

**Wenn du etwas hinzufügst, gehört dazu** (jeweils ein Test erzwingt es):

| Neu | Dann auch |
|---|---|
| Cookie oder `localStorage`-Schlüssel | Eintrag in `features/marketing/lib/cookie-inventory.ts` (und `/cookies` stimmt dann) |
| Seite in der eingeloggten App | Eintrag in `APP_PREFIXES`, öffentliche Seite in `PUBLIC_PREFIXES` (`shared/lib/app-routes.ts`) |
| Seite mit Captcha oder Checkout | Eintrag in `thirdPartiesFor()` (`server/security/csp.ts`) |
| Öffentliche Seite | Metadaten über `pageMetadata()`; keine `FadeIn` und kein `motion.h1` um eine `h1` |
| Text eines Hilfe-Artikels geändert | `updated` in `docs-nav.ts` nachziehen |
| UI-Text | Wörterbuch `shared/i18n/messages/`, alle fünf Sprachen (fr/it/es sind nie von Muttersprachlern geprüft: im PR kennzeichnen) |
| Migration | Policy und Grant mitliefern; jede an `authenticated` vergebene Funktion von `PUBLIC` entziehen (`migrations.test.ts`). Auf Produktion nur mit Kasums Ja; braucht der Code die Migration, erst sie, dann den Code |
| Aufruf eines Modell-Anbieters | durch `src/server/llm/` (und damit Retry und Failover), nie ein SDK direkt |
| Datei in `src/server/` | `import "server-only"` |
| Zod-Schema | `z` aus `@/shared/lib/zod`, nie aus `"zod"` (Meldungen wie zod 3, `zod-import.test.ts`) |
| Mail-Vorlage | `supabase/templates/`, Link über `/auth/callback`; im Dashboard neu einfügen |
| Node-Version ändern | alle Stellen, siehe [SETUP.md](docs/SETUP.md), "Node-Version" |

## Env-Dateien

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker (`docker-compose.yml`), Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.prod.yml`) |
| `.env.example` | Vorlage (committed) |

`.env*` (außer `.example`) sind gitignored. Schema in [.env.example](.env.example).

## Struktur (Kurzform)

Begründung der Struktur: [docs/audits/RESTRUCTURE-2026-08-02.md](docs/audits/RESTRUCTURE-2026-08-02.md).

```
src/app/       NUR Routing. (marketing) = öffentlich (inkl. (legal)),
               (app) = eingeloggt, (auth) = Login/Signup, api/ = Handler.
               auth/callback ist ein ECHTES Segment, nicht verschieben.
src/features/  Vertikale Schnitte, je components/ hooks/ lib/:
               auth · chat · marketing · projects · prompts · settings
src/shell/     App-Rahmen (Sidebar, Mobile-Nav, Command-Palette). Darf
               Features mounten — Features dürfen einander NICHT kennen.
src/server/    Nie im Browser, jede Datei mit `import "server-only"`.
               security/ (crypto, csp, rate-limit, turnstile, url-safety),
               brain/ (github.ts, analyze.ts — Projekt-Gedaechtnis),
               billing/, observability/, http/, supabase/, llm/ (je Anbieter eine Datei), llm-retry.ts,
               llm-failover.ts, env.ts, byok.ts, project.ts, system-prompt.ts
src/shared/    Von überall nutzbar, kennt niemanden über sich:
               ui/ brand/ motion/ providers/ lib/ supabase/
tests/guards/  Repo-weite Invarianten (Kontrast, server-only, Schichtgrenzen,
               Routenlisten, SEO-Metadaten, sichtbare Überschriften, Cookies,
               Node-Version, Mail-Vorlagen, Dependabot, Migrationen)
e2e/           Browser-Smoketests (Playwright, lokaler Supabase-Stack, Postfach)
supabase/migrations/  SQL, Schema, RLS, Grants, gehärtete Funktionen (0001→)
```

**Wohin gehört eine neue Datei?** Berührt sie ein Geheimnis → `src/server/`
(+ `server-only`). React-Hook → `…/hooks/` (+ `client-only`). Gehört sie zu
genau einem Feature → `src/features/<f>/`. Brauchen sie zwei Features →
`src/shared/`. Test immer als `<name>.test.ts(x)` **daneben**.

Braucht ein Modul sowohl ein Feature ALS AUCH `src/server/`, gehört es ins
Feature, nicht nach `server/`: die Richtung `features/ → server/` ist erlaubt,
die Gegenrichtung nicht. `brain-sources.ts` ist der Fall — es kennt die
Projektdateien und den GitHub-Import, deshalb liegt es in
`features/projects/lib/`, und `server/brain/analyze.ts` bekommt fertige Daten
übergeben statt selbst zu laden.

**Eine Ausnahme von "app/ nur Routing":** `src/app/api/chat/` trägt neben `route.ts` die
Schritte des Chat-Zugs (`gate.ts`, `allowance.ts`, `turn.ts`, `reply-stream.ts`). Sie
mounten das Chat-Feature, das Projekt-Feature (`buildProjectContext`) UND `server/`,
und das darf nur `app/`: ein Feature dürfte das Projekt-Feature nicht kennen. Die
Dateien importieren einander **relativ** (der Schicht-Guard verbietet `@/app/…`). Ein
Schritt gibt ENTWEDER eine `Response` (die Route antwortet damit sofort) ODER seinen
Wert zurück; die Reihenfolge der Schritte und die Rückgabe der Reservierungen an jedem
Ausstieg hält `route.exits.test.ts` fest. Was keine Reservierung und kein Feature braucht
(Verlauf kürzen, deutsche Fehlertexte), liegt in `features/chat/lib/turn-*.ts`.

**Der Chat im Browser** (`features/chat/`): `components/chat.tsx` setzt nur zusammen
(`chat-thread.tsx`, `chat-notices.tsx`, Composer, Sprachleiste). Der Zustandsautomat
eines Zugs steht in `hooks/use-chat-turn.ts`, die Anfrage samt Stromlesen in
`hooks/run-chat-turn.ts`, dazu `use-chat-scroll.ts`, `use-attach-notice.ts` und
`lib/chat-wire.ts`. `chat.turn.test.tsx` hält den Automaten fest, `chat.test.tsx` die
Oberfläche.

Die Schichtgrenzen erzwingt [tests/guards/layer-boundaries.test.ts](tests/guards/layer-boundaries.test.ts),
nicht ESLint: `no-restricted-imports` mit `patterns` läuft über minimatch, und
das ist hier durch den `brace-expansion`-Security-Override kaputt
("expand is not a function"). Den Override dafür zu lockern wäre der falsche
Tausch.

Sicherheits-Header sitzen in [next.config.ts](next.config.ts). Der DB-Layer
(RLS, Grants, `search_path`-Hardening) ist bewusst sorgfältig, beim Ändern den
Stil halten und neue Tabellen mit Policy + Grant versehen.

---

## Mascot-System, Finn

Finn ist das zentrale Markenmerkmal. Das vollständige Spec steht in [MASCOT.md](docs/MASCOT.md).

**14 States:** `idle | welcoming | curious | listening | thinking | researching |
building | organizing | explaining | delivering | celebrating | helping | waiting | sad`

**Schlüssel-Komponenten:**
- `src/shared/brand/mascot-states.ts`, State-Registry (Single Source of Truth)
- `src/shared/brand/mascot.tsx`, Base-Komponente mit `state?` prop
- `src/shared/brand/animated-mascot.tsx`, AnimatePresence-Crossfade + Idle-Loops
- `public/mascot/dolphin-<state>.png`, 14 Assets, eins pro State (zwei
  zusätzliche, unreferenzierte Originale sind seit B-7, Audit 06.09.2026, entfernt)

**Animations-Presets:** `float | lean | nod | think | bob | cheer | peek | sigh`
Alle reduced-motion-safe. Keyframe-Arrays brauchen `TargetAndTransition`-Typ, nicht `Target`.

**State-Zuordnung (Landing Page):**
- Hero-Intro: `welcoming`
- Hero-Demo-Narration: `curious → listening → delivering` (Idee, Rückfrage, Prompt)
- HowItWorks: `building`
- ProductShowcase: `organizing` (float, rechts neben der Headline, ab lg; Brand-Audit #1, 2026-07-17)
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

## Landing Page, aktueller Zustand

Die öffentliche Website hat zwei Seiten, die das Produkt verkaufen: die Landing Page
und `/pricing`. `/features` gibt es nicht mehr (`next.config.ts` leitet auf
`/#funktionen` um). Daneben stehen die Hilfe (`/docs`), `/ueber`, `/kontakt`,
`/vergleich` mit drei Vergleichsseiten und die Rechtstexte. Die Vergleiche sind wie
die Hilfe geschrieben, nicht in Finns Ich-Form, und nur über Footer, Hilfe-Übersicht,
Sitemap und `llms.txt` erreichbar, nicht über die Navbar. Die Landing Page nennt keinen
Preis und stellt keine Fragen, beides lebt nur auf `/pricing`.

**Reihenfolge** (`src/app/(marketing)/page.tsx`):
```
Navbar → Hero → HowItWorks → ProductShowcase → FinalCTA → Footer
```

| Datei | Zustand | Finn |
|---|---|---|
| `hero.tsx` | Finn + Sprechblase links, Headline und CTAs rechts, darunter die HeroDemo in drei Stufen (Idee → Rückfrage → Prompt, spiegelt das echte CodeBlock-Chrome aus `chat-markdown.tsx`). „Erst mal zuschauen" springt auf `#produkt`. | `welcoming` + Stage-States |
| `how-it-works.tsx` | Drei Schritte (Idee → kurz klären → startklar) in flachen `card-surface`-Karten. Trägt `id="funktionen"`, das Sprungziel der Navbar. | `building` |
| `product-showcase.tsx` | Interaktive Workspace-Vorschau (Chats / Projekte) mit demselben Pillen-Umschalter (`NavSwitcher`) wie die echte Sidebar. Einziges „Schau es dir an"-Element. | `organizing` |
| `final-cta.tsx` | Persönlicher Abschluss, „Den Rest mach ich mit dir." | `celebrating` |
| `footer.tsx` | Kleiner Finn (nur das Bild) und eine flache Link-Zeile mit allen öffentlichen Seiten, Copyright, eine Trennlinie, darunter der kazuvate-Credit. Links tragen dieselbe Wasser-Pille wie die Navbar (`NavWave`, `shared/ui/nav-wave.tsx`). | `idle` |
| `navbar.tsx` | Fix, Blur beim Scrollen, zwei Links: „Funktionen" (`/#funktionen`) und „Preise" (`/pricing`). | kein Finn |

**`/pricing`:** `PageHeader` (nur Headline) → `PricingGrid` (Finns auf den Plan-Karten) →
`FAQ` (zwei Fragen) → `Footer`.

**Entfernt, nicht wiederherstellen:** `Capabilities`, `Problem`, `ExampleOutput`,
`Integrations`, `FeaturesGrid`, `PricingBridge`, die Beruhigungs-Kartenreihe auf
`/pricing`. Die Gründe stehen im Changelog.

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

## Nicht anfassen (stabil), und was bewusst offen ist

- Mascot-State-System und alle 14 Assets.
- Hero-Demo (drei Stufen), Footer (Finn's Farewell).
- Auth-Flow, DB-Migrationen, RLS-Policies: nur mit Test und Grund. Der Auth-Flow
  wurde am 2026-10-06 angefasst (Reset-Link, siehe Changelog), mit Tests und einem
  Browser-Test, der ihn Ende zu Ende prüft.
- **Offen im Design:** die Frage „Dark Mode wirkt kalt" (Palette-Verbindung
  Creme/Coral/Navy, `--accent-warm` wartet auf echte Höhepunkte). Heikles
  „felt, not seen"-Terrain, Roadmap in [DESIGN.md](docs/DESIGN.md), „Finn's World".
  Die rund 13 verstreuten `focus:ring`-Stellen blieben auf dem flachen Ring.
