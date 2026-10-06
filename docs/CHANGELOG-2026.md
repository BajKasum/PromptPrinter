# Changelog 2026, Verlauf der Entscheidungen und Umbauten

Aus `CLAUDE.md` hierher verschoben (2026-10-06, Betriebs-Audit M7), **unverändert**:
jeder Block beschreibt den Stand zum Zeitpunkt seines Datums, nicht den heutigen.
Was heute gilt, steht in [CLAUDE.md](../CLAUDE.md), Abschnitt "IST-Zustand".
Ein Block darf also etwas als offen oder noch nicht angewendet bezeichnen, das später
erledigt wurde (z. B. die Migrationen 0043 und 0046, am 2026-10-05 angewendet).
Neue Einträge kommen **oben** unter diesen Kopf, jeder mit Datum im Titel. Einzige Änderung
gegenüber dem Original: die Pfade der Links sind relativ zu `docs/`, und ein Link auf eine
verschobene Datei zeigt auf ihren neuen Ort (`src/server/llm.ts` → `src/server/llm/index.ts`).

---

**Betriebs-Audit, Folgesitzung M7 bis M10 (2026-10-06, PR #42 bis #65):**
Nur diese vier Punkte, K1 bis K3 blieben unberührt. Der Nachlauf zu M1 bis M6 entfiel:
Kasum hatte bis dahin nichts davon erledigt (GITHUB_TOKEN, GEMINI_API_KEY, STRIPE_*-Variablen,
Fehler-Tracker-Entscheid).

- **M10, Abhängigkeiten.** Gleich zu Beginn färbte ein neues Advisory (GHSA-68fv-2mgg-jv7q,
  `source-map-js`, CVSS 7.5, gepatcht in 1.2.2) jeden Branch rot: der Fall, den M10 verhindern
  soll. Behoben mit einem Lockfile-Update (#42, kein `overrides`-Eintrag nötig). **Dependabot**
  (#43): npm und Actions montags, Minor und Patch in einem PR je Ökosystem, jeder Major einzeln,
  höchstens 5 bzw. 3 offene PRs, **kein Auto-Merge**; er öffnete sofort 8 PRs, genau nach
  Konfiguration. Die Supabase-CLI-Version (die Dependabot nicht sieht) steht in e2e.yml,
  SETUP.md und env.ts, `pinned-versions.test.ts` hält sie gleich (6 Mutationen). **Täglicher
  Audit** (#52, `audit.yml`, 4:37 UTC): meldet per **einmaligem GitHub-Issue** (anlegen, bei
  Folgefehlern ergänzen, bei sauberem Lauf schließen) und warnt 7 Tage vor Ablauf einer
  Ausnahme. Alle drei Zweige gegen echtes GitHub geprüft (Test-Issue #53, danach geschlossen),
  12 Mutationen. Dabei fiel ein **echter Fehler** auf: Dependabots Gruppen-Refresh scheiterte
  mit `Override for postcss@8.5.28 conflicts with direct dependency` (`EOVERRIDE`), weil
  `postcss` direkte Abhängigkeit UND Override mit derselben Spanne war. Reproduziert und mit
  `"postcss": "$postcss"` behoben (#54), ein Guard hält es fest. Danach lief der Refresh
  (Sammel-PR #56 grün), und ein `ignore` für den `@types/node`-Major schloss den PR mit
  Version 26. **braces** (GHSA-vfj7-8cjw-p6xm): am 2026-10-06 weiter **ohne gepatchte Version**
  (`first_patched_version: null`, `npm view braces`: neueste 3.0.3, betroffen alle bis 3.0.3).
  Die Ausnahme läuft am 2026-11-04 ab, das tägliche Issue warnt ab dem 28.10. Entscheid dann:
  Upstream-Fix, Tailwind 4 (Breaking Change) oder Verlängerung mit Beleg.
- **M8, Node-Version.** Produktion lief auf 24 (Vercel), CI, E2E, Docker und `.nvmrc` auf 22.
  Laut nodejs/Release `schedule.json` (06.10.2026): 20 abgekündigt, 22 nur noch Maintenance
  (bis 2027-04-30), 24 Active LTS bis 2026-10-20, danach Maintenance bis **2028-04-30**, 26 wird
  am 2026-10-28 LTS, **Vercel bietet 26 gar nicht an** (nur 24.x, 22.x, 20.x). Kasum wählte
  **Node 24**. `.nvmrc` ist die Quelle, die drei Workflows lesen sie, Dockerfile `node:24-alpine`,
  `engines.node` `24.x`, `@types/node` `^24` (#55). `engines.node` **übersteuert** laut Vercel-Doku
  die Projekt-Einstellung, die ohnehin auf `24.x` stand: eine Änderung an Vercel war nicht nötig.
  `node-version.test.ts` liest alle Stellen (14 Mutationen) und prüft in der CI zusätzlich die
  echte Laufzeit. CI, E2E und Docker-Image unter 24 grün, Produktions-Deployment READY,
  `/api/health` ok. **Nicht belegt:** die Node-Version der Laufzeit selbst (das Build-Log nennt
  sie nicht). **Lokal nicht gelaufen:** `npm run test:e2e` (Docker Desktop startete nicht,
  die CI belegt denselben Commit).
- **M9, Auth-Mails.** Laut Supabase-Doku liefert der Standardversand **nur an Adressen aus dem
  Projekt-Team** aus ("Email address not authorized"). Registrierungen laufen heute ohne Mail
  (Sofort-Login, bei keinem der 5 Konten je eine Bestätigung ausgelöst), betroffen wäre der
  **Passwort-Reset**. Die DNS-Zone liegt bei Vercel und trägt weder MX noch SPF, DKIM oder
  DMARC. **Nicht belegt:** ob im Dashboard ein eigener SMTP steht (Kasum hat noch nicht
  nachgesehen). Gebaut: vier deutsche Vorlagen in `supabase/templates/` samt Guard (#57),
  Anleitung für Brevo in SETUP.md (gewählt, **nichts gebucht, kein DNS geändert**), Datenschutz-
  Entwurf im Vault. Der neue Browser-Test für den Reset mit **echter Mail** (Mailpit, #58) fand
  einen Fehler, den kein Unit-Test sah: `verifyOtp({ token_hash, type })`, der Weg der Vorlage und
  der Route, stellt bei GoTrue IMMER die Anmeldemethode `otp` aus (supabase/auth, `verify.go`,
  `verifyPost`), die Seite "Neues Passwort" verlangte seit M-7 aber `recovery`: **jeder Reset
  über die Vorlage endete bei "Link ungültig"**. Kasum entschied: `token_hash` behalten, Seite
  lockern (#59): `otp` zählt nur frisch (10 Minuten), `recovery` wie bisher. Was in Produktion
  gilt, hängt am Text der Vorlage im Dashboard und ist nicht belegt (Standard-`ConfirmationURL`
  → `recovery`, ging; `token_hash` → `otp`, ging nicht).
- **M7, Wartbarkeit.** Je Datei ein PR, je PR zwei Commits (erst Tests gegen den alten Code, dann
  der Schnitt mit unveränderten Tests), die Dateien skriptgesteuert aus Zeilenbereichen des
  Originals erzeugt. `CLAUDE.md` 1739 → 418 Zeilen, der Verlauf wörtlich hierher (#61, mit
  Link-Guard `doc-links.test.ts`). `llm.ts` 1451 Zeilen → `src/server/llm/` mit 12 Dateien (#63,
  26 neue Charakterisierungstests, 16 Mutationen, 1295 von 1295 Codezeilen wörtlich). `POST
  /api/chat` 860 → 94 Zeilen in `route.ts` plus vier Schritt-Dateien in `app/api/chat/` (#64,
  23 Tests zur Reihenfolge und Rückgabe der Reservierungen an jedem Ausstieg, 14 Mutationen).
  `chat.tsx` 865 → 144 Zeilen mit Hooks und Teilkomponenten (#65, 16 Tests, 18 Mutationen, 17
  gefangen, eine äquivalent). **Grenze:** Code-Dateien höchstens 400 Zeilen (alle neuen Dateien
  liegen darunter, die größte hat 327), `CLAUDE.md` höchstens 450. Noch darüber, nicht Teil
  dieses Durchgangs: `hero.tsx` (590), `rate-limit.ts` (504), die Wörterbücher (Daten).
- **Aufgefallen, nicht angefasst:** ein **leer gesetztes** `ZAI_MODEL` (`ZAI_MODEL=`) ergibt wegen
  `??` ein leeres Modell statt des Standards. Und der Mutations-Läufer ersetzte einmal ein
  Verzeichnis durch eine Datei (ein altes Backup gleichen Namens); wiederhergestellt, die
  Läufer sichern seitdem in einmalige Ordner.
- **Offen:** Kasum: Dashboard zu Auth-Mails nachsehen, Mail-Anbieter buchen und DNS (nur mit seinem
  Ja), "Dependabot security updates" einschalten, die offenen Dependabot-PRs durchsehen, die
  `braces`-Entscheidung, die vier Punkte aus M1 bis M6. Juristisch: Datenschutz zu Brevo und zum
  Ausweich-Anbieter.

> **Vercel Speed Insights (2026-10-06, PR #60):**
> Auf Kasums Wunsch Ladezeiten (Web Vitals) echter Besucher in Vercel
> auswertbar. `@vercel/speed-insights` ^2.0.0, eingebunden als
> `<SiteSpeedInsights />` im Root-Layout
> ([`src/shared/providers/site-speed-insights.tsx`](../src/shared/providers/site-speed-insights.tsx)),
> also auf öffentlichen Seiten wie in der App. Kein Env-Wert, kein Schalter im
> Dashboard (laut Vercel-Doku vom 06.10.2026 reicht das Paket, die Pfade
> `/_vercel/speed-insights/*` stellt Vercel bereit). Ansehen: Vercel → Projekt →
> Speed Insights. Details, Kosten und Grenzen: `docs/SETUP.md`, "Geschwindigkeitsmessung".
>
> **Drei Entscheidungen, die nicht im Quickstart stehen:**
>
> - **Eigene Wrapper-Komponente statt `<SpeedInsights />` direkt im Layout.**
>   `beforeSend` ist eine Funktion und kommt nicht als Prop vom Server- in einen
>   Client-Component. Außerdem rendert der Wrapper **nur im Produktions-Build**:
>   in der Entwicklung lädt das Paket ein Debug-Skript von
>   `va.vercel-scripts.com`, das unsere CSP zu Recht blockiert (und damit auch
>   `npm run test:e2e` mit Konsolenfehlern gefüllt hätte). Statt die Policy zu
>   lockern, misst die Entwicklung nicht.
> - **Adressen werden vor dem Senden gekürzt**
>   ([`speed-insights-event.ts`](../src/shared/lib/speed-insights-event.ts)). Das
>   Vercel-Skript schickt `location.href` vollständig (im ausgelieferten Skript
>   nachgelesen). Bei uns stehen darin Chat- und Projekt-UUIDs im Pfad und, bei
>   Anmelde-/Bestätigungslinks, Einmalwerte in der Query. Query und Fragment
>   fallen weg, jede UUID wird zu `[id]`, eine nicht lesbare Adresse wird gar
>   nicht gesendet.
> - **Keine CSP-Änderung**: das Skript liegt auf unserer eigenen Adresse, die
>   Messwerte gehen dorthin zurück (`'self'` in `script-src` und `connect-src`,
>   auch in der Nonce-Policy der App). `csp.test.ts` hält fest, dass es dabei
>   bleibt: wer `scriptSrc`/`endpoint` auf einen fremden Host stellt, muss
>   `csp.ts` mitziehen. Die öffentlichen Seiten bleiben statisch (die
>   Komponente nutzt weder `headers()` noch `cookies()`).
>
> **Rechtstexte mitgezogen, nicht optional:** die Datenschutzerklärung sagte
> wörtlich "wir betreiben keine Webanalyse" und `/cookies` "wir binden keine
> Drittanbieter zu solchen Zwecken ein". Beides stimmte mit dem Einbau nicht
> mehr. Neu: Abschnitt "Messung der Ladegeschwindigkeit" (Ziffer 2), Rechtsgrundlage
> berechtigtes Interesse (Ziffer 3), Vercel Speed Insights als Empfänger
> (Ziffer 4), Speicherdauer nach Vercels Fristen (Ziffer 6); `/cookies` Ziffer 1
> und 3. `LEGAL.lastUpdated` auf den 06.10.2026 (gilt für alle Rechtstexte
> gemeinsam). Die Angaben stammen aus Vercels Dokumentation
> (<https://vercel.com/docs/speed-insights/privacy-policy>) und sind als
> "nach Angaben von Vercel" gekennzeichnet. **Juristisch ansehen lassen**, wie
> jede Änderung an den Rechtstexten. **Nicht belegt:** wie lange Vercel die
> Messwerte aufbewahrt (steht in der Dokumentation nicht), deshalb nennt der Text
> keine Zahl.
>
> **Auf der Vorschau von PR #60 im Browser geprüft (06.10.2026):** das Skript
> kommt über den zufälligen Pfad der "Resilient Intake" von der eigenen Domain
> (`/<16 Hex-Zeichen>/script.js`, Messwerte an `/<…>/vitals`; die Vercel-Doku
> spricht von einem Zufallswert "zur Build-Zeit", beobachtet wurde aber derselbe
> Präfix auf der Vorschau und in Produktion, von einem Wechsel mit jedem Build
> sollte man also nicht ausgehen) und antwortet auch einem Abgemeldeten mit 200. Die
> Middleware steht nicht im Weg: ein unbekannter Pfad unter demselben Präfix
> landet in unserer App (HTML-404 mit unserer CSP), `/vitals` antwortet mit der
> JSON-404 der Vercel-Plattform, die Route gehört also der Plattform. Kein
> Cookie, nichts in `localStorage`/`sessionStorage`, keine Antwort mit
> `Set-Cookie`, kein CSP-Verstoß durch das Skript. Die einzige Konsolenmeldung
> (`vercel.live/_next-live/feedback`) ist Vercels Vorschau-Leiste, die es nur auf
> Preview-Deployments gibt. Die `beforeSend`-Funktion wurde im echten Bundle
> aufgerufen: UUID, Query und Fragment fallen weg, eine unlesbare Adresse wird
> zu `null`.
> **Nach dem Merge auf `promptprinter.app` wiederholt:** dasselbe Skript und
> derselbe Pfad, Status 200, keine Cookies, kein Browser-Speicher, keine
> Konsolenmeldung; Datenschutzerklärung und `/cookies` zeigen die neuen Abschnitte,
> die alten Aussagen ("keine Webanalyse", "keine Drittanbieter zu solchen Zwecken")
> sind weg.
> **Nicht geprüft:** dass Messwerte im Dashboard ankommen. Das braucht echte
> Besuche auf `promptprinter.app`, und das Senden selbst ist ein `no-cors`-Request
> ohne lesbare Antwort. Das Skript misst außerdem nicht, wenn `navigator.webdriver`
> gesetzt ist oder der User-Agent "Headless" enthält, automatisierte Browser
> (Playwright, Lighthouse im Headless-Modus) erzeugen also keine Daten.
>
> **Nicht dasselbe wie Web Analytics.** Der Vermerk im
> Rechts-Audit-Block vom 28.09.2026 ("Nicht mergen: den Vercel-Bot-Branch
> `vercel/install-vercel-web-analytics-…`") gilt unverändert, siehe `CLAUDE.md`: Web Analytics (`@vercel/analytics`, Besucherzahlen und
> Herkunft) ist ein anderes Produkt, in den Rechtstexten nicht genannt und nicht
> eingebaut. Speed Insights misst nur Ladezeiten.
>
> **Kosten:** kostenlos auf allen Tarifen, 10.000 Ereignisse in 30 Tagen
> (rollend, geteilt über das Team); bei Erreichen pausiert Vercel die Messung für
> mindestens 14 Tage, es gibt keine Rechnung. Im kostenlosen Tarif nur Real
> Experience Score und Zähler je Seite, alle Core Web Vitals erst mit Speed
> Insights Plus (nur Pro).

⚠️ **Workspace-Redesign (2026-07): Phasen 1-4 + Wahrheits-Pass umgesetzt.**
[REDESIGN.md](REDESIGN.md) ist das **verbindliche Zielmodell** und bleibt die
Detailquelle (Datenmodell, Kontext-Injektions-Budget, offene Nachschritte).
Kurzfassung des IST-Zustands:

- **Nav zweigliedrig** (Chats/Projekte, kein „Start"), Sidebar einklappbar
  (Cookie `pp-sidebar`, `Strg/⌘+B`) mit Recents. Login landet auf `/chats/new`.
- **Eine Chat-Erfahrung**, keine Modus-Wahl (`conversations.mode` nur noch
  intern). Kanonische Routen `/chats/new` + `/chats/[id]`; `/chat` und
  `/dashboard` sind reine Redirects.
- **Projekte sind Workspaces**: direkt anlegbar (`POST /api/projects`),
  persistente Shell (`projects/[id]/layout.tsx`) mit Kontext-Rail
  (Anweisungen, Struktur, Dateien, Ergebnisse-Karte), Hauptspalte wechselt
  per Subroute (Übersicht, `chats/[cid]`, `results`). Mehrere Chats pro
  Projekt.
- **Produktionsweg entfernt (2026-07-16, siehe „Handoff entfernt" unten)**:
  ~~jeder Projekt-Chat kann direkt ein Ergebnis erzeugen~~, das war der
  Stand bis zur Entfernung der Handoff-Funktion. `/api/generate` samt der
  ganzen Erzeugungs-Pipeline ist seit 2026-07-17 komplett entfernt (C-1,
  siehe unten), keine tote Route mehr im Repo.
- **Dateien**: `project_files`-Tabelle + privater `project-files`-Bucket,
  Upload/Löschen in der Rail, Allowlist `.md/.txt/.json/.csv`, max. 10 à
  200 KB. `buildProjectContext` injiziert Anweisungen → Struktur → Dateien
  → Idee/Artefakt, mit Budget (Details: REDESIGN.md §7).
- **Wahrheits-Pass erledigt**: Landing (`ProductShowcase`) zeigt die echte
  Nav ohne Modus-Badges, Settings-Copy korrigiert, toter Code
  (`ProjectCard`-Komponente) entfernt.

**Nachschritt erledigt:** „In Projekt verschieben" für bestehende globale
Chats, Icon-Button in `chat-list.tsx` (nur global) öffnet einen
Projekt-Picker (`move-to-project.tsx`), setzt `conversations.project_id`
per RLS-scoped Client-Update, kein neuer API-Endpunkt.

Offen, bewusst zurückgestellt: Settings-Tool-Defaults behalten-oder-
streichen (Grundsatzfrage, kein bekannter Bruch).
`buildProjectContext` injiziert Dateien jetzt nach Struktur, vor Idee/
Artefakt: `.md` zuerst, Gesamtbudget 12.000 Zeichen, 3.000 pro Datei
(Kostenpass 2026-07, siehe unten), nicht injizierte Dateien werden nur
namentlich erwähnt. Projekt-Löschen räumt jetzt auch die Storage-Objekte
auf (kein Leak).

**Kostenpass (2026-07):** Default-Modell auf `glm-4.5-air` gesenkt (6×/3,6×
günstiger als `glm-5-turbo` bei Input/Output, live gegen den Account
geprüft), `DEFAULT_MAX_OUTPUT_TOKENS` 8192→6144, Chat trimmt die an das
Modell gesendete Historie auf die letzten 12 Nachrichten (gespeichert wird
weiterhin die volle Transkript), Projektkontext-Budgets in `buildProjectContext`
halbiert (Dateien, Anweisungen, Idee, Artefakt-Referenz). Reine Parameter-
optimierung, keine Produktänderung, Details in `src/server/llm.ts` und
`src/app/api/chat/route.ts`.

**Kritik-Pass + BYOK + Refactoring (2026-07):** Auf Bitte um eine schonungslos
kritische Bewertung der App als neuer Nutzer entstand eine lange Liste
echter Lücken, alle abgearbeitet (Commits `977474a`..`bb923eb`):

- **BYOK ist jetzt real, nicht nur versprochen** (`3a8f1b8`): Nutzer
  hinterlegen in Settings (`api-keys.tsx`) eigene Anthropic-/OpenAI-/
  Gemini-Keys, `POST/DELETE /api/settings/api-key`, AES-256-GCM-
  verschlüsselt (`src/lib/crypto.ts` + Server-Secret
  `API_KEY_ENCRYPTION_SECRET`, siehe `.env.example`), Tabelle
  `user_api_keys` (Migration `0015_user_api_keys.sql`, **live gegen die
  Supabase-DB angewendet**, nicht nur lokal committed). `llm.ts` kennt
  jetzt 4 Provider: Z.ai (Server-Default), Gemini (Server-Zweit), Anthropic
  + OpenAI (nur BYOK, kein Server-Key dafür vorgesehen). Ein eigener Key
  übersteuert den Server-Key komplett und hebt sowohl das Generierungen- als
  auch das Chat-Nachrichten-Limit auf (der Nutzer zahlt dann selbst).
- **PDF-Export** für Pro eingelöst (`jspdf`, `src/lib/pdf-export.ts`);
  „Priorisierte Warteschlange" (nie gebaut) aus dem Pricing gestrichen.
- **Chat-Kostenrisiko geschlossen** (`826b753`): `/api/chat` hatte kein
  Plan-Limit, nur den 120/h-Ratelimit, theoretisch ~86k Nachrichten/Monat
  auf dem Server-Key. Jetzt `chatMessages` in `plans.ts` (Free 200/Monat,
  Pro/Team 2000/Monat), BYOK hebt es auf, Anzeige in Settings + Billing.
- **Datenschutzerklärung korrigiert** (`977474a`): nannte nur Google Gemini
  als Auftragsbearbeiter, tatsächlich läuft die Generierung primär über
  Z.ai, China als Drittland ergänzt (Standardvertragsklauseln statt
  EU-US Data Privacy Framework, da kein Angemessenheitsbeschluss besteht).
- **Zwei God-Objekte aufgelöst**, reine Verhalten-erhaltende Refactorings,
  keine Logik-/Optikänderung: `api/generate/route.ts` 375→~130 Zeilen
  (`b0975d3`, → `lib/generate-guards.ts`, `build-generate-content.ts`,
  `run-generation.ts`, `persist-generation.ts`, geteiltes `lib/api-problem.ts`
  jetzt auch von `api/chat/route.ts` genutzt, vorher zwei divergierende
  Kopien); `chat.tsx` 667→260 Zeilen (`bb923eb`, → `chat-markdown.tsx`,
  `chat-empty-state.tsx`, `chat-result-panel.tsx`, `chat-transcript.tsx`,
  `chat-handoff-menu.tsx`, `chat-composer.tsx`, `lib/chat-variants.ts`,
  `lib/use-copy-to-clipboard.ts`).
- **Sidebar umgebaut** (`f453b81`): Pillen-Umschalter Chat/Projekt (nur eine
  Liste sichtbar, routegetrieben über `pathname`) statt beide Listen
  dauerhaft übereinander. Desktop (`sidebar.tsx`) und Mobile-Drawer
  (`mobile-nav.tsx`, `4dc716f`) teilen sich seither `ACTIVE_ROW`/
  `INACTIVE_ROW`/`TabSwitcher` aus `sidebar.tsx`, statt zweier Kopien, die
  auseinanderdriften können. ⌘K durchsucht jetzt auch Chats (`64ec1cb`).
- **Kleinere Fixes:** Navbar-Wortmarke zweifarbig + kollabiert beim
  Scrollen (synchron mit dem 8px-Pillen-Trigger), Signup zeigt AGB/
  Datenschutz-Hinweis + natives `minlength=8`, Hero-Demo-Fenster sagt
  „· Demo" (sah wie ein echtes Eingabefeld aus), Stub-Antworten ohne
  Entwickler-Jargon (kein „.env.local" mehr Richtung Endnutzer), FAQ
  „Ist meine Idee sicher?" nennt jetzt den KI-Anbieter.

**Rechtstexte ausgefüllt (2026-07-16):** [`src/shared/lib/legal.ts`](../src/shared/lib/legal.ts)
trägt jetzt echte Angaben (Kasum Bajrami, Riehenstrasse 80, 4058 Basel,
Gerichtsstand Basel-Stadt, Privatperson ⇒ `companyId` bleibt leer). Vor dem
Eintragen wurde der Nutzer explizit gefragt und hingewiesen, dass das Repo
öffentlich ist und die Adresse damit dauerhaft in der Git-Historie steht,
er hat sich bewusst für die echte Adresse entschieden. Impressum/AGB/
Datenschutz sind damit inhaltlich vollständig. ~~Einzig offen: `appHost`
bleibt Platzhalter, bis die Hosting-Entscheidung gefallen ist.~~
**Erledigt:** `appHost` steht auf „Vercel Inc., USA", die App läuft live
unter `https://promptprinter.app`, die Hosting-Frage ist entschieden. Alles
andere aus dem Kritik-Pass ist erledigt, keine bekannten offenen Findings
mehr aus dieser Runde.

**Landing-Aufräumung (2026-07-16):** Auf Zuruf aus Live-Screenshots drei
Sektionen entschlackt (`499208c`): Trust-Badge-Zeile aus dem Hero raus
(SaaS-Klischee), ExampleOutput-Header von Headline+Subtext+Zitat-Bubble+Finn
auf Headline + eine Zeile gekürzt, Integrations-Pills von 12 auf die 8 am
ehesten erkennbaren Tools reduziert. Danach (`df538a1`): **Problem-Sektion
komplett entfernt** (Komponente gelöscht, nicht mehr in `page.tsx`, war
zuvor als „nicht anfassen" markiert, jetzt überholt) und die
ProductShowcase-Mini-Sidebar zeigte noch das Vor-Redesign-Muster (gestapelte
Chats/Projekte-Zeilen + fixer „+ Neuer Chat"-Button); jetzt auf denselben
Pillen-Umschalter wie die echte Sidebar umgestellt (`NavSwitcher`,
singuläre Labels „Chat"/„Projekt"), Desktop und Mobile teilen sich die
Komponente. Danach (`ed9ebee`): **`ExampleOutput` und `Integrations`
ebenfalls komplett entfernt**, auf Nutzerwunsch, beide Komponenten
gelöscht (nicht nur die Landing Page, auch `/features` nutzte beide und
ist live via Footer-Link + Sitemap). Anchor-Links, die auf `#example`
zeigten (Navbar „Funktionen", Hero-CTA „Erst mal zuschauen"), zeigen jetzt
auf `#produkt` (ProductShowcase, das einzige verbleibende Proof-Element
auf der Landing Page). Die untenstehenden Landing-Page-Abschnitte sind
entsprechend angepasst.

**App-UI-Pass (2026-07-16):** Zwei Screenshot-getriebene Funde in der
eingeloggten App, nicht der Landing Page. Erstens (`5f84a37`): Sidebar-
Chat-/Projektliste (`INACTIVE_ROW` in `sidebar.tsx`, geteilt mit
`mobile-nav.tsx`) lag bei `text-foreground/55`, rechnerisch ~4.2:1 Kontrast,
unter dem WCAG-AA-Minimum (4.5:1). Auf `/70` angehoben (~7.2:1), dieselbe
Anhebung in der Command-Palette (lief über `text-muted-foreground`) und in
der ChatList-Metazeile (`/45` → `/60`). Der listige Platzhalter „Chats,
Projekte, Seiten, Aktionen…" (Command-Palette-Input + Topbar-Suchbutton)
durch „Wonach suchst du?" ersetzt. Zweitens (`6404e66`): Die `is_admin`-
Ausnahme (`plans.ts`, `effectiveLimits`) galt bisher nur für die
monatlichen Plan-Kontingente, nicht für den stündlichen `rateLimit()` in
`/api/chat`, `/api/generate`, `/api/projects` und `/api/settings/api-key`,
der komplett unabhängig lief, der Betreiber-Account (is_admin=true, per
Supabase-MCP verifiziert) wurde beim eigenen Testen genauso gedrosselt wie
jeder andere Nutzer. Jetzt vor dem Rate-Limiter geprüft (bestehende
Profil-Fetches wiederverwendet, `generate-guards.ts` gibt `isAdmin` jetzt
im `GenerateAllowance`-Result zurück). Nebenbei gefunden: `/api/projects`
nutzte noch rohes `PLAN_LIMITS` statt `effectiveLimits` für den
Projekt-Cap, ebenfalls korrigiert. Der rohe englische Fehlertext „Rate
limit exceeded. Try again later." (identisch in allen vier Routen) durch
„Zu viele Anfragen, bitte warte kurz und versuch es erneut." ersetzt.

⚠️ **Handoff entfernt (2026-07-16, `ad0271e`), grundlegende Änderung:**
Auf expliziten Nutzerwunsch, nach expliziter Rückfrage bestätigt (das
"..."-Menü im Composer war der **einzige** Weg im ganzen Chat, aus einer
Unterhaltung ein Ergebnis zu erzeugen), komplett gelöscht:
`chat-handoff-menu.tsx`, `packet-bridge.tsx`, `prompt-save.tsx`,
`use-handoff-flow.ts`, `build-progress.tsx` (dadurch verwaist), je mit
Tests. `ChatConversationStrip` aus `chat-transcript.tsx` entfernt.
`chat.tsx`/`chat-composer.tsx`/die vier `<Chat>`-Seiten von der reinen
Handoff-Verkabelung befreit (`canHandoff`, `projectName`/
`-Instructions`/`-Context`, `defaultTools`). `/api/generate` existiert
als Route weiter, wird aber von keiner UI mehr aufgerufen. **Chats
erzeugen damit nie mehr automatisch einen Prompt oder ein
Software-Paket** — das widerspricht der Produktbeschreibung direkt unten
("verwandelt Ideen in build-fertige Prompt-Pakete"), die ist damit nicht
mehr aktuell und wartet auf eine bewusste Neuformulierung, keine
Vermutung meinerseits eingetragen.

**Chat-Empty-State vereinfacht (`bd2b20f`, dieselbe Sitzung):** Zeigte
vorher Finn + Erklärzeile + „Oder starte mit einem Beispiel" + 3
Starter-Buttons, jetzt nur noch Finn + personalisierte Grußzeile ("Woran
arbeiten wir, {Name}?", Name = `profiles.display_name` oder E-Mail-Präfix,
wie im Topbar-Label). `sub`/`starters`/`REFINE_STARTERS` aus
`chat-variants.ts` entfernt. Nebenbei den sichtbaren Sprung des Composers
nach der ersten Nachricht behoben (Mindesthöhe lag nur auf dem Empty-State,
nicht auf dem gemeinsamen Inhaltsbereich).

**Kritik-Pass „F-1" behoben (2026-07-16):** Eine angeforderte schonungslose
QA-Bewertung fand als Top-Befund, dass nach der Handoff-Entfernung mehrere
Flächen noch den nicht mehr existierenden Chat→Ergebnis-Weg versprachen.
Behoben, in dieser Reihenfolge: **Ergebnisse-Leerzustand** (`8de5264`,
`results/page.tsx`) sagte „Öffne einen Chat und erzeug von dort dein
erstes Ergebnis", führte aktiv in eine tote Aktion, Copy jetzt ohne
Kausalbehauptung, Chat-Link bleibt als reine Navigation. **AGB §2/§4**
(`973b4a3`) versprachen vertraglich „erzeugt strukturierte Prompt-
Artefakte wie Brief, PRD, Master-Prompt…", eine Leistung, die die
Software nicht mehr erbringt, rechtlich heikel; jetzt ehrliche
Beschreibung als KI-gestützter Prompt-Chat. Die Produktbeschreibung
direkt unten ist entsprechend aktualisiert, der ⚠️-Hinweis von zuvor ist
damit aufgelöst. **Bewusst nicht in diesem Pass angefasst:** Landing-Page-
Marketing (Hero-Demo „Dein Bau-Paket", ProductShowcase-Artefakt-Zahlen,
`/features`), das ist ein separater Kreativ-/Positionierungs-Auftrag, kein
mechanischer Korrektur-Fix, siehe 2nd-brain für den offenen Punkt.

**Kritik-Pass „S-1" behoben (2026-07-16, `682039d`):** Der zweite kritische
QA-Befund, SSRF über den BYOK-Custom-Provider. Der `baseUrl` (Settings)
wurde nur mit `z.string().url()` validiert, der Server fetchte sie direkt
bei jedem Settings-Test-Call, Chat und Generate. Jeder registrierte
Free-Nutzer konnte den Server damit zu Requests an interne Ziele bringen
(Cloud-Metadaten `169.254.169.254`, `localhost`, RFC1918-Bereiche),
verschärft durch teilweise Response-Body-Reflektion in der Fehlermeldung
(SSRF mit Exfiltration). Neu: [`src/server/security/url-safety.ts`](../src/server/security/url-safety.ts),
`assertPublicHttpsUrl()` erzwingt https, löst den Hostnamen auf und lehnt
jede aufgelöste Adresse in privaten/reservierten Bereichen ab (inkl. der
von WHATWG-URL normalisierten Hex-Schreibweise für IPv4-mapped IPv6, ein
anfänglicher Test-Fail zeigte das: `::ffff:127.0.0.1` wird zu
`::ffff:7f00:1` normalisiert). Verdrahtet in `llm.ts`s `customComplete()`,
dem einen Ort, der tatsächlich fetcht, deckt damit alle drei Aufrufpfade
in einem Rutsch ab. `redirect: "error"` verhindert zusätzlich einen
Redirect-basierten Bypass. Kein DNS-Rebinding-fester Pinned-Connection-
Aufbau (unverhältnismässig für dieses Projekt), schliesst aber den
üblichen Fall. Fehlerantworten geben nur noch die geparste, erwartete
Provider-Fehlerform zurück, nie mehr den rohen Response-Body.

**Kritik-Pass „S-2" behoben (2026-07-16, `e54161b`):** Keine
Content-Security-Policy trotz Fremd-Markdown-Rendering im Chat,
[next.config.ts](../next.config.ts) liess sie bisher bewusst weg, weil eine
echte CSP einen Nonce braucht, den eine statische `headers()`-Config
nicht liefern kann. react-markdown läuft ohne
`rehype-raw`/`dangerouslySetInnerHTML`, hat also keinen bekannten
Injection-Pfad, CSP ist trotzdem die übliche zweite Verteidigungslinie.
Neu: [`src/server/security/csp.ts`](../src/server/security/csp.ts) baut die Policy aus einem
Pro-Request-Nonce, [`src/middleware.ts`](../src/middleware.ts) erzeugt ihn
(`Buffer.from(crypto.randomUUID())`, ein roher UUID-String ist wegen der
Bindestriche kein gültiger CSP-Nonce) und reicht ihn per Request-Header
durch, Next hängt seine eigenen Hydration-Scripts automatisch an
denselben Nonce, `src/app/layout.tsx` liest ihn über `headers()` zurück
und reicht ihn an next-themes' `nonce`-Prop weiter (Layout dafür zur
async Function gemacht). Cloudflare Turnstile bleibt über einen
Origin-Allowlist-Eintrag erlaubt (externes `<script src>`, kein Nonce
nötig). `script-src` erlaubt `'unsafe-eval'` nur in `development` (Next
Fast Refresh braucht `eval()`, die Produktion nicht). `connect-src`
bekommt die Supabase-Projekt-Origin, kein LLM-Provider braucht einen
Eintrag, die laufen alle serverseitig. Im Dev-Server per Browser-Preview
verifiziert: CSP-Header korrekt gesetzt, Turnstile lädt weiterhin,
next-themes + Next-Hydration-Scripts tragen denselben Nonce, keine
CSP-Verstösse in der Konsole.

**Kritik-Pass „U-1" behoben (2026-07-16, `ddded15`):** Hero-Demo,
FeaturesGrid, `/features` und ProductShowcase bewarben weiterhin die
automatische Mehrfach-Dokument-Erzeugung, die mit der Handoff-Entfernung
ersatzlos gestrichen wurde. Bewusst zurückgestellt bis zur Entscheidung,
wie die Seite den tatsächlichen Chat-Flow zeigen soll, jetzt umgesetzt:
neue Erzählung, grundiert in `src/prompts/system.ts`s
`CHAT_SYSTEM_PROMPT` (eine Rückfrage, dann der fertige Prompt im
Codeblock). `hero.tsx`s HeroDemo von 4 Stufen (Idee→Plan→Build→Launch
mit auto-generiertem Produktplan/Design/DB/Backend/Marketing +
Live-Domain) auf 3 Stufen (Idee → Rückfrage → Prompt) umgebaut, die
Prompt-Stufe spiegelt bewusst `chat-markdown.tsx`s echtes CodeBlock-
Chrome. `features-grid.tsx`: 6 Karten mit generierten Dokumenten ersetzt
durch das, was ein Chat tatsächlich liefert (Rückfragen, Ziel-KI-
Tailoring, Projekte, BYOK, Verlauf), die „Ebenfalls dabei"-Bonuskarte
(Deployment-Anleitung, SEO-Plan) ersatzlos entfernt. `how-it-works.tsx`s
Schritt 3 versprach „einen kompletten Plan plus die fertigen Anweisungen
für jedes KI-Tool", jetzt der eine zugeschnittene Prompt.
`features/page.tsx` + `layout.tsx`: Meta-Description nannte PRD/
Blueprints/Schema als generierte Artefakte, jetzt der Chat-Kern
beschrieben. `product-showcase.tsx`: Mock-Projekte zeigten „9 Artefakte"
+ Kategorie-Pills aus der toten Pipeline, echte Projekte haben heute 0
Artefakte (keine `generations`-Zeilen mehr, siehe F-1-Fix), auf
Chat-Zähler umgestellt. `faq.tsx` + `pricing-preview.tsx`: „Stack
wechseln"/„Alle Ausgabetypen" durch den echten Weg ersetzt. Verifiziert
im Dev-Server (Browser-Preview): alle Seiten rendern die neue Copy
korrekt, keine Konsolenfehler.

**Kritik-Pass „C-1" behoben (2026-07-17):** Die tote `/api/generate`-
Pipeline (siehe QA-Kritik-Pass oben) war seit der Handoff-Entfernung von
keiner UI mehr erreichbar, wurde aber weiter gewartet und blieb als
direkt POST-bare, nicht per UI verlinkte Route live. Komplett entfernt:
die Route selbst, `generate-guards.ts`, `build-generate-content.ts` (+
Test), `run-generation.ts`, `persist-generation.ts`, sowie die zehn nur
dafür genutzten Paket-Prompt-Templates (`brief/prd/master/frontend/
backend/schema/security/marketing/seo/deployment-template.ts`).
Mitentfernt, weil ausschliesslich von der toten Pipeline importiert:
`SYSTEM_PROMPT`/`GENERAL_SYSTEM_PROMPT` aus `prompts/system.ts`,
`generalPromptTemplate`/`generalVariantTemplate` aus
`prompts/general-prompt.ts`, `generateRequestSchema`/`GenerateRequest`
aus `lib/schemas.ts`, `prompts/types.ts` (alle vier Interfaces waren
ungenutzt). Bewusst **nicht** angefasst: `GENERAL_VARIANTS`,
`lib/artifacts.ts` und die `generations`-Tabelle, die tragen weiterhin
die Ergebnisse-Anzeige und die Usage-Meter für bestehende Zeilen. Die
Grundsatzfrage (kommt je ein Ersatz-Feature für den Chat→Ergebnis-Weg?)
bleibt offen; falls ja, wird die Pipeline aus der Git-Historie
rekonstruiert, kein Verlust durchs Löschen. Quality-Gate komplett grün
(`npm run typecheck && npm run lint && npm run test && npm run build`),
`.next`-Cache musste einmal geleert werden, weil er noch einen Typ für
die gelöschte Route generiert hatte.

**Grundsatzfrage beantwortet + „Prompt speichern" gebaut (2026-07-17,
`b3ae4af`):** Auf die Frage, womit der Chat→Ergebnis-Weg ersetzt wird,
die Entscheidung: **„Ergebnisse" bleibt als Konzept, aber
leichtgewichtig.** In einem Projekt-Chat sichert ein „Speichern"-Button
(`chat-result-panel.tsx` → `save-prompt-button.tsx`) den fertigen Prompt
aus der aktuellen Antwort in die Ergebnisse des Projekts. **Kein
Auto-Generieren, kein Modell-Call** — nur der Prompt, den der Nutzer
schon hat, das unterscheidet es klar vom entfernten Handoff (der
automatisch 10 Artefakte generierte). Speicher: die bestehende **leere**
`generations`-Tabelle wird wiederverwendet statt einer neuen Tabelle
(ein gespeicherter Prompt = eine Zeile mit `outputs = { prompt, title,
target }`); die Tabelle behält aus Pragmatismus ihren Namen, semantisch
ist eine Zeile jetzt ein gespeicherter Prompt. Einzige DB-Änderung:
Migration `0018_generations_owner_delete.sql` ergänzt die fehlende
owner-scoped DELETE-Policy + Grant (0001 hatte nur select/insert), live
gegen die Supabase-DB angewendet und per SQL verifiziert. Neue
Ergebnisse-Seite = Liste gespeicherter Prompts (Kopieren/Löschen/
PDF-für-Pro, jsPDF lazy) statt der toten 10-Tab-Ansicht. Das tote
„Generierungen"-Monatslimit (zählte 0, wurde nirgends erzwungen) ist
raus (Meter aus Billing/Settings, `generations`-Feld aus `plans.ts`),
Speichern ist unbegrenzt/gratis, nur Chat-Nachrichten bleibt gemessen.
Toter Paket-Code, der dadurch verwaiste, entfernt: `artifacts.ts`
(+Test), `project-tabs.tsx`, `general-prompt.ts`/`GENERAL_VARIANTS`
(die letzten Reste aus dem C-1-„nicht angefasst") — Bibliothek zeigt
jetzt Prompt- statt Artefakt-Zähler, die immer leeren Kategorie-Filter
sind weg. Quality-Gate grün (222 Tests, +12 für die neuen Helfer). Der
interaktive Speichern-Flow wurde nicht per Browser verifiziert (braucht
Login), die reine Logik ist unit-getestet, DB-Migration per SQL geprüft.

**Finn-Umbau zum Build-Spezialisten (2026-07-22, `79755a9` + `2a2f811`):**
Nach einer Grill-me-Session zur Produktrichtung stand fest: die Zielgruppe
ist Vibe-Coder, die Prompts in Bau-Tools füttern, nicht ein allgemeines
Alltags-Prompt-Tool. Der tatsächliche Code widersprach dem: jeder neue
Chat lief auf `mode="general"` → `CHAT_SYSTEM_PROMPT`, der explizit
„everyday goals … not just software" sagte und nur „ONE short clarifying
question" stellte, keine Vollständigkeits-Fragen zu Datenmodell/Auth/
Screens. `CODE_CHAT_SYSTEM_PROMPT` (der eigentliche Build-Prompt) war
nur über `project.type === "software"` erreichbar, aber `POST /api/projects`
setzt hart `type: "general"`, kein UI-Pfad setzt je „software" (0 von 1
Projekten in der Prod-DB), also war er faktisch toter Code.

Schritt 1 (`79755a9`): `CHAT_SYSTEM_PROMPT` neu geschrieben. Kernwert
jetzt explizit „nicht Credits verbrennen" — eine **gebündelte** Rückfrage
(nicht mehr „ONE question") stellt nur, was für die konkrete Idee zählt
(Ziel-Tool falls unbekannt, Kern-Screens, Datenmodell, Auth, Design-
Richtung), dann ein fertiger, aufs Ziel-Tool zugeschnittener Prompt.
Kulanter Fallback für Nicht-Bau-Ziele (Finn hilft trotzdem, ohne Bau-Fragen
zu erzwingen). Context-Safety-Absatz (Prompt-Injection-Abwehr) unverändert,
reine Sicherheitsgrenze, nicht Teil der Positionierung.

Schritt 2 (`2a2f811`): `CODE_CHAT_SYSTEM_PROMPT` + die mode-Verzweigung in
`api/chat/route.ts` entfernt, eine Systemprompt für jeden Chat. Bewusst
**nicht** angefasst: `chatRequestSchema.mode`, `ChatMode`-Typ,
`conversations.mode` (4 von 8 Bestandschats tragen „software", per
Supabase-Check verifiziert) und `chat-variants.ts` — reine Altdaten-
Kompatibilität, keine Verhaltensentscheidung hängt mehr daran. Ein
DB-Schnitt (Spalte/Typ entfernen) ist ein separates, grösseres Thema.

Beides reine Prompt-/Server-Änderungen ohne UI, im Stub-Modus nicht
sichtbar prüfbar (Chat-Antwort dort unabhängig vom System-Prompt generisch),
deshalb nur über das Gate abgesichert (typecheck/lint/build/222 Tests,
beide Schritte grün). **Landing-Page/Marketing-Nachzug erledigt (2026-07-22,
`a5dfc13` + `56db021`):** Beim Durchgehen von Hero, HowItWorks, FAQ,
FeaturesGrid, `/features` und Pricing stellte sich heraus, dass der Umfang
deutlich kleiner war als hier zunächst notiert, die frühere U-1-Überarbeitung
(`ddded15`, 2026-07-16) hatte die Positionierung schon auf Build-Tools
umgestellt (Lovable/Cursor/Claude Code durchgängig genannt, keine
"Alltag/everyday"-Reste mehr, per Grep über alle Marketing-Komponenten
verifiziert). Tatsächlicher Rest: zwei veraltete Code-Kommentare in
`hero.tsx`/`features-grid.tsx` ("Finn asks exactly one clarifying
question", stale seit dem Prompt-Umbau, keine UI-Wirkung) und **eine**
echte inhaltliche Lücke, die FAQ-Antwort auf "Was bringt mir das, statt
Claude einfach selbst zu fragen?" trug den neu gewählten Kernhook "nicht
Credits verbrennen" noch nicht. Jetzt nachgezogen: Finn fragt vor dem
Tippen in Lovable/Cursor/Claude Code nach Datenmodell/Auth/Design, das
spart Credits und Nachbesserungs-Runden. Beide Commits Gate-grün
(typecheck/lint/build/222 Tests).

**App-Chrome verschlankt (2026-07-22, `74ee9f1`):** Auf Nutzer-Feedback
zu Screenshots die Topbar komplett entfernt (`topbar.tsx` gelöscht):
Suchfeld, Benachrichtigungs-Stub (war nur ein leerer Platzhalter) und
Konto-Dropdown wirkten als unnötiges Chrome oben auf der Seite. Konto
(Avatar, Name, Plan/Admin-Badge, Einstellungen, Abrechnung, Abmelden)
sitzt jetzt unten in der Sidebar, in beiden Zuständen (Popover öffnet
aufwärts ausgeklappt, nach rechts eingeklappt). Die globale ⌘K-
Befehlspalette bleibt als reine Tastatur-Funktion erhalten (kein
sichtbarer Button mehr, aber ein echtes, in der Erst-Login-Tour gelehrtes
Feature, keine tote Funktion), zieht mit in die Sidebar um. Mobile:
`MobileNav`s Hamburger-Trigger wandert direkt in `layout.tsx`
(schmale sticky Leiste, nur der Button), „Abmelden" im Drawer ergänzt
(hatte vorher nur in der Topbar gelebt). Onboarding-Tour (`tour-steps.ts`)
nachgezogen: der „search"-Schritt zeigt jetzt eine zentrierte Karte statt
ein nicht mehr existierendes Element anzuvisieren, der „account"-Schritt
zielt auf den neuen `data-tour="account-menu"`-Anker. Composer
(`chat-composer.tsx`): Eingabefeld startet einzeilig (48px), wächst mit
Inhalt bis 200px, scrollt danach intern, wie bei Claude/ChatGPT statt der
vorherigen festen 2-Zeilen-Box; Senden-Button ist jetzt ein kleiner
runder Icon-Button (36×36) statt des breiten Text+Icon-Buttons. Verifiziert
im Dev-Server mit echter eingeloggter Session (Kontomenü-Position in
beiden Sidebar-Zuständen, Composer-Auto-Resize per DOM-Messung bestätigt).
Gate grün (typecheck/lint/build/222 Tests, `next/navigation`-Mocks in
`sidebar.test.tsx`/`mobile-nav.test.tsx` um `useRouter` ergänzt, neu durch
die Abmelden-Funktion).

**Automatischer Redirect aus leeren Projekten entfernt (2026-08-01,
`d857da0`):** Auf Bug-Report („Projekt öffnen, nichts tun, nach kurzer
Zeit landet man trotzdem im Chat-Composer") die Ursache in
`projects/[id]/(workspace)/page.tsx` gefunden: `if (rows.length === 0)
redirect(...)` in der Server-Component, bewusst am 23.07. als N-2-Shortcut
eingebaut („Skip straight to the composer, damit ein leeres Projekt keinen
unnötigen Extra-Klick verlangt"), feuerte aber serverseitig bei **jedem**
Besuch eines chatlosen Projekts, ganz ohne Nutzerinteraktion — kein
`useEffect`, kein Timeout, ein reiner Server-Redirect während des
Renderns. Kein Chat wurde dabei in der DB angelegt (`chats/new/page.tsx`
persistiert nichts, das passiert erst mit der ersten gesendeten
Nachricht in `/api/chat`), aber der Nutzer wurde trotzdem zwangsweise vom
Dashboard weggeschoben. Ersetzt durch einen expliziten Leerzustand
(`waiting`-Finn, „Noch keine Chats", Button „Neuen Chat starten"), der
Redirect passiert jetzt nur noch durch einen bewussten Klick. Grep über
den ganzen `src`-Baum nach `redirect(`/`router.push`/`router.replace`
bestätigte, dass das die einzige Auto-Navigation in diesem Flow war;
`chat.tsx`s `router.replace` auf die kanonische Chat-URL feuert weiterhin,
aber ausschliesslich nach einer vom Nutzer selbst gesendeten ersten
Nachricht, das ist beabsichtigtes Verhalten und blieb unangetastet. Gate
grün (typecheck/lint/662 Tests/build). Nicht per eingeloggtem Browser-
Klicktest verifiziert, dieses Environment hat keinen Test-Login; Dev-
Server startete aber sauber, unauthentifizierter Zugriff auf die Route
redirectete wie erwartet auf `/login`, keine Server-Fehler im Log.

**Vercel-Deployment-Audit (2026-08-01):** Auf Wunsch der komplette Stack
gegen Vercel-Kompatibilität durchgegangen (Env-Vars, Build-Konfig, Next-
Config, Middleware, API-Routen, Runtime, Docker-Unabhängigkeit, Security-
Header, Rate-Limiting, Auth, Logging). Ergebnis: **deploybereit**, zwei
echte Findings behoben, alles andere war bereits korrekt.
[`next.config.ts`](../next.config.ts)s `output: "standalone"` (fürs
Docker-Runner-Stage, siehe [Dockerfile](../Dockerfile)) ist jetzt
`process.env.VERCEL ? undefined : "standalone"` — Vercels eigene Build-
Pipeline braucht/nutzt das nicht, lässt es aber unschädlich zu; bewusst
trotzdem abgeschaltet, um selbst den seltenen Output-File-Tracing-
Edgecase zu vermeiden. Per `VERCEL=1 npm run build` UND per normalem
`npm run build` verifiziert: Ersteres erzeugt kein `.next/standalone`
mehr, Letzteres weiterhin `server.js`, Docker bleibt unangetastet.
[`rate-limit.ts`](../src/server/security/rate-limit.ts)s `clientIp()` prüfte bisher
`cf-connecting-ip` zuerst (ein Header, den nur Cloudflare setzt) — auf
Vercel setzt niemand diesen Header, ein Angreifer könnte ihn also selbst
mitschicken und sich beliebig viele frische Rate-Limit-Buckets erkaufen
(aktuell praktisch unerreichbar, da jede Route eine Session verlangt,
aber genau der Fehler, den diese Funktion beheben soll, sobald eine neue
anonyme Route dazukommt). Jetzt auf Vercels dokumentierte Header
umgestellt (`x-vercel-forwarded-for` → `x-forwarded-for` → `x-real-ip`,
https://vercel.com/docs/headers/request-headers), `cf-connecting-ip`
komplett entfernt. Drei betroffene Tests in
[`rate-limit.test.ts`](../src/server/security/rate-limit.test.ts) entsprechend
umgeschrieben. `.gitignore` um `.vercel` ergänzt (lokales CLI-Artefakt).
Alles andere bereits Vercel-tauglich ohne Änderung: alle API-Routen
explizit `runtime = "nodejs"`, `/api/chat` trägt bereits
`maxDuration = 300` (liegt exakt auf der Hobby-Plan-Obergrenze, unter
Fluid Compute Default UND Maximum, geprüft gegen Vercels aktuelle Docs),
`env.ts`s Boot-Check wirft in Produktion hart ab (läuft auf Vercel pro
Function-Cold-Start, `NODE_ENV=production` gilt dort für Production UND
Preview), keine Server Actions, kein `fs`-Schreibzugriff, kein
`child_process`, kein Cron, next/image ohne `unoptimized`, Fonts über
`next/font/google` (self-hosted im Build). ~~`vercel.json` bewusst nicht
angelegt.~~ **Überholt seit 2026-08-04 (Planpunkt B-1), siehe direkt
unten.** Kein Code-Findings-Posten offen; verbleibende
Schritte sind reine Dashboard-Konfiguration (Env-Vars in Vercel setzen,
Supabase-Redirect-URLs um die Vercel-Domain ergänzen), keine
Repo-Änderung.

**Funktionsregion nach Dublin (2026-08-04, Planpunkt B-1):** Live gemessen
lieferte **jede** Route `X-Vercel-Id: fra1::iad1` — der Edge-Knoten steht in
Frankfurt, der Code lief in **Washington DC**, die Datenbank liegt in
**Irland** (`eu-west-1`). Jede Supabase-Query querte damit zweimal den
Atlantik, und ein Projekt-Chat-Aufruf macht rund 15 davon. Das hatte nie
jemand entschieden: `iad1` ist Vercels Standard, und ohne `vercel.json` hat
nie jemand widersprochen.

`vercel.json` trägt jetzt `"regions": ["dub1"]`. **Warum Dublin und nicht
Frankfurt**, obwohl Frankfurt näher an den Nutzern liegt: die Distanz zum
Nutzer zahlt man **einmal** pro Aufruf, die Distanz zur Datenbank **pro
Query**. Bei rund 15 Rundreisen schlägt das jeden Gewinn beim ersten Byte —
grob 15 × 25 ms (fra1→Irland) gegen 15 × 2 ms (dub1, gleiche Stadt wie die
DB). Nach B-2 verstärkt sich das noch: die öffentlichen Seiten kommen dann
statisch vom CDN und sind von der Region gar nicht mehr betroffen, sodass
die Region **nur noch** den datenbankschweren, eingeloggten Teil bestimmt.
Die Datei enthält keine Kommentare (JSON), deshalb steht die Begründung
hier. Umstellen ist ein Wort, falls eine Messung widerspricht.

⚠️ **NEGATIVES ERGEBNIS: `browserslist` bringt hier nichts (2026-08-04,
Planpunkt B-4).** Der Plan wollte „41 KB Polyfills für Browser, die niemand
mehr benutzt" per `browserslist`-Angabe in `package.json` abschneiden.
Gemessen, nicht angenommen:

- Mit `browserslist: ["chrome >= 111", "edge >= 111", "firefox >= 111",
  "safari >= 16.4"]` gebaut → `polyfills-42372ed130431b0a.js` ist **byte- und
  hash-identisch** (112.594 B), ebenso die geteilten Chunks (`103 kB`,
  gleiche Hashes) und die Landing Page (`172 kB`). Kein einziges Byte anders.
- Der Grund: Next hängt den Polyfill-Chunk mit `noModule: true` ein (im
  kompilierten `next/dist/server/app-render/app-render.js` nachgesehen). Ein
  `<script nomodule>` wird von **jedem** modul-fähigen Browser ignoriert —
  die 110 KB gehen für heutige Nutzer nie über die Leitung. Sie stehen im
  Build-Verzeichnis, nicht im Netzwerk-Wasserfall.

Die Angabe wurde deshalb wieder entfernt: eine Konfigurationszeile, die eine
Wirkung suggeriert, die sie nicht hat, ist schlimmer als keine. Wer die
Bundle-Grösse angehen will, muss an die 103 kB geteilten Chunks — nicht an
die Polyfills.

**Turnstile wurde nie verifiziert, jetzt schon (2026-08-02):** Das Captcha
auf Login/Registrierung/Reset war seit dem Einbau **reine Dekoration**. Der
Ablauf war: Widget rendert → Browser bekommt Token → Token reist als
`captchaToken` an Supabase Auth → **niemand prüft ihn**. Supabase wertet
dieses Feld nur aus, wenn CAPTCHA im eigenen Dashboard eingeschaltet ist,
und das war es nie. Nicht vermutet, sondern gemessen: ein
`POST /auth/v1/recover` mit dem Token `XXXX.DUMMY.TOKEN.XXXX` gegen das
Live-Projekt antwortete **200**, was mit aktivem Setting unmöglich ist. Die
alten Kommentare in `turnstile-widget.tsx` und `.env.example` („das SECRET
gehört nach Supabase") haben genau diesen Zustand als beabsichtigt
beschrieben und damit jahrelang kaschiert.

Behoben mit einer echten serverseitigen Prüfung im eigenen Backend:
[`src/server/security/turnstile.ts`](../src/server/security/turnstile.ts) löst jeden Token kanonisch
bei `challenges.cloudflare.com/turnstile/v0/siteverify` ein (Secret als
`TURNSTILE_SECRET`, **niemals inline**), **fail-closed** bei Timeout,
Nicht-2xx oder unparsbarer Antwort. Eingelöst wird in der neuen Route
[`/api/auth`](../src/app/api/auth/route.ts), die die vier anonymen
Auth-Aktionen (`sign-in`, `sign-up`, `resend`, `reset-password`) bündelt.

**Warum eine neue Route und nicht nur ein Check im Formular:** die Formulare
riefen Supabase direkt aus dem Browser. Ein clientseitiges „erst prüfen,
dann Supabase rufen" wäre ein Ratschlag, keine Schranke — der Aufrufer
entscheidet, ob er sich daran hält. Erst dadurch, dass Token-Einlösung und
Auth-Aktion **im selben Server-Request** passieren, ist die Prüfung nicht
mehr umgehbar. Bewusst **eine** Route mit `action`-Diskriminante statt vier
Geschwisterrouten: das Gate existiert dann an genau einer Stelle, eine
fünfte Auth-Aktion kann es später nicht vergessen. OAuth bleibt
clientseitig (hatte nie ein Captcha, Google/GitHub haben eigene
Bot-Abwehr).

⚠️ **Supabase-CAPTCHA jetzt NICHT nachträglich einschalten.** Ein
Turnstile-Token ist genau einmal einlösbar. Mit zwei Prüfern gewinnt der
erste und der zweite sieht `timeout-or-duplicate` — das würde jeden Login
brechen, nicht eine zweite Schicht ergänzen.

Weitere Details: `env.ts` verlangt `TURNSTILE_SECRET` in Produktion **nur
dann**, wenn `NEXT_PUBLIC_TURNSTILE_SITE_KEY` gesetzt ist — genau die
Kombination „Widget sichtbar, niemand prüft" ist damit nicht mehr
startbar, ein Deployment ohne Captcha bleibt erlaubt. `clientIp()` ist aus
`rate-limit.ts` exportiert (siteverify bekommt `remoteip`), Ratelimit
30/10 min pro IP **vor** dem Body-Parsen (die Route ist anonym, hat also
keinen Session-Check für diese Position). Fehlertexte werden serverseitig
mit `translateAuthError` übersetzt (Audit M-1), der Reset-Pfad antwortet
weiterhin neutral, damit er nicht verrät, ob eine Adresse registriert ist.

**Verifiziert** gegen den echten Cloudflare-Endpunkt mit dessen
dokumentierten Dummy-Secrets: `2x0000…AA` (immer ungültig) → 403, Supabase
nie erreicht; `1x0000…AA` (immer gültig) → Prüfung passiert, Supabase
antwortet „Email oder Passwort falsch". Dazu 698 Tests grün (neu:
`turnstile.test.ts`, `api/auth/route.test.ts`). **Nicht** im Browser
verifiziert: das Browser-Pane lief in dieser Sitzung wieder im bekannten
„hidden"-Zustand (`document.visibilityState === "hidden"`, Body-Höhe 0),
React führt dann die Hydration nicht aus, das Widget rendert deshalb
nirgends — reproduzierbar **auch mit gestashten Änderungen**, also
vorbestehende Umgebungs-Flakiness, kein Effekt dieser Arbeit.

**Projekt-Gedächtnis / AI Project Brain (2026-08-03, `d71a2d6`..`bae80c0`):**
Ein Projekt kann jetzt Dateien UND ein öffentliches GitHub-Repo tragen, die
einmal analysiert werden; danach kennt jeder Chat dieses Projekts Framework,
Sprache, Architektur, Datenbank, Design-System, Coding-Style und
Konventionen, ohne dass der Nutzer sie erklärt.

- **Datenmodell:** eigene Tabelle `project_brains` (0037), 1:1 zum Projekt.
  Bewusst NICHT `projects.context` erweitert — dort steht, was der Nutzer
  selbst getippt hat, hier steht Abgeleitetes. Gemischt liesse sich nicht
  mehr unterscheiden, wer was gesagt hat, und genau daran hängt die
  Reihenfolge im Prompt. Grant nur `select`: geschrieben wird ausschliesslich
  in der Route über den Service-Role-Client, sonst könnte sich jeder sein
  „analysiertes" Ergebnis aus der Browser-Konsole schreiben — und der einzige
  Wert dieser Tabelle ist, dass die Fakten aus echten Quellen stammen.
- **Quellen (0038):** Datei-Allowlist von `.md/.txt/.json/.csv` auf Text-,
  Code-, Konfig- und Bildformate erweitert, 10 → 20 Dateien, Grössen **pro
  Art** (Text 200 KB, Lockfile 1 MB, Bild 2 MB) statt einer Zahl. Neue
  Schranke, die den Speicher wirklich bindet: 25 MB Summe pro Projekt.
- **GitHub ohne SSRF-Fläche:** die eingegebene URL wird NIE gefetcht, aus ihr
  werden nur `owner`/`repo` gezogen und gegen GitHubs Alphabet geprüft
  (Owner dürfen keine Punkte führen, daran scheitert `evil.com/owner/repo`);
  aufgerufen werden nur selbst zusammengesetzte URLs zweier fester Hosts.
  Nur 2 Requests gegen `api.github.com` (60/h pro IP), Dateiinhalte vom
  Raw-CDN, das nicht mitzählt. Optional `GITHUB_TOKEN` für 5000/h.
- **Multimodal in `llm.ts`** (`analyzeComplete`), damit die Hausregel „genau
  eine Stelle spricht mit einem Anbieter" hält. Nur Z.ai braucht ein zweites
  Modell (`ZAI_VISION_MODEL`, Default `glm-4.6v`), und nur wenn wirklich
  Screenshots dabei sind — Textanalysen bleiben auf `glm-4.5-air`.
- **Kosten:** Analyse zählt gegen dasselbe Monatskontingent wie ein Chat-Zug
  (derselbe Redis-Schlüssel, kein zweiter Zähler — die Preisseite verspricht
  nur eine Zahl), eigenes Stundenlimit von 5 statt 120. Live gemessen ~0,0005 $
  pro Analyse. **Kein Stub-Modus**, auch nicht in Entwicklung: eine erfundene
  Faktenliste wäre schlimmer als gar keine, weil sie danach in jeden Prompt
  wandert.
- **Injektion:** Brain-Block nach Instructions/Struktur, vor den Dateien —
  Nutzerangaben schlagen Ableitungen. Die gespeicherten Fakten laufen vor dem
  Einsetzen erneut durch das Zod-Schema (was aus der DB in einen Systemprompt
  wandert, wird geprüft, nicht geglaubt). **Der Kostengewinn ist der Punkt:**
  Datei-Budget 12000 → 6000, Brain-Block höchstens 2500, unterm Strich
  weniger Kontext pro Zug bei mehr Wissen. Bilder fallen aus dem Chat-Kontext
  ganz raus (Analysequelle, kein Chat-Kontext).
- **Keine Embeddings, und das ist eine Entscheidung, kein Rückstand.** Das
  Brain ist ein ~2 KB grosses, destilliertes Artefakt, das ohnehin bei jedem
  Zug vollständig mitreist — es gibt nichts zu *finden*, also nichts
  abzurufen. Die Rohquellen sind auf 20 Dateien plus 14 Repo-Dateien
  gedeckelt und werden zum Analysezeitpunkt einmal gelesen, nicht pro Zug
  durchsucht. pgvector würde eine Extension, einen Embedding-Anbieter (keiner
  der vier verdrahteten Provider ist dafür angebunden), eine Chunking-
  Pipeline und Retrieval-Latenz pro Zug kosten — für ein Korpus, das
  vollständig ins Budget passt. **Erst dann neu bewerten,** wenn ein Projekt
  Quellen tragen soll, die *nicht* mehr komplett destillierbar sind (ganze
  Codebasen statt Manifeste, oder Chat-Verläufe als durchsuchbares Archiv).
- **Beim Dogfooding gefunden:** der erste echte Lauf gegen dieses Repo
  verbrannte 5 von 14 Repo-Datei-Plätzen auf verschachtelte `README.md` unter
  `.claude/skills` (`bae80c0`, jetzt höchstens 2 pro Dateiname, flachere
  Pfade zuerst) — und die Analyse beschrieb das Produkt korrekt so, wie die
  README es beschrieb, nämlich als die am 17.07. entfernte
  Generierungs-Pipeline. Die README ist entsprechend korrigiert.

**Erst-Login-Tour entfernt (2026-08-05):** Auf expliziten Nutzerwunsch die
geführte Finn-Tour komplett gestrichen, `src/features/onboarding/` (drei
Dateien: `onboarding.tsx`, `tour.tsx`, `tour-steps.ts`) gelöscht, der Ordner
existiert nicht mehr. Mitentfernt: der `<Onboarding>`-Mount samt
`tourDone`/`onboarding_done`-Auswertung in `(app)/layout.tsx`, die
„Hilfe & Onboarding"-Karte in Settings (`?tour=1`-Neustart-Button, das war
der einzige Ort, der die Tour manuell erneut auslösen konnte) und alle
sechs `data-tour="…"`-Anker in `sidebar.tsx`/`mobile-nav.tsx`, die nur die
Tour als Spotlight-Ziele brauchte. `profiles.settings.onboarding_done`
wird damit nirgends mehr geschrieben oder gelesen; die Spalte selbst bleibt
unangetastet (JSONB, kein Migrationsbedarf), `settings.interested_in`
(Pro-Signup-Marker) läuft unverändert weiter. **Bewusst nicht angefasst:**
`sign-up-experience.test.tsx`s Fixture, die `onboarding_done: true` als
Beispielwert für „bereits vorhandene Settings bleiben beim Merge erhalten"
nutzt — das prüft generisches Merge-Verhalten, nicht die Tour selbst, und
hätte mit jedem anderen Schlüsselnamen genauso funktioniert. Ebenso
unangetastet: MASCOT.mds „Onboarding-Begleiter"-Eintrag (§8, Ideen-Katalog
für spätere Weiterentwicklung, keine Beschreibung von bestehendem Code) und
`docs/projekte/page.tsx`s Erwähnung eines „Onboarding-Flow"-Chats (Beispiel
für einen Chat-Namen in der Doku-Prosa, nichts mit der UI-Tour zu tun).
Der `⌘K`-Absatz weiter oben in diesem Dokument nennt die Tour noch als den
Ort, an dem die Befehlspalette einst gelehrt wurde — das ist ein
historischer Changelog-Eintrag über eine vergangene Änderung (`74ee9f1`,
2026-07-22) und bleibt unverändert stehen, wie jeder Eintrag hier den Stand
zum Zeitpunkt der jeweiligen Änderung beschreibt, nicht den heutigen.

**Footer entschlackt, Landing Page ohne Preis/FAQ (2026-08-05):** Auf
Nutzerfeedback zu einem Screenshot drei Änderungen. Erstens, `footer.tsx`:
die Abschiedszeile „Schön, dass du da warst. · Finn" ist weg, übrig bleibt
nur das Mascot-Bild — Finn spricht hier nicht mehr, er steht nur noch da.
Die beiden getrennten Link-Zeilen (Produkt normal-, Legal leiser gewichtet)
sind zu einer einzigen Zeile neben Finn zusammengelegt, alle neun Seiten
gleich gewichtet, im selben Hover-Stil wie die Navbar-Links (Wasser-Pille +
einschwimmende Welle). Dafür wurde `NavWave`, bis dahin eine private
Funktion in `navbar.tsx`, nach `shared/ui/nav-wave.tsx` gezogen — sie hat
keine Hooks und keinen State, bleibt also in einer Server Component (dem
Footer) genauso gültig wie in der Client-Component-Navbar. Die zweite
`border-t`, die vorher das Copyright vom Rest des Footers abtrennte, ist
weg (der gemeldete „doppelte Rand"), genau wie das grössere vertikale
Padding — der Footer ist jetzt spürbar kompakter.

Zweitens, die Landing Page (`(marketing)/page.tsx`): `PricingBridge` („Und
was kostet das? Bring deinen eigenen Key mit …") und `FAQ` sind raus, auf
ausdrücklichen Wunsch, keinen Preis und keine Fragen mehr auf der
Startseite zu zeigen. Beides bleibt exklusiv auf `/pricing`, wo `FAQ`
ohnehin schon direkt unter `PricingGrid` sass. `pricing-bridge.tsx` ist
komplett gelöscht, kein anderer Aufrufer.

Drittens, `faq.tsx`: von 6 auf 2 Fragen gekürzt, auf Zuruf, welche der
vermeintlichen Trust-Fragen tatsächlich Vertrauen schaffen und welche nur
Zweifel einpflanzen, die vorher niemand hatte. Geblieben: „Was, wenn der
Prompt nicht passt?" und die Tool-Vergleichsfrage, deren Titel von „…statt
Claude einfach selbst zu fragen?" auf „…statt eine KI einfach direkt zu
fragen?" geändert wurde (die Antwort selbst nennt weiterhin Lovable/Cursor/
Claude Code als Positionierung, nur die Frage sollte nicht an einem
einzelnen Produktnamen hängen). Entfernt: „Muss ich programmieren können?",
„Was, wenn ich die Technik noch nicht festgelegt habe?", „Ist meine Idee
bei dir sicher?" und „Gehört mir, was dabei rauskommt?" — die inhaltlichen
Zusagen dahinter (Datenschutzerklärung, Eigentum am Ergebnis) bestehen
unverändert fort, nur diese eine FAQ-Sektion nennt sie nicht mehr einzeln.
**Bewusst nicht angefasst:** `sign-in-experience`/`sign-up-experience` und
alle anderen Landing-Sektionen; `/pricing`s eigene FAQ-Instanz zeigt jetzt
automatisch dieselben 2 Fragen, weil beide Seiten dieselbe Komponente
rendern, keine separate Anpassung nötig.

**Sprachmodus im Chat (2026-07-30, `4990356`, umgebaut 2026-08-01,
`5c13ecf`), bisher nirgends dokumentiert (B-2, Audit 06.09.2026):** Ein
Composer-Button öffnet eine `VoiceBar` (`src/features/chat/components/
voice-bar.tsx`), die den Composer im normalen Chat-Fluss ersetzt (kein
Vollbild-Overlay mehr seit dem Umbau). Vier Zustände im Kreis:
listening → thinking → speaking → listening. Web Speech API für die
Transkription (`interimResults`, Turn geht nach 1,5 s Stille selbst raus),
Mikrofon-Waveform über `AnalyserNode` auf Canvas (`voice-waveform.tsx`,
~63 Balken, 80–4200 Hz Bandpass, `autoGainControl: false` — sonst klingen
Flüstern und Rufen nach kurzer Zeit gleich laut). Gesprochene Turns laufen
durch dasselbe `send()` wie getippte, landen also identisch im Transkript.
Reine Client-Logik (`voice-engine.ts`, 22 Tests für die Waveform-Mathematik),
kein eigener Server-Endpunkt.

⚠️ **Offener Datenschutz-Punkt, seit dem Bau-Commit bekannt, bis heute nicht
geschlossen:** Chrome und Edge erkennen Sprache NICHT auf dem Gerät, sie
streamen das Mikrofon-Audio an den Spracherkennungsdienst des jeweiligen
Browser-Herstellers (Google/Microsoft). Damit kommt ein Auftragsbearbeiter
hinzu, den `datenschutz/page.tsx` bis heute nicht nennt (dort stehen nur
Z.ai, Gemini, Supabase, Lemon Squeezy). Safari erkennt lokal, ist also nicht
betroffen. Nicht mechanisch nachgezogen, weil es eine echte rechtliche
Einordnung braucht (welcher Dienst genau, welches Land, welche
Übermittlungsgrundlage) — wer als Nächstes an dieser Datei arbeitet, sollte
das klären, bevor mehr Nutzer den Sprachmodus finden.

**Chat: Antwort neu erzeugen + eigene Frage bearbeiten (2026-08-06,
`625b7e5` + `0aa41c2`, Planpunkt C-2), bisher nirgends dokumentiert (B-2,
Audit 06.09.2026):** Zwei Aktionen im Chat, die beide "ab hier neu"
bedeuten. „Neu erzeugen" schneidet die letzte Antwort vom Verlauf ab und
lässt sie neu beantworten, die Frage bleibt stehen. Der Stift neben einer
eigenen Nachricht öffnet sie als Textfeld (Enter sendet, Shift+Enter
Zeilenumbruch, Escape verwirft, wie im Composer); Absenden ersetzt die
Frage UND verwirft jede Antwort danach — ein alter Verlauf auf eine Frage,
die es so nicht mehr gibt, wäre ein sich selbst widersprechendes
Transkript. Beide teilen sich serverseitig einen Kern (`run()` in
`api/chat/route.ts`), der Wire-Vertrag trägt dafür `replaceMessageId`
(Neu-Erzeugen) bzw. `supersededMessageIds` (Bearbeiten). In beiden Fällen
fällt der alte Verlauf immer erst NACH dem erfolgreichen neuen Zug weg —
ein gescheiterter Anbieter-Aufruf darf nie ersatzlos löschen. Kein
Bearbeiten während eines laufenden Zugs (kein `onEdit` wird durchgereicht,
solange eine Antwort streamt). Eine spätere Änderung liess die vom Client
mitgeschickte ID zwischenzeitlich durch eine frei erfundene `randomId()`
ersetzen, wodurch das Löschen der Vorgänger-Zeile ins Leere lief (K-2,
Audit-Befundbericht 06.09.2026, im 2nd-brain-Projektordner) — mittlerweile
behoben.

**Settings entschlackt (2026-09-06, `7ccd3a3` + `9051a2f`):** Auf
Nutzerwunsch drei Vereinfachungen in den Einstellungen.

Erstens, **Profilbild komplett entfernt**: `avatar-upload.tsx` gelöscht
(war der einzige Weg, der `avatar_url` je gesetzt hat — keine
OAuth-Foto-Übernahme von Google/GitHub existiert in diesem Code). Beide
Render-Stellen in `sidebar.tsx` (Kontomenü-Trigger + offenes Panel) zeigen
jetzt immer den Initialen-Kreis, nie ein `<img>`. `avatar.ts`
(`avatarStoragePath()`) bleibt bewusst bestehen, `api/account/route.ts`
braucht sie weiterhin für die Storage-Bereinigung bei Kontolöschung; DB-
Spalte, Storage-Bucket und Migration 0027 ebenfalls bewusst unangetastet.

Zweitens, **die "Nutzung"-Karte in den Einstellungen entfernt**: war
byte-identisch mit der Abrechnungsseite eigenen "Nutzung diesen
Monat"-Abschnitt (dieselben zwei `UsageMeter`, dieselben Abfragen), zeigte
also nichts, was `/billing` nicht schon zeigt.

Drittens, **BYOK-Einstellungen ohne Anbieter-Auswahl**: statt vier immer
sichtbaren Karten (Anthropic/OpenAI/Gemini/Custom) gibt es jetzt ein
einziges Feld. Neu: `shared/lib/byok-detect.ts`, `detectProviderFromKey()`
erkennt Anthropic/OpenAI/Gemini am Key-Format selbst (`sk-ant-`/`AIza`/
generisches `sk-`, in dieser Reihenfolge — sonst wäre jeder Anthropic-Key
fälschlich OpenAI). Der Server leitet den Provider immer selbst her,
vertraut nie einer Client-Angabe dafür; `api/settings/api-key/route.ts`s
POST-Schema wechselte von `z.discriminatedUnion` zu `z.union` mit
`.strict()` auf dem Primärzweig, damit ein mitgeschickter
`provider: "custom"` samt Zusatzfeldern nicht stillschweigend gegen den
Primärzweig durchgeht, bevor der echte custom-Zweig je geprüft wird. Der
bestehende 4-Felder-Fallback für jeden anderen OpenAI-kompatiblen
Endpunkt (Z.ai, DeepSeek, Groq, OpenRouter, eigenes Gateway) bleibt
unverändert erhalten, jetzt hinter einem "Anderer Anbieter?"-Link statt
einer vierten Karte — der lässt sich aus einem Key allein nicht erraten.
Kein DB-Schema-Wechsel nötig, `provider` war schon ein CHECK-Constraint,
keine echte Postgres-Enum.

Alle drei im Dev-Server mit echter Anmeldung verifiziert. Gate grün
(typecheck/lint/build, 1143 Tests, davon 15 neu).

**Audit 23.09.2026 + erste Umsetzung (`9a31260`..`7ac0ba9`):** Vollständiger
Durchgang ohne Codeänderung, Bericht im 2nd-brain
(`02 Projekte/PromptPrinter/PromptPrinter Audit 2026-09-23.md`). Kernbefund:
technisch gesund, die Hebel liegen beim Produkt. Danach auf Kasums Auswahl
umgesetzt, je ein Commit, Gate davor:

- **Free ohne Key** (`9a31260`, F-1): Free chattet nur mit eigenem Key, ein
  neues Konto erfuhr das aber erst NACH dem Absenden, mit einem
  "Erneut senden"-Knopf, der denselben 403 wiederholte. Jetzt fragen die
  vier Chat-Seiten `getNeedsOwnKey()` (server/session.ts, Entscheidung als
  reine Funktion `requiresOwnKey()` in plans.ts) und `<Chat needsKey>` zeigt
  `ChatKeyNotice` schon im leeren Chat ("Key hinterlegen" →
  `/settings#api-keys`, "Pro ansehen" → `/billing`). Ein 403 mit
  `kind: "byokRequired"` zeigt denselben Hinweis statt des Fehlerbanners.
- **Ziel-Tool-Auswahl komplett entfernt** (`212e4bc`): auf Kasums Wunsch,
  niemand hat sie benutzt, und das Modell ignorierte das gewählte Tool
  ohnehin. Picker, `target-tools.ts`, `target` im Request-Schema, im
  Systemprompt-Zusatz, in `chat-persistence.ts`, "Für X" in Chat-Kopf/
  -Liste/gespeicherten Prompts, das Struktur-Feld "Ziel-KI" der Rail sowie
  die "Für Lovable"-Pillen in Hero-Demo und ProductShowcase sind weg. Finn
  fragt im Gespräch selbst nach dem Tool. **Migration 0044** (dropt
  `conversations.target`, räumt `projects.context.target` und
  `generations.outputs.target`) ist **live angewendet**, nach dem Deploy
  des Codes, per SQL verifiziert. Achtung: 0043 (Stripe-Reste) ist weiterhin
  NICHT live, 0044 lief also vor 0043 — die beiden sind unabhängig.
- **Kopierter Prompt ohne ```** (`6e7af90`, F-3): glm-4.5-air schliesst den
  Codeblock auf der Inhaltszeile, der Block blieb offen und "Prompt kopieren"
  nahm die Backticks mit. `normalizeFences()` (features/chat/lib) repariert
  das vor dem Rendern.
- **Gespeicherte Prompts als Titelliste** (`7ac0ba9`): zugeklappt nur der
  Titel (automatisch aus der ersten Prompt-Zeile, umbenennbar), ein Klick
  klappt den Prompt mit Kopieren/Umbenennen/PDF/Löschen auf. WAI-Accordion
  (Überschrift umschliesst den Knopf).

- **Gedächtnis zuoberst in der Rail** (`a164de4`, P-3, auf dem ersten
  Feature-Branch `feat/project-brain-rail`): erste Karte statt vierter,
  leiser Akzentrahmen, Status "aktiv"/"veraltet", fertig analysiert kompakt
  (Zusammenfassung + Stack), Einzelfelder unter "Details". Bewusst NICHT
  auf der Landing Page (Kasums Entscheid).

**CI war danach fünf Commits lang rot** (alle von diesem Tag), nicht wegen
des Codes: `npm audit --audit-level=high` steht in der CI vor allen anderen
Schritten und schlug wegen eines neuen `sharp`-Advisories an. Behoben in
`671b8e7` (sharp-Override ^0.35.4, vitest ^4.1.11, 0 vulnerabilities),
`npm audit` ist seitdem Teil des lokalen Gates (siehe "Befehle"). Seit
demselben Commit läuft die CI bei Pushes auf jeden Branch, und es gilt die
Branch-Regel unter "Arbeitsregeln".

**Rechts- und Barrierefreiheits-Audit (2026-09-28):** Auf Kasums Wunsch
("die Seite soll nicht verklagt werden") Rechtstexte, Cookies, Einwilligungen,
Drittdienste, Werbeaussagen, Bilder und Barrierefreiheit gegen Code UND
Live-Seite geprüft. Bericht mit allen offenen Punkten im 2nd-brain
(`02 Projekte/PromptPrinter/PromptPrinter Rechts-Audit 2026-09-28.md`).
Ein Branch pro Problem, alle CI-grün und per Fast-Forward in `main`:

- `fix/signup-consent-wording`: Checkbox akzeptiert nur die AGB, die
  Datenschutzerklärung wird "zur Kenntnis genommen" (sie ist keine
  Einwilligung). `OAuthButtons` zeigt selbst den AGB-Hinweis, weil Google/
  GitHub die Checkbox umgingen und Supabase auch von `/login` aus Konten anlegt.
- `feat/cookie-policy-page`: neue Seite `/cookies`. Einträge in
  `features/marketing/lib/cookie-inventory.ts`, Guard
  `tests/guards/cookie-inventory.test.ts` scheitert bei jedem neuen Cookie
  oder localStorage-Schlüssel, der dort fehlt. **Neues Cookie = Eintrag dort.**
  Gemessen: anonyme Besucher bekommen auf öffentlichen Seiten gar nichts
  gespeichert, deshalb weiterhin bewusst kein Banner.
- `fix/privacy-policy-completeness`: Datenschutz nennt jetzt OAuth-Daten,
  Anzeigename, die echten Dateigrenzen (aus `project-files.ts`),
  Projekt-Gedächtnis inkl. GitHub-Abruf, Pflichtangaben und "kein Profiling".
- `fix/privacy-zai-transfer-facts`: Z.ai ist laut eigener Privacy Policy
  eine Firma in **Singapur** (nicht China), und nirgends belegt sind die
  Standardvertragsklauseln, die der Text behauptete. Jetzt steht nur, was
  belegt ist. **Rechtlich offen**, siehe Bericht.
- `fix/pricing-unsupported-claims`: "400 Prompts" -> "400 Chat-Antworten"
  (gezählt werden Antworten), "unbegrenzt" -> "ohne Monatslimit",
  "fertigen Plan" -> "Prompt", Registrierung nennt den Key-Bedarf von Free.
- `feat/ai-chat-disclosure`: Satz "Finn ist eine KI…" dauerhaft unter dem
  Composer (EU-KI-Verordnung Art. 50 Abs. 1, gilt seit 02.08.2026).
- `feat/voice-mode-privacy-notice`: Sprachmodus sagt beim Aufnehmen, dass
  Chrome/Edge an Google/Microsoft schicken, mit Link zur Datenschutzerklärung.
  Der ⚠️-Sprachmodus-Punkt weiter oben ist damit im Code erledigt
  (Datenschutzerklärung seit 06.09., Hinweis in der Sprachleiste jetzt),
  offen bleibt nur die juristische Einordnung.
- `fix/a11y-landmarks-and-links`, `fix/a11y-form-labels`: axe (WCAG 2.2 AA)
  über alle öffentlichen Seiten plus statischer JSX-Scan der eingeloggten App.
  `<main>` auf den Auth-Seiten, Links im Fliesstext unterstrichen,
  Überschriften-Reihenfolge auf `/pricing`, Formularfelder mit Namen.
- `fix/refund-cancel-path`: `/rueckerstattung` sagt, WIE man kündigt.

Nicht per Code lösbar und deshalb nur im Bericht: EU-Vertreter nach
Art. 27 DSGVO, Übermittlungsgrundlage für Z.ai, Lemon-Squeezy-Einstellungen
(Testmodus-URL in `.env.local`, Preise inkl. MwSt.), Kündigungsbutton
(§ 312k BGB), Higgsfield-Lizenz des Maskottchens. **Nicht mergen:** den
Vercel-Bot-Branch `vercel/install-vercel-web-analytics-…`, solange
Datenschutz und `/cookies` die Webanalyse nicht nennen.

**Kontomenü, Nutzung, Tarife, Nutzungsrichtlinie, Sprachen (2026-09-29):**
Auf Kasums Wunsch, ein Branch pro Änderung, jede CI-grün und per
Fast-Forward in `main`:

- `fix/footer-kazuvate-credit`: der kazuvate-Credit im Footer war 12 px
  klein und grau. Jetzt wie auf den Kundenseiten (ProMeti, Artemis,
  Portfolio): eigener Block unter dem Copyright, kurze Trennlinie (nicht
  volle Breite, sonst wieder die "doppelte Linie" vom 05.08.), Zeichen 28 px
  + Name 20 px fett in kazuvate-Oliv. Farbe als Token `--kazuvate`
  (hell `#3F5019`, dunkel `#93AA5E`) + Tailwind `text-kazuvate`,
  ausschliesslich für diesen Credit.
- `feat/usage-page`: neue Seite `/usage` ("Nutzung", für alle). Das eigene
  Kontingent zog von `/billing` dorthin, `/billing` zeigt nur noch Plan und
  Abo. Die frühere Admin-Seite "Betrieb" (`/admin`) ist ein Abschnitt
  derselben Seite, der nur für `is_admin` rendert; `/admin` leitet per
  `next.config.ts` dauerhaft auf `/usage` um. `adminNav` existiert nicht mehr.
- `feat/account-menu-shortcuts`: Kontomenü in der Reihenfolge Einstellungen,
  Nutzung, Gespeicherte Prompts, Abrechnung, jeweils mit Kürzel
  (Strg/⌘+`,`, Strg/⌘+Shift+U/S/B). Definition in `shell/lib/nav.ts` +
  `shortcuts.ts`, globaler Listener `shell/hooks/use-nav-shortcuts.ts`
  (nur in der Sidebar gemountet), Hinweise auch in der Befehlspalette. Alt
  bewusst ausgeschlossen (Strg+Alt = AltGr). Nebenbei: Strg+B/Strg+K
  prüften Shift nicht.
- `feat/plans-overview`: "Alle Tarife anzeigen" → `/plans`, Free und Pro
  wie auf `/pricing`, aber mit markiertem aktuellem Plan, Checkout mit
  Konto-ID und einer Vergleichstabelle aus `plans.ts`/`pricing.ts`.
- `feat/usage-policy`: neue Seite `/nutzungsrichtlinie` (die AGB sind die
  Nutzungsbedingungen, eine Nutzungsrichtlinie fehlte). AGB Ziffer 7 macht
  sie zum Bestandteil. Verlinkt in Footer, Sitemap, `llms.txt`, öffentlich in
  der Middleware. Wie alle Rechtstexte: Entwurf, juristisch prüfen lassen.
- `feat/account-menu-learn-more`: Untermenü "Mehr erfahren" (Hilfe + alle
  Rechtstexte, neuer Tab). Das Kontomenü lebt seitdem in
  `shell/components/account-menu.tsx`, das seitliche Untermenü ist ein
  eigener Baustein (`account-submenu.tsx`, Disclosure-Muster, Tastatur:
  Pfeil rechts/links, Escape schliesst erst das Untermenü).

**Mehrsprachigkeit (i18n), Branches `feat/i18n-foundation` + `-en/-fr/-it/-es`:**
Die eingeloggte App gibt es auf Deutsch, Englisch, Französisch,
Italienisch und Spanisch. **Landing Page, Login/Registrierung und die
Rechtstexte bleiben Deutsch** (Entscheid Kasum; eine übersetzte
Datenschutzerklärung wäre rechtlich eine eigene Fassung).

- Keine Bibliothek. `shared/i18n/messages/de.ts` ist die Quelle der Wahrheit,
  sein Typ `Messages` zwingt jede Sprache zu denselben Schlüsseln.
  `tests/guards/i18n-catalog.test.ts` prüft zusätzlich, dass jede
  Übersetzung dieselben `{platzhalter}` hat wie das Deutsche, dass die
  deutschen App-Plantexte mit `/pricing` übereinstimmen, und dass kein
  Client-Code fremde Wörterbücher importiert.
- Lesen: Client `useT()`/`useLocale()` (`shared/i18n/provider.tsx`,
  Standardwert Deutsch, deshalb laufen alte Komponententests ohne
  Provider), Server-Seiten `getT()`/`getLocale()`, API-Routen
  `requestT(req)` (liest den Cookie aus dem Request-Header, nicht über
  `next/headers`). Helfer: `fmt`, `plural` (Intl.PluralRules), `rich`
  (Links/Hervorhebungen mitten im Satz).
- Speichern: Cookie `pp-locale` (in der Cookie-Richtlinie) +
  `profiles.settings.locale` für andere Geräte (`use-change-locale.ts`).
  Auf einem neuen Gerät nimmt das (app)-Layout die Profil-Sprache und der
  Provider schreibt den Cookie nach. `<html lang>` zieht der Provider im
  Browser nach (das Root-Layout darf keine Request-Daten lesen).
- Wählen: Kontomenü → "Sprache", Mobile-Drawer, Einstellungen (Karte
  "Sprache"). Datum/relative Zeiten über Intl (Deutsch unverändert),
  Sprachmodus hört und spricht in der App-Sprache, die Projekt-Analyse
  schreibt das Gedächtnis in der App-Sprache (löst Audit-Befund F-7).
- **Neue UI-Texte gehören ab jetzt ins Wörterbuch**, in alle fünf
  Sprachen. Neue Sprache: Code in `LOCALES`, Eintrag in `LOCALE_NAMES`,
  `LOCALE_TAGS`, `LOCALE_ENGLISH_NAMES`, Datei `messages/<code>.ts`,
  Eintrag im `CATALOG` von `server/i18n.ts`.

**Nicht im Browser verifiziert:** alle eingeloggten Seiten (Kontomenü,
`/usage`, `/plans`, Sprachwechsel). Diese Sitzung hatte keinen Login im
Browser-Pane. Abgesichert über das Gate (1219 Tests, darunter
Komponententests für Menü, Kürzel, Untermenüs und das englische Rendern)
und `curl` für die Umleitungen. Öffentliche Seiten (Footer,
`/nutzungsrichtlinie`) im Dev-Server geprüft.

⚠️ **Merge-Weg geändert (2026-09-29): Pull Request mit "Rebase and merge"
statt lokalem Fast-Forward.** Alle Branches oben kamen noch per
Fast-Forward nach `main`, und GitHub hat die meisten dieser Commits nicht in
Kasums Contributions gezählt (Messung und Begründung unter
"Arbeitsregeln"). Ab jetzt geht jeder Branch per PR und `gh pr merge
--rebase` nach `main`. Die bereits gemergten Commits bleiben, wie sie sind
(kein Force-Push auf `main`). **Nachträglich gezählt wurden sie am 01.10.2026
trotzdem**, ohne die Historie anzufassen, durch einen kurzen Wechsel des
Standard-Branches (Ablauf und Messung unter "Arbeitsregeln").

**SEO-Durchgang (2026-10-01):** Kasum brachte eine Checkliste aus einem
TikTok mit (serverseitig rendern, Sitemap, robots, KI-Crawler, llms.txt,
eindeutige Titel, Canonicals, Überschriften-Hierarchie, Überschriften als
Fragen, interne Links, Textwände, Autorenzeile, JSON-LD, Vergleichsseiten,
Lighthouse, Search Console, tote Links). Zuerst gegen Code UND Live-Seite
gemessen, dann nur die echten Lücken behoben. Ein Branch pro Punkt, jeder
per PR mit "Rebase and merge" (PRs #12 bis #21).

**Schon vorhanden und unverändert** (per `curl` gegen `promptprinter.app`
belegt): alle öffentlichen Seiten statisch und mit Inhalt im HTML, Sitemap,
robots.txt, llms.txt, eindeutige Titel, genau eine `h1` pro Seite,
Organization/WebSite/SoftwareApplication/HowTo/FAQPage/BreadcrumbList als
JSON-LD, kein einziger toter Link (59 Linkziele geprüft). GPTBot, ClaudeBot,
PerplexityBot und zehn weitere Crawler bekommen 200.

**Behoben:**

- `fix/seo-dead-urls-404`: jede tote Adresse ging per 307 auf `/login`
  (Status 200), nie auf ein 404. Die Middleware kennt jetzt drei Sorten
  Pfade: öffentlich, eingeloggte App (`APP_PREFIXES` in
  `shared/lib/app-routes.ts`, Login-Umleitung wie bisher) und alles andere,
  das abgemeldet per Rewrite die 404-Seite bekommt. "Unbekannt ist gesperrt"
  (M-7) bleibt. Die CSP-Wahl hängt seitdem an `isAppPath()`, nicht mehr an
  `requiresSession()`. **Neue App-Seite = Eintrag in `APP_PREFIXES`, neue
  öffentliche Seite = Eintrag in `PUBLIC_PREFIXES`**, beides erzwingt
  `tests/guards/route-access.test.ts` gegen die Ordner unter `src/app`.
- `fix/seo-auth-pages-noindex`: `/login`, `/signup` und die Passwort-Seiten
  trugen das Canonical der Startseite. Jetzt eigenes Canonical plus
  `noindex, follow` im `(auth)`-Layout.
- `perf/lcp-headlines-without-js`: framer-motion liefert für
  `initial={{ opacity: 0 }}` ein `opacity:0` im HTML aus, Überschrift und
  erster Absatz erschienen erst nach dem Hydrieren. Neu: CSS-Klasse
  `.enter-rise` (nur `transform`) und die Server-Komponente `<Rise>`
  (`shared/motion/rise.tsx`) für den Seitenkopf. **`FadeIn` und `motion.h1`
  gehören nicht mehr um eine `h1`** (`tests/guards/visible-headlines.test.ts`).
  `Mascot` setzt `sizes`. Gemessen gegen die Live-Seite, mobil: grösster
  Inhalt auf `/pricing` 1,79 s → 0,86 s und auf einem Hilfe-Artikel 1,39 s →
  0,68 s (jeweils beobachtet, jetzt gleichzeitig mit dem ersten Bild),
  Lighthouse-Performance 77 → 87 und 81 → 91. SEO, Barrierefreiheit und
  Best Practices stehen auf 100. Die Startseite bleibt bei 75 bis 80: dort
  bremst nicht mehr die Überschrift, sondern das JavaScript von
  framer-motion und der Hero-Demo (Total Blocking Time 480 bis 930 ms). Das
  ist ein Umbau am Hero und bewusst nicht Teil dieses Durchgangs.
- `feat/seo-page-metadata`: jede Unterseite trug `og:title`, Beschreibung
  und `og:url` der Startseite. **Öffentliche Seiten setzen ihre Metadaten
  über `pageMetadata()`** (`shared/lib/page-metadata.ts`): Titel,
  Beschreibung, Canonical, `openGraph` samt Bild, `twitter`. Der Guard
  `tests/guards/seo-metadata.test.ts` importiert die Seiten und prüft
  Canonical gleich Pfad, eigene Vorschau, eindeutige Titel und
  Beschreibungen, Titel höchstens 65 Zeichen, und dass die Sitemap genau die
  öffentlichen Seiten führt.
- `feat/seo-question-headings`: 54 `h2` der Hilfe von Stichworten auf Fragen
  umgestellt ("Konto löschen" → "Wie lösche ich mein Konto?").
- `feat/seo-docs-byline-article-schema`: Autorenzeile (`Byline`) und
  `TechArticle`-JSON-LD auf jedem Hilfe-Artikel, `ProfilePage` auf `/ueber`.
  `docs-nav.ts` trägt pro Artikel ein `updated`-Datum. **Wer den Text eines
  Artikels ändert, zieht dessen `updated` nach**, nicht bei Refactorings.
- `feat/seo-comparison-pages`: `/vergleich` plus drei Vergleichsseiten
  (ChatGPT oder Claude direkt fragen, Prompt-Vorlagen, direkt im Bau-Tool
  prompten), Inhalte in `features/marketing/lib/comparisons.ts`. Die Regeln
  stehen dort im Kopf und gelten für jede weitere Seite: Vergleich mit einer
  Arbeitsweise statt mit einem Produkt, keine Preise oder Funktionen Dritter
  (veralten, und eine falsche Angabe wäre unlautere vergleichende Werbung),
  jede Seite sagt, wann der andere Weg besser ist, der eigene Preis kommt
  aus `pricing.ts`. Stimme der Hilfe, nicht Finns Ich-Form.
- `feat/seo-search-console-verification`: `GOOGLE_SITE_VERIFICATION` und
  `BING_SITE_VERIFICATION` setzen den Inhaber-Nachweis im Root-Layout
  (`shared/lib/site-verification.ts`). **Offen, nur für Kasum:** Property in
  der Search Console anlegen, Wert in Vercel setzen, neu deployen,
  bestätigen, `/sitemap.xml` einreichen. Schritte stehen in `.env.example`.
- `fix/ci-audit-brace-expansion`: `npm audit` schlug wieder an (neues
  Advisory für `brace-expansion`), Override auf `^5.0.12`.

**Geprüft und bewusst gelassen:** Textwände gibt es ausserhalb der
Rechtstexte keine (längster Absatz 81 Wörter auf `/ueber`, in der
Datenschutzerklärung sechs Absätze über 80 Wörter, die als Rechtstext so
bleiben). robots.txt behält eine einzige Gruppe für `*`: ein Crawler mit
eigener Gruppe ignoriert `*`, die Disallow-Liste müsste pro Bot wiederholt
werden.

**Contributions, bestätigt:** direkt nach dem Rebase-Merge von PR #11 sprang
der 29.09. bei GitHub von 2 auf 3 gezählte Commits, und jeder der am 01.10.
per Rebase gemergten Commits wurde gezählt. Der Weg unter "Arbeitsregeln"
hält also, was er verspricht.

**README und Lizenz (2026-10-01, direkt auf `main`, von Kasum erlaubt):**
Das README ist bewusst kurz (Logo, Tagline, Screenshot, Funktionen, Stack,
Lizenz). **Alles Technische gehört nach [docs/SETUP.md](SETUP.md)**
(Schnellstart, Scripts, Environment, Deploy-Checkliste, Struktur,
Projekt-Gedächtnis), nicht zurück ins README. Das README beschreibt, was das
Produkt kann: wer ein Feature streicht oder baut, zieht die Liste dort nach
(am 03.08. beschrieb es die entfernte Pipeline, und die Gedächtnis-Analyse
gab das falsch wieder). Bilder liegen in `docs/images/`, das Logo ist ein
256-px-Ausschnitt von Finn (15 KB statt 2,6 MB). [LICENSE](../LICENSE) ist
"All Rights Reserved", nur Ansehen, ein Entwurf ohne juristische Prüfung.
**Offen, nur Kasum:** die GitHub-Beschreibung des Repos (Zahnrad neben
"About") nennt noch "PRDs, technical specifications, and blueprints", also die
entfernte Pipeline.

**Vorübergehende Anbieterfehler werden wiederholt (2026-10-01,
`feat/llm-retry-transient-errors`):** Ein 503, ein abgerissener Aufruf oder ein
Ratenlimit des KI-Anbieters wurde bisher sofort als Fehlermeldung an den
Nutzer gereicht, obwohl derselbe Aufruf zwei Sekunden später klappt.
[`src/server/llm-retry.ts`](../src/server/llm-retry.ts) wiederholt jetzt bis zu
zweimal (3 Versuche, Wartezeit 0,35 bis 0,7 s, dann 0,7 bis 1,4 s, mit
Zufallsanteil; ein `Retry-After` des Anbieters gilt bis 4 s). **Die Regel
steht an genau einer Stelle:** die drei Einstiegspunkte in `llm.ts`
(`chatComplete`, `chatCompleteStream`, `analyzeComplete`) sind Hüllen um die
bisherigen Funktionen (`…Once`), und in allen SDK-Konstruktoren sind die
eigenen Wiederholungen der Anbieter abgeschaltet (Anthropic/OpenAI `maxRetries:
0`, Gemini `attempts: 1`; Gemini wiederholte vorher bis zu 5 Mal, sonst
wären es 3 x 3 Versuche geworden). **Wiederholt wird:** Netzwerkabbruch, 408,
425, 429, 500, 502 bis 504, 520 bis 524, 529. **Nie:** 400, 401, 403, 404,
422, ein 429 mit aufgebrauchtem Guthaben (`insufficient`, `balance`,
`billing`, `credit` im Text, Warten hilft dort nicht), Zeitlimit, leere
Antwort, Abbruch durch den Nutzer. **Streams werden nur bis zum ersten
Textstück wiederholt**, danach würde der Text von vorn beginnen und das
Gelesene verdoppeln. Ein Zug zählt weiterhin einmal gegen Kontingent und
Tagesbudget, egal wie viele Versuche er braucht. Die Route meldet jeden
Wiederholungsversuch als SSE-Event `status` (`{phase: "retrying", attempt,
maxAttempts}`), der Browser zeigt statt "Schreibt…" "Das dauert gerade etwas
länger" (`ChatTyping retrying`, Text in allen fünf Sprachen). Geloggt wird
jeder Versuch als `llm.retry` (Info, kein Alarm), ein endgültig
gescheiterter Zug trägt `attempts` im `chat.turn_failed`. **Neuer
Anbieter-Aufruf = durch `llm.ts` und damit durch die Hülle**, nie am
Retry vorbei ein SDK direkt aufrufen.

**Fotos und Dateien an Chat-Nachrichten (2026-10-02, Branch
`feat/chat-attachments`):** Ein „+" links im Composer öffnet direkt die
Dateiauswahl (kein Menü), beim Hovern steht „Fotos oder Dateien hinzufügen"
(neues `shared/ui/tooltip.tsx`). Entschieden von Kasum, nach der Frage
„nur an Finn schicken oder speichern": **dauerhaft im Chat speichern**, wie bei
ChatGPT (die leichtere Variante ohne Speicherung wurde bewusst verworfen).

- **Was geht:** Fotos (PNG/JPG/WebP) und alles aus der Dateiliste
  (`shared/lib/file-kinds.ts`, aus `project-files.ts` hierher gezogen, weil zwei
  Features sie brauchen), bis 4 je Nachricht, auch per Strg+V. Lockfiles zählen
  als Text (200-KB-Grenze). **Nicht** dabei: PDF, GIF, HEIC. Eine Nachricht
  braucht ihren Text, ein Anhang allein lässt sich nicht senden (Hinweis unter
  den Dateien). Drag & Drop gibt es nicht.
- **Grenzen** an einer Stelle, `shared/lib/chat-limits.ts`: Bilder auf 1568 px
  und höchstens 1 MB (Browser skaliert, ein 11-MB-PNG wird ~160 KB, im
  Browser-Pane nachgemessen), Textdateien 200 KB, **2 MB roh je Anfrage**
  (Vercel nimmt Bodies nur bis 4,5 MB, Base64 kostet 33 %), **100 MB je
  Konto**. `MAX_CHAT_BODY_BYTES` und sein Invarianten-Test tragen den
  Anhangsanteil.
- **Speicher:** Migration **0045**, Tabelle `message_attachments` (Client nur
  `select`) + privater Bucket `chat-attachments` **ohne insert-Policy**:
  geschrieben wird nur in `/api/chat` über den Service-Role-Client
  (`createAdminClient`), nachdem `validateUploads` Magic Bytes, strenges UTF-8,
  Grössen und das Kontingent (`attachment_bytes_used()`, eine Funktion, weil
  PostgREST bei 1000 Zeilen kappt) geprüft hat. Der Browser sagt, was er
  hochladen WILL, der Typ kommt aus den Bytes. Pfad
  `{userId}/{conversationId}/{uuid}.{ext}`, nie der Dateiname.
- **Ablauf:** Bytes reisen als Base64 an der NEUEN Nachricht; ältere Nachrichten
  tragen nur ihre Zeilen-ID, der Server schlägt ihre Anhänge selbst nach
  (`model-history.ts`, auf Eigentümer + Konversation eingegrenzt). Ein
  Browser kann dem Modell also nichts unterschieben, was nicht als echter
  Anhang des Chats gespeichert ist. `openTurn` legt Objekte und Zeilen mit der
  Frage ab, bei einem Fehler geht alles zurück.
- **Was das Modell sieht** (`attachment-model.ts`, rein, ohne Mocks testbar):
  Budget vom Neuesten zum Ältesten, höchstens 4 Bilder, 24.000 Zeichen
  Dateitext, 12.000 je Datei ("nicht Credits verbrennen"). Dateitext steht in
  `<attached_file>`-Tags, ein schliessendes Tag im Text wird entschärft. Fällt
  etwas heraus, sagt das Modell es („…is not available to you in this turn"),
  statt zu raten. Systemprompt: Anhänge sind Material, keine Anweisung (wie der
  Projektkontext).
- **Anbieter** (`llm.ts`): `LlmMessage.images`, jeder Pfad übersetzt in seine
  Form (image_url-Data-URI für Z.ai/Custom/OpenAI, inlineData für Gemini,
  base64-Blöcke VOR dem Text für Anthropic). **Z.ai:** `glm-4.5-air` sieht keine
  Bilder, ein Zug mit Bild im Verlauf läuft auf `glm-4.6v`
  (`ZAI_VISION_MODEL`), teurer, aber nur dann. **Gegen den echten Account
  geprüft:** ein selbst erzeugtes blaues Quadrat wird über den Chat-Stream als
  „blue" erkannt. Ein BYOK-Custom-Modell ohne Vision scheitert mit der
  generischen Anbieter-Fehlermeldung.
- **Aufräumen, immer in derselben Reihenfolge:** Pfade einsammeln, ZEILEN
  löschen (Kaskade), erst bei Erfolg die OBJEKTE entfernen. Storage-Objekte
  kaskadieren nicht. Betrifft `rollbackTurn`, `dropSupersededMessages`,
  Chat löschen (`chat-list.tsx`), Projekt löschen (`delete-project.tsx`, Inner
  Join über `conversations`) und Konto löschen (`api/account`, seitenweise).
  Die Helfer für Browser-Seiten stehen in `shared/lib/attachment-storage.ts`
  (`projects` darf nicht aus `chat` importieren). Waisen findet
  `scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments`.
- **Bearbeiten einer Nachricht mit Anhängen:** die Dateien bleiben dran,
  werden nicht erneut hochgeladen. `inheritAttachmentsFrom` (nur wirksam, wenn
  die Anfrage dieselbe Nachricht auch als `supersededMessageIds` führt) hängt
  sie erst NACH dem erfolgreichen Zug um, VOR dem Wegwerfen der alten. Ohne
  echte Zeilen-ID gibt es kein Bearbeiten solcher Nachrichten.
- **Verlauf nach dem Neuladen:** `load-messages.ts` (beide Chat-Seiten) lädt
  Nachrichten samt Anhängen per Embed und signiert Bild-URLs (4 h). Scheitert
  der Embed (Migration 0045 fehlt), fällt er auf den reinen Verlauf zurück.
- **Deploy-Reihenfolge: erst Migration 0045, dann der Code.** Davor geht der
  Chat weiter, nur Nachrichten MIT Anhang scheitern. **Eingehalten:** 0045
  wurde am 2026-10-02 als `chat_attachments` in die Produktions-Datenbank
  angewendet (Supabase-MCP, letzte Migration davor `drop_conversation_target`),
  danach PR #27 per Rebase-Merge nach `main`. 0043 (Stripe-Reste) ist
  weiterhin NICHT live, die beiden sind unabhängig.
- **Nach dem Anwenden lesend geprüft (2026-10-02):** `message_attachments`
  existiert mit RLS an und der Policy `message_attachments_owner_select`;
  `authenticated` hat nur `select`, `anon` gar nichts. Bucket `chat-attachments`
  ist privat, 2.097.152 Byte, erlaubt `image/png`, `image/jpeg`, `image/webp`,
  `text/plain`. Auf `storage.objects` gibt es für ihn nur `select` und
  `delete`, keine insert-Policy (die übrigen insert-Policies der Tabelle
  gelten `avatars` und `project-files`). `attachment_bytes_used()` ist für
  `authenticated` ausführbar, für `anon`/`public` nicht; der Trigger
  `message_attachments_limit` ist aktiv und seine Funktion für niemanden
  ausführbar. In einer Transaktion mit ROLLBACK als `authenticated` mit
  zufälliger UUID: Zählung 0, Insert scheitert mit `42501 permission denied`.
  Danach 0 Zeilen und 0 Objekte, es blieb nichts zurück. Advisors: keine neue
  Sicherheitswarnung. Neu in der Performance-Liste nur zwei INFO-Hinweise
  „Unused Index" für `message_attachments_message_idx` und
  `message_attachments_conversation_idx`, erwartbar bei einer leeren Tabelle,
  kein Handlungsbedarf (nach echter Nutzung noch einmal ansehen). Die übrigen
  Funde (`billing_events` ohne Policy und ohne FK-Index, Schutz vor geleakten
  Passwörtern in Supabase Auth nicht aktiviert, ältere ungenutzte Indizes)
  gab es schon vorher.
- **Datenschutz/Hilfe nachgezogen:** neuer Abschnitt „Anhänge im Chat" in der
  Datenschutzerklärung (`lastUpdated` auf den 2.10.2026), Anhänge in der
  Z.ai-/Supabase-Aufzählung, Speicherdauer und Löschen; Hilfe-Artikel
  „Chat mit Finn" (drei neue Fragen), „Dateien im Projekt" (der Satz „Bilder
  kommen nicht in den Chat" galt nicht mehr) und „Konto und Daten".
  **Juristisch ansehen lassen**, wie jede Änderung an den Rechtstexten.
- **Verifiziert:** Gate grün (1593 Tests; neu: Store, Route-Ablauf, Budget,
  Browser-Aufbereitung, Composer, Chat, Lösch-Pfade; Mutationstest am
  Zurückrollen), Composer in hell und dunkel im Browser-Pane (Hover-Tooltip,
  Datei-Auswahl, Verkleinern, Vorschau, abgeschickte Nachricht). **Nicht
  verifiziert:** der ganze Ablauf mit eingeloggtem Konto gegen die echte
  Datenbank und den echten Bucket (kein Login in der Sitzung; das Schema
  selbst ist seit dem 2026-10-02 live und geprüft, siehe oben), und die
  Übersetzungen in fr/it/es (von Muttersprachlern prüfen lassen).

**Betriebs-Audit (2026-10-04):** Prüfung gegen die sechs Punkte eines
"Senior Engineer vor Production"-Videos (Fundament, Sicherheit, Randfälle,
Datenbank, Test unter echten Bedingungen, Betrieb), Code UND Infrastruktur
(Supabase- und Vercel-MCP, nur lesend). Ergebnis: der Code ist sauber, die
Hebel liegen im **Betrieb**. Liste mit Belegen im Second Brain:
`02 Projekte/PromptPrinter/PromptPrinter Betriebs-Audit 2026-10-04.md`; der
Prompt zum Abarbeiten der offenen Punkte steht daneben (`Prompt Folgesitzung
Betriebs-Audit 2026-10-04.md`).

**Die sieben niedrigen Punkte sind erledigt**, ein Branch und ein PR je Punkt
(#30 bis #36), dazu #29 als Blocker. Was daraus für die Arbeit hier folgt:

- **Gate-Kommando ist `npm run audit:gate`** statt `npm audit`: dasselbe mit
  Schwelle `high`, plus eine befristete Ausnahmeliste
  ([`scripts/audit-gate.mjs`](../scripts/audit-gate.mjs)). Anlass: GHSA-vfj7-8cjw-p6xm
  (`braces`) hat keine gepatchte Version und hängt nur an Build-Werkzeugen
  (im ausgelieferten `.next/standalone` nicht enthalten). Die Ausnahme **läuft
  am 2026-11-04 ab**, danach scheitert die CI wieder (Entscheid dann: Upstream-
  Fix, Tailwind 4 oder Verlängerung mit Begründung).
- **Migration 0046** (`set_active_byok_provider` nicht mehr für `anon`
  ausführbar) liegt im Repo, ist aber wie 0043 **NICHT in der Produktions-DB**.
  Neuer Guard in `migrations.test.ts`: jede an `authenticated` vergebene
  Funktion muss von `PUBLIC` entzogen werden.
- **CSP pro Route:** `thirdPartiesFor(pathname)` in `server/security/csp.ts` gibt
  Turnstile und Lemon Squeezy nur den Routen frei, die sie einbinden, dazu
  `script-src-attr 'none'`. `'unsafe-inline'` bleibt auf statischen Seiten (Next-
  Inline-Skripte tragen dort keinen Nonce). **Neue Seite mit Captcha oder
  Checkout = Eintrag dort**; `tests/guards/csp-third-parties.test.ts` folgt den
  Importen und erzwingt es in beide Richtungen.
- **BYOK-Secret rotieren:** `API_KEY_ENCRYPTION_SECRET_PREVIOUS` +
  [`scripts/rotate-byok-secret.mjs`](../scripts/rotate-byok-secret.mjs), Ablauf in
  `docs/SETUP.md`. Blob-Format unverändert (Zurückrollen bleibt sicher). Das
  Skript ist eine Kopie der Verschlüsselung; ein Guard hält beide gleich.
- **Passwortprüfung:** `weakPasswordReason()` in `shared/lib/password.ts` weist
  bekannte Passwörter, Leetspeak-Varianten, Muster und die eigene E-Mail ab
  (Registrierung serverseitig in `/api/auth`, Formulare als Sofort-Rückmeldung).
  **Anmelden prüft nicht** (bestehende Konten sollen nicht ausgesperrt werden).
  Bewusst ohne Drittdienst (HaveIBeenPwned bräuchte einen Eintrag in der
  Datenschutzerklärung); echte Abdeckung gibt es nur mit Supabase Pro.
- **Datenexport:** `GET /api/account/export` + Karte "Deine Daten" in den
  Einstellungen. Positivliste je Abschnitt (`server/account-export.ts`), nie
  `select *`, nie API-Keys, nie Dateiinhalte. Texte in fr/it/es ungeprüft.
- **`docker.yml`:** baut und startet den Produktions-Container wöchentlich und
  bei Änderungen an Dockerfile/Compose/`package*.json` und prüft `/api/health`.
  Beim ersten Lauf grün: der Docker-Pfad war nicht verrottet.
- **`/api/chat` zählt lazy:** die monatliche Zählabfrage läuft nur noch, wenn
  Redis nicht entscheiden kann oder eine Ablehnung die Zahl nennen muss.

**Vor dem Gate zwischen Branches `.next` leeren** (`rm -rf .next`): es hält Typen
für Routen, die es auf dem anderen Branch nicht gibt, und der Typecheck scheitert
daran. Hängt das Gate und die Testzeiten stehen plötzlich in Minuten statt
Millisekunden, zuerst den Rechner prüfen (Standby), nicht den Code.

**Offen, Details im Prompt:** kritisch K1 Supabase/Vercel auf Gratis-Tarifen
ohne Backup, K2 `ALERT_WEBHOOK_URL` fehlt (die Alarmierung ist gebaut, aber aus),
K3 der Bezahlweg ist nie real gelaufen (`billing_events` leer); mittel: kein
E2E-Test und kein Staging, kein Umschalten auf einen zweiten Modell-Anbieter,
`GITHUB_TOKEN` fehlt, tote `STRIPE_*`-Variablen, Auth-Mails vermutlich über den
Standardversand, kein Fehler-Tracker, Wartbarkeit (`llm.ts`, `chat/route.ts`,
`chat.tsx`, diese Datei), Node 24 (Vercel) gegen 22 (CI), Dependabot.
**Korrektur zur ersten Fassung des Audits:** `llmConfig()` wählt Gemini nur,
wenn `ZAI_API_KEY` FEHLT. Das ist eine Auswahl beim Start, kein Umschalten bei
einem Z.ai-Ausfall; einen `GEMINI_API_KEY` zu setzen ändert dort nichts.

**Betriebs-Audit, Folgesitzung M1 bis M6 (2026-10-05, PR #38 bis #40):**
Nur diese sechs Punkte, K1 bis K3 und M7 bis M10 sind unberührt (siehe den
Prompt im 2nd-brain).

- **M1/M2, Smoketests im Browser (#38):** `npm run test:e2e`, 17 Playwright-
  Tests (Chromium, Desktop und Pixel 7) gegen den **lokalen Supabase-Stack**,
  nie gegen ein gehostetes Projekt. Eigener Workflow `e2e.yml` (Pfadfilter,
  wöchentlich). Ablauf, Abdeckung und was bewusst NICHT geprüft wird:
  [docs/SETUP.md](SETUP.md), "Ende-zu-Ende-Tests". Der Lauf beweist nebenbei,
  dass sich die Datenbank aus `supabase/migrations/` nachbauen lässt: nach dem
  Neuaufbau stimmen Spalten, Richtlinien, RLS, Indizes, Buckets sowie Tabellen-
  und Spaltenrechte mit Produktion überein (Hash-Vergleich, einziger Unterschied
  ist die Plattformfunktion `rls_auto_enable()`). Dafür waren zwei Eingriffe
  nötig: **`0003` setzt das `REVOKE` auf `rls_auto_enable()` jetzt bedingt** (die
  Funktion legt nur Supabase auf gehosteten Projekten an, lokal fehlte sie und
  brach die Kette), und **`supabase/roles.sql`** nimmt `anon`/`authenticated` die
  automatischen Rechte auf neue Tabellen (der lokale Stack vergibt sie, Produktion
  nicht, ein vergessenes `GRANT` fiele sonst lokal nie auf). Sperren: `e2e/support/
  env.ts` verweigert jede andere Datenbank-Adresse als localhost, der Test-Server
  bekommt seine Umgebung vollständig vom Test und schlägt damit die echte
  `.env.local`, Port 3100, kein Wiederverwenden eines laufenden Servers. Läuft im
  Dev-Modus mit Stub-Chat (`next start` verweigert den Stub). Mutationstest:
  drei eingebaute Fehler machten je den zuständigen Test rot (lokal, nicht in der
  CI). **Nie ausprobiert:** der Browser-Pfad mit echter KI, Sprachmodus, Zahlung,
  Turnstile, Redis, Mails, fr/it/es, andere Browser, Last.
- **M2, Vorschau-Secrets (Vercel, mit Kasums Ja):** `SUPABASE_SERVICE_ROLE_KEY`,
  `API_KEY_ENCRYPTION_SECRET` und `LEMON_SQUEEZY_WEBHOOK_SECRET` sind jetzt
  Production-only; Preview trägt eigene Platzhalter bzw. Zufallswerte (bootet,
  kann aber keine Admin-Aktionen, und eigene Keys aus Produktion nicht
  entschlüsseln). Alle anderen Variablen sind weiter für beide Ziele gesetzt. Ein
  Vorschau-Deployment nach der Änderung antwortet auf `/api/health` mit ok, das
  Produktions-Deployment danach ebenfalls. **Kein Staging-Projekt:** Supabase Free
  erlaubt zwei Projekte, die Vorschau teilt sich weiter die Produktions-
  **Datenbank** (mit RLS, ohne Admin-Rechte).
- **M3, Failover Z.ai → Gemini (#40):** [`src/server/llm-failover.ts`](../src/server/llm-failover.ts).
  Nur mit beiden Server-Keys, nach den 3 Versuchen, nur bei einem Ausfall
  (Netz, 408/425/5xx, 429 ohne Guthaben-Text, 30 s ohne erstes Textstück), nie
  bei 400/401/403/404/422, leerer Antwort, leerem Guthaben, BYOK oder Nutzerabbruch,
  bei Streams nur vor dem ersten Textstück. Leistungsschalter in Redis (3 Züge in
  Folge in 2 Minuten, 60 s offen, Probeaufruf), eigenes Tagesbudget
  `LLM_FAILOVER_DAILY_CALLS` (200), weil Gemini rund das Achtfache kostet. `chat.turn`
  loggt den Anbieter, auf dem der Zug WIRKLICH lief. **Verhaltensänderung für den
  bestehenden Pfad:** der Z.ai-Stream hat jetzt ein Zeitlimit bis zum ersten
  Textstück (30 s, vorher keines, ein hängender Anbieter blockierte bis 300 s).
  **Nie gegen den echten Gemini-Dienst geprüft**, nur mit simulierten Ausfällen und
  sieben Mutationstests. **Wartet auf Kasum:** bezahlter `GEMINI_API_KEY` (auf dem
  Gratis-Tarif darf Google Prompts zur Produktverbesserung nutzen), und die
  Datenschutzerklärung juristisch ansehen (der Satz "Ausweich-Anbieter" stimmt erst
  jetzt, ob er Anhänge und Projektdateien trägt, ist offen). Ohne den Key ändert
  sich im Betrieb nichts außer dem Zeitlimit.
- **M4, GitHub-Kontingent (#39):** gemessen, 2 zählende Anfragen je Analyse, ohne
  Token 60/h pro IP = 30 Analysen (ob Vercels Egress-IP geteilt wird, ist lokal
  nicht messbar). Neu `brain.github_quota` (`authenticated`, `limit`, `remaining`,
  nie das Token) und `brain.github_rate_limited` als Warnung. **Wartet auf Kasum:**
  Token ohne Scopes anlegen, `GITHUB_TOKEN` in Vercel setzen, eine Analyse
  auslösen, im Log `limit: 5000` prüfen.
- **M5, Migrationen live (mit Kasums Ja, 05.10.2026):** 0043 (Stripe-Reste) und
  0046 (`anon` nicht mehr auf `set_active_byok_provider`) sind in der
  Produktions-DB, lesend verifiziert (Tabelle/Spalte/Index weg, `anon` ohne
  Funktionsrecht), Advisors ohne neuen Fund. **Wartet auf Kasum:** die vier
  `STRIPE_*`-Variablen in Vercel löschen und im Stripe-Dashboard die Schlüssel
  widerrufen, falls das Konto noch existiert (im Code steht nichts mehr davon).
- **M6, Fehler-Tracker (nur Vorschlag):** nichts gebaut, kein Dienst verbunden.
  Gewählt: Fehler-Tracker (EU). Vorschlag samt Textentwurf für die
  Datenschutzerklärung im 2nd-brain (`PromptPrinter Fehler-Tracker Vorschlag
  2026-10-05`). Der Textentwurf trägt Platzhalter für Aufbewahrung und
  Übermittlungsgrundlage, weil beides nicht belegt ist.

---

## Anhang: aus CLAUDE.md ausgelagert am 2026-10-06

Die Abschnitte unten standen bis zum 2026-10-05 **wörtlich** so in `CLAUDE.md`. Sie
sind gekürzt oder ersetzt worden, weil sie Verlauf und Messungen mit Regeln
mischten. Die Regeln selbst stehen weiter in `CLAUDE.md`; hier steht, wie es dazu kam
(Messungen, Zahlen, Stand der Dinge am 2026-10-05).

### Wichtig zu wissen (Fassung vom 2026-10-05)

1. **Modell-Provider ist Z.ai (GLM), plus BYOK.** Der komplette Modellzugriff
   ist in [`src/server/llm.ts`](../src/server/llm/index.ts) gekapselt, Server-seitig:
   `ZAI_API_KEY` (Z.ai, Default-Modell `glm-4.5-air`, Kosten-Tier, via
   `ZAI_MODEL` überschreibbar) → `GEMINI_API_KEY` (Zweit-Provider) →
   **Stub-Modus** (Templates kommen unverändert zurück, ganzer Flow bleibt
   ohne Key testbar). Zusätzlich kann jeder Nutzer in den Einstellungen einen
   eigenen Anthropic-/OpenAI-/Gemini-Key hinterlegen (BYOK,
   [`src/server/byok.ts`](../src/server/byok.ts) + `user_api_keys`-Tabelle,
   verschlüsselt via `API_KEY_ENCRYPTION_SECRET`), der übersteuert den
   Server-Key komplett und hebt Generierungen-/Chat-Nachrichten-Limits auf.
   Routen sprechen nie direkt mit einem Provider-SDK.
2. **Zahlungen laufen über Lemon Squeezy, live seit 2026-08.** Checkout,
   Webhook (`/api/webhooks/lemonsqueezy`) und Kundenportal-Verlinkung sind
   gebaut und produktiv (siehe „Kritik-Pass + BYOK" und den Audit-Abarbeitungs-
   Block weiter unten für die seither behobenen Befunde). Stripe ist aus Code
   UND Datenbank vollständig entfernt (Migration `0043_drop_stripe_remnants.sql`,
   **B-11, Audit 06.09.2026 — noch nicht live angewendet**, siehe dort).
3. **Env-Dateien nicht verwechseln:** `npm run dev` liest `.env.local`, der
   Prod-Docker-Container liest `.env` (via `env_file` in
   `docker-compose.prod.yml`), das `--env-file .env.local` im Compose-Befehl
   steuert nur die ${VAR}-Interpolation, nicht die Container-Runtime-Vars. Ein
   API-Key muss also je nach Workflow in der richtigen Datei (oder beiden)
   stehen.
4. **`docker-compose.yml` ist seit 2026-08 der Dev-Stack, nicht Prod** (siehe
   „Docker-Dev-Stack" weiter unten). Der blanke `docker compose up --build`
   baute vorher stillschweigend das strikte Produktions-Image und brach ohne
   Upstash/Verschlüsselungs-Secret beim Boot ab — genau der Fehler, den ein
   Dev-Rechner ohne Produktions-Secrets immer ausgelöst hätte. Produktion
   braucht jetzt zwingend `-f docker-compose.prod.yml` (siehe [DOCKER.md](DOCKER.md)).

### Befehle, Gate und Build-Wettlauf (Fassung vom 2026-10-05)

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

Die [CI](../.github/workflows/ci.yml) fährt dieselbe Kette bei jedem Push auf
**jeden** Branch und bei jedem PR. Der Audit steht dort VOR allem anderen:
schlägt er an, laufen Typecheck, Lint, Test und Build gar nicht erst. Genau so
waren am 23.09.2026 fünf Commits in Folge rot, obwohl das lokale Gate (damals
noch ohne Audit) grün war — ein neues `sharp`-Advisory war seit dem
letzten Push erschienen. Deshalb gehört der Audit ins lokale Gate.

**`audit:gate` ist `npm audit --audit-level=high` mit einer Ausnahmeliste**
([`scripts/audit-gate.mjs`](../scripts/audit-gate.mjs), seit 2026-10-04). Am
04.10.2026 erschien GHSA-vfj7-8cjw-p6xm für `braces` ohne gepatchte Version
(betroffen sind alle bis 3.0.3), also gab es nichts, auf das ein `overrides`-
Eintrag hätte heben können, und jede CI wäre rot geblieben. `braces` hängt nur
an `tailwindcss` 3.4 und `eslint-config-next`; im ausgelieferten
`.next/standalone` ist es nicht enthalten (geprüft). Die Liste `ACCEPTED` im
Skript nimmt genau diesen Fund heraus, **befristet bis 2026-11-04**, mit
Begründung; alles andere ab `high` scheitert wie zuvor. Danach scheitert das Gate
wieder und jemand muss neu entscheiden: Upstream-Fix abwarten, auf Tailwind 4
springen (Breaking Change) oder mit neuer Begründung verlängern. Einträge nur
mit Beleg, dass der Fund die ausgelieferte App nicht erreicht, nie "später".

**Die Schritte des Gates nie durch `| tail` oder `| head` leiten.** Eine Pipe
gibt den Exit-Code des letzten Befehls zurück, also den von `tail`, und der
ist immer 0: ein roter `npm audit` sah am 01.10.2026 so einen Lauf lang grün
aus. Ausgabe in eine Datei schreiben und den Exit-Code des Schritts selbst
prüfen.

**Wenn der Build mit `ENOENT … .next/…` abbricht:** läuft parallel ein
Dev-Server? `next dev` und `next build` teilen sich dasselbe `.next`-
Verzeichnis, und während der Dev-Server kompiliert (vor allem direkt nach dem
Start), liest der Build Dateien, die der Dev-Server gerade ersetzt. Der Abbruch
sieht aus wie ein echter Build-Fehler und ist keiner — Dev-Server stoppen,
Build wiederholen.

Das ist ein **Wettlauf, keine Zustandsverderbnis.** Gemessen am 2026-08-04
(Planpunkt A-4, dessen ursprüngliche Diagnose „stale `.next`" damit widerlegt
ist): zweimal `npm run build` hintereinander auf einem bestehenden `.next`
läuft grün, und auch ein Build bei laufendem, fertig kompiliertem Dev-Server
läuft grün. Reproduziert wurde der Abbruch nur, während der Dev-Server frisch
startete und selbst noch schrieb. Deshalb bewusst **kein** `prebuild`, das
`.next` löscht: das würde bei jedem Build den inkrementellen Cache wegwerfen
(auch in der CI) und einen Wettlauf trotzdem nicht verhindern — `rm -rf .next`
„hilft" nur, weil es Zeit kostet, in der der Dev-Server fertig wird.

### Arbeitsregeln mit Messungen zu Contributions und CI (Fassung vom 2026-10-05)

- **Git-Staging immer explizit per Dateiname**, nie `git add .` / `git add -A`.
- **Gate vor jedem Commit** (siehe oben), alles grün.
- **Commit-Trailer:** `Co-Authored-By: Claude <aktuelles Modell> <noreply@anthropic.com>`.
- **Nie direkt auf `main` arbeiten** (Kasums Regel seit 2026-09-23). Jede
  Arbeit auf einem eigenen Branch (`fix/…`, `feat/…`, `docs/…`), für jedes
  Problem ein eigener. **Branches nie löschen**, weder lokal noch auf GitHub
  (auch nicht beim Merge, kein `--delete-branch`).
- **Nach `main` nur per Pull Request mit "Rebase and merge"** (Kasums Regel
  seit 2026-09-29). Ablauf pro Branch:
  1. Frischen Branch von aktuellem `main` anlegen (`git pull` vorher).
  2. Committen, Gate grün, Branch pushen.
  3. `gh pr create --base main` mit kurzer Beschreibung.
  4. CI auf dem PR grün abwarten, dann `gh pr merge <nr> --rebase`. **Ein
     grüner Lauf, der älter als ein paar Stunden ist, zählt nicht:** vorher
     `gh run rerun <id>` und das Ergebnis abwarten. Der Rebase-Merge schreibt
     einen neuen Commit auf `main`, und dessen Lauf prüft den Stand von jetzt,
     nicht von vorgestern.
  5. Lokal `git checkout main && git pull`, erst danach der nächste Branch.

  **Warum die Regel in Schritt 4 steht:** am 01.10.2026 war PR #11 seit zwei
  Tagen grün. Beim Merge lief `npm audit` gegen ein neues Advisory für
  `brace-expansion` und färbte den Commit auf `main` rot (`df67d43`), obwohl
  an dem PR nichts falsch war. Ein rotes Kreuz im Verlauf lässt sich nicht mehr
  entfernen, ohne `main` umzuschreiben. Genauso entstanden 6 der 14 roten
  Commits unter den neuesten 100 auf `main` (fünf am 23.09., einer am
  01.10.), die übrigen 8 waren abgebrochene Läufe, siehe nächster Absatz.

  **Abgebrochene Läufe:** bis 2026-10-01 brach die CI einen laufenden Lauf ab,
  sobald auf derselben Ref ein neuer Push kam, auch auf `main`. Zwei Commits
  kurz hintereinander auf `main` ergaben für den ersten ein rotes Kreuz
  (06.09. und 01.10.). Auf `main` hat jeder Commit seit `fix/ci-main-runs-not-cancelled`
  seine eigene Concurrency-Gruppe, auf Branches und PRs wird weiter abgebrochen.
  Wer trotzdem ein Kreuz sieht: `gh run rerun <id>`, aber erst wenn auf `main`
  kein anderer Lauf läuft (ältere Läufe teilen sich noch die alte Gruppe).

  **Warum kein lokales Fast-Forward mehr:** GitHub hat Commits, die zuerst
  auf einem Branch lagen und dann per Fast-Forward auf `main` geschoben
  wurden, grösstenteils nicht in Kasums Contributions gezählt (gemessen:
  28.09. 6 von 37, 29.09. 2 von 12; am 23.09., direkt auf `main`, 8 von 8).
  "Rebase and merge" schreibt die Commits auf `main` neu, jeder einzelne
  zählt, und die Historie bleibt linear. Folge daraus: die Commits auf `main`
  haben andere IDs als auf dem Branch. Deshalb den nächsten Branch **nie**
  vom vorherigen Feature-Branch abzweigen, sondern immer von frisch
  gepulltem `main`, sonst trägt der neue PR die alten Commits noch einmal mit.

  **Am 01.10.2026 nachgemessen:** jeder per "Rebase and merge" gemergte
  Commit wurde gezählt, der erste (PR #11) innert Sekunden. Prüfen lässt sich
  das über die GitHub-API (`contributionsCollection` →
  `commitContributionsByRepository`), nicht nur am Profil. Ein Commit zählt am
  Tag, an dem er geschrieben wurde (Autor-Datum), nicht am Tag des Merges.
  Jeder PR zählt zusätzlich als ein eigener Beitrag.

  **Ungezählte Commits nachträglich zählen lassen (am 01.10.2026 getestet, hat
  funktioniert):** Ein Wechsel des Standard-Branches lässt GitHub die Beiträge
  des Repos neu einlesen. Die Historie bleibt dabei unberührt.
  1. Spiegel-Branch auf den aktuellen `main`-HEAD legen
     (`git branch contributions-reindex main && git push origin contributions-reindex`).
     Er muss auf dem HEAD stehen, damit jeder Commit von `main` auch auf dem
     neuen Standard-Branch erreichbar bleibt und nichts wegfallen kann.
  2. `gh api -X PATCH repos/BajKasum/PromptPrinter -f default_branch=contributions-reindex`
  3. Rund zwei Minuten warten, dann messen (`contributionsCollection`, siehe
     oben). Am 01.10. zeigte die erste Messung nach 13 Sekunden noch nichts,
     die zweite nach rund 90 Sekunden schon alles.
  4. `gh api -X PATCH repos/BajKasum/PromptPrinter -f default_branch=main` und
     nochmal messen, ob die Zahlen halten.

  Gemessen: 28.09. 6 auf 37 Commits, 29.09. 3 auf 13, 01.10. 14 auf 15. Die
  Zahlen standen nach dem Zurückstellen und auch einen Tag später unverändert.
  Vercel deployte durch den Wechsel nichts. **Während des Wechsels (wenige
  Minuten) nichts auf `main` pushen oder mergen:** ein Push auf einen
  Nicht-Standard-Branch zählt laut GitHub nicht als Beitrag. Der Spiegel-Branch
  bleibt stehen (Branches nie löschen). Warum das nötig war: die Commits waren
  vorher schon auf einem Branch, und GitHub zählte sie beim Fast-Forward nach
  `main` nicht. Ob das wirklich der Mechanismus ist, ist nicht belegt, belegt
  ist nur, dass der Wechsel sie nachträglich zählt.
- **Nach jeder abgeschlossenen Änderung committen + pushen**, nicht auf Aufforderung warten.
- **Secrets nie mit `NEXT_PUBLIC_*`** prefixen, landen sonst im Client-Bundle.
  Server-Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`, …) ohne Prefix.
- **Keine rohen Hex-Farben** in Komponenten, nur semantische Token-Utilities
  (siehe [DESIGN.md](DESIGN.md)).
- **User-scoped Queries:** RLS scope + zusätzlich explizit `.eq("user_id", …)`
  (Defense-in-depth), v.a. wo Counts Limits durchsetzen.

### Landing Page, Aktueller Zustand (Fassung vom 2026-10-05)

> ⚠️ **Die öffentliche Website hat seit 2026-07-30 genau zwei Seiten**
> (`a72c3ba`): die Landing Page und `/pricing`. `/features` existierte einen
> Tag (`cd639c6`, 2026-07-29) und ist wieder aufgelöst, die Seite verteilte
> ein Argument auf zwei Orte, die es unterschiedlich erzählten (Landing
> pitchte Finn und hörte auf, `/features` begrüsste ihn ein zweites Mal und
> trug die eigentliche Erklärung, wer nie auf „Funktionen" klickte, sah nur
> den Pitch). `next.config.ts` leitet `/features` dauerhaft auf
> `/#funktionen` um; Navbar und Footer verlinken direkt den Anker.
>
> Gemeint sind die beiden Seiten, die das Produkt verkaufen. Daneben gibt es
> die Hilfe (`/docs`, zehn Artikel), `/ueber`, `/kontakt`, die sechs
> Rechtstexte und seit 2026-10-01 `/vergleich` mit drei Vergleichsseiten
> (siehe "SEO-Durchgang" oben). Die Vergleiche sind wie die Hilfe geschrieben,
> nicht in Finns Ich-Form, und nur über Footer, Hilfe-Übersicht, Sitemap und
> `llms.txt` erreichbar, nicht über die Navbar.

**Aktuelle Seiten-Reihenfolge** (`src/app/(marketing)/page.tsx`):
```
Navbar → Hero → HowItWorks → ProductShowcase → FinalCTA → Footer
```
`HowItWorks` trägt `id="funktionen"` (das Ziel des Navbar-Links). Die Landing
Page nennt seit 2026-08-05 keinen Preis mehr und stellt keine Fragen mehr,
`PricingBridge` (war: „Und was kostet das?") und `FAQ` sind raus, siehe
Eintrag unten. Beides lebt jetzt ausschliesslich auf `/pricing`.

**Entfernte Sektionen** (bewusst gelöscht, nicht wiederherstellen):
- `Capabilities`, früh entfernt (war Jargon-lastig)
- `Problem` (Litany + trauriger Finn), auf Nutzerwunsch entfernt (2026-07-16,
  `df538a1`), Komponente gelöscht. War zuvor als „nicht anfassen" markiert.
- `ExampleOutput` und `Integrations`, auf Nutzerwunsch entfernt (2026-07-16,
  `ed9ebee`), beide Komponenten gelöscht. Betraf zwei Seiten: die Landing
  Page und `/features` (nutzte beide ebenfalls, live per Footer-Link +
  Sitemap). Anchor-Links, die auf `#example` zeigten (Navbar „Funktionen",
  Hero-CTA „Erst mal zuschauen"), zeigen jetzt auf `#produkt`
  (ProductShowcase), sonst wären sie ins Leere gelaufen.

> **Update (2026-07-30):** `HowItWorks` folgt direkt auf `Hero`, danach
> `FeaturesGrid`, `ProductShowcase` und `PricingBridge`. Schließt den
> Story-Flow (so gehen wir vor → das bekommst du → dein Arbeitsplatz →
> Preis). Flache `card-surface`-Karten + `building`-Finn heben `HowItWorks`
> klar von der glänzenden Hero-Demo ab. `pricing-preview.tsx` existiert nicht
> mehr, die Pläne stehen seit `cd639c6` auf `/pricing` (`pricing-grid.tsx`).

**Sektion-Dateien:**
| Datei | Zustand | Finn |
|---|---|---|
| `hero.tsx` | Asymmetrisch: Finn + Sprechblase links, Headline+CTAs rechts. Darunter HeroDemo, seit dem Finn-Umbau (2026-07-22, U-1) 3 Stufen statt 4 (Idee → Rückfrage → Prompt, spiegelt `chat-markdown.tsx`s echtes CodeBlock-Chrome). Trust-Badge-Zeile unter den CTAs entfernt, „Erst mal zuschauen" zeigt jetzt auf `#produkt`. Subtext auf einen kurzen Zweizeiler gekürzt + vergrößert (18/21px statt 16/18px), Demo-Fensterchrome ohne „PromptPrinter · Demo"-Label (2026-07-16). | `welcoming` + Stage-States |
| `how-it-works.tsx` | 3-Schritt-Prozess (Idee → kurz klären → startklar) in flachen card-surface-Karten; Step 2 mit Chat-Bubble. Direkt nach Hero, vor ProductShowcase (`FeaturesGrid` stand hier zwischenzeitlich, am 2026-07-30 wieder entfernt, siehe unten). Trägt `id="funktionen"` + `scroll-mt-24`, das Sprungziel der Navbar. | `building` |
| `product-showcase.tsx` | Interaktive Workspace-Vorschau: Chats / Projekte. Mini-Sidebar nutzt denselben Pillen-Umschalter (`NavSwitcher`, "Chat"/"Projekt") wie die echte Sidebar, kein gefälschter „app.promptprinter.dev/…"-URL-Balken mehr (2026-07-16). Einziges verbleibendes „Schau es dir an"-Proof-Element auf der Landing Page. Seit 2026-07-17 mit `organizing`-Finn im Header (Brand-Audit #1). | `organizing` |
| `final-cta.tsx` | Persönlicher Abschluss, "Den Rest mach ich mit dir." | `celebrating` |
| `footer.tsx` | Finn's Abschluss: kleiner Finn (nur das Bild, kein Text mehr seit 2026-08-05) + eine flache Link-Zeile daneben (alle 12 Seiten, seit 2026-09-28 inkl. `/cookies`, seit 2026-09-29 inkl. `/nutzungsrichtlinie`, seit 2026-10-01 inkl. `/vergleich`, keine Produkt/Legal-Gewichtung mehr), Copyright direkt darunter, nur noch eine Trennlinie, darunter der kazuvate-Credit als eigener Block (kurze Linie, Oliv, seit 2026-09-29). Links tragen dieselbe Wasser-Pille + Welle wie die Navbar (`NavWave` jetzt in `shared/ui/nav-wave.tsx`, von beiden geteilt). | `idle` |
| `navbar.tsx` | Fix/blur-on-scroll, 2 Nav-Links: „Funktionen" (`/#funktionen`, natives `<a>`) und „Preise" (`/pricing`, `next/link`). Hover + aktive Seite: Wasser-Pille hinter dem Label + einschwimmende Welle (`.nav-pill`/`.nav-wave` in globals.css, `NavWave`-Komponente in `shared/ui/nav-wave.tsx`), aktive Seite behält beides an + `aria-current`. Mobile-Drawer: getönte Zeile + einblendendes Chevron. | Kein Finn |

**`/pricing`** (`src/app/(marketing)/pricing/page.tsx`): `PageHeader` (nur
Headline) → `PricingGrid` → `FAQ` → `Footer`. Der begrüssende Finn samt
Sprechblase und Subline über der Headline ist auf Nutzerwunsch weg
(2026-07-30), `FinnGreeting` hatte danach keinen Aufrufer mehr und ist
gelöscht; `page-header.tsx` behält nur Grid + Floaters. Die Finns auf den
Plan-Karten (`PricingGrid withMascot`) sind ausdrücklich geblieben, das ist
weiterhin die Seite, auf der er überall sein soll — die separate
Beruhigungs-Kartenreihe (eigener Key / keine Kreditkarte / monatlich
kündbar, je mit eigenem Finn) zwischen Plan-Grid und FAQ ist seit `ca77daa`
(2026-07-30, selber Tag wie ihre Einführung) wieder weg: die FAQ direkt
darunter beantwortet dieselben drei Sorgen ausführlicher.

> **Spannung aus 2026-07-30, seit demselben Tag aufgelöst:** `FeaturesGrid`
> stand zwischenzeitlich zwischen `HowItWorks` und `ProductShowcase`
> (Widerspruch zum Brand-Prinzip „kein Feature-Grid" unten, damals bewusst
> eingegangen, weil der Nutzer die Funktionen-Seite mit der Homepage
> zusammengelegt haben wollte). Auf Zuruf aus Live-Screenshots noch am selben
> Tag (`ca77daa`) wieder entfernt: deckte dieselbe Fläche wie `HowItWorks`
> und der echte Workspace direkt daneben schon ab. Komponente gelöscht, aus
> der Git-Historie rekonstruierbar, kein Aufrufer mehr.

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

### Offene Punkte / Nächste Schritte (Fassung vom 2026-10-05)

**Priorität 1: Das Workspace-Redesign**, Phasen 1-5 aus [REDESIGN.md](REDESIGN.md)
(Sidebar → Chat-Kanonisierung → Workspace v1 → Dateien → Handoff/Wahrheits-Pass).
Die Brand-Audit-Punkte unten bleiben gültig, laufen aber danach bzw. werden von
Phase 5 (Landing-Nachzug) teilweise miterledigt.

Brand-Audit-Status (2026-07-17 durchgegangen):

1. ✅ **ProductShowcase** (erledigt, `c233d15`), `organizing`-Finn (float) rechts
   neben der Headline, ab lg sichtbar. Die längste Sektion hatte als einzige
   keinen Finn — behoben.
4. ✅ **Mono-Eyebrow auf jeder Sektion** (bereits erledigt), die
   `SCHAU ES DIR AN`/`DEIN ARBEITSPLATZ`-Eyebrows sind in den früheren
   Landing-Umbauten schon aus allen Landing-Sektionen verschwunden. Verbliebene
   `font-mono uppercase`-Treffer sind Demo-Fenster-Chrome im Hero,
   `/features` und Legal-Seiten, keine Sektions-Eyebrows. Kein Handlungsbedarf.
2. ◐ **Finn-Welt-Atmosphäre / Dark Mode** (teilweise, `005718d`), erster
   „vorsichtig ausbauen"-Pass: biolumineszenter Fokus-Ring (Manifesto #9)
   an den geteilten Primitives (`.focus-glow`/`.input-glow` in globals.css,
   Wasser-Ring + weicher Bloom, box-shadow-only). `FinnAtmosphere` (ambienter
   Tiefen-Layer) existierte schon. **Offen bleibt** die grössere „Dark Mode
   wirkt kalt"-Frage (Palette-Verbindung Creme/Coral/Navy, `--accent-warm`
   wartet auf echte Höhepunkte, Phase 3) — heikles „felt, not seen"-Terrain,
   Roadmap in DESIGN.md → „Finn's World". Die ~13 verstreuten `focus:ring`-
   Call-Sites blieben (noch) auf dem flachen Ring.
3. ✅ **Sektions-Übergänge / Rhythmus** (erledigt, `246a820`), die untere
   Hälfte (Pricing → FAQ → FinalCTA) lief dreimal identisch `py-24/32`
   (metronomisch); die obere Hälfte hatte mit fallenden Top-Paddings 36→20→16
   schon Rhythmus. FAQ ist jetzt der engere Zwischenbeat (md 20/20) zwischen
   Pricing (32/24) und FinalCTA (28/36), Abstände ziehen sich zum CTA hin
   zusammen. Reine Whitespace-Änderung.

**Nicht anfassen (stabil, fertig):**
- Mascot-State-System und alle 14 Assets (die zwei toten Reste `dolphin-happy.png`/
  `dolphin-think.png` sind seit B-7, Audit 06.09.2026, entfernt)
- Hero-Demo (seit 2026-07-22 3 Stufen: Idee → Rückfrage → Prompt, siehe Tabelle oben)
- Footer (Finn's Farewell)
- Auth-Flow, DB-Migrationen, RLS-Policies
