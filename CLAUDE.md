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
>   Stand bis zur Entfernung der Handoff-Funktion. `/api/generate` samt der
>   ganzen Erzeugungs-Pipeline ist seit 2026-07-17 komplett entfernt (C-1,
>   siehe unten), keine tote Route mehr im Repo.
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
>
> **Kritik-Pass „S-1" behoben (2026-07-16, `682039d`):** Der zweite kritische
> QA-Befund, SSRF über den BYOK-Custom-Provider. Der `baseUrl` (Settings)
> wurde nur mit `z.string().url()` validiert, der Server fetchte sie direkt
> bei jedem Settings-Test-Call, Chat und Generate. Jeder registrierte
> Free-Nutzer konnte den Server damit zu Requests an interne Ziele bringen
> (Cloud-Metadaten `169.254.169.254`, `localhost`, RFC1918-Bereiche),
> verschärft durch teilweise Response-Body-Reflektion in der Fehlermeldung
> (SSRF mit Exfiltration). Neu: [`src/lib/url-safety.ts`](src/lib/url-safety.ts),
> `assertPublicHttpsUrl()` erzwingt https, löst den Hostnamen auf und lehnt
> jede aufgelöste Adresse in privaten/reservierten Bereichen ab (inkl. der
> von WHATWG-URL normalisierten Hex-Schreibweise für IPv4-mapped IPv6, ein
> anfänglicher Test-Fail zeigte das: `::ffff:127.0.0.1` wird zu
> `::ffff:7f00:1` normalisiert). Verdrahtet in `llm.ts`s `customComplete()`,
> dem einen Ort, der tatsächlich fetcht, deckt damit alle drei Aufrufpfade
> in einem Rutsch ab. `redirect: "error"` verhindert zusätzlich einen
> Redirect-basierten Bypass. Kein DNS-Rebinding-fester Pinned-Connection-
> Aufbau (unverhältnismässig für dieses Projekt), schliesst aber den
> üblichen Fall. Fehlerantworten geben nur noch die geparste, erwartete
> Provider-Fehlerform zurück, nie mehr den rohen Response-Body.
>
> **Kritik-Pass „S-2" behoben (2026-07-16, `e54161b`):** Keine
> Content-Security-Policy trotz Fremd-Markdown-Rendering im Chat,
> [next.config.ts](next.config.ts) liess sie bisher bewusst weg, weil eine
> echte CSP einen Nonce braucht, den eine statische `headers()`-Config
> nicht liefern kann. react-markdown läuft ohne
> `rehype-raw`/`dangerouslySetInnerHTML`, hat also keinen bekannten
> Injection-Pfad, CSP ist trotzdem die übliche zweite Verteidigungslinie.
> Neu: [`src/lib/csp.ts`](src/lib/csp.ts) baut die Policy aus einem
> Pro-Request-Nonce, [`src/middleware.ts`](src/middleware.ts) erzeugt ihn
> (`Buffer.from(crypto.randomUUID())`, ein roher UUID-String ist wegen der
> Bindestriche kein gültiger CSP-Nonce) und reicht ihn per Request-Header
> durch, Next hängt seine eigenen Hydration-Scripts automatisch an
> denselben Nonce, `src/app/layout.tsx` liest ihn über `headers()` zurück
> und reicht ihn an next-themes' `nonce`-Prop weiter (Layout dafür zur
> async Function gemacht). Cloudflare Turnstile bleibt über einen
> Origin-Allowlist-Eintrag erlaubt (externes `<script src>`, kein Nonce
> nötig). `script-src` erlaubt `'unsafe-eval'` nur in `development` (Next
> Fast Refresh braucht `eval()`, die Produktion nicht). `connect-src`
> bekommt die Supabase-Projekt-Origin, kein LLM-Provider braucht einen
> Eintrag, die laufen alle serverseitig. Im Dev-Server per Browser-Preview
> verifiziert: CSP-Header korrekt gesetzt, Turnstile lädt weiterhin,
> next-themes + Next-Hydration-Scripts tragen denselben Nonce, keine
> CSP-Verstösse in der Konsole.
>
> **Kritik-Pass „U-1" behoben (2026-07-16, `ddded15`):** Hero-Demo,
> FeaturesGrid, `/features` und ProductShowcase bewarben weiterhin die
> automatische Mehrfach-Dokument-Erzeugung, die mit der Handoff-Entfernung
> ersatzlos gestrichen wurde. Bewusst zurückgestellt bis zur Entscheidung,
> wie die Seite den tatsächlichen Chat-Flow zeigen soll, jetzt umgesetzt:
> neue Erzählung, grundiert in `src/prompts/system.ts`s
> `CHAT_SYSTEM_PROMPT` (eine Rückfrage, dann der fertige Prompt im
> Codeblock). `hero.tsx`s HeroDemo von 4 Stufen (Idee→Plan→Build→Launch
> mit auto-generiertem Produktplan/Design/DB/Backend/Marketing +
> Live-Domain) auf 3 Stufen (Idee → Rückfrage → Prompt) umgebaut, die
> Prompt-Stufe spiegelt bewusst `chat-markdown.tsx`s echtes CodeBlock-
> Chrome. `features-grid.tsx`: 6 Karten mit generierten Dokumenten ersetzt
> durch das, was ein Chat tatsächlich liefert (Rückfragen, Ziel-KI-
> Tailoring, Projekte, BYOK, Verlauf), die „Ebenfalls dabei"-Bonuskarte
> (Deployment-Anleitung, SEO-Plan) ersatzlos entfernt. `how-it-works.tsx`s
> Schritt 3 versprach „einen kompletten Plan plus die fertigen Anweisungen
> für jedes KI-Tool", jetzt der eine zugeschnittene Prompt.
> `features/page.tsx` + `layout.tsx`: Meta-Description nannte PRD/
> Blueprints/Schema als generierte Artefakte, jetzt der Chat-Kern
> beschrieben. `product-showcase.tsx`: Mock-Projekte zeigten „9 Artefakte"
> + Kategorie-Pills aus der toten Pipeline, echte Projekte haben heute 0
> Artefakte (keine `generations`-Zeilen mehr, siehe F-1-Fix), auf
> Chat-Zähler umgestellt. `faq.tsx` + `pricing-preview.tsx`: „Stack
> wechseln"/„Alle Ausgabetypen" durch den echten Weg ersetzt. Verifiziert
> im Dev-Server (Browser-Preview): alle Seiten rendern die neue Copy
> korrekt, keine Konsolenfehler.
>
> **Kritik-Pass „C-1" behoben (2026-07-17):** Die tote `/api/generate`-
> Pipeline (siehe QA-Kritik-Pass oben) war seit der Handoff-Entfernung von
> keiner UI mehr erreichbar, wurde aber weiter gewartet und blieb als
> direkt POST-bare, nicht per UI verlinkte Route live. Komplett entfernt:
> die Route selbst, `generate-guards.ts`, `build-generate-content.ts` (+
> Test), `run-generation.ts`, `persist-generation.ts`, sowie die zehn nur
> dafür genutzten Paket-Prompt-Templates (`brief/prd/master/frontend/
> backend/schema/security/marketing/seo/deployment-template.ts`).
> Mitentfernt, weil ausschliesslich von der toten Pipeline importiert:
> `SYSTEM_PROMPT`/`GENERAL_SYSTEM_PROMPT` aus `prompts/system.ts`,
> `generalPromptTemplate`/`generalVariantTemplate` aus
> `prompts/general-prompt.ts`, `generateRequestSchema`/`GenerateRequest`
> aus `lib/schemas.ts`, `prompts/types.ts` (alle vier Interfaces waren
> ungenutzt). Bewusst **nicht** angefasst: `GENERAL_VARIANTS`,
> `lib/artifacts.ts` und die `generations`-Tabelle, die tragen weiterhin
> die Ergebnisse-Anzeige und die Usage-Meter für bestehende Zeilen. Die
> Grundsatzfrage (kommt je ein Ersatz-Feature für den Chat→Ergebnis-Weg?)
> bleibt offen; falls ja, wird die Pipeline aus der Git-Historie
> rekonstruiert, kein Verlust durchs Löschen. Quality-Gate komplett grün
> (`npm run typecheck && npm run lint && npm run test && npm run build`),
> `.next`-Cache musste einmal geleert werden, weil er noch einen Typ für
> die gelöschte Route generiert hatte.
>
> **Grundsatzfrage beantwortet + „Prompt speichern" gebaut (2026-07-17,
> `b3ae4af`):** Auf die Frage, womit der Chat→Ergebnis-Weg ersetzt wird,
> die Entscheidung: **„Ergebnisse" bleibt als Konzept, aber
> leichtgewichtig.** In einem Projekt-Chat sichert ein „Speichern"-Button
> (`chat-result-panel.tsx` → `save-prompt-button.tsx`) den fertigen Prompt
> aus der aktuellen Antwort in die Ergebnisse des Projekts. **Kein
> Auto-Generieren, kein Modell-Call** — nur der Prompt, den der Nutzer
> schon hat, das unterscheidet es klar vom entfernten Handoff (der
> automatisch 10 Artefakte generierte). Speicher: die bestehende **leere**
> `generations`-Tabelle wird wiederverwendet statt einer neuen Tabelle
> (ein gespeicherter Prompt = eine Zeile mit `outputs = { prompt, title,
> target }`); die Tabelle behält aus Pragmatismus ihren Namen, semantisch
> ist eine Zeile jetzt ein gespeicherter Prompt. Einzige DB-Änderung:
> Migration `0018_generations_owner_delete.sql` ergänzt die fehlende
> owner-scoped DELETE-Policy + Grant (0001 hatte nur select/insert), live
> gegen die Supabase-DB angewendet und per SQL verifiziert. Neue
> Ergebnisse-Seite = Liste gespeicherter Prompts (Kopieren/Löschen/
> PDF-für-Pro, jsPDF lazy) statt der toten 10-Tab-Ansicht. Das tote
> „Generierungen"-Monatslimit (zählte 0, wurde nirgends erzwungen) ist
> raus (Meter aus Billing/Settings, `generations`-Feld aus `plans.ts`),
> Speichern ist unbegrenzt/gratis, nur Chat-Nachrichten bleibt gemessen.
> Toter Paket-Code, der dadurch verwaiste, entfernt: `artifacts.ts`
> (+Test), `project-tabs.tsx`, `general-prompt.ts`/`GENERAL_VARIANTS`
> (die letzten Reste aus dem C-1-„nicht angefasst") — Bibliothek zeigt
> jetzt Prompt- statt Artefakt-Zähler, die immer leeren Kategorie-Filter
> sind weg. Quality-Gate grün (222 Tests, +12 für die neuen Helfer). Der
> interaktive Speichern-Flow wurde nicht per Browser verifiziert (braucht
> Login), die reine Logik ist unit-getestet, DB-Migration per SQL geprüft.
>
> **Finn-Umbau zum Build-Spezialisten (2026-07-22, `79755a9` + `2a2f811`):**
> Nach einer Grill-me-Session zur Produktrichtung stand fest: die Zielgruppe
> ist Vibe-Coder, die Prompts in Bau-Tools füttern, nicht ein allgemeines
> Alltags-Prompt-Tool. Der tatsächliche Code widersprach dem: jeder neue
> Chat lief auf `mode="general"` → `CHAT_SYSTEM_PROMPT`, der explizit
> „everyday goals … not just software" sagte und nur „ONE short clarifying
> question" stellte, keine Vollständigkeits-Fragen zu Datenmodell/Auth/
> Screens. `CODE_CHAT_SYSTEM_PROMPT` (der eigentliche Build-Prompt) war
> nur über `project.type === "software"` erreichbar, aber `POST /api/projects`
> setzt hart `type: "general"`, kein UI-Pfad setzt je „software" (0 von 1
> Projekten in der Prod-DB), also war er faktisch toter Code.
>
> Schritt 1 (`79755a9`): `CHAT_SYSTEM_PROMPT` neu geschrieben. Kernwert
> jetzt explizit „nicht Credits verbrennen" — eine **gebündelte** Rückfrage
> (nicht mehr „ONE question") stellt nur, was für die konkrete Idee zählt
> (Ziel-Tool falls unbekannt, Kern-Screens, Datenmodell, Auth, Design-
> Richtung), dann ein fertiger, aufs Ziel-Tool zugeschnittener Prompt.
> Kulanter Fallback für Nicht-Bau-Ziele (Finn hilft trotzdem, ohne Bau-Fragen
> zu erzwingen). Context-Safety-Absatz (Prompt-Injection-Abwehr) unverändert,
> reine Sicherheitsgrenze, nicht Teil der Positionierung.
>
> Schritt 2 (`2a2f811`): `CODE_CHAT_SYSTEM_PROMPT` + die mode-Verzweigung in
> `api/chat/route.ts` entfernt, eine Systemprompt für jeden Chat. Bewusst
> **nicht** angefasst: `chatRequestSchema.mode`, `ChatMode`-Typ,
> `conversations.mode` (4 von 8 Bestandschats tragen „software", per
> Supabase-Check verifiziert) und `chat-variants.ts` — reine Altdaten-
> Kompatibilität, keine Verhaltensentscheidung hängt mehr daran. Ein
> DB-Schnitt (Spalte/Typ entfernen) ist ein separates, grösseres Thema.
>
> Beides reine Prompt-/Server-Änderungen ohne UI, im Stub-Modus nicht
> sichtbar prüfbar (Chat-Antwort dort unabhängig vom System-Prompt generisch),
> deshalb nur über das Gate abgesichert (typecheck/lint/build/222 Tests,
> beide Schritte grün). **Landing-Page/Marketing-Nachzug erledigt (2026-07-22,
> `a5dfc13` + `56db021`):** Beim Durchgehen von Hero, HowItWorks, FAQ,
> FeaturesGrid, `/features` und Pricing stellte sich heraus, dass der Umfang
> deutlich kleiner war als hier zunächst notiert, die frühere U-1-Überarbeitung
> (`ddded15`, 2026-07-16) hatte die Positionierung schon auf Build-Tools
> umgestellt (Lovable/Cursor/Claude Code durchgängig genannt, keine
> "Alltag/everyday"-Reste mehr, per Grep über alle Marketing-Komponenten
> verifiziert). Tatsächlicher Rest: zwei veraltete Code-Kommentare in
> `hero.tsx`/`features-grid.tsx` ("Finn asks exactly one clarifying
> question", stale seit dem Prompt-Umbau, keine UI-Wirkung) und **eine**
> echte inhaltliche Lücke, die FAQ-Antwort auf "Was bringt mir das, statt
> Claude einfach selbst zu fragen?" trug den neu gewählten Kernhook "nicht
> Credits verbrennen" noch nicht. Jetzt nachgezogen: Finn fragt vor dem
> Tippen in Lovable/Cursor/Claude Code nach Datenmodell/Auth/Design, das
> spart Credits und Nachbesserungs-Runden. Beide Commits Gate-grün
> (typecheck/lint/build/222 Tests).
>
> **App-Chrome verschlankt (2026-07-22, `74ee9f1`):** Auf Nutzer-Feedback
> zu Screenshots die Topbar komplett entfernt (`topbar.tsx` gelöscht):
> Suchfeld, Benachrichtigungs-Stub (war nur ein leerer Platzhalter) und
> Konto-Dropdown wirkten als unnötiges Chrome oben auf der Seite. Konto
> (Avatar, Name, Plan/Admin-Badge, Einstellungen, Abrechnung, Abmelden)
> sitzt jetzt unten in der Sidebar, in beiden Zuständen (Popover öffnet
> aufwärts ausgeklappt, nach rechts eingeklappt). Die globale ⌘K-
> Befehlspalette bleibt als reine Tastatur-Funktion erhalten (kein
> sichtbarer Button mehr, aber ein echtes, in der Erst-Login-Tour gelehrtes
> Feature, keine tote Funktion), zieht mit in die Sidebar um. Mobile:
> `MobileNav`s Hamburger-Trigger wandert direkt in `layout.tsx`
> (schmale sticky Leiste, nur der Button), „Abmelden" im Drawer ergänzt
> (hatte vorher nur in der Topbar gelebt). Onboarding-Tour (`tour-steps.ts`)
> nachgezogen: der „search"-Schritt zeigt jetzt eine zentrierte Karte statt
> ein nicht mehr existierendes Element anzuvisieren, der „account"-Schritt
> zielt auf den neuen `data-tour="account-menu"`-Anker. Composer
> (`chat-composer.tsx`): Eingabefeld startet einzeilig (48px), wächst mit
> Inhalt bis 200px, scrollt danach intern, wie bei Claude/ChatGPT statt der
> vorherigen festen 2-Zeilen-Box; Senden-Button ist jetzt ein kleiner
> runder Icon-Button (36×36) statt des breiten Text+Icon-Buttons. Verifiziert
> im Dev-Server mit echter eingeloggter Session (Kontomenü-Position in
> beiden Sidebar-Zuständen, Composer-Auto-Resize per DOM-Messung bestätigt).
> Gate grün (typecheck/lint/build/222 Tests, `next/navigation`-Mocks in
> `sidebar.test.tsx`/`mobile-nav.test.tsx` um `useRouter` ergänzt, neu durch
> die Abmelden-Funktion).

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

## Landing Page, Aktueller Zustand

> ⚠️ **Die öffentliche Website hat seit 2026-07-30 genau zwei Seiten**
> (`a72c3ba`): die Landing Page und `/pricing`. `/features` existierte einen
> Tag (`cd639c6`, 2026-07-29) und ist wieder aufgelöst, die Seite verteilte
> ein Argument auf zwei Orte, die es unterschiedlich erzählten (Landing
> pitchte Finn und hörte auf, `/features` begrüsste ihn ein zweites Mal und
> trug die eigentliche Erklärung, wer nie auf „Funktionen" klickte, sah nur
> den Pitch). `next.config.ts` leitet `/features` dauerhaft auf
> `/#funktionen` um; Navbar und Footer verlinken direkt den Anker.

**Aktuelle Seiten-Reihenfolge** (`src/app/page.tsx`):
```
Navbar → Hero → HowItWorks → FeaturesGrid → ProductShowcase →
PricingBridge → FAQ → FinalCTA → Footer
```
`HowItWorks` trägt `id="funktionen"` (das Ziel des Navbar-Links, bewusst dort
und nicht auf `FeaturesGrid`, sonst überspringt der Sprung die drei Schritte,
die die Feature-Liste erst verständlich machen). `PricingBridge` ist der eine
Ort auf der Landing Page, der einen Preis nennt, die Pläne selbst bleiben auf
`/pricing`.

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
| `hero.tsx` | Asymmetrisch: Finn + Sprechblase links, Headline+CTAs rechts. Darunter HeroDemo (Idea→Plan→Build→Launch mit Stage-Narration). Trust-Badge-Zeile unter den CTAs entfernt, „Erst mal zuschauen" zeigt jetzt auf `#produkt`. Subtext auf einen kurzen Zweizeiler gekürzt + vergrößert (18/21px statt 16/18px), Demo-Fensterchrome ohne „PromptPrinter · Demo"-Label (2026-07-16). | `welcoming` + Stage-States |
| `how-it-works.tsx` | 3-Schritt-Prozess (Idee → kurz klären → startklar) in flachen card-surface-Karten; Step 2 mit Chat-Bubble. Direkt nach Hero, vor FeaturesGrid. Trägt `id="funktionen"` + `scroll-mt-24`, das Sprungziel der Navbar. | `building` |
| `product-showcase.tsx` | Interaktive Workspace-Vorschau: Chats / Projekte. Mini-Sidebar nutzt denselben Pillen-Umschalter (`NavSwitcher`, "Chat"/"Projekt") wie die echte Sidebar, kein gefälschter „app.promptprinter.dev/…"-URL-Balken mehr (2026-07-16). Einziges verbleibendes „Schau es dir an"-Proof-Element auf der Landing Page. Seit 2026-07-17 mit `organizing`-Finn im Header (Brand-Audit #1). | `organizing` |
| `features-grid.tsx` | 6 Karten, was ein Chat tatsächlich liefert. Lebte auf `/features`, seit 2026-07-30 wieder auf der Landing Page, dabei Mono-Eyebrow entfernt (alle anderen Sektionen hatten ihre längst verloren). | `organizing` |
| `pricing-bridge.tsx` | „Und was kostet das?" + Link auf `/pricing`. Der einzige Ort auf der Landing Page, der einen Preis nennt. | Kein Finn |
| `faq.tsx` | 6 Trust-Fragen, vollständig de-jargoned | Kein Finn |
| `final-cta.tsx` | Persönlicher Abschluss, "Den Rest mach ich mit dir." | `celebrating` |
| `footer.tsx` | Finn's Farewell: kleiner Finn + "Schön, dass du da warst., Finn" + 5 echte Links. Links hovern auf `accent-text` (DESIGN.mds Link-Regel), nicht mehr auf `foreground`. | `idle` |
| `navbar.tsx` | Fix/blur-on-scroll, 2 Nav-Links: „Funktionen" (`/#funktionen`, natives `<a>`) und „Preise" (`/pricing`, `next/link`). Hover + aktive Seite: Wasser-Pille hinter dem Label + einschwimmende Welle (`.nav-pill`/`.nav-wave` in globals.css), aktive Seite behält beides an + `aria-current`. Mobile-Drawer: getönte Zeile + einblendendes Chevron. | Kein Finn |

**`/pricing`** (`src/app/pricing/page.tsx`): `PageHeader` (nur Headline) →
`PricingGrid` → 3 Beruhigungs-Karten je mit Finn → `FAQ` → `Footer`. Der
begrüssende Finn samt Sprechblase und Subline über der Headline ist auf
Nutzerwunsch weg (2026-07-30), `FinnGreeting` hatte danach keinen Aufrufer
mehr und ist gelöscht; `page-header.tsx` behält nur Grid + Floaters. Die
Finns auf den Plan- und Beruhigungs-Karten sind ausdrücklich geblieben, das
ist weiterhin die Seite, auf der er überall sein soll.

> **Spannung, bewusst eingegangen (2026-07-30):** Die Brand-Prinzipien unten
> sagen „kein Feature-Grid". `FeaturesGrid` steht trotzdem wieder auf der
> Landing Page, weil der Nutzer die Funktionen-Seite ausdrücklich mit der
> Homepage zusammengelegt haben wollte und der Inhalt sonst ersatzlos
> verschwunden wäre. Das Prinzip stammt aus der Zeit, als das Grid dieselben
> vier Outputs wie `ExampleOutput` wiederholte (beide gibt es nicht mehr), es
> ist also nicht mehr dieselbe Sektion, gegen die das Prinzip formuliert
> wurde. Wenn die Landing Page nochmal überarbeitet wird: das ist die Stelle,
> an der Prinzip und Ist-Zustand auseinanderliegen.

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
- Mascot-State-System und alle 16 Assets
- Hero-Demo (Idea→Plan→Build→Launch)
- Footer (Finn's Farewell)
- Auth-Flow, DB-Migrationen, RLS-Policies
