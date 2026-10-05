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
| `npm run test:e2e` | Playwright-Smoketests im Browser gegen einen lokalen Supabase-Stack (siehe „Ende-zu-Ende-Tests", braucht Docker) |
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

### BYOK-Secret rotieren

`API_KEY_ENCRYPTION_SECRET` verschlüsselt die Keys, die Nutzer in den
Einstellungen hinterlegen. Bis zum 04.10.2026 hing jeder Key an genau diesem
einen Wert: wer ihn änderte, machte alle Keys unlesbar, und `getUserOverride()`
stuft einen unlesbaren Key stillschweigend auf "kein eigener Key" zurück. Jeder
BYOK-Nutzer lief dann unbemerkt auf dem Server-Key und unter den Plan-Grenzen.
Eine Rotation geht jetzt so:

1. Neues Secret erzeugen (lang, zufällig).
2. In Vercel `API_KEY_ENCRYPTION_SECRET_PREVIOUS` = altes Secret,
   `API_KEY_ENCRYPTION_SECRET` = neues Secret. Deployen. Die App liest ab jetzt
   Keys unter beiden Secrets und schreibt nur noch unter dem neuen. Beim Start
   erscheint eine Warnung, solange die Rotation offen ist.
3. `scripts/rotate-byok-secret.mjs` im Probelauf (ohne `--apply`): zählt, wie
   viele Zeilen noch nur das alte Secret öffnet. Schreibt nichts.
4. Dasselbe mit `--apply`: schlüsselt diese Zeilen unter dem neuen Secret neu.
   Es schreibt nur, solange noch der alte Chiffretext in der Zeile steht (hat
   ein Nutzer zwischendurch neu gespeichert, gewinnt sein Wert), und gibt nie
   einen Key oder ein Secret aus.
5. Probelauf noch einmal: "nur altes Secret: 0".
6. `API_KEY_ENCRYPTION_SECRET_PREVIOUS` in Vercel löschen, deployen. **Erst jetzt
   ist das alte Secret wirklich ungültig**, solange die Variable steht, öffnet
   es alles, was noch nicht umgeschlüsselt ist.

Zeilen, die weder das alte noch das neue Secret öffnet, meldet das Skript mit
Exit 3 und Zeilen-ID. Es löscht nie etwas; der Nutzer muss den Key neu eingeben.
Das Skript liest die Werte bewusst nur aus der Umgebung, nie aus einer
`.env`-Datei (Aufruf im Kopfkommentar), damit eine Rotation nicht versehentlich
gegen die falsche Datenbank läuft.

## Docker

Siehe [`DOCKER.md`](DOCKER.md), Dev (Hot-Reload, Port 3000) und Prod (standalone,
Port 3001) als jeweils ein Befehl.

## Design

Siehe [`DESIGN.md`](DESIGN.md), Token-System, Theme-Regeln, Komponenten-Status.

## Qualität

Vor jedem Commit muss das volle Gate grün sein:

```bash
npm run audit:gate && npm run typecheck && npm run lint && npm run test && npm run build
```

[CI](../.github/workflows/ci.yml) führt genau dieselbe Kette bei jedem Push auf
jeden Branch und bei jedem Pull Request aus. Die Smoketests laufen getrennt in
[`e2e.yml`](../.github/workflows/e2e.yml) (nur wenn etwas Betroffenes geändert wird,
dazu wöchentlich), und `docker.yml` hält den Docker-Pfad am Leben. `audit:gate` ist
`npm audit --audit-level=high` plus eine kurze, befristete Ausnahmeliste für
Funde ohne gepatchte Version (`scripts/audit-gate.mjs`).

## Ende-zu-Ende-Tests

Die Unit-Tests prüfen Bausteine, nicht, ob ein eingeloggter Nutzer durch das
Produkt kommt. Die Smoketests in [`e2e/`](../e2e) bedienen die App im echten
Browser (Playwright, Chromium) gegen einen **lokalen Supabase-Stack**, nie gegen
ein gehostetes Projekt.

### Ablauf

Voraussetzungen: Docker und die Supabase-CLI (Version wie in
[`e2e.yml`](../.github/workflows/e2e.yml), derzeit 2.119.0).

```bash
supabase start          # baut die Datenbank aus supabase/migrations/ neu auf
npm run test:e2e        # startet einen eigenen Dev-Server auf Port 3100
supabase stop           # danach (optional, --no-backup verwirft die Daten)
```

Ohne installierte CLI geht es auch so (Windows, Git Bash):

```bash
export E2E_SUPABASE_CLI="npx --yes supabase@2.119.0"
npx --yes supabase@2.119.0 start
npm run test:e2e
```

Einmalig: `npx playwright install chromium`. Ein einzelner Test:
`npx playwright test e2e/chat.spec.ts --project desktop`; mit Browserfenster
`--headed`; einen fehlgeschlagenen Lauf sieht man mit
`npx playwright show-report`.

### Was geprüft wird

| Datei | Prüft |
|---|---|
| `smoke.spec.ts` | der Test-Server spricht nur mit dem lokalen Stack (kein Supabase-Projekt, kein Turnstile aus `.env.local`), öffentliche Seiten antworten, Unbekanntes ist 404, die App ist ohne Anmeldung zu |
| `auth.spec.ts` | Registrieren, Abmelden, Anmelden über die Formulare, falsches Passwort, schwaches Passwort wird im Server abgewiesen |
| `chat.spec.ts` | Frage senden und Antwort, nach dem Neuladen noch da; Textanhang landet in Tabelle UND Speicher, byte-gleich; ein Free-Konto sieht den Key-Hinweis vor dem Tippen |
| `projects.spec.ts` | Projekt anlegen, Anweisungen speichern, Datei hochladen, Chat im Projekt, Löschen räumt Zeilen und Dateien im Speicher auf |
| `account.spec.ts` | Datenexport (eigene Daten ja, fremde und Geheimnisse nein), Sprachwechsel, Konto löschen samt Dateien |
| `mobile.spec.ts` | Telefonmaß (Pixel 7): Menü, Chat, keine Seite läuft über den Rand |

### Was bewusst NICHT geprüft wird

- **Eine echte KI-Antwort.** Es ist kein Modell-Anbieter konfiguriert, der Chat
  antwortet mit der Demo-Antwort (Stub-Modus, nur in Entwicklung erlaubt, daher
  läuft der Test-Server im Dev-Modus). Dass die Antwort gut ist, prüft kein Test.
- **Der Sprachmodus.** Die Web Speech API gibt es in einem automatisierten
  Chromium nicht verlässlich, und ein Mikrofon gibt es nicht.
- **Zahlungen und Webhooks** (Lemon Squeezy), **Turnstile**, **Upstash/Redis**,
  **E-Mail-Bestätigung und Passwort-Reset-Mails**, **OAuth** (Google/GitHub).
  Der lokale Stack hat die Bestätigungsmail ausgeschaltet
  (`supabase/config.toml`), das ist der einzige gewollte Unterschied beim Auth.
- **Den Produktions-Build.** `next start` verweigert den Stub-Chat, deshalb
  läuft hier der Dev-Server. CSP und statische Seiten im Produktions-Build
  prüfen `tests/guards/` und `docker.yml`.
- **Last, andere Browser, Tastatur-Barrierefreiheit.** Nur Chromium, ein Nutzer.
- **fr/it/es.** Die Tests laufen auf Deutsch, der Sprachwechsel nur auf Englisch.

### Wie nah der lokale Stack an der Produktion ist

Am 05.10.2026 gemessen: nach `supabase start` stimmen Spalten, Richtlinien,
RLS-Stand, Indizes, Buckets sowie Tabellen- und Spaltenrechte für `anon` und
`authenticated` mit der Produktions-Datenbank überein (Hash über die sortierte
Liste, Zahl der Zeilen gleich). Die einzigen Unterschiede sind bekannt:

- Migration 0043 ist in Produktion noch nicht angewendet (Tabelle
  `subscriptions` und Spalte `profiles.stripe_customer_id` gibt es dort noch).
- `public.rls_auto_enable()` legt Supabase nur auf gehosteten Projekten an.
- Migration 0046 (`set_active_byok_provider` nicht mehr für `anon`) ist dort
  ebenfalls noch offen.

Dafür waren zwei Eingriffe im Repository nötig, und beide sind Absicht:

1. **`0003_harden_functions.sql`** setzte ein `REVOKE` auf `rls_auto_enable()`
   voraus, die es lokal nicht gibt: das Schema war aus dem Repository nicht
   nachbaubar. Das `REVOKE` ist jetzt bedingt (`to_regprocedure`), die Wirkung
   auf einem gehosteten Projekt ist unverändert.
2. **`supabase/roles.sql`** nimmt `anon` und `authenticated` die automatischen
   Rechte auf neu angelegte Tabellen (`alter default privileges`). Der lokale
   Stack vergibt sie von sich aus, Produktion nicht. Ohne diese Datei fiele ein
   vergessenes `GRANT` in einer Migration lokal nie auf und wäre in Produktion
   ein „permission denied": genau der Fehler, den 0002 einmal behoben hat.

### Sperren

- `e2e/support/env.ts` verweigert jede Datenbank-Adresse außer `127.0.0.1` und
  `localhost`. Die Tests legen Konten an und löschen sie wieder.
- Der Test-Server bekommt seine Umgebung vollständig vom Test: alle Dienste, die
  er nicht nutzen darf (Modell-Anbieter, Upstash, Turnstile, Zahlung,
  Alarm-Webhook, GitHub-Token), stehen auf leer und schlagen damit die echte
  `.env.local`. `smoke.spec.ts` prüft das an Werten, die dort wirklich stehen.
- Der Test-Server läuft auf Port 3100 und nie auf einem schon laufenden Server
  (`reuseExistingServer: false`), damit ihn kein Dev-Server mit echten
  Zugangsdaten ersetzt.

### Neuer Test, neue Migration

Ein neuer Test bekommt sein Konto aus `support/fixtures.ts` (`signedIn`,
`makePro` für den Chat) und räumt es selbst weg. Eine neue Migration braucht
nichts: `supabase start` wendet sie an, und fehlt ihr ein `GRANT`, fällt das hier
auf. Die Tests wurden einmal gegengeprüft, indem je ein Fehler in die App
eingebaut wurde (Projekt-Löschen ohne Speicher-Aufräumen, Export mit internem
Pfad, Schranke gegen schwache Passwörter aus): jeder machte genau den
zuständigen Test rot.

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

**GitHub-Kontingent und `GITHUB_TOKEN`.** Der Import braucht zwei Anfragen an
`api.github.com` je Analyse (Metadaten, Dateibaum), die Dateiinhalte kommen vom
Raw-CDN und zählen nicht mit. Ohne Token gilt das Limit von 60 Anfragen pro Stunde
und IP, also 30 Analysen, und auf einer geteilten Server-IP teilen sich alle
Nutzer es (am 05.10.2026 gegen `octocat/Hello-World` und dieses Repository
gemessen: zwei zählende Anfragen je Import, die zehn bis vierzehn Raw-Anfragen
ohne `x-ratelimit`-Header). Mit einem Token ohne Scopes sind es 5000 pro Stunde
(GitHub → Settings → Developer settings → Fine-grained tokens, nur öffentliche
Repositories, keine Berechtigungen), gesetzt als `GITHUB_TOKEN`.

Ob er in Produktion greift, steht im Log: jede Anfrage an `api.github.com` schreibt
`brain.github_quota` mit `authenticated`, `limit` und `remaining` (nie den Token
selbst). Mit Token steht dort `limit: 5000`, ohne `limit: 60`. Ist das Kontingent
aufgebraucht, kommt zusätzlich `brain.github_rate_limited` als Warnung (geht an
den Alarm-Webhook, wenn einer gesetzt ist).

**Keine Embeddings, bewusst.** Siehe [CLAUDE.md](../CLAUDE.md) für die Begründung
und die Bedingung, unter der sich das ändern würde.

## Anbieter-Ausfall (Failover auf Gemini)

Fällt Z.ai länger aus, ist der Chat für jeden ohne eigenen Key tot, wenn nichts
umschaltet. Mit **beiden** Server-Keys (`ZAI_API_KEY` und `GEMINI_API_KEY`) tut es
[`src/server/llm-failover.ts`](../src/server/llm-failover.ts). Ohne `GEMINI_API_KEY`
bleibt alles wie bisher.

**Wann umgeschaltet wird.** Nur nach den drei Versuchen von `llm-retry.ts`, nur bei
einem Ausfall (Netzabbruch, 408/425/5xx, 429 ohne Guthaben-Text, oder 30 Sekunden
ohne erstes Textstück), nie bei 400/401/403/404/422, leerer Antwort oder
aufgebrauchtem Guthaben (das soll jemand sehen, nicht still auf eine teurere
Rechnung umleiten), nie bei einem Zug mit eigenem Key (BYOK), und bei einem Stream
nur, solange noch kein Textstück beim Nutzer angekommen ist.

**Leistungsschalter.** Drei gescheiterte Züge in Folge innerhalb von zwei Minuten
öffnen ihn (Redis, gilt für alle Instanzen). Dann gehen die Züge 60 Sekunden direkt
zu Gemini, statt erst dreimal gegen den toten Anbieter zu laufen. Danach versucht
ein Zug Z.ai wieder: gelingt er, ist der Schalter zu, scheitert er, ist er sofort
wieder offen. Fällt Redis aus, gilt er als zu (wie bisher zuerst Z.ai).

**Kosten.** Laut Preis-Übersicht (Stand 03.09.2026) kostet `gemini-3.5-flash`
$1,50/$9,00 je Million Tokens gegen $0,20/$1,10 bei `glm-4.5-air`, also etwa das
Achtfache: ein Zug mit 6k rein und 1,5k raus rund $0,0225 statt $0,0029. Darum ein
eigenes Tagesbudget (`LLM_FAILOVER_DAILY_CALLS`, Vorgabe 200 Züge, rund $4,50). Jeder
Zug zählt außerdem weiter einmal gegen Monatskontingent und `LLM_DAILY_CALL_BUDGET`.
Ist das Failover-Budget aufgebraucht, laufen keine Züge mehr auf Gemini.

**Datenschutz.** Im Ausfall gehen Nachrichten, Anhänge und Projektdateien an Google.
Der Key muss deshalb aus einem Projekt mit **aktivierter Abrechnung** stammen: auf
dem Gratis-Tarif darf Google Prompts zur Produktverbesserung nutzen, auf der
bezahlten Stufe nicht. Die Datenschutzerklärung nennt Gemini als „Ausweich-Anbieter,
falls Z.ai nicht verfügbar ist“; erst mit diesem Failover stimmt der Satz. Ob die
Formulierung alle Fälle trägt (Anhänge, Projektdateien), sollte juristisch angesehen
werden.

**Was du im Log siehst.** `llm.retry` (jeder Wiederholungsversuch), `llm.failover`
(Warnung, geht an den Alarm-Webhook: `from`, `to`, `reason`, `attempts`),
`llm.breaker_open` (Warnung) und `llm.breaker_closed`,
`spend_guard.failover_budget_exhausted` (Warnung). `chat.turn` und
`chat.turn_failed` tragen den Anbieter, auf dem der Zug WIRKLICH lief (`provider`).

**Zeitlimit.** Der Z.ai-Stream hat jetzt ein Zeitlimit bis zum ersten Textstück
(30 Sekunden, `ZAI_FIRST_CHUNK_TIMEOUT_MS` in `llm.ts`). Vorher hatte er keines: ein
hängender Anbieter blockierte den Zug bis zur `maxDuration` der Route (300
Sekunden). Das gilt auch ohne Gemini-Key; danach läuft ein Stream beliebig lange.

**Aktivieren.** `GEMINI_API_KEY` (bezahlte Stufe) in Vercel setzen, neu deployen.
Ohne Key tut der Code nichts. Geprüft ist er mit simulierten Ausfällen
(`llm-failover.test.ts`, `llm.test.ts`), **nicht** gegen den echten Gemini-Dienst.

## Anhänge im Chat

Ein „+" im Composer hängt Fotos (PNG, JPG, WebP) und Text-, Code- oder
Konfigurationsdateien an eine Nachricht, bis zu vier. Die Anhänge bleiben im Chat
und gehen bei späteren Antworten erneut mit, soweit sie ins Modell-Budget passen.

- Grenzen an einer Stelle: [`src/shared/lib/chat-limits.ts`](../src/shared/lib/chat-limits.ts)
- Prüfen, ablegen, nachschlagen: [`src/features/chat/lib/attachment-store.ts`](../src/features/chat/lib/attachment-store.ts)
- Was beim Modell ankommt (Budget, Kürzen): [`attachment-model.ts`](../src/features/chat/lib/attachment-model.ts), [`model-history.ts`](../src/features/chat/lib/model-history.ts)
- Tabelle `message_attachments` und privater Bucket `chat-attachments`: **Migration 0045**.
  Der Bucket hat bewusst **keine insert-Policy**, geschrieben wird nur in `/api/chat`
  über den Service-Role-Client, nachdem Magic Bytes, Kodierung, Grössen und das
  Speicherkontingent (100 MB je Konto) geprüft sind.
- **Reihenfolge beim Deploy: erst Migration 0045 anwenden, dann den Code.** Läuft
  der Code ohne die Migration, geht der Chat weiter (Verlauf ohne Anhänge), aber
  jede Nachricht MIT Anhang scheitert mit "konnte nicht gespeichert werden".
- Z.ai: ein Zug, dessen Verlauf ein Bild trägt, läuft auf dem sehenden Modell
  (`ZAI_VISION_MODEL`, Default `glm-4.6v`) statt auf `glm-4.5-air`. Teurer, aber nur
  für Züge mit Bild.
- Verwaiste Objekte im Bucket (ein Aufräumschritt, der nach dem Löschen scheiterte):
  `node scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments`
