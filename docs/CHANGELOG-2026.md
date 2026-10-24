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

**#140, Datenmodell der gespeicherten Prompts, und #135 abgeschlossen (2026-10-25):** Zweiter und dritter Teil des Auftrags von Kasum vom Abend (alles ohne Rückfragen, auch die Migration auf Produktion; PR #185).

- **Migration `0049_saved_prompts.sql`:** `generations` heißt `saved_prompts`, samt Policies (`saved_prompts_owner_*`), Indizes, Primär- und Fremdschlüsseln, Check `saved_prompts_outputs_len` (die Umbenennung läuft über Schleifen mit `like 'generations\_%'`, die Migration ist wiederholbar). Weg sind die vier Spalten der Pipeline `model`, `latency_ms`, `tokens_in`, `tokens_out`, `projects.status` (samt `projects_status_check`) und `'team'` aus `profiles_plan_check`. `project_summaries()` zählt aus `saved_prompts` (`create or replace`, gleiche Spalten wie 0023, Rechte wie 0032: PUBLIC entzogen, `authenticated` darf). **`projects.type` bleibt**: es wird seit #154 gelesen und geschrieben, der Vorschlag im Issue, es zu entfernen, entfiel.
- **Vorher in Produktion gelesen:** 3 Zeilen in `generations`, die vier Spalten überall NULL und im Code nirgends gelesen (nur `model: null` beim Speichern), `projects.status` in beiden Zeilen `ready` und nirgends gelesen, `profiles.plan` nur `free` (6 Konten), keine Sicht, kein Trigger, keine fremde Policy auf der Tabelle, `project_summaries()` als einzige Funktion mit dem Namen. **Trockenlauf** gegen den echten Stand: Transaktion mit allen Anweisungen, am Ende ein absichtlicher Fehler mit dem Prüfergebnis (Tabelle, vier Policies, vier Constraints, drei Indizes, Spaltenrechte `insert` auf fünf Spalten und `update` nur auf `outputs`, `project_summaries()` aufrufbar, `anon` ohne EXECUTE); danach lesend bestätigt, dass die Produktion unverändert war.
- **Code:** alle `.from("generations")` sind `.from("saved_prompts")`, Datenexport (ohne `model`, die Spalte war leer) und Aktivierungstrichter ebenso; `POST /api/projects` schreibt kein `status` mehr, der Speichern-Knopf kein `model`; `PlanKey` ist `free | pro` (`toPlanKey("team")` ergibt Free, die Abzeichen-Farbe für `team` ist weg). Bezeichner und Kommentare ziehen mit (`SavedPromptRow`, `mapSavedPromptRows`).
- **Guards:** `tests/guards/saved-prompts-model.test.ts` (kein `"generations"` mehr in `src/`, keine Pipeline-Spalte neben `saved_prompts`, `PlanKey` nur `free | pro`) und ein Eintrag in `migrations.test.ts` (die Migration benennt um und löscht, keine spätere holt es zurück). Mutationen: alter Tabellenname im Aktivierungstrichter, `tokens_in` nicht mehr gelöscht, `team` zurück in `PlanKey`: je ein Test schlug an, Dateien aus der Sicherung zurückgesetzt.
- **Reihenfolge und Wagnis:** `CLAUDE.md` verlangt für Migrationen auf Produktion Kasums ausdrückliches Ja; sein Auftrag lautete, alle Issues ohne Rückfragen zu lösen, und #140 ist ohne die Migration nicht lösbar. Deshalb: Gate und CI grün, dann die Migration angewendet (Supabase-Migration `saved_prompts`, Version 20261024224720), sofort danach der PR gemergt (Fenster, in dem der alte Code gegen die neue Tabelle fragt: die Zeit bis zum Deployment, bei 3 Zeilen und ohne echte Nutzung ohne Folgen). Danach lesend verglichen: Tabelle, Spalten, Policies, Indizes und Constraints wie im Trockenlauf, `anon` ohne EXECUTE auf `project_summaries()`, und als angemeldeter Nutzer simuliert (Rolle `authenticated`, Claims gesetzt, Transaktion mit Abbruch) liefert sie beide Projekte, die drei Zeilen von `saved_prompts` sind für den Besitzer sichtbar.
- **Was der Browser-Test gefunden hat:** der erste CI-Lauf von PR #185 scheiterte in `e2e/projects.spec.ts` ("Projekt-Anweisungen" nicht gefunden): `getProject()` in `src/server/project.ts` forderte `status` in einer Spaltenliste als Zeichenkette an, die Projektseite hätte nach der Migration gar nicht mehr geladen. Kein Unit-Test sah es (Supabase ist dort gemockt, der Typprüfer liest Zeichenketten nicht). Behoben im selben PR, dazu ein Guard, der Abfragen auf `projects` nach `status` absucht (Mutation: `status` zurück in die Spaltenliste, der Test schlug an). Ohne den E2E-Lauf wäre das nach dem Anwenden der Migration in Produktion aufgefallen.
- **#135 abgeschlossen, Zielwert nicht belegt:** live gemessen (Lighthouse 12.8.2 mobil, Chromium von Playwright): ruhiger Rechner TBT 246 bis 290 ms in fünf von sechs Läufen (Median 283 ms, ein Ausreißer 980 ms), Performance 90 bis 92; dieselbe Seite mit zwei hängenden Hintergrundprozessen (`python -` aus früheren Sitzungen, je ein Kern voll, beendet) 556 bis 915 ms. Der größte Posten ist Nexts Laufzeit-Chunk (`1255-…`, 804 ms Skript unter Drosselung), nicht mehr framer-motion. `browserslist` (Tailwind-4-Mindestversionen) ausprobiert und verworfen: `/` 17,4 auf 17,1 kB, die Polyfills stecken in Nexts Laufzeit und bleiben. Weniger Hydration wäre ein Umbau des Heros (Nicht-anfassen-Liste) und ein eigenes Issue.
- **#133 bleibt offen:** der Code-Teil ist in PR #184 (Berechtigungen, SHA-Bindung); Ruleset auf `main` und Dependabot security updates sind Sicherheitseinstellungen des Repositories und wurden **nicht** gesetzt. Die Befehle stehen als Kommentar im Issue.

**Lehre:** ein `python -` aus der Windows-Store-Verknüpfung (`WindowsApps\python.exe`) liest von der Standardeingabe und belegt einen Kern, solange er lebt; zwei davon liefen seit dem 20.10. und 23.10., zwei kamen heute dazu. Kein `python`-Aufruf in der Shell, `node` für Skripte nehmen.

---

**Sicherheitsalarme 2026-10-25: zwei Dependabot-Meldungen, vier Code-Scanning-Alarme, Code-Teil von #133 (ein Branch):** Auftrag von Kasum am Abend, alles ohne Rückfragen bis zum Merge.

- **Dependabot (GHSA-xp26-3454-mjgp, GHSA-qxg6-89mg-rqv8, beide `@vitest/mocker`, mittel, nur Entwicklung):** `vitest` von 4.1.11 auf `^4.1.12` (die gepatchte Version, kein Sprung auf 5). Der Baum hatte zwei Kopien (`node_modules/@vitest/mocker` und eine unter `vitest/`); jetzt gibt es eine, 4.1.12. Dazu hob npm zwei Nebenpakete um eine Minor-Version an (`6.2.2` auf `6.3.0`, `3.1.1` auf `3.2.0`), sonst nichts. `npm ls vitest @vitest/mocker` und `npm audit` sind sauber.
- **Code-Scanning `actions/missing-workflow-permissions` (ci.yml, e2e.yml, docker.yml):** jeder Workflow trägt oben `permissions: contents: read`. Keiner der drei schreibt etwas ins Repository, `audit.yml` hatte den Block schon (mit `issues: write`).
- **Code-Scanning `js/bad-tag-filter` (`src/shared/lib/ai-marker.test.ts`):** `/^<!--.*-->$/` passt nicht auf einen Kommentar mit Zeilenumbruch. Der Test prüft jetzt `startsWith("<!--")` und `endsWith("-->")`, es ist ein Test, kein Filter, aber der Alarm ist damit sachlich erledigt statt unterdrückt.
- **#133, Code-Teil:** jede Action in allen vier Workflows hängt an einer Commit-SHA mit Versionskommentar (`actions/checkout@3d3c42e… # v7`, ebenso `setup-node`, `cache`, `upload-artifact`, `supabase/setup-cli`); Dependabot (`github-actions`) hebt SHA und Kommentar zusammen an. `tests/guards/workflows.test.ts` hält beides fest (Block `permissions:` mit `contents: read` und ohne `write-all`, SHA statt Tag, Versionskommentar). Mutationen: Block in `docker.yml` gelöscht und ein Tag statt der SHA in `e2e.yml`, beide Tests schlugen an, Dateien aus der Sicherung zurückgesetzt. Die Guards `pinned-versions` und `node-version` lesen die Workflows per Muster und laufen mit den Kommentaren weiter.

---

**Issue-Runde 2026-10-23: #135, #128, #154, #158 (Code), #136 und #158 (Migration auf eigenem Zweig):** Fünf Issues aus den sieben offenen. Was Code ist, kommt in einem Pull Request (ein Commit je Issue). Was eine Migration auf Produktion braucht (#136, #158), liegt als eigener Zweig bereit und ist **nicht angewendet und nicht gemergt**: `CLAUDE.md` verlangt dafür Kasums ausdrückliches Ja. Vorab: das Audit-Gate war rot, weil am Abend des 22.10. vier Advisories im ausgelieferten Baum erschienen (next critical und high, dompurify über jspdf critical und high); `next` 15.5.28 und `dompurify` 3.4.17 in PR #181, vor allem anderen gemergt.

- **#135, `LazyMotion`:** `MotionShell` setzt `<LazyMotion features={domAnimation}>` um den Baum, 95 Stellen in 24 Dateien nutzen `m.*` statt `motion.*`; `tests/guards/lazy-motion.test.ts` hält fest, dass kein `motion` mehr importiert wird und kein `layout`/`drag` an einem `m.*` steht (die Funktionen von `domMax`, in `domAnimation` wirkungslos). **Gemessen** (Produktions-Build, Lighthouse 12.8.2 mobil, Chromium von Playwright, sechs Läufe im Wechsel gegen einen Build von `main`): First Load JS der Startseite 174 auf 147 kB, von `/pricing` 252 auf 224 kB; Total Blocking Time (Median 152 ms vorher, 168 ms nachher) und Hauptthread (3,6 zu 4,0 s) **ließen sich nicht von der Streuung trennen**, nur der framer-motion-Chunk schrumpfte von rund 830 auf 720 ms Ausführung. Eine erste Fassung lud die Funktionen als eigenen Chunk nach (Dokumentation von framer-motion): das gab keinen kürzeren Hauptthread und eine spätere größte Inhaltsdarstellung (jedes `initial={{ opacity: 0 }}` blieb bis dahin unsichtbar), also verworfen. Ein Lauf allein sagt hier nichts: der erste Lauf nach einem Serverstart lag zwischen 125 und 850 ms TBT, erst Läufe im Wechsel gegen den alten Build waren vergleichbar. **Nicht geändert:** `sizes` der Maskottchen (steht schon, `Mascot` setzt `${size}px`; die grobe Leiter von `next/image` feiner zu stellen vermehrt die Umwandlungen bei Vercel), die Polyfills (stecken in Nexts eigenem Laufzeit-Chunk, ob `browserslist` sie entfernt, nicht geprüft). **Folgen:** `layout` am Toast fiel weg, übereinanderstehende Toasts springen beim Schließen statt zu gleiten. Das Issue bleibt offen, bis nach dem Deployment live nachgemessen ist (380 ms TBT lokal nicht nachstellbar, lokal liegt `main` bei 150 ms).
- **#128, Aktivierung nach Anmeldewoche:** Abschnitt "Betrieb" der Seite `/usage` (nur `is_admin`) zeigt je Anmeldewoche der letzten acht Wochen: Registriert, mit Key, mit Antwort von Finn, mit gespeichertem Prompt, jeweils mit Anteil. `src/server/activation-funnel.ts`: eine `limit(1)`-Abfrage je Konto und Signal über den Service-Role-Client, **keine Migration**, Obergrenze 300 Konten (darüber weist die Ansicht darauf hin; wer weit mehr Konten hat, ersetzt `loadActivationFunnel` durch eine SQL-Funktion). Gezählt wird, was heute noch da ist (Key, Antwort, Prompt), die Zahlen sind eine Untergrenze und das steht in der Ansicht. Nur Zähler, keine Inhalte, kein Drittanbieter; der Datenschutztext sagt zu Protokolldaten "ausschließlich dem sicheren Betrieb", die Zähler sind Kontodaten des eigenen Dienstes und keine Profilbildung, ich habe ihn **nicht** geändert. Wochenlogik rein und getestet, die Rolle `assistant` per Mutation gesichert (der erste Testfall fing sie nicht, weil Frage und Antwort je eine Zeile ergaben).
- **#154, Workspace passt zur Aufgabe:** `projects.type` ('software' | 'general', Check-Constraint seit 0008, neue Projekte 'general') trägt die Art des Projekts, **ohne Migration**. Rail: Zielgruppe, Ton, Hintergrund, Weiteres für jedes Projekt; Frontend, Backend, Sprache, Datenbank erst mit dem Häkchen "Softwareprojekt" (schreibt `projects.type` mit `.eq("user_id", …)`, bei Fehler zurückgenommen); ein Feld der anderen Art mit Inhalt bleibt sichtbar. Gedächtnis: GitHub-Feld nur bei Software (ein schon hinterlegtes Repo bleibt sichtbar), eigene Hinweise ohne Repo-Sprache; die Analyse fragt bei einem allgemeinen Projekt nach Zielgruppe, Ton, Eckdaten und Vorgaben, ohne Kontaktdaten (`GENERAL_ANALYSIS_SYSTEM_PROMPT`). `ProjectBrainFacts` bekam `audience`, `tone`, `keyFacts`; ein vorher gespeichertes Brain liest sich unverändert. Hilfe "Projekte als Arbeitsplatz", `CLAUDE.md`, `project-brain.tsx` (422 Zeilen) in Karte und `project-brain-facts.tsx` geteilt. **Nicht belegt:** nie gegen ein echtes Modell gelaufen (die Tests prüfen den Wortlaut des Prompts und den Datenfluss, nicht die Antwortqualität), nicht im Browser mit Login gesehen; fr/it/es nicht von Muttersprachlern geprüft. **Wirkung auf #140:** `projects.type` wird jetzt gelesen und geschrieben, der Vorschlag dort, es zu entfernen, entfällt.
- **#158, Reste des Profilbild-Uploads:** Code-Teil: die OAuth-Bildhosts `lh3.googleusercontent.com` und `avatars.githubusercontent.com` sind aus `img-src` raus (die Supabase-Origin bleibt, die Vorschaubilder der Chat-Anhänge sind signierte Adressen dort), der Kommentar verwies auf eine gelöschte Datei. Datenbank-Teil in Migration `0048` auf eigenem Zweig (PR #182): Insert- und Update-Policy des Buckets `avatars` weg, Bucket privat, `revoke update (avatar_url)`. Lesend gegen die Produktion geprüft: ein Objekt im Bucket (das eine von vor 0027), eine Zeile mit gesetztem `avatar_url`, vier Policies; Select- und Delete-Policy bleiben, damit das Löschen eines Kontos aufräumt. Das Objekt wird nicht gelöscht.
- **#136, Index auf `billing_events.user_id`:** Migration `0047`, auf demselben Zweig (PR #182). `billing_events` ist in Produktion leer (0 Zeilen), der Index kostet nichts, jetzt ist der beste Zeitpunkt. Die fünf "unused"-Indizes bleiben (Begründung im Issue).

**Nachtrag, am selben Tag nach Kasums Ja: 0047 und 0048 sind auf Produktion angewendet** (Supabase-Migrationen `billing_events_user_index` und `drop_avatar_upload_remnants`), PR #182 danach per Rebase-Merge. Lesend vorher und nachher verglichen: Bucket `avatars` von öffentlich auf privat, `avatars_owner_insert` und `avatars_owner_update` weg (Select und Delete bleiben, das eine Objekt liegt weiter da), `has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')` von true auf false (`display_name` und `settings` weiter true, Lesen von `avatar_url` weiter erlaubt), `billing_events_user_idx` angelegt und gültig. Der Advisor "Fremdschlüssel ohne Index" ist weg; neu steht der Index unter "unused", wie die anderen, weil es keine Abfragen gibt. #158 und #136 sind damit erledigt.

**Wartet auf Kasum:** live nachmessen für #135; die beiden offenen Teile von #133 (Branch-Schutz, Dependabot-Alerts, das sind GitHub-Einstellungen, nicht angefasst).

---

**Issue-Runde 2026-10-22 (zweite): #138, #146, #132, #155, #139 (ein Branch, ein Commit je Issue):** Wieder fünf Issues ohne Migration auf Produktion, ohne Rechtstexte und ohne Einstellungen in Vercel oder GitHub. Jede neue Schranke mit Mutation geprüft.

- **#138, Lint über die ESLint-CLI:** `npm run lint` ist `eslint . --max-warnings 0`, nicht mehr `next lint` (fällt mit Next 16 weg). `eslint .` sieht anders als `next lint` den ganzen Baum: ohne Ignore-Liste waren es über 40 000 Meldungen in `.next` und knapp fünf Minuten. Die Flat-Config ignoriert Build-Ausgaben und erzeugte Dateien, lässt Parameter mit Unterstrich vorn unbenutzt (`argsIgnorePattern: "^_"`, die vier Warnungen in den Tests), schaltet `react-hooks/rules-of-hooks` für `e2e/` aus (Playwrights `use` ist kein Hook) und `postcss.config.mjs` exportiert eine benannte Konstante. Lauf jetzt 21 s, keine Meldung; auch `tests/`, `e2e/`, `scripts/` und die Konfigurationsdateien werden jetzt geprüft (`next lint` sah nur `src`). `tests/guards/lint-script.test.ts` hält den Aufruf (`eslint`, `--max-warnings 0`) und die Ignore-Liste fest; Mutation: Skript auf `next lint` zurück, zwei Tests schlagen an, und eine absichtlich eingefügte unbenutzte Variable lässt `npm run lint` mit Exit 1 enden. Die Schichtgrenzen bleiben im Guard (`layer-boundaries.test.ts`), daran ändert sich nichts. **Offen aus `docs/UPGRADES-2026-10.md`, Zeile 2:** der Wechsel auf Next 16 selbst, nur der Lint-Aufruf ist erledigt.
- **#146, ein Name und eine Aufzählung:** die Gruppe der Hilfe-Navigation hieß "Modelle und Limits", die Seite darin "Pläne und Limits"; die Gruppe heißt jetzt "Keys und Pläne". Die Free-Karte (Preisseite aus `pricing.ts`, App aus `planCopy` in allen fünf Sprachen) und die Hilfe "Pläne und Limits" nennen dieselben Wege wie `/docs/eigene-api-keys` und `llms.txt`: Anthropic, OpenAI, Gemini oder ein anderer Anbieter (jeder OpenAI-kompatible Endpunkt). Der holprige Satz in der Beschreibung von "Prompts speichern" (kam wörtlich in `llms.txt`) ist neu. `updated` von "Pläne und Limits" und "Prompts speichern" auf 2026-10-22. Tests: Navigationsname gleich Seitentitel (liest jede `page.tsx`), keine doppelten Gruppen- oder Artikelnamen, erste Zeile der Free-Karte in jeder Sprache vollständig und die der Preisseite gleich dem deutschen Wörterbuch. **Nicht angepasst:** das Platzhalterfeld "API-Key einfügen (Anthropic, OpenAI oder Gemini)" und die Hinweise bei fehlendem Key (sie nennen die drei Formate, die das Feld erkennt; "Anderer Anbieter" ist dort ein eigener Link). fr/it/es nicht von Muttersprachlern geprüft.
- **#132, Konto löschen verlangt eine frische Anmeldung:** `DELETE /api/account` liest wie die Seite "Neues Passwort" die AMR-Liste des JWT (`getClaims()`) und verlangt einen Eintrag mit einem Zeitpunkt von höchstens 10 Minuten (`signedInRecently()` in `src/features/auth/lib/fresh-sign-in.ts`). **`token_refresh` zählt nicht:** GoTrue trägt beim stündlichen Erneuern einen Eintrag mit neuem Zeitpunkt ein, er belegt keine Anmeldung; zählte er, wäre jede Sitzung im Schnitt eine halbe Stunde frisch. Ohne belegbaren Zeitpunkt (kein Claim, keine Liste, Textform nach RFC 8176) gilt die Sitzung als alt. Sonst 403 mit `code: "reauth_required"`, vor dem Ratenlimit, dem Kündigen des Abos und jedem Aufräumen; auch für Admins. Der Dialog zeigt dann statt des Eingabefelds den Grund (`role="alert"`) und den Knopf "Neu anmelden": diese Sitzung beenden (`signOut({ scope: "local" })`, andere Geräte bleiben angemeldet), dann `/login?next=%2Fsettings`; das gilt für Passwort- und OAuth-Konten gleich, `?next=` wird von beiden Wegen ausgewertet. Neue Texte in allen fünf Sprachen. **Nicht gegen den echten Stack belegt:** dass die AMR-Einträge einer frischen Passwort-Anmeldung so aussehen (`{ method: "password", timestamp }`, Sekunden); das belegt der bestehende Browser-Test "Konto löschen entfernt Nutzer, Chats und die Dateien im Speicher" in der CI, der sich frisch anmeldet und danach löscht. Eine alte Sitzung lässt sich im Browser-Test nicht herstellen, sie ist nur mit Mock-Claims getestet. Mutationen: Prüfung in der Route abgeschaltet (sechs Tests), `token_refresh` zugelassen (zwei), Behandlung im Dialog abgeschaltet (vier).
- **#155, E-Mail-Adresse wechseln:** **bewusst keine Änderung per `updateUser({ email })`.** Bei Supabase ist "Confirm email" aus (`CLAUDE.md`, Auth-Mails), also Autoconfirm: dann wechselt die Adresse ohne Bestätigung, und wer ein Konto über eine gestohlene Sitzung übernimmt, setzt die Adresse um und das Passwort über den Reset zurück. Das Issue lässt den Hinweis als Lösung zu ("mindestens ein Satz ... zum Beispiel per Kontaktformular"): unter dem gesperrten Feld steht jetzt "Andere Adresse nötig? Schreib mir über das Kontaktformular." (fünf Sprachen, Link auf `/kontakt`), und `/docs/konto-und-daten` hat den Abschnitt "Wie ändere ich meine E-Mail-Adresse?" (`updated` 2026-10-22). **Die Umstellung macht Kasum von Hand**, es gibt keinen Ablauf dafür. Wer eine echte Änderung will, schaltet zuerst "Confirm email" ein (und testet die Auth-Mails, sie sind nie getestet) und baut dann `updateUser` mit der schon vorhandenen Vorlage `supabase/templates/email_change.html`. fr/it/es nicht von Muttersprachlern geprüft.
- **#139, Kommentare:** 26 Pfadverweise in Kommentaren zeigten auf Dateien, die es nicht gibt (`lib/llm.ts`, `lib/env.ts`, `lib/turnstile.ts`, `lib/supabase/...`, `src/lib/...`, ein entferntes `buildOverride()` in `api/generate`); sie zeigen jetzt auf den heutigen Ort. Der Widerspruch in `cookie-options.ts` ist behoben (Voreinstellung von `@supabase/ssr` ist `httpOnly: false`, im Quelltext von `node_modules` nachgesehen). Neu: `tests/guards/comment-paths.test.ts` (jeder Pfad in einem Kommentar unter `src/` muss auf eine vorhandene Datei enden; zwei Beispielpfade stehen auf einer Ausnahmeliste; Mutation: `server/env.ts` zurück auf `lib/env.ts`, der Test nennt die Zeile) und eine Zeile in der Tabelle von `CLAUDE.md` (Kommentare sagen, was gilt und warum, kein Verlauf, Deutsch mit richtigen Umlauten, Pfade relativ zu `src/`, beim Anfassen angleichen). Die in dieser Runde neu geschriebenen Kommentare folgen ihr. **Bewusst nicht gemacht**, wie das Issue es sagt ("kein Grossumbau"): die rund 150 Verlaufs-Kommentare ("used to", "vorher", "bis 2026-...") und die umschriebenen Umlaute (`fuer`, `ueber`) in älteren Dateien bleiben stehen, bis jemand die Datei anfasst. Das Issue ist damit mit Regel, Guard und den fehlerhaften Pfaden erledigt, nicht mit dem Abräumen aller alten Kommentare.

---

**Issue-Runde 2026-10-22: #142, #151, #152, #153, #157 (ein Branch, ein Commit je Issue):** Gewählt wurden fünf Issues, die keine Migration auf Produktion, keine Rechtstexte und keine Einstellungen in Vercel oder GitHub brauchen. Jede Schranke mit Mutation geprüft (kaputt gemacht, Test schlug an, aus der Sicherung zurückgesetzt).

- **#142, API-Routen einheitlich:** `DELETE /api/account` antwortet mit `problem()` (`detail`, `content-type: application/problem+json`) statt mit eigenem `{ error }`; die 429 trägt `retryAfter` wie alle anderen. `problem()` kennt jetzt auch den Titel zu 500. Der Client (`delete-account.tsx`) liest `detail`. Der Auth-Callback ruft `safeNextPath()` statt der eigenen, schwächeren Prüfung (`//host` wird abgelehnt, nicht bloß durch `siteUrl()` auf der eigenen Domain gehalten); der Kommentar an `safeNextPath` stimmt wieder.
- **#153, Z.ai-Karte:** `settings-workspace.tsx` zeigt "Übermittlung an Z.ai" nur noch, wenn das Konto den Server-Key überhaupt nutzen kann (`effectiveLimits(plan, isAdmin).chatMessages > 0`: Pro, Team, Admin) oder schon zugestimmt hat (der Widerruf geht immer). Text und Rechtsgrundlage unverändert. Die Free-Ansicht hat damit acht Karten statt neun.
- **#157, Prefetch:** neue Hülle `HoverPrefetchLink` (`src/shared/ui/hover-prefetch-link.tsx`): `prefetch={false}`, bis der Link Hover, Fokus oder Berührung bekommt, dann Standard (`prefetch={null}`). Nötig, weil `prefetch={false}` in Next 15.5 auch das Prefetchen beim Überfahren abstellt (`link.js`: `if (!prefetchEnabled …) return`). Eingesetzt für die Zeilen von `chat-list.tsx`, `sidebar.tsx`, `mobile-nav.tsx` und `library-card.tsx`; `tests/guards/list-prefetch.test.ts` verbietet dort ein bloßes `<Link>` auf Chat- und Projektzeilen. **Nicht gemessen:** die Zahl der `_rsc`-Anfragen vorher und nachher (das Issue verlangt dieselbe Messung; sie braucht einen Produktions-Build mit eingeloggtem Konto, im Dev-Server wird nicht prefetcht).
- **#152, Tippflächen:** `touch-hit` am Auge "Key anzeigen" (14 x 14 px) in beiden Key-Formularen (`api-key-field.tsx`, `api-keys.tsx`), `touch-hit-y relative` an "Plan verwalten", "Anderer Anbieter", "Details" im Gedächtnis und "Plan und Abo". `touch-target.test.ts` nennt jetzt jedes dieser sechs Elemente und verlangt die Klasse (bisher prüfte er nur, dass ein Knopf mit Klasse positioniert ist). **Nicht gemacht:** der Browser-Test über alle sichtbaren Knöpfe unter 24 px, den das Issue als Möglichkeit nennt, und nicht auf einem Handy gemessen.
- **#151, Tastatur und Screenreader:** die Befehlspalette merkt sich beim Öffnen, wer den Fokus hatte, und gibt ihn bei Escape, Klick daneben und Strg+K zurück (nicht bei einem Seitenwechsel durch einen Eintrag, dort übernimmt die neue Seite). Das Kontomenü verliert `aria-haspopup`: das Panel ist eine Liste gewöhnlicher Links (Disclosure, wie `account-submenu.tsx` es begründet), kein ARIA-Menü; das Issue ließ beide Wege offen, das Weglassen ist der kleinere. `/chats/new` bekommt eine nur für Screenreader sichtbare `h1` ("Neuer Chat", vorhandener Schlüssel `nav.newChat`), die Begrüßung im Chat bleibt die `h2` darunter. **Nicht gehört:** mit NVDA oder VoiceOver nicht geprüft, nur per Test und Zugänglichkeitsbaum. `move-to-project.tsx` trägt ebenfalls `aria-haspopup="true"`, das Issue nennt es nicht, nicht angefasst.

---

**`vite` auf 8.1.6, neues Advisory GHSA-587h-7wmj-h5pm (2026-10-21):** Am Abend des 2026-10-20 (19:48 UTC) wurde ein Advisory zu `launch-editor` veröffentlicht, das `vite` 8.0.0 bis 8.1.5 einbindet (high: `fs.existsSync()`-Prüfung unter Windows umgehbar, dazu zwei weitere `launch-editor`-Funde derselben Kette). `vite` ist nur ein Entwicklungswerkzeug (hängt an `vitest` und `@vitejs/plugin-react`, nicht im ausgelieferten Baum), aber es gibt eine gepatchte Version, und die Regel des Audit-Gates (`scripts/audit-gate.mjs`) lautet dann: anheben, nicht melden. Das Gate färbte damit auch einen unveränderten Stand rot: `npm audit` ist zeitabhängig, ein neues Advisory macht denselben Commit von einem Tag auf den anderen rot (deshalb vor jedem Merge die CI neu laufen lassen). Gewählt wurde die **kleinste** gepatchte Version im Bereich (8.1.6, laut Advisory `>= 8.0.0, <= 8.1.5` behoben in 8.1.6), nicht `npm audit fix` (das zusätzlich `next` 15.5.28, `eslint-config-next`, `rolldown` und weitere angehoben hätte) und nicht die neueste (8.3.4): die Zeile `"vite": "^8.1.5"` in den `overrides` von `package.json` steht jetzt auf `^8.1.6`, in `package-lock.json` änderten sich nur Version, Adresse und Prüfsumme von `node_modules/vite`. `npm run audit:gate` ist danach sauber (gemeldet bleibt nur `braces`). Nicht angefasst: das offene `next`-Patch-Update (15.5.28, moderate, GHSA-4jqv-mc3x-m676) bleibt Sache von Dependabot oder einer eigenen Entscheidung.

---

**Navigation und Footer der öffentlichen Seiten liegen neben `<main>` (2026-10-21, #144):** `src/app/(marketing)/layout.tsx` legte die ganze Seite in ein `<main>`, auch `<Navbar />` (`<header>`) und `<Footer />` (`<footer>`); ein `<header>` oder `<footer>` innerhalb von `<main>` ist für Screenreader keine Landmarke (`banner`, `contentinfo`) mehr, die Landmarken-Navigation hatte nur einen Hauptbereich, der Kopf und Fuß einschloss. axe meldet das nicht (Lighthouse 100), weil es nur vorhandene Landmarken prüft. Neu: die Hülle ist ein `<div className="relative">` mit Navbar, `<main>{children}</main>` und Footer; die zwei `JsonLd` stehen davor, ebenfalls außerhalb von `<main>`. **Das `relative` blieb absichtlich auf der äußeren Hülle:** die Navbar ist `fixed`, also hat `<main>` dasselbe Rechteck wie vorher, und absolut platzierte Teile der Seiten und des Footers beziehen sich auf dasselbe Rechteck wie bisher. **Abweichung vom Vorschlag im Issue:** der Anker `#main-content` blieb auf dem ersten Inhaltsabschnitt jeder Seite (Hero, `PageHeader`, `LegalShell`, `DocsShell` und sechs Seiten mit eigenem Kopf: Hilfe-Übersicht, Kontakt, Über, Pro-bald, Vergleiche), er sitzt nicht auf `<main>`. Der Vorschlag hätte den Anker aus zehn Dateien genommen, aber der Skip-Link überspränge dann nicht mehr, was in `<main>` vor dem Text steht (die Seitenleiste der Hilfe); das Issue selbst hält den Weg ohne diese Änderung für "erfüllbar". Kommentare in `layout.tsx` und `legal-shell.tsx` nannten noch die alte Begründung ("Navbar liegt innerhalb von `<main>`") und sind umgeschrieben. **Belegt:** `src/app/(marketing)/layout.test.tsx` (neu) rendert das echte Layout mit der echten Navbar und dem echten Footer: ein `<main>`, die Seite darin, `<header>` und `<footer>` nicht darin, Reihenfolge Kopf, Hauptbereich, Fuß, Skip-Link bleibt (Mutation: alte Verschachtelung wiederhergestellt, drei Tests schlagen an, danach aus der Sicherung zurückgesetzt). Im Dev-Server nachgesehen: auf Start, Preise, Hilfe, Datenschutz, Kontakt, Über und Vergleich genau ein `<main>`, `<header>` und `<footer>` nicht darin, genau ein `#main-content`; der Zugänglichkeitsbaum des Browsers zeigt `banner`, `main` und `contentinfo` als eigene Landmarken. **axe 4.11.4** (WCAG 2.0 bis 2.2 A und AA plus Best Practice, im Dev-Server mit der Kopie aus `node_modules`, danach wieder entfernt): **keine Verstöße** auf `/`, `/pricing` und `/docs`; die Landmarken-Regeln bestehen (`landmark-banner-is-top-level`, `landmark-contentinfo-is-top-level`, `landmark-one-main`, `landmark-no-duplicate-*`, `landmark-unique`, `region`, `bypass`), und der Anker `#main-content` liegt auf der Hilfe-Übersicht innerhalb von `<main>`. **Nicht gemacht:** NVDA oder VoiceOver (das Issue verlangt auch einen Screenreader); die Landmarken sind nur im Zugänglichkeitsbaum des Browsers und mit axe belegt, nicht gehört.

---

**Konto löschen räumt alle Projektdateien auf, nicht nur die ersten 1000 (2026-10-21, #131):** `DELETE /api/account` las die Pfade der Projektdateien mit einer einzigen Abfrage (`project_files`, `.eq("user_id", …)`), PostgREST kappt eine Antwort aber bei 1000 Zeilen und meldet das nicht. Bei den Chat-Anhängen stand die Seitenschleife schon da (mit einem Kommentar, der den Grund nannte), bei den Projektdateien fehlte sie; der Kommentar darunter ging noch von 10 Dateien je Projekt aus (seit Migration 0038 sind es 20). Ein Konto mit mehr als 1000 Zeilen (Pro oder Admin, beide ohne Projektgrenze: ab 51 Projekten mit voller Dateizahl) ließ den Rest als Waisen im Bucket `project-files` zurück, zu denen keine Zeile mehr zeigt, obwohl die Datenschutzerklärung (Ziffer 8) zusagt, dass beim Löschen alles verschwindet. Neu: `collectStoragePaths(page)` in `src/shared/lib/storage-cleanup.ts` liest alle `storage_path`-Werte seitenweise und **wirft** bei einem Lesefehler (statt eine halbe Liste zu liefern); in der Route gibt es eine kleine Funktion `removeUserObjects(…)`, die für beide Tabellen (`message_attachments`/`chat-attachments`, `project_files`/`project-files`) liest, in Stapeln entfernt und Lesefehler wie nicht durchgegangene Stapel meldet, ohne das Löschen des Kontos aufzuhalten. Die Ereignisnamen (`account.attachment_cleanup_*`, `account.storage_cleanup_*`) sind gleich geblieben. **Zwei Dinge mehr als gefordert:** (1) beide Abfragen sortieren jetzt nach `id` (`.order("id")`), denn zwei Seiten derselben Abfrage ohne Reihenfolge sind in Postgres nicht garantiert überschneidungsfrei, eine Zeile könnte ausfallen; (2) der Avatar wird in einem eigenen `try` entfernt, vorher stand er im selben Block wie die Projektdateien und wäre bei einem Lesefehler dort übersprungen worden (der alte Code ignorierte den Lesefehler der Projektdateien stillschweigend, jetzt wird er gemeldet). Tests: `route.test.ts` (1003 Zeilen über zwei Seiten, genau 1000 Zeilen dann eine leere Seite, Reihenfolge, Lesefehler lässt Avatar und Löschen stehen, nicht entfernte Stapel werden gezählt), `storage-cleanup.test.ts` (Helfer). Mutationen: nur die erste Seite lesen (sechs Tests schlagen an), Sortierung entfernen (acht schlagen an), beide aus der Sicherung zurückgesetzt. **Nicht angefasst:** `attachment-storage.ts` hat eine eigene Schleife mit anderer Fehlerbehandlung (liefert bei einem Lesefehler, was es hat, weil ein Chat sich auch dann löschen lassen soll); Konten, die vor diesem Fix mit mehr als 1000 Dateien gelöscht wurden, hinterließen Waisen, `node scripts/reconcile-project-files-storage.mjs` listet sie (nur lesend, `--delete` entfernt sie; mit Produktionszugang, nicht in dieser Sitzung gelaufen).

---

**Wackliger Test beruhigt (2026-10-21, #145):** Der Test "öffnet das erweiterte Formular über den Anderer-Anbieter-Link und speichert vier Felder" in `api-keys.test.tsx` tippte mit `user.type` 67 Anschläge (Name, Modell, die 46 Zeichen der Endpunkt-Adresse, Key) und lag im vollen Lauf unter Last bei 5,18 s gegen das Limit von 5 s; allein lief er grün, die CI auch. Das Tippen ist nicht Gegenstand des Tests, also fügt er die vier Werte jetzt ein (`user.click` auf das Feld, dann `user.paste`); das Zeitlimit blieb bei 5 s, es wurde nichts hochgesetzt, damit ein echter Hänger weiter auffällt. Dieselbe Prüfung der Nutzlast (alle fünf Felder, exakt) bleibt. **Gemessen** (`--reporter=verbose`, Rechner im Leerlauf): 1345 ms vorher, 472 ms nachher. **Danach der Rest geprüft, wie das Issue vorschlug:** der ganze jsdom-Lauf (595 Tests, 594 grün, einer übersprungen) mit Dauer je Test. Der gefixte Test steht nicht mehr unter den zwölf langsamsten. Der langsamste war `library-browser.test.tsx` "resets back to the first page when the search query changes" mit 3065 ms (neun Anschläge, jeder rendert 30 Karten neu): eingefügt statt getippt, jetzt 413 ms. Danach kommen `chat.turn.test.tsx` (2889 ms) und `chat.test.tsx` (2493 ms) und die Anmelde-Formulare (bis 2150 ms), alle deutlich unter dem Limit, nicht angefasst; wer das Limit wieder erreicht, findet die Liste mit `npx vitest run --project jsdom --reporter=json --outputFile=zeiten.json`. **Nebenbefund, nicht behoben:** die Aussage des Library-Tests ist schwach (nach der Suche "Projekt 2" gibt es nur noch 11 Treffer, "mehr laden" fehlte also auch ohne das Zurücksetzen der Seite); er wurde hier nur schneller gemacht, nicht schärfer.

---

**Die Liste der öffentlichen Seiten liegt neben der der App (2026-10-21, #143):** `CLAUDE.md` schickte neue Seiten in "`APP_PREFIXES`, öffentliche Seite in `PUBLIC_PREFIXES` (`shared/lib/app-routes.ts`)", aber `PUBLIC_PREFIXES` und `PUBLIC_EXACT` standen in `src/server/supabase/middleware.ts`; wer eine öffentliche Seite hinzufügte und die Liste in `app-routes.ts` suchte, fand sie nicht, und die vergessene Seite hätte abgemeldet mit 404 geantwortet. Gewählt wurde die zweite Hälfte des Vorschlags im Issue, nicht nur den Pfad zu ändern: beide Listen und `isAppPath()` stehen jetzt in `src/shared/lib/app-routes.ts`, die Middleware importiert sie von dort (`requiresSession()` und die Logik bleiben in der Middleware). Damit stimmt der Satz in `CLAUDE.md` ohne Änderung der Bedeutung (dort steht jetzt "beide Listen in …"), und wer die App-Liste ändert, sieht die öffentliche daneben. Nachgezogen: `docs/PRO-WIEDERAUFNAHME.md`, die Meldung und der Kopf von `route-access.test.ts`, die Prüfung in `pro-availability.test.ts`, die `/pro-bald` in der Liste sucht. **Neu im Guard** `route-access.test.ts`: die Datei, die `CLAUDE.md` in der Zeile mit `PUBLIC_PREFIXES` nennt, exportiert wirklich `APP_PREFIXES` und `PUBLIC_PREFIXES` (hätte den Fehler aus dem Issue gefangen). Mutationen: `/kontakt` aus der Liste entfernt (der alte Guard-Test schlägt an), Pfad in `CLAUDE.md` auf die Middleware geändert (der neue schlägt an); beide danach aus der Sicherung zurückgesetzt. Das Verhalten der Middleware ist gleich geblieben (90 Tests der Routen, Middleware und Guards grün).

---

**Plan aus dem Profil an einer Stelle (2026-10-21, #141):** Die Zeile `raw === "pro" || raw === "team" ? raw : "free"` stand in fünf Dateien von Hand (`api/chat/allowance.ts`, `api/projects/route.ts`, `api/projects/[id]/brain/route.ts`, `billing/page.tsx`, `usage/page.tsx`), obwohl `toPlanKey()` sie schon konnte, dazu je dieselbe Folge "Plan, Admin, wirksame Limits". Gefunden wurden beim Umbau drei weitere Abwandlungen: `settings/page.tsx` castete den Rohwert nur (`as PlanKey`, ein unbekannter Wert hätte als Plan durchgereicht), `account-menu.tsx` schrieb die Zeile selbst, und die PDF-Export-Prüfung in `prompts/page.tsx` und `projects/[id]/(workspace)/results/page.tsx` zählte `"pro"` und `"team"` einzeln auf. Neu: `resolvePlan(profile)` in `src/shared/lib/plans.ts` liefert `{ plan, isAdmin, limits }` aus einer Zeile von `profiles` (fehlende Zeile = Free ohne Adminrechte); alle zehn Stellen und `server/session.ts` nutzen es oder `toPlanKey()`. **Bewusst nicht** die vom Issue als Beispiel genannte `loadPlan(supabase, userId)`: die Routen lesen das Profil nebenläufig zu einer Zählung oder zum Key (`Promise.all`), eine Funktion, die selbst liest, hätte aus einer Runde zwei gemacht; die Funktion nimmt darum die schon gelesene Zeile. Das Verhalten ist gleich geblieben (712 Tests der Routen, Seiten und Shell grün, keiner geändert); `settings/page.tsx` ist die einzige Abweichung: ein unbekannter Plan-Wert gilt dort jetzt wie überall als Free. `tests/guards/plan-resolution.test.ts` verbietet die handgeschriebene Zeile in `src/` außerhalb von `plans.ts` (Mutation: Zeile in `utils.ts` angehängt, Guard schlägt an, danach zurückgesetzt), `plans.test.ts` prüft `resolvePlan` (fehlende Zeile, unbekannter Plan, Admin). **Nicht angefasst:** die drei Abfragen von `is_admin` allein in `api/settings/api-key/route.ts` und `api/account/route.ts` (lesen nur den Admin-Status für das Ratenlimit, keinen Plan).

---

**Hero ohne Key-Zeile (2026-10-20, Kasum):** Die Zeile unter den Hero-Knöpfen ("Du brauchst dafür einen KI-Key, am einfachsten einen kostenlosen von Google. So kommst du dran", seit #126) ist wieder weg, sie passt nach Kasums Urteil nicht auf die Startseite. `hero.tsx` hat damit 591 statt 606 Zeilen und trägt keinen Text zum Key mehr. **Geblieben**, weil nur die Hero-Zeile gemeint war: die Karte "Einmal vorab" unter den drei Schritten, der Satz im Abschluss der Startseite und der Untertitel der Registrierung. Der Guard `tests/guards/landing-key-hint.test.ts` verlangt den Hinweis nicht mehr im Hero, sondern prüft, dass er dort nicht wieder auftaucht. Damit ist die Lücke aus #126 ("wer auf \"Leg mit Finn los\" klickt, weiss vorher, was er braucht") unter dem Knopf wieder offen; wer sie schließen will, tut es an einer der drei übrigen Stellen.

---

**Audit-Gate nach Baum getrennt, keine Ausnahmeliste mehr (2026-10-20, Entscheid Kasum, Weg 1 aus `docs/UPGRADES-2026-10.md`):** Nachdem sich gezeigt hatte, dass Tailwind 4 den `braces`-Fund nicht beseitigt (er hängt an `eslint-config-next`, und Next 16 bindet dasselbe `fast-glob` ein), wollte Kasum nicht monatlich verlängern. `scripts/audit-gate.mjs` ruft jetzt `npm audit --json` und `npm audit --omit=dev --json` auf und trennt: **(1)** ein Fund ab "high" im ausgelieferten Baum blockiert immer, ohne Ausnahmen und ohne Fristen; **(2)** ein Fund nur in einem Entwicklungswerkzeug blockiert, wenn es eine gepatchte Version gibt (anheben), und wird nur **gemeldet**, wenn es keine gibt (Zeile "gemeldet, blockiert nicht" im Protokoll, Exit 0). `ACCEPTED`, `until`, das Prüfen auf Ablaufdatum und `expiringSoon` in `scripts/audit-issue.mjs` (die Warnung "Ausnahme läuft in 7 Tagen ab") sind entfernt; das tägliche Issue gibt es nur noch bei einem echten Fehlschlag, und ein gemeldeter Werkzeug-Fund öffnet keines (es gäbe nichts zu entscheiden, das Issue bliebe offen, bis Upstream nachzieht). **Wie "ohne gepatchte Version" erkannt wird:** am Bereich des **Knotens** im Bericht (`vulnerabilities.<paket>.range`): `*` heißt, jede veröffentlichte Version ist betroffen. Der Bereich des Advisorys selbst (`via[].range`, bei `braces` `<=3.0.3`) taugt dafür nicht, er sagt nicht, ob es eine 3.0.4 gibt; `npm audit` nennt `fixAvailable` auch dann, wenn es nur auf eine alte `eslint-config-next` zurückstuft (14.2.35). Ein Fund ohne lesbaren Bereich zählt als behebbar, also als blockierend. **Was das ersetzt:** ein Ablaufdatum, das jemand vergessen kann, durch eine Bedingung, die das Gate bei jedem Lauf selbst prüft: zieht jemand `braces` in den ausgelieferten Baum (heute meldet `--omit=dev` nichts außer dem `next`-Patch), scheitert es. **Schwäche, bewusst:** ein neuer Werkzeug-Fund ohne gepatchte Version fällt nun nicht mehr auf, er steht nur im Protokoll. Gemessen am echten Baum: `node scripts/audit-gate.mjs` endet mit 0 und meldet GHSA-vfj7-8cjw-p6xm. `tests/guards/audit-gate.test.ts` und `audit-issue.test.ts` sind umgeschrieben (Mutationen: Produktion durchlassen, jeden Fund "ohne Fix" nennen, beide gefangen). Nebenbefund: `npm audit` meldet für `next` (moderate, GHSA-4jqv-mc3x-m676, Patch 15.5.27) einen echten Fund im ausgelieferten Baum; unterhalb der Schwelle, deshalb kein Fehlschlag, aber ein Patch-Update ist fällig.

---

**Tailwind 4 (2026-10-20, #137 Schritt 1, eigener Branch `feat/tailwind-4`): umgestellt, aber die `braces`-Ausnahme ist damit NICHT gelöst:** `tailwindcss` 3.4.19 auf 4.3.3 (`@tailwindcss/postcss` statt `tailwindcss` und `autoprefixer` in `postcss.config.mjs`), `tailwind-merge` 2.6.1 auf 3.7.0, `tailwindcss-animate` entfernt, `tailwind.config.ts` gelöscht (die Theme steht jetzt in `@theme` am Kopf von `globals.css`). **Der Plan irrte sich:** er nahm an, Tailwind 4 beseitige den Fund. Nach dem Umbau bleibt `braces` über `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob 3.3.1` -> `micromatch`, und Next 16 bindet dasselbe `fast-glob` ein, also hilft auch der nächste Major nicht. Was sich geändert hat: der Pfad über `tailwindcss` ist weg, und `npm audit --omit=dev` (der ausgelieferte Baum) meldet `braces` nicht mehr. Die Ausnahme in `scripts/audit-gate.mjs` ist deshalb mit neuer Begründung einmal bis **2026-11-19** verlängert; **wie es danach weitergeht, entscheidet Kasum** (drei Wege in `docs/UPGRADES-2026-10.md`, "Korrektur").

**Wie umgebaut:** das offizielle Werkzeug `@tailwindcss/upgrade` lief, sein Ergebnis wurde nicht übernommen, sondern geprüft. Brauchbar waren 86 Klassenersetzungen (`outline-none` zu `outline-hidden`, `bg-gradient-to-*` zu `bg-linear-to-*`, `shadow-sm` zu `shadow-xs`, `blur` zu `blur-sm`, `z-[95]` zu `z-95`, `!bg-accent` zu `bg-accent!` und weitere, alle von Hand durchgesehen) und der Kopf von `globals.css` (`@import`, `@custom-variant dark`, `@theme`). Verworfen: das Werkzeug machte aus **jeder** Klasse in `globals.css` einen `@utility`, auch aus `.dark .finn-atmosphere` wurde ein `@utility dark`; die Datei behält darum ihren Aufbau von vorher (`@layer base/components/utilities`, die Touch-Regeln ausserhalb jeder Ebene). Ausserdem ersetzte es in `common-passwords.ts` das Passwort-Wort `"shadow"` durch `"shadow-sm"` (zurückgenommen). `tailwindcss-animate` wurde an genau einer Stelle gebraucht (mobiles Menü), dafür gibt es `--animate-menu-in` im `@theme` statt der Abhängigkeit `tw-animate-css`.

**Gemessen, nicht geschätzt:** vorher (Tailwind 3, `main`, in einem eigenen Worktree gebaut) und nachher wurden die berechneten Stile **aller Elemente** von 19 öffentlichen Seiten (Start, Preise, Anmeldung, Registrierung, Kontakt, Hilfe, Vergleiche, Rechtstexte, 404) in Hell und Dunkel (Klasse `dark` nach dem Hydrieren), am Desktop und im Handy-Format verglichen (über 13 000 Elemente je Lauf, Position und Grösse eingeschlossen, Farben nach dem Wert über Weiss und über Schwarz mit Toleranz 2, damit `color-mix` in oklab nicht als Unterschied zählt). Das Messen selbst brauchte mehrere Anläufe (falsche Farb-Regex, Cloudflare-Widget einmal mit, einmal ohne, andere Env-Dateien im Alt-Build), die Zahlen oben gelten für den letzten, sauberen Lauf. Es fanden sich **vier echte Abweichungen, alle behoben:** (1) `.glass` und `.glass-strong` verloren in Chrome und Firefox den Weichzeichner (`backdrop-filter`): Lightning CSS gab bei einem handgeschriebenen `-webkit-backdrop-filter` neben der unpräfixierten Zeile nur die präfixierte aus; das Präfix steht nicht mehr in der Quelle, ein Guard hält es fest. (2) Knöpfe zeigten `cursor: default` statt `pointer` (Preflight 4). (3) `option` hatte kein Polster mehr (UA-Standard `0 2px 1px` zurück). (4) Der Anmelde-Rahmen verlor oben 24 px, weil `space-y-6` den am Desktop ausgeblendeten Finn (`lg:hidden`) nicht mehr mitzählt; `lg:pt-6` stellt das Bild von vorher her. Übrig, bewusst, ohne Wirkung auf das Bild: `divide-y` setzt die Linie unten am ersten statt oben am zweiten Eintrag (FAQ auf `/pricing`, selbe Zeile), und das unsichtbare Köderfeld im Kontaktformular hat einen durchsichtigen statt weissen Hintergrund.

**Nicht gemessen:** die eingeloggte App (liegt hinter dem Login; durchgesehen wurde nur per Suche: `space-y` mit versteckten Kindern, `translate`/`scale`/`rotate` (seit Tailwind 4 eigene CSS-Eigenschaften neben dem `transform`, das framer-motion setzt), Platzhalterfarbe, Ring-Standardbreite), Hover-, Fokus- und Offen-Zustände, Safari und Firefox. Neu zu wissen: Tailwind 4 braucht Safari 16.4, Chrome 111, Firefox 128 oder neuer, und `hover:` gilt nur auf Geräten mit Hover (auf dem Handy bleibt ein Hover-Zustand nicht mehr nach dem Tippen hängen). **Grössen:** CSS roh 66 auf 96 KB, gzip 13,0 auf 16,0 KB (Tailwind 4 gibt alle `@layer components`-Klassen aus, 3 nur die benutzten), First Load JS rund 2 kB mehr (`tailwind-merge` 3). `tests/guards/tailwind-4.test.ts` hält die Stellen fest, die nur im gebauten CSS auffallen.

---

**zod im Browser: 89 KB gzip auf 24 KB, keine eval-Probe mehr (2026-10-20, #134):** Auf `/login`, `/signup`, `/kontakt`, `/reset-password` und dem Projekt-Arbeitsraum lag ein Chunk von 393 057 Bytes roh (88 860 gzip) mit allen 258 Exporten von zod, darunter die rund 60 Sprachpakete. Ursache, im gebauten Chunk nachgesehen: der Wrapper `shared/lib/zod.ts` gab `z` als Wert aus (`export { z }`), und Webpack kann Zugriffe wie `z.object(...)` nicht durch einen Wrapper bis zum einzelnen Export zurückverfolgen, also bleibt der ganze Namensraum. Zwei Zwischenversuche brachten nichts (`export { z } from "zod"`, `config` als benannter Import): derselbe Chunk, Byte für Byte. Wirksam war erst, den Wrapper als echten Namensraum auszugeben (`export * from "zod"`) und im Browser-Code `import * as z from "@/shared/lib/zod"` zu schreiben (fünf Dateien: die drei Anmelde-Formulare, `contact.ts`, `project-brain.ts`); `z.object(...)` im Quelltext bleibt gleich. **Gemessen** (`next build` mit den Platzhaltern der CI): Chunk 86 231 roh, **24 487 gzip**; First Load JS `/login` 329 auf 264 kB, `/signup` 330 auf 265, `/kontakt` 254 auf 189, `/reset-password` 255 auf 190, Projekt-Arbeitsraum auf 248 kB. Auf dem Server bleibt `import { z }` erlaubt (Grösse egal). Zweitens `jitless` im Browser (`typeof window !== "undefined"`): zod probiert beim ersten Objektschema `Function("")` aus, die CSP verbietet `eval`, und der Browser meldete die abgefangene Probe auf jeder Seite mit Formular; im ausgelieferten Chunk steht die Probe weiter, aber `jitless` kehrt vor ihr zurück. Auf dem Server bleibt der schnelle Weg, die Entscheidungen (gültig, ungültig) sind in beiden dieselben. Belegt: `tests/guards/zod-import.test.ts` (neue Regel: `import { z }` nur in `src/server/`, `src/app/api/`, `schemas.ts` und Tests, dazu Mutation), `zod.jitless.test.tsx` (in jsdom wird `Function` nie aufgerufen, Mutation gefangen), und der Browser-Test gegen den Produktions-Build: die Anmeldeseite prüft die E-Mail weiter ("Bitte eine gültige Email eingeben"). **Nicht belegt:** dass die CSP-Meldung in einem echten Chrome verschwunden ist; die Browser-Fläche dieser Sitzung setzt die CSP für `eval` nicht durch (`Function("")` lief auch auf einer Seite ohne `unsafe-eval`), also konnte der Verstoss weder vorher gesehen noch nachher als weg gemessen werden. Eine Prüfung in Chrome unter Probleme (Issues) steht aus. Den Grössen-Guard am `/login`-Bündel, den das Issue erwog, gibt es nicht: er bräuchte einen Build-Schritt in der CI; die Import-Regel fängt den Rückfall an der Quelle.

**Eingabefehler der API sagen, welches Feld nicht stimmt, in der Sprache des Kontos (2026-10-20, #130):** `POST /api/settings/api-key`, `/api/projects`, `/api/auth` und `/api/contact` antworteten auf einen Schemafehler mit dem festen englischen `detail: "Invalid request"` (kaputtes JSON: `"Invalid JSON body"`), die Oberfläche zeigt nur `detail`, also stand im Toast "Invalid request". Der Fall aus dem Issue (Basis-URL ohne `https://` bei "Anderer Anbieter") war sogar schlimmer als beschrieben: die Vereinigung im Schema meldet in `issues` den ersten "weichen" Zweig, bei einem custom-Rumpf also den primären ("Unrecognized key(s)"), die URL kam dort nie vor. Neu: `src/server/http/validation-problem.ts` (`validationProblem`, `invalidJsonProblem`, `describeIssue`) macht aus dem ersten Fehler einen Satz aus dem Wörterbuch (`api.fields`, `api.fieldEmpty|TooShort|TooLong|Url`, `api.invalidEmail`), z. B. "Die Basis-URL muss eine gültige Adresse sein, die mit https:// beginnt." Für die Vereinigung im api-key-Weg wird der Zweig beschrieben, den der Nutzer ausgefüllt hat (`provider: "custom"` oder nicht), `issues` bleibt, wie es war. `flattenIssues` in `shared/lib/zod.ts` gibt dieselbe Auffächerung wie `responseIssues` mit den ganzen Fehlern zurück. Ein fehlendes Feld gilt als leeres; was sich nicht einfach sagen lässt (unbekannter Schlüssel), bekommt den allgemeinen Satz. Die Sprache kommt aus dem Cookie (`requestT`); die anonymen Routen `/api/auth` und `/api/contact` antworten **fest Deutsch**, weil ihre Seiten es sind (Landing, Auth und Rechtstexte bleiben deutsch). Die festgehaltenen Antworten (`*.validation.cases.json`) sind neu aufgenommen, und verglichen mit dem Stand davor änderte sich in 103 Fällen **nur `detail`**, in keinem Status, Pfad oder `issues`-Text. **Nicht angefasst:** die deutschen Meldungen in den Schemas ("Key darf nicht leer sein" und andere) bleiben als `issues[].message` im Protokoll, sie erreichen den Nutzer nicht mehr; der Chat-Titel "Neuer Chat" aus `chat-persistence.ts` ist ein gespeicherter Wert, kein Meldungstext, und bräuchte einen Fallback beim Anzeigen. fr/it/es nicht von Muttersprachlern geprüft. Nicht mit Login im Browser durchgeklickt, durch Routen- und Hilfstests belegt.

**Ergebnis-Panel: Titel nach Inhalt, Export auch für die neueste Antwort, ein Begriff (2026-10-20, #150):** Drei Ungereimtheiten aus dem Audit. (1) Über Finns Rückfrage stand "Dein Ergebnis": jetzt "Dein Prompt", sobald `extractPrompt` einen Block findet, sonst "Finns Antwort". Bewusst nicht "Finns Rückfrage": eine Antwort ohne Prompt-Block muss keine Frage sein (eine Erklärung wäre falsch beschriftet), "Antwort" stimmt immer. Der Name des Bereichs für Screenreader heisst "Aktuelle Antwort von Finn". (2) Die neueste Antwort hatte "Prompt kopieren" und "Speichern", aber keinen Export; erst nach der nächsten Nachricht, als Blase, kam er. `ChatReplyActions` (Antwort kopieren, Export) ist jetzt ein Baustein in `chat-transcript.tsx`, den Blase und Panel gemeinsam nutzen, damit die neueste Antwort nie weniger kann als die davor. Die Datei heisst weiter `prompt-<n>.md`, `n` ist die Stelle im Chat wie bei den Blasen. (3) Im Projekt hiess die Liste "Ergebnisse", im Kontomenü "Gespeicherte Prompts": jetzt überall Letzteres (Seitentitel, Zähler im Projektkopf, leerer Zustand, Löschhinweis, Untertitel der Projektliste, in allen fünf Sprachen; **fr/it/es nicht von Muttersprachlern geprüft**). Die Hilfe zog mit (`/docs/ergebnisse` behält die Adresse, `updated` in `docs-nav.ts` auf 2026-10-19, das UTC-Datum der Änderung: `docs-nav.test.ts` vergleicht gegen UTC, und kurz nach Mitternacht Ortszeit wäre der 2026-10-20 für die CI noch Zukunft) und verlor dabei eine falsche Aussage: sie sagte, in einem losen Chat gebe es keinen Speichern-Knopf, seit Migration 0025 (N-1) gibt es ihn überall. Der Seitenpfad `/projects/[id]/results` und die Code-Bezeichner `results` bleiben, nur Anzeigetexte wurden geändert.

**Startideen im leeren Chat (2026-10-20, #156):** `/chats/new` zeigte nur Finn, die Frage und ein leeres Feld, die Zielgruppe kennt das Prinzip "erst Rückfrage, dann Prompt" nicht. Jetzt stehen unter der Frage vier antippbare Ideen im Wortlaut "Ein Prompt für …" (Brief an den Vermieter, 10-Folien-Präsentation, Webseite für den Sportverein, Lernplan): sie zeigen die Breite des Versprechens und das Wort "Prompt", mit dem Finn laut Live-Test (#148) besser arbeitet. **Ein Tipp füllt nur das Feld und setzt den Cursor ans Ende, gesendet wird nichts.** Nur im leeren Standalone-Chat (Variante `general`), nicht im Projekt-Chat, der seinen eigenen Kontext hat, und nicht mehr, sobald eine Nachricht da ist. Dafür nimmt `ChatComposer` eine optionale `inputRef`. Der Kommentar in `chat-empty-state.tsx` und `chat-variants.ts`, der "keine Startideen" als Absicht festhielt, ist umgeschrieben. Texte (`chat.emptyStartersLabel`, `chat.emptyStarters`) in allen fünf Sprachen, **fr/it/es nicht von Muttersprachlern geprüft**. Nicht im Browser gesehen (der leere Chat liegt hinter dem Login); Verhalten durch `chat-empty-state.test.tsx` und `chat.test.tsx` belegt.

**Startseite nennt die Key-Voraussetzung vor der Registrierung (2026-10-20, #126):** Auf Free gibt es ohne eigenen KI-Key keinen Chat, die Startseite sagte das erst im letzten Abschnitt, die Nicht-Entwickler-Zielgruppe stand nach der Registrierung vor einer technischen Einrichtung. Gewählt wurde der kleinste der drei Wege im Issue ("ehrlich früh sagen"), nicht Probe-Antworten auf dem Server-Key (hängt an Z.ai-Einwilligung, Kosten und der Vercel-Hobby-Frage) und nicht das statische Beispiel ohne Konto. Eine Zeile unter den Hero-Knöpfen ("Du brauchst dafür einen KI-Key, am einfachsten einen kostenlosen von Google" mit Link auf `/docs/eigene-api-keys`), eine gestrichelte Karte "Einmal vorab" unter den drei Schritten, der Abschluss und der Untertitel der Registrierung ziehen nach. **Bewusst kein vierter Schritt:** die drei Schritte sind das Versprechen, der Key ist die einmalige Einrichtung davor; ein vierter Schritt hätte auch die Überschrift, das HowTo-Markup, `llms.txt` und die Hilfe ("drei Schritte") mitgezogen. Die Hero-Zeile ist das einzige, was an `hero.tsx` dazukam (606 von 610 Zeilen), die Demo darunter blieb unberührt. `tests/guards/landing-key-hint.test.ts` hält die Stellen fest. Nicht gemessen: ob es die Abbrüche senkt, das braucht #128.

**Major-Upgrades: Plan und Entscheid zur `braces`-Ausnahme (2026-10-20, #137):** Die Ausnahme für GHSA-vfj7-8cjw-p6xm läuft am 2026-11-04 ab. Am 2026-10-20 neu geprüft: weiter keine gepatchte `braces`-Version, `npm audit` bietet nur `tailwindcss@4.3.3` an, der ausgelieferte Build enthält `braces` nicht. Entscheid: Tailwind 4 als eigener Branch (riskanter Umbau, 137 Dateien mit `className`, drei Guards lesen `globals.css`), fertig bis etwa 2026-10-28. Rückfall bei nicht grünem Branch am 2026-11-02: einmalige Verlängerung um höchstens 30 Tage mit erneutem Beleg am Standalone-Build. Reihenfolge danach: Next-Patch (neues Advisory GHSA-4jqv-mc3x-m676, moderate), Next 16 mit ESLint-CLI (#138), `motion` mit LazyMotion (#135), TypeScript 7 und vitest 5 einzeln; `@types/node` bleibt bei Node 24. Nichts davon in diesem Schritt umgesetzt, nur geplant: [UPGRADES-2026-10.md](UPGRADES-2026-10.md).

**Git-Arbeitsweise: ein Branch je Arbeitsgang, nicht je Issue (2026-10-19, Kasum):** Nach der Runde mit fünf Issues auf fünf Branches und vier nötigen Neuaufsetzern wollte Kasum "schlau committen, schlau pushen, schlau Branches anlegen": nicht für jeden Commit oder jedes Issue einen Branch, sondern einen Branch mit mehreren Commits und einem PR, und nachlesen, wie man Git und GitHub richtig benutzt. Nachgelesen: GitHub Flow (ein Branch je Gruppe *unzusammenhängender* Änderungen, jeder Commit eine in sich stimmige Änderung, regelmäßig pushen, PR zum Besprechen), Trunk-Based Development (kurzlebige Branches von Stunden bis wenigen Tagen, höchstens zwei bis drei aktive Branches, oft integrieren), atomare Commits (je Commit eine logische Änderung, kein Winzig-Stückeln, vor dem Teilen aufräumen, gepushte Historie nie umschreiben). Ergebnis in `CLAUDE.md`, "Arbeitsregeln": ein Branch je Arbeitsgang oder Thema mit mehreren Commits, ein PR nach dem anderen, Gate vor Push und Merge statt vor jedem Commit (je Commit Typecheck und betroffene Tests), Push an Zwischenständen und am Sitzungsende, `Closes #n` in der Commit-Nachricht. Unverändert bleiben: nie auf `main`, "Rebase and merge" (damit jeder Commit in den Contributions zählt), Branches nie löschen (GitHub rät zum Löschen, Kasum will sie als Nachweis), nie force-pushen. Neu aus dem Fallstrick vom selben Tag: zwei offene Branches, die denselben Changelog-Kopf ändern, lassen sich nach dem ersten Merge nicht mehr per Rebase mergen, darum ein PR nach dem anderen (sonst `-v2` und Cherry-Pick).

**Finn schreibt den Prompt, nicht die Aufgabe, und duzt (2026-10-19, Issue #148):** Der Live-Test vom 18.10. (Z.ai `glm-4.5-air`) zeigte: ohne das Wort "Prompt" erledigte Finn die Aufgabe selbst (ein fertiger Brief im Block "PROMPT"), siezte, fragte nach Name und Adresse und nannte einen Paragrafen, den niemand erwähnt hatte. `src/server/system-prompt.ts` hat dafür jetzt: jede Aufgabenbeschreibung ist ein Wunsch nach einem Prompt (auch ohne das Wort), nie die Aufgabe selbst liefern oder ankündigen, duzen (de du, fr/it tu, es tú), nie nach Namen, Adressen oder Kontaktdaten fragen (Platzhalter), keine Gesetze oder Rechtsordnung annehmen, höchstens vier kurze Fragen, dazu ein kurzes Beispiel (Brief an den Vermieter) als Unterschied. Das Beispiel nennt keine Bau-Tools (Test bleibt). **Gegen das echte Modell gemessen** (ein Lauf, sechs deutsche Eingaben ohne das Wort "Prompt", je zwei Züge, altes gegen neues Prompt; Skript nur im Scratchpad, nicht im Repo): alt siezte in 3 von 6 ersten Antworten, fragte im Briefbeispiel nach Namen und Adresse, schrieb den Brief selbst und zitierte "§ 536"; neu siezte in keiner ersten Antwort, fragte nach nichts Persönlichem, lieferte in 6 von 6 Fällen einen Auftrag an eine KI und nannte kein Gesetz. Das ist ein Stichprobenlauf von n = 6 mit Heuristiken, kein Beleg für jede Eingabe; die Sprachen fr/it/es und englische Eingaben sind nicht gemessen, ebenso wenig die Antwort nach mehreren Runden. `system-prompt.test.ts` hält den Text fest (Mutationen schlagen an), das Verhalten prüft nur ein Lauf gegen das Modell. **Offen:** eine kleine wiederholbare Auswertung (10 bis 20 Eingaben) als Skript im Repo, falls Kasum sie will; die Marken-Beschriftung "PROMPT" im Ergebnisfeld passt jetzt zum Inhalt.

**Pro-Texte folgen dem Schalter (2026-10-19, Issue #125):** Seit 2026-10-17 ist Pro nicht kaufbar, aber Preisseite, Registrierung, `/plans`, `/billing`, `/usage`, der Hinweis im leeren Chat, die Fehlermeldung `byokRequired`, die Vergleiche, die Hilfe und `llms.txt` verkauften es weiter (Empfehlung, Preis, Erstattung), und erst der Klick auf "Pro holen" führte auf "Pro gibt es noch nicht". Jetzt liefert `buildPlans()` (`src/shared/lib/pricing.ts`) ohne Schalter eine Pro-Karte im Zustand "Später / Noch nicht verfügbar": kein Preis, kein Abzeichen "Finns Empfehlung", kein Kaufknopf, kein Erstattungstext, ein Link auf `/pro-bald`. Die App-Texte haben je eine Ersatzfassung im Wörterbuch (`proSoon`, `keyNoticeBodySoon`, `upsellTitleSoon`, `noteFreeSoon`, `subtitleSoon`, `byokRequiredSoon`, alle fünf Sprachen; fr/it/es nicht von Muttersprachlern geprüft). Wer Pro schon hat (auch ein Admin), sieht auf `/plans` weiter den echten Plan; die Zeile "Kündigung / 14 Tage Geld zurück" der Vergleichstabelle entfällt ohne Pro. **Bewusst nicht angefasst:** `/rueckerstattung` und die übrigen Rechtstexte (nur nach Kasums Entscheid), das JSON-LD der Startseite (Issue #127). Mit dem Schalter kommt alles von selbst zurück (docs/PRO-WIEDERAUFNAHME.md). Tests: `pricing.test.ts` (beide Zustände, fünf Sprachen), `pricing-grid.test.tsx` (gerenderte Preisseite), `build-llms-txt.test.ts`, `comparisons.test.ts`; Mutationen schlagen an.

**Unbekannte Unterseiten der App zeigen die 404 statt einer leeren Seite (2026-10-19, Issue #149):** `/settings/x`, `/usage/x`, `/billing/x`, `/plans/x` und `/prompts/x` antworteten eingeloggt mit einer leeren Seite. Ursache: `isAppPath()` gibt jedem Pfad unter einem App-Präfix die Nonce-Policy, eine Adresse ohne Route geht aber an die statische Root-404, deren Inline-Skripte keinen Nonce tragen; die CSP blockt sie, die Seite hydriert nie (derselbe Fehlertyp wie bis 2026-10-01 bei toten Adressen außerhalb der App). Jetzt hat jedes Präfix eine Auffangroute `[...rest]/page.tsx`, die `notFound()` ruft (bei `chats` und `projects` unter `[id]`), die 404 rendert damit im App-Layout, wie schon unter `/chats/<unbekannt>`. `/admin/...` (leitete nur `/admin` auf `/usage` um) folgt jetzt ebenfalls (`/admin/:path*`). Der Guard `tests/guards/route-access.test.ts` verlangt die Auffangroute für jeden Ordner unter `(app)`; Mutation (Auffangroute entfernt) schlägt an. **Nicht im Browser geprüft:** ohne Docker kein lokaler Supabase-Stack, also keine eingeloggte Sitzung; ein Browser-Test in `e2e/` fehlt aus demselben Grund.

**Stopp beim Neu-Erzeugen und Bearbeiten räumt die alte Fassung auf (2026-10-19, Issue #129):** Der Abbruch-Zweig in `src/app/api/chat/reply-stream.ts` sicherte nur den Teiltext (`completeTurn`), die Schritte des vollständigen Zugs fehlten (`dropReplacedReply`, `adoptAttachments`, `dropSupersededMessages`). Der Bildschirm zeigte nach „Stopp“ schon den neuen Stand, die Datenbank hielt alt und neu, ein Reload zeigte beide. Entscheid: **mit Teiltext** läuft dieselbe Aufräumkette wie nach einem vollständigen Zug (gemeinsamer Helfer `dropOldVersion`). **Ohne Teiltext** gibt es beim Neu-Erzeugen nichts Neues, die Route behält die alte Antwort und der Client setzt sie wieder ein (`run-chat-turn.ts`, kein Datenverlust durch einen Stopp vor dem ersten Wort); beim Bearbeiten steht die neue Frage seit C-1 in jedem Fall, die alte Fassung samt Dateiumzug fällt trotzdem weg. Tests: `route.test.ts` (vier Abbruchfälle), `route.attachments.test.ts` (Dateien ziehen beim Stopp um), `chat.turn.test.tsx` (Wiederherstellen und Ersetzen); Mutationen in Route und Client schlagen an.

**Ratenlimits: ein Zähler je Aktion (2026-10-19, Issue #147):** Alle sechs Routen mit Stundenlimit pro Nutzer nutzten den Schlüssel `u:<id>`. Upstash bildet den Redis-Schlüssel aus Präfix, Kennung und Zeitfenster, die Obergrenze gehört nicht dazu: Chat (120), Projekte (30), Key-Verwaltung (30/60) und Export/Löschen (je 5) zählten in denselben Zähler. Fünf Chat-Antworten in einer Stunde sperrten damit den Datenexport und das Löschen des Kontos mit 429, die beiden Rechte, die die Datenschutzerklärung zusagt. Admins sind ausgenommen, darum fiel es im eigenen Betrieb nie auf. `rateLimitKey(req, scope, userId?)` verlangt jetzt einen Bereich (`RateLimitScope`: chat, projects, brain, consent, contact, auth, api-key-save/-update/-delete, account-delete, account-export), der Schlüssel heißt `<bereich>:u:<id>`. Die Schlüssel von brain, consent und contact bleiben unverändert (`brain:u:<id>` usw.), nur die übrigen Zähler fangen einmalig bei null an. `tests/guards/rate-limit-scopes.test.ts` hält fest, dass kein Bereich zweimal vorkommt, der Typ und die Aufrufe übereinstimmen und `rateLimit()` keinen blanken Schlüssel bekommt. Mutationen (Bereich ignoriert, zwei Routen mit demselben Bereich) schlagen an.

**Pro ist nicht kaufbar, jeder Pro-Knopf führt auf `/pro-bald` (2026-10-17, Kasum):** Auf die Frage, ob man jetzt zahlen kann, fiel auf: Vercel Hobby erlaubt laut den Fair-Use-Regeln nur nicht-kommerzielle Nutzung, "any method of requesting or processing payment from visitors" zählt als kommerziell. Der Vercel-Pro-Plan (rund 20 $ im Monat) ist noch nicht gebucht. Kasum: die Seite bleibt, wie sie ist, jeder Weg zu Pro leitet auf eine Seite "Pro noch nicht verfügbar, tut uns leid", und später soll eine neue Sitzung mit "nimm Pro wieder auf" alles zurückholen. Umgesetzt mit einem Schalter (`PRO_AVAILABLE = false` in `src/shared/lib/pro-availability.ts`): `LemonCheckoutButton` (Preisseite über `ProCheckoutCta`, `/plans`, `/billing`) rendert dann einen Link auf `/pro-bald`, Besucher ohne Konto landen ebenfalls dort statt bei der Registrierung. Neue öffentliche Seite `/pro-bald` (noindex, nicht in der Sitemap; der SEO-Guard nimmt `noindex`-Seiten aus der Sitemap-Pflicht aus). **Nichts gelöscht:** Checkout-Seite in Markenfarben, Webhook, Kundenportal, Preise, `/plans`, `/billing`. Anleitung zum Zurückholen: `docs/PRO-WIEDERAUFNAHME.md` (Voraussetzungen Vercel Pro, Backup, Lemon-Squeezy-Einstellungen, Schritte, erster echter Kauf als Test des Webhooks); der Guard `tests/guards/pro-availability.test.ts` hält Schalter, Seite, Anleitung und den CLAUDE.md-Verweis zusammen und verbietet einen zweiten Weg zur Checkout-Adresse.

**Bezahlen auf der ganzen Seite von Lemon Squeezy, in Markenfarben, mit Finn (2026-10-17, Kasum):** Kasum wollte eine Zahlungsseite wie sein Beispiel (links Produkt mit Bild, rechts Zahlart und Zahlungsdaten, im PromptPrinter-Design). Ein Formular in der eigenen Seite gibt es bei Lemon Squeezy nicht (nur Fenster über der Seite oder die gehostete Seite; ein eigenes Formular ginge nur mit Paddle inline oder Stripe Elements, grosser Umbau, nicht gewählt). Gewählt: die gehostete Seite. Links Name, Preis, kleines Finn-Zeichen und das Produktbild auf den hellen App-Farben (`CHECKOUT_COLORS` in `shared/lib/lemon-squeezy.ts`, aus den Tokens: #EBF4FA, #0C0F13, #596473, Knopf #7FC5F0), rechts die weisse Zahlungshälfte von Lemon Squeezy; **diese Hälfte nimmt keine Farbe an** (am 2026-10-17 mit grellen Farben geprüft: nur die linke Seite, Titel, Preis und Knopf folgen). `LemonCheckoutButton` hat `presentation`: `page` (Standard, ein Link ohne `embed`, Lemon.js wird nicht geladen) oder `overlay` (der bisherige Weg, Beschreibung, Logo, Bild und Rabattfeld aus). Auf der Seite sind nur Beschreibung (im Dashboard englisch) und Rabattfeld aus. Kasum lädt das Finn-Bild (1200 x 1200, Hintergrund #EBF4FA) im Dashboard hoch und löscht das alte Bild. Die Seite liegt auf `promptprinter.lemonsqueezy.com`; die Rückkehr nach dem Kauf stellt Kasum im Dashboard am Produkt ein (Bestätigung/Link zu /billing), der Webhook schaltet Pro unabhängig davon frei.

**Bezahlfenster schlank: Logo, Bild, Beschreibung und Rabattfeld aus (2026-10-17, Kasum: Variante A):** Kasum gefiel der Inhalt des Fensters von Lemon Squeezy nicht: Produktbild oben abgeschnitten, das runde Shop-Logo überlappte es, Titel und Beschreibung englisch (im Dashboard am 15.10. so angelegt). Das Fenster liegt bei Lemon Squeezy, sein Aussehen kommt aus dem Dashboard und aus URL-Parametern. Nachgesehen: in der Doku stehen `embed`, `logo=0` und `button_color` als URL-Parameter (Guide "Taking payments"), `media`, `desc` und `discount` als `checkout_options` der API (false blendet aus); `checkout[email]`, `checkout[name]`, `checkout[discount_code]` füllen vor. Im Browser (Hosted-Seite, nicht gekauft) geprüft: `logo=0&media=0&desc=0&discount=0` wirken alle vier als URL-Parameter, übrig bleiben "PromptPrinter Pro", die Zahlart und der Preis. **`dark=1` bewirkt nichts mehr** (in der API-Doku veraltet, Farb-Parameter ersetzen es); die Farb-Parameter färben auf der Hosted-Seite nur den Hintergrund, die Karte bleibt weiss. Deshalb bleibt das Fenster hell, ohne Dashboard-Arbeit. `buildCheckoutUrl` (`shared/lib/lemon-squeezy.ts`) setzt die vier Parameter immer, auch gegen eine Adresse in der Umgebungsvariablen, die etwas anderes vorgibt; `NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL` bleibt unverändert. **Variante B** (Finn behalten): ein quadratisches Produktbild (1200 x 1200, Hintergrund #EAF3FB, Finn auf 70 Prozent Breite) und deutscher Titel und Text im Dashboard, dann `media` und `desc` aus `CHECKOUT_HIDDEN_PARTS` nehmen. Nicht über die URL steuerbar: Währung (eine Shop-Währung, siehe Teil 3), Sprache der Belege (Store-Einstellung), Zahlarten (Cash App Pay erscheint in Stripe, nicht von uns gewählt).

**Handy-Audit, Fund 6: Prompt-Codeblock nutzt die Breite (2026-10-17):** Auf 375 px blieben dem Prompt im Ergebnisfeld nur rund 243 von 375 px Textbreite (Seitenrand 24 + Karte 20 + Codeblock-Rand 20 + Codeblock-Polster 14 je Seite). Auf dem Handy jetzt Karteninnenrand 12 statt 20 px, Kopfzeile 16 statt 20 px und Codeblock-Polster 12 statt 14 px, ab `md` unverändert. Gewinn rund 20 px Textbreite (gemessen live nach dem Deploy). Der Seitenrand von 24 px bleibt, er gehört zum ganzen App-Gerüst.

**Handy-Audit, Fund 5: Mindestschrift 12 px in der eingeloggten App (2026-10-17):** 51 Stellen mit `text-[10px]` bis `text-[11.5px]` (Hinweiszeilen, Datums- und Metazeilen, Abzeichen wie "Admin" und "Finns Empfehlung", "Finn ist eine KI und kann Fehler machen", Gedächtnis- und Dateikarten) sind jetzt `text-[12px]`. Betroffen nur die eingeloggte App (`(app)`, Shell, `shared/ui`, Chat, Projekte, Einstellungen, Prompts). **Nicht angefasst:** Landing, Hilfe, Vergleiche, Rechtstexte, Auth-Seiten (Kasum findet die Startseite auf dem Handy gut, das Hero steht auf der Nicht-anfassen-Liste). Der Guard `tests/guards/app-min-text.test.ts` verbietet `text-[Npx]` unter 12 px in diesen Ordnern.

**Handy-Audit, Fund 2 nachgebessert: `!important` (2026-10-17):** Die erste Fassung (Regel ausserhalb der `@layer`) wirkte live nicht: das Chat-Textfeld blieb bei 14 px (gemessen auf Prod, `matchMedia('(pointer: coarse)')` war wahr, die Regel im Stylesheet). Ursache: Tailwind 3 kennt keine echten CSS-Ebenen, `@layer` ist dort nur eine Anordnung. `.text-sm` (Spezifität 0,1,0) schlägt ein blosses `textarea` oder `select` (0,0,1); nur `input:not(...)` hatte genug Gewicht. Jetzt `font-size: 16px !important` bei Touch. Der Guard prüft `!important` mit; er prüfte vorher nur den Quelltext und hielt den Fehler nicht auf. Lehre: bei CSS-Regeln, die gegen Tailwind-Klassen gewinnen sollen, die berechnete Grösse live messen, nicht nur den Quelltext testen. **Dazu** Fund 4 live gemessen (Treffer 21 px über und unter der Mitte, `elementFromPoint`): Menü, Anhang, Mikrofon, Filter-Pillen, Favoriten, Chat-Liste und "Neu erzeugen" erreichen 44 px; "Prompt kopieren" nicht, weil die Kopfzeile des Codeblocks (`overflow-hidden`) die Trefferfläche abschnitt, darum dort mehr Polster auf dem Handy (`py-2.5 md:py-1.5`).

**Handy-Audit, Fund 4: Tippflächen auf 44 px (2026-10-17):** Menü-, Anhang-, Mikrofon- und Senden-Knopf waren 36 px, Nachricht bearbeiten 24, "Neu erzeugen" 27 und "Prompt kopieren" 20 px hoch, dazu die Symbolknöpfe in Chat-, Datei- und Prompt-Listen (32, 28, 24 px) und die Filter-Pillen (33 px). Statt die Optik zu vergrössern, erweitern die Hilfsklassen `touch-hit` und `touch-hit-y` (am Ende von `globals.css`, nur `@media (pointer: coarse)`, ausserhalb jeder `@layer`) die Trefferfläche per `::after` auf mindestens 44 px. `touch-hit-y` wächst nur in der Höhe, für Knöpfe, die dicht in einer Reihe stehen (Chat-Liste, gespeicherte Prompts, Sprachleiste), sonst überlappen sich die Flächen. Der Knopf muss positioniert sein; der Guard `tests/guards/touch-target.test.ts` prüft Regel, Stelle und `relative` an jedem Knopf. Nicht angefasst: Fliesstext-Links und Fussleisten-Links, das Bild bleibt gleich.

**Handy-Audit, Fund 3: Tarife seitlich scrollbar (2026-10-17):** `/plans` war bei 375 px und darunter seitlich scrollbar (Dokumentbreite 389 statt 375). Ursache nicht die Tabelle selbst (sie steckt in einem `overflow-x-auto`-Div), sondern ihre `sr-only`-Beschriftungen: sie sind `position: absolute`, der Div war nicht positioniert, also gehörten sie zum Dokument und wurden nicht abgeschnitten. Gefunden durch Ausblenden der Elemente nacheinander und Messen der Dokumentbreite; ein `relative` am Div brachte die Breite live auf 365. Der Guard `tests/guards/scroll-wrapper-positioned.test.ts` verlangt das für jeden scrollenden Tabellenrahmen in Dateien mit `sr-only`-Text.

**Handy-Audit, Fund 2: Eingabefelder mindestens 16 px auf Touch (2026-10-17):** Alle Eingabefelder hatten 12,5 bis 14 px (`text-sm`, `text-[13.5px]`, Chat-Eingabe, Suche, Einstellungen, Projekt-Rail). iOS-Safari zoomt beim Fokus auf ein Feld unter 16 px hinein und lässt die Seite vergrössert. Eine Regel am Ende von `globals.css` setzt Felder, Textfelder und Auswahllisten bei `@media (pointer: coarse)` auf 16 px; sie steht **ausserhalb jeder `@layer`**, sonst gewinnen die Tailwind-Grössen aus `@layer utilities`. Desktop bleibt bei der kleineren Schrift. Der Guard `tests/guards/touch-input-size.test.ts` hält Regel und Stelle fest. Nicht auf echtem iPhone geprüft: das Verhalten (kein Zoom beim Fokus) braucht Kasums Gerät.

**Handy-Audit der eingeloggten App, Fund 1: Menü auf dem Handy (2026-10-17):** Kasum fand die eingeloggte App auf dem Handy schlecht. Audit in Brave mit Handy-Emulation (360 bis 768 px). Der mobile Drawer (`fixed inset-0`) hing in der klebenden Kopfleiste mit `backdrop-blur`; ein Vorfahre mit `backdrop-filter` wird zum Bezugsrahmen für `fixed`, der Drawer war nur 56 px hoch (live gemessen: Rechteck 375x56), das Menü auf jedem Handy unbenutzbar. Jetzt per Portal an `document.body`, wie die anderen Dialoge; Test `mobile-nav.test.tsx` hält es fest. Weitere Funde des Audits (Eingabefelder unter 16 px, Tarife seitlich, Tippflächen, Mini-Text, Codeblock-Breite) in eigenen Einträgen.

**Z.ai: Einwilligung vor dem ersten Server-Key-Zug (2026-10-17, R-1):** Z.ai hat keine Standardvertragsklauseln und keinen Angemessenheitsbeschluss (Singapur, China nicht auszuschliessen). Kasum wollte den Punkt selbst lösen; als Notbehelf bis zur Antwort von Z.ai (Mail vom 17.10.) holt der Chat im Pro-Plan vor dem ersten Zug die ausdrückliche Einwilligung (Art. 49 Abs. 1 lit. a DSGVO, Art. 17 Abs. 1 lit. a revDSG). `server/consent.ts`: Speicherung in `app_metadata.zai_consent` (nur mit dem Service-Role-Schlüssel beschreibbar, keine Migration), Version `ZAI_CONSENT_VERSION` (Hinweistext geändert: hochsetzen, dann wird neu gefragt). Der Server prüft sie bei jedem Zug auf dem Z.ai-Server-Key (`allowance.ts`, Schritt 3a, vor jeder Reservierung) und bei der Projekt-Analyse; eigener Key (BYOK), anderer Server-Anbieter und Stub brauchen sie nicht. `POST/DELETE /api/consent/zai`. Oberfläche: `ChatConsentNotice` statt Fehlerbanner bei 403 `consentRequired` (die Nachricht wartet im Feld, "Einverstanden und senden" schickt sie ab), Karte "Übermittlung an Z.ai" in den Einstellungen (ansehen, zustimmen, widerrufen), Hilfe "Pläne und Limits", Datenschutz Ziffern 2, 3 und 5. Fünf Schranken per Mutation geprüft. **Grenze, bewusst nicht kleingeredet:** der EDSA sieht Einwilligungen nach Art. 49 als Ausnahme für gelegentliche Übermittlungen, nicht für eine dauerhafte wie diese. Die saubere Lösung bleiben Standardvertragsklauseln von Z.ai oder ein anderer Standardanbieter; die Einwilligung ist die billigste Verbesserung gegenüber "gar nichts". fr, it und es nie von Muttersprachlern geprüft. Der Datenexport (`/api/account/export`) nennt die Zustimmung mit Zeitpunkt und Fassung unter `consents.zaiTransfer`.

**Digital Services Act: Meldeweg und Kontaktstelle (2026-10-17, R-15):** Kasum wollte R-15 selbst lösen. Einordnung (aus Sekundärquellen, nicht am Amtsblatt geprüft): wer Daten von Nutzern speichert, ist ein Hosting-Dienst; Art. 11, 12, 13, 14, 16 und 17 gelten unabhängig von der Grösse, Berichte (Art. 15) und die Plattformpflichten (Art. 20 bis 28) nicht für Kleinst- und Kleinunternehmen. Ob private, nicht öffentliche Ablage überhaupt gemeint ist, bleibt offen; die Kosten der Absicherung sind gering. Umgesetzt: (1) Meldeweg nach Art. 16 als Thema "Rechtswidrigen Inhalt melden" im Kontaktformular, mit Hinweis, was in eine Meldung gehört, und Eingangsbestätigung per Mail nur bei diesem Thema (Art. 16 Abs. 4); (2) Nutzungsrichtlinie Ziffer 6 nennt die Begründung jeder Massnahme (Art. 17), den Widerspruch und dass ein Mensch entscheidet, Ziffer 7 den Meldeweg und die Kontaktstelle (Art. 11, 12; Deutsch und Englisch); (3) Datenschutz Ziffer 2 nennt die Eingangsbestätigung. **Nicht gelöst:** Art. 13, ein gesetzlicher Vertreter in der EU für Anbieter ohne Sitz dort. Das ist derselbe Vertrag wie der EU-Vertreter nach Art. 27 DSGVO (R-2), viele Anbieter bieten beide; sobald Kasum einen hat, kommen Name und Adresse in Datenschutz Ziffer 1 und die Nutzungsrichtlinie.

**Sprachmodus: Einwilligung vor dem ersten Diktat (2026-10-17):** Kasum: "eine Einwilligung wäre gut vor dem ersten Diktat" (Rechts-Audit, Punkt Sprachmodus). Chrome und Edge schicken die Aufnahme an Google bzw. Microsoft (Datenschutz Ziffer 4); wer den Sprachmodus öffnet, löst das aus. Jetzt fragt `VoiceConsentDialog` vor dem ersten Öffnen nach (alle Browser, ein Text), Ablehnen lässt den Chat unverändert, Einverstanden öffnet die Sprachleiste. Gespeichert wird **im Browser**, nicht beim Konto: localStorage `pp-voice-consent`, der Wert ist die Fassung des Hinweises (`VOICE_CONSENT_VERSION`, bei geändertem Text hochsetzen, dann wird neu gefragt). Widerruf: Link "Zustimmung widerrufen" in der Sprachleiste (löscht den Eintrag, schliesst den Sprachmodus). `ConfirmDialog` bekam dafür `tone="neutral"`. Eintrag in `cookie-inventory.ts` (damit `/cookies` stimmt), Datenschutz (Ziffer 2, Sprachmodus und Cookies) nennt es. Texte in fünf Sprachen (fr, it, es nie von Muttersprachlern geprüft). Vier Schranken per Mutation geprüft (Gate, Speichern, Widerruf, Fassung). **Grenze:** eine Zustimmung im Browser ist kein serverseitiger Nachweis; für die Übermittlung durch den Browser-Anbieter (der eigenverantwortlich handelt) reicht sie als Information und Wahl, mehr kann PromptPrinter dort nicht belegen.

**KI-Kennzeichnung, erste Schicht (2026-10-17, R-9):** Kasum wollte R-9 selbst lösen. Art. 50 Abs. 1 (Chatbot sagt, dass er KI ist) war seit 2026-09-28 erledigt. Für Abs. 2 (maschinenlesbare Kennzeichnung der Ausgabe, Frist laut Berichten 2026-12-02 für Systeme, die vor 2026-08-02 am Markt waren) steht jetzt eine erste Schicht: `x-ai-generated: true` an der Antwort von `/api/chat`, ein HTML-Kommentar am Anfang einer heruntergeladenen Markdown-Antwort, Dokumenteigenschaften und ein sichtbarer Hinweis in exportierten PDFs (`shared/lib/ai-marker.ts`, drei Stellen per Mutation geprüft). **Nicht gelöst und nicht behauptet:** ein Wasserzeichen (für reinen Text gibt es kein anerkanntes Verfahren, der Kodex verlangt mindestens zwei Schichten), eine Erkennungsschnittstelle, und ob eine Schicht genügt. Gelesen habe ich nur Zusammenfassungen von Kanzleien und der Kommission, nicht den Kodex und die Leitlinien (C(2026) 5054) im Wortlaut. Das Weitere in `docs/SETUP.md`, "KI-Kennzeichnung".

**Entscheid zum Aufwand bei Rechtlichem (2026-10-17, Kasum):** Nach dem Test von Kontaktformular und Auth-Mail (beides ging) sagte Kasum zu den offenen Rechtspunkten sinngemäß: kein EU-Vertreter, kein Vertrag, keine Angebote, "lass das einfach komplett weg"; er brauche nicht "das Beste vom juristisch Besten", die App sei ein Lernprojekt, es gebe keine Werbung, und niemand müsse wissen, wie viele Nutzer sie hat; sie solle vor allem gut aussehen. Folgen: **EU-Vertreter (Art. 27 DSGVO, DSA Art. 13) bewusst nicht**, damit bleibt auch die Pflicht aus DSA Art. 13 offen; **R-5 (Preis in Franken)**: der Checkout zeigt einem Besucher in der Schweiz Euro, das bleibt so; kein Jurist für R-1, R-5, R-6, R-9, R-15. Z.ai: Kasum wartet auf die Antwort auf seine Mail. Der Rest (Einwilligungen, Meldeweg, KI-Kennzeichnung) ist als PR gebaut und bleibt, weil er kaum Aufwand verursacht; neue Rechtsarbeit gibt es nur noch auf Wunsch. Ausserdem: auf dem Handy sieht die eingeloggte App schlecht aus (Startseite und Preise gut), Kasum will Screenshots der schlechtesten Stellen schicken.

**"Die Mensch-Prüfung konnte nicht geladen werden" und der Checkout als fremde Seite (2026-10-17):** Kasum meldete beides vom Handy: das Captcha auf /login schlug "sehr oft" fehl, und "Pro holen" öffnete die Seite bei Lemon Squeezy statt des Fensters. **Ursache, auf der Live-Seite nachgestellt:** die Content-Security-Policy kommt mit dem Dokument und je nach Pfad (Turnstile nur auf /login, /signup, /reset-password, /kontakt, Lemon Squeezy nur auf /pricing, /billing, /plans, Betriebs-Audit 04.10.). Next.js wechselt die Seite im Browser ohne neues Dokument, dabei gilt die Policy der ersten Seite weiter. Wer von der Startseite zu /login geht (Navbar), oder sich aus der App abmeldet (`router.push("/login")`), hat die Policy OHNE Turnstile, das Skript wird gesperrt, nach acht Sekunden kommt die Meldung. Dasselbe beim Weg Chat → Pläne für den Checkout. Direkt geladen oder nach einem Neuladen ging es, deshalb "oft", nicht immer. **Fix:** `FreshDocumentForThirdParties` im Root-Layout lädt neu, sobald ein Seitenwechsel eine Seite erreicht, deren Drittanbieter das Dokument nicht freigibt (`needsFreshDocument` in `shared/lib/third-party-paths.ts`, dort wohnen jetzt auch die Pfadlisten; `csp.ts` zieht sie von dort). Erfasst Links, `router.push`, Zurück/Vor und Weiterleitungen; der Preis ist ein kurzes Aufblitzen. Keine Schleife: nach dem Neuladen ist der Dokumentpfad der aktuelle. Guard `tests/guards/fresh-document.test.ts` hält die Einbindung im Root-Layout fest. Lokal geprüft: von der Startseite zu /login lädt die Seite neu, `window.turnstile` ist da, die Fehlermeldung bleibt aus. **Nicht geprüft:** die Abmelden- und Checkout-Wege im echten Browser (hinter dem Login); per Test abgedeckt.

**Kontaktformular (2026-10-17):** `/kontakt` hat neben der Mailadresse ein Formular (Kasum: "mach ein Formular", R-12 im Rechts-Audit: Deutschland verlangt einen zweiten schnellen Weg). `POST /api/contact` sendet über die Resend-HTTP-Schnittstelle (`server/mail/resend.ts`) an `LEGAL.email`, speichert nichts. Schutz: Ratenlimit 5 je Stunde und IP, **20 je Tag insgesamt** (gleiches Resend-Konto wie die Auth-Mails, Gratis 100 am Tag), Köderfeld, Turnstile (`/kontakt` in `thirdPartiesFor()`; das Widget zog dafür von `features/auth` nach `shared/ui`, weil zwei Features es brauchen). Texte: Datenschutz Ziffern 2, 3, 4, 6 und `/cookies`. Sechs Schranken per Mutation geprüft (Captcha, Tageslimit, Köderfeld, Adress-Limit, Betreff-Umbruch, CSP-Liste), jede ließ einen Test rot werden. **Nicht belegt:** dass eine Mail ankommt, es gab keinen Schlüssel zum Prüfen. Ohne `RESEND_API_KEY` meldet das Formular "gerade nicht verfügbar" samt Adresse.

**Rechtstexte, Fakten abgeglichen (2026-10-17):** Kasum wollte alle offenen Datenschutz-Punkte angehen. Gegen die Anbieter-Dokumente (alle am 2026-10-17 gelesen) abgeglichen und im Text nachgezogen: (1) **Google Gemini als Ausweich-Anbieter gestrichen** (Ziffer 4 und 5), weil es keinen `GEMINI_API_KEY` gibt und der Failover aus ist; wer den Key setzt, ergänzt vorher den Text (Regel in CLAUDE.md, Hinweis in `.env.example` und SETUP.md). (2) **Z.ai:** die Vereinbarung zur Auftragsbearbeitung steht unten auf der Datenschutzseite von Z.ai (nicht als eigenes Dokument), sagt "nicht auf unseren Servern gespeichert, in Echtzeit verarbeitet" (Ziffer 4b), das steht jetzt als Aussage von Z.ai im Text. Standardvertragsklauseln enthält sie **nicht**, nur "legally recognized transfer mechanisms"; R-1 bleibt offen. (3) **Resend:** Plus Five Five, Inc. nennt sich in der Vereinbarung und im Changelog (2025-03-13) EU-US-DPF-zertifiziert, **nicht** Swiss-US; steht im Text als eigene Angabe von Resend. Gegen die offizielle DPF-Liste nicht geprüft. (4) **AGB Ziffer 2 und Nutzungsrichtlinie Ziffer 2:** die Vorschläge aus #88 eingebaut ("beliebige KI-Anwendungen (z. B. Claude, ChatGPT, Gemini)", "eine KI deiner Wahl", "nicht die Aufgabe selbst"). (5) **Supabase:** die Bedingungen und der DPA (Version 1, 2026-08-01) nennen als Vertragspartner Supabase Pte. Ltd. (Singapur), Datenschutz sagte "Supabase Inc."; jetzt "Supabase Pte. Ltd., Singapur", die Daten bleiben in Irland, Standardvertragsklauseln samt Schweizer Anpassung stehen im DPA (Ziffer 4 und 5). Im Dashboard (Organization, Legal Documents, am 2026-10-17 gelesen) steht, der DPA gelte automatisch mit den Bedingungen, eine Unterschrift sei nicht nötig (R-7 für Supabase erledigt); die Folgenabschätzung für Übermittlungen (TIA) liegt dort zum Download. **Gefunden, nicht eingebaut:** Vercel nennt für Speed Insights keine Aufbewahrungsdauer (nur "minimum necessary period"), Upstash-DPA hat keine Schweizer Anpassung der Klauseln, Cloudflare-DPA nennt DPF inkl. Swiss-US. (6) **Upstash:** Kasum hat im Dashboard die Region EU-Central-1 (Frankfurt) gelesen; Ziffer 4 nennt sie, Ziffer 5 führt Upstash nicht mehr unter den USA-Diensten, sondern bei der EU-Datenhaltung. (7) **Lemon Squeezy:** Kasum hat "Tax-inclusive pricing" (Settings, General) am 2026-10-17 eingeschaltet, der beworbene Preis ist damit der Endpreis (R-4). (8) **Resend** steht laut Kasum auf der offiziellen DPF-Liste als Active (mit dem Vermerk, die Rezertifizierung werde geprüft); der Satz im Text bleibt als eigene Angabe von Resend. Datum der Rechtstexte: 17. Oktober 2026.

**Datenschutz um Resend, DMARC (2026-10-15):** Resend ist als Empfänger in die Datenschutzerklärung gekommen (Ziffer 2 Kontodaten, Ziffer 4 Dienste, Ziffer 5 Drittländer, Ziffer 6 Speicherdauer; das Datum der Rechtstexte steht jetzt auf 15. Oktober 2026). Angegeben sind Plus Five Five, Inc. (USA) als Vertragspartei, Region Irland für unsere Domain mit dem Vorbehalt, dass die Vereinbarung überwiegend die USA vorsieht, und 30 Tage Aufbewahrung der Mailinhalte, jeweils nach Angaben von Resend. **Bewusst nicht behauptet:** eine Zertifizierung zum Data Privacy Framework (nicht geprüft); die Grundlage der Übermittlung sind die Standardvertragsklauseln, wie bei den anderen US-Diensten. Als Rechtstext lag die Änderung zuerst offen im PR #103; Kasum hat sie am 2026-10-15 zum Mergen freigegeben, die CI war grün. Die juristische Prüfung steht weiter aus. Außerdem steht bei Vercel jetzt der Eintrag TXT `_dmarc` = `v=DMARC1; p=none;` (nur beobachten; die Resend-Einträge blieben unberührt). Die Supabase-URL-Konfiguration hat Kasum geprüft, sie stimmt.

**Auth-Mails über Resend (2026-10-15, Dashboards, kein Code):** Der Plan vom 06.10. nannte Brevo, Kasum hat stattdessen sein bestehendes Resend-Konto genommen. Domain `promptprinter.app` in Resend (Region Irland, "Verified"), die DNS-Einträge (DKIM-TXT und zwei CNAME) hat Resend über die Vercel-Anbindung selbst angelegt. In Supabase ist der eigene SMTP-Server eingetragen (`smtp.resend.com`, Port 465, Benutzer `resend`, ein Key nur für diese Domain) und die Vorlagen sind eingefügt. **Nicht belegt, nie getestet:** dass eine Mail ankommt (Kasum wollte keinen Test). Deshalb bleibt "Confirm email" aus; ohne bewiesenen Versand würde es Registrierungen aussperren. Alle 5 bestehenden Konten gelten als bestätigt (gezählt, `email_confirmed_at`), das Einschalten sperrte also niemanden aus. **Offen:** Resend in die Datenschutzerklärung (neuer Empfänger, US-Firma), ein `_dmarc`-Eintrag, und der erste echte Reset zeigt, ob alles läuft.

**Betrieb, Entscheide (2026-10-15):** Kasum entschied, **keinen Alarm-Webhook** einzurichten (`ALERT_WEBHOOK_URL` bleibt leer, die App schreibt ihre Meldungen nur nach stdout; Ausfälle fallen also nur durch Zufall oder Kunden auf) und **keinen Gemini-Server-Key** zu setzen (`GEMINI_API_KEY` fehlt, der Failover von Z.ai auf Gemini ist damit aus; fällt Z.ai aus, ist der Chat für alle ohne eigenen Key tot, bis es wieder läuft). Der Code für beides bleibt, er tut ohne die Variablen nichts. Gesetzt ist dagegen `GITHUB_TOKEN` (Production, fein granuliert, nur öffentliche Repositories, keine Rechte): der Gedächtnis-Import hat damit 5000 statt 60 Anfragen pro Stunde. **Nicht belegt:** dass der Token in Produktion greift; im Log steht es als `brain.github_quota` mit `limit: 5000` (Hobby behält Logs nur eine Stunde). Mit dem Failover aus bleibt im Datenschutz der Satz zum Ausweich-Anbieter und der Hinweis, dass im Ausfall Daten an Google gehen könnten, ohne Wirkung; ob er bleibt oder gestrichen wird, entscheidet Kasum zusammen mit den anderen juristischen Punkten. Der echte Kauf zum Prüfen des Zahlungswegs ist ausdrücklich nicht geplant: Secret-Gleichheit und Steuerausweis bleiben ungeprüft, bis ein erster Kunde kauft.

**Dependabot-Durchgang (2026-10-15, PR #91, #92, #94 bis #97, #99):** auf Kasums Auftrag alle offenen Dependabot-PRs gemergt, jeder nach deiner Regel: Branch auf dem aktuellen `main` (Dependabot rebased auf Anforderung), frische CI mit Browser-Tests und Docker, dann Rebase-Merge. Die Läufe der PRs waren drei Tage alt und zählten deshalb nicht. Gemergt: `actions/checkout` 4 auf 7 und `actions/setup-node` 4 auf 7 (nur Workflow-Dateien, die CI lief im PR schon mit den neuen Versionen), `@vitejs/plugin-react` 5 auf 6 und `@testing-library/jest-dom` 6 auf 7 (nur Testwerkzeuge), `openai` 6 auf 7 (einziger Bruch laut Changelog: Node.js 22 nötig, hier läuft Node 24; der Code nutzt nur `chat.completions.create`), `lucide-react` 0.474 auf 1.55 (entscheidet Kasum damit zugunsten der neuen Symbole, gemessen waren 9 von 70 sichtbar anders; der alte PR #51 wurde von Dependabot durch #95 ersetzt) und die Sammelgruppe mit 11 Paketen (#99, löste #93 ab: u. a. `@anthropic-ai/sdk` 0.133, `@google/genai` 2.28, `zod` 4.6.6, `playwright` 1.64). **Nicht belegt:** die Anbieter-SDKs (`openai`, `@anthropic-ai/sdk`, `@google/genai`) gegen die echten Dienste, die Tests bilden sie nach. Offen bleibt nur #1 (Vercel-Bot, Draft, wird nie gemergt).

**Lemon Squeezy live (2026-10-15, Vercel und Lemon Squeezy, kein Code):** Die Seite verlinkte bis dahin ein Testmodus-Produkt (der Checkout trug den Balken "Derzeit ist der Testmodus aktiviert"), echte Käufe waren unmöglich. Jetzt: Live-Produkt "PromptPrinter Pro" (Abo, 5,90 € monatlich, englische Texte), Live-Webhook auf `/api/webhooks/lemonsqueezy` mit den zwölf Ereignissen aus `docs/SETUP.md`, in Vercel (Production) der neue Checkout-Link, ein neues Webhook-Secret und neu `LEMON_SQUEEZY_API_KEY` (beendet das Abo beim Löschen eines Pro-Kontos; fehlte bis dahin ganz). Die vier `STRIPE_*`-Variablen sind aus Vercel entfernt. Geprüft nach dem Deployment: das Live-Bundle trägt nur den neuen Link, der Webhook weist ein unsigniertes und ein falsch signiertes Ereignis mit 401 ab (ohne Secret käme 503), `/api/health` ok. **Nicht belegt:** dass das Secret in Vercel dem im Lemon-Squeezy-Webhook gleicht und ob Preise brutto oder netto gelten (am Checkout erschien bei Deutschland, Österreich und der Schweiz keine Steuerzeile); beides zeigt erst ein echter Kauf. Lehre aus dem Ablauf: Vercel führt `LEMON_SQUEEZY_WEBHOOK_SECRET` als zwei Zeilen (Production und Preview), das neue Secret landete zuerst in der falschen, und ein vorzeitig gesetzter Live-Link ohne passendes Secret hätte Kunden zahlen lassen, ohne Pro freizuschalten.

**Sicherheitsrichtlinie (2026-10-11, Branch `docs/security-policy`):** `SECURITY.md` im Wurzelverzeichnis, damit GitHub unter "Security policy" zeigt, wie man eine Lücke meldet: per Mail an die Adresse aus `src/shared/lib/legal.ts`, nicht über eine öffentliche Issue. Auf Kasums Wunsch (Mail statt GitHubs privater Meldefunktion). Zugesagt wird nur, was sich halten lässt: Antwort in einigen Tagen ohne feste Frist, kein Bug-Bounty, kein Freibrief für Tests (nur eigenes Konto, keine Last, kein Social Engineering). Nicht eingerichtet: GitHubs "Private vulnerability reporting" und eine `/.well-known/security.txt` auf der Seite.

**Neuausrichtung: Prompts für jede KI und jede Aufgabe (2026-10-11, Branch `feat/positionierung-jede-ki`):**
Kasums Entscheid. PromptPrinter ist kein Werkzeug für Vibe-Coder und Bau-Tools (Lovable, Cursor, v0,
Claude Code, Bolt, Replit) mehr, sondern gibt Prompts für jede KI und jede Aufgabe: Dokument, Webseite,
Datenbank, Sicherheitsprüfung, Plan. Kasums Begründung: "Vibe-Coder" kommt bei Besuchern nicht gut an,
es ist ein Werkzeug, das Prompts gibt. Die Positionierung vom 2026-07-22 (eine Nische statt
zwei) ist damit ersetzt, nicht ergänzt.

- **Finn (Produkt).** `src/server/system-prompt.ts` neu: gilt für jede Aufgabe, nimmt den Nutzer nicht als
  Entwickler an, fragt je nach Aufgabe etwas anderes (Text: Leser, Ton, Länge, Format; Software: Screens,
  Daten, Login, Look; Datenbank, Analyse, Prüfung: System, Technik, Umfang, Maßstab für ein gutes Ergebnis).
  **Das Ziel-Tool ist keine feste Eröffnungsfrage mehr**, nur noch, wenn es den Prompt verändert (Code- oder
  Bildwerkzeug). Ohne Angabe wird der Prompt so geschrieben, dass er in jeder KI läuft. Neu: Finn schreibt den
  Prompt und erledigt die Aufgabe nicht selbst (eine Zeile, dann der Prompt). Die Schutzabsätze gegen
  Anweisungen in Anhängen und Projektkontext sind unverändert. `system-prompt.test.ts` hält die Ausrichtung
  fest (keine Bau-Tool-Namen, jede Aufgabe, Ziel-Tool keine feste Frage, Form der Antwort, Schutzabsätze).
- **Texte der App** (fünf Sprachen): Sprachmodus "Sag einfach, was du brauchst", Free-Merkmal "Prompts für
  jede KI und jede Aufgabe" statt "Zugeschnitten auf dein Bau-Tool" (auch `pricing.ts`). fr, it und es sind
  nicht von Muttersprachlern geprüft.
- **Öffentliche Seiten.** Hero (Überschrift "Sag mir, was du brauchst. Ich schreib dir den Prompt.", Sprechblase
  "Prompt-Buddy", drei Demo-Durchläufe aus verschiedenen Bereichen: Sicherheitsprüfung, Bewerbung, Datenbank),
  die drei Schritte, die FAQ, die Beispiel-Chats und -Projekte der Produktvorschau, die Über-Seite, Titel und
  Beschreibung (`layout.tsx`, Vorschaubild, `llms.txt`), vier Hilfe-Artikel (`updated` auf 2026-10-11).
- **Vergleiche.** Der dritte Vergleich hieß "Direkt im Bau-Tool prompten" und fiel mit der Prämisse. Er heißt
  jetzt `/vergleich/direkt-in-die-ki-tippen`; die alte Adresse leitet dauerhaft um (`next.config.ts`). Die
  anderen beiden sind umgeschrieben, ohne Lovable und Cursor.
- **Doku.** README, `CLAUDE.md` ("Was ist PromptPrinter?" und der Chat-Eintrag im IST-Zustand), `docs/PRODUCT.md`
  (Nutzer und Zweck), `docs/MASCOT.md` ("Prompt-Buddy"), Lesetext des Design-Skills unter
  `.claude/skills/promptprinter-design/`.
- **Bewusst nicht angefasst.** *Rechtstexte* (AGB Ziffer 2 nennt noch "Lovable, Cursor" als Beispiele,
  Nutzungsrichtlinie Ziffer 2 sagt "KI-Bau-Tools wie Lovable, Cursor oder Claude Code"): Vorschlag liegt bei
  Kasum, juristisch prüfen. *Projekt-Gedächtnis und Struktur-Felder* (Stack, Frontend, Backend) sind weiter auf
  Softwareprojekte zugeschnitten, das ist ein Funktionsthema und kein Textthema. *Die visuelle Marke* heißt in
  `PRODUCT.md` weiter "Refined Dev-Brand". Frühere Changelog-Einträge und Audits bleiben wörtlich.

**Reste ohne Kasum (2026-10-07, PR #70 bis #84, Dependabot #50):** zwei Sitzungen, die erste
erreichte bei Teil C das Nutzungslimit, die zweite prüfte alles Gemergte unabhängig nach (Webhook gegen
die Doku, `optionalEnv`, die Schnitte Zeile für Zeile) und arbeitete weiter. Ausgangslage: `main` =
`057a376`, Produktion `READY`, keine andere Sitzung lief.

- **A, Dashboards (nur lesend, Kasums Chrome, nichts gespeichert, keine Geheimnisse gelesen).**
  *Supabase* (Free): **kein eigener SMTP** (Standardversand, nach Supabases Doku nur an Adressen des
  Projekt-Teams, 2 Mails je Stunde für alle), "Confirm email" **aus**, Vorlage "Reset password" =
  **Supabase-Standard** (`{{ .ConfirmationURL }}`, die Vorlagen aus `supabase/templates/` sind nicht
  eingefügt), Site URL `https://promptprinter.app`, eine Redirect-URL `https://promptprinter.app/**`.
  Aus dem Code abgeleitet, nicht mit einem echten Ereignis belegt: der Standard-Link läuft über
  `/auth/v1/verify` und den `code`-Weg von `/auth/callback`, die Seite "Neues Passwort" nimmt ihn an, nur
  im Browser, der den Reset angefordert hat; das Nadelöhr ist der Versand. *Vercel* (Hobby): Speed
  Insights ohne Messwerte (Desktop und Mobile, 7 Tage), in Production die vier `STRIPE_*` noch da, es
  fehlen `ALERT_WEBHOOK_URL`, `GITHUB_TOKEN`, `GEMINI_API_KEY` (nur Namen gelesen, nichts entschlüsselt).
  *Lemon Squeezy:* nicht angemeldet, nicht prüfbar (Testmodus oder Live, Webhook-URL, Preise brutto oder
  netto bleiben offen).
- **#70, neues Advisory vorweg.** `audit.yml` meldete GHSA-wq5f-xc86-pv6w (`sharp` < 0.35.5, CVSS 8.9,
  librsvg): jeder Branch hatte einen roten `audit:gate`. Override auf `^0.35.5`; im Repo importiert
  niemand `sharp`, es hängt an `next/image`.
- **B, #72, leer gesetzte optionale Umgebungswerte.** `optionalEnv()` (`src/server/env-value.ts`): leer
  und nur Leerzeichen sind nicht gesetzt. Angewendet auf `ZAI_MODEL`, `GEMINI_MODEL`, `ZAI_VISION_MODEL`,
  die Server-Schlüssel, `GITHUB_TOKEN`, `ALERT_WEBHOOK_URL` und `siteUrl()`; die beiden Tagesbudgets waren
  schon sicher. 28 Tests rot gegen den alten Code, 27 Mutationen gefangen.
- **C, #71 und #51.** `GithubIcon` als eigene Komponente (Pfade unverändert aus lucide 0.474, ISC).
  **#51 (`lucide-react` 1.x) bleibt offen**, denn "kein Symbol sichtbar geändert" lässt sich nicht
  behaupten: die erste Sitzung rendert 70 genutzte Symbole beider Versionen und vergleicht Pixel (53
  gleich, 8 kaum, **9 sichtbar anders**: `Menu`, `Moon`, `SunMoon`, `MessageSquare`, `Settings`, `Bookmark`,
  `Building2`, `Sparkles`, `SkipForward`); die zweite vergleicht das Markup der 70 Symbole (**23** anders
  gezeichnet). Dazu setzt 1.x `aria-hidden` standardmäßig. Entscheid ist Kasums.
- **D, #73, Zahlungsweg (K3, Teil).** Webhook gegen die Lemon-Squeezy-Doku gehalten (in der zweiten
  Sitzung erneut gelesen: drei Wiederholungen nach 5, 25 und 125 Sekunden, `order_refunded` bei voller **und**
  teilweiser Erstattung, Status `partial_refund` bei Bestellung und Abo-Rechnung). Behoben: eine
  Teilerstattung stufte auf Free zurück; `subscription_resumed`, `_paused`, `_unpaused` und
  `subscription_payment_recovered` wurden ignoriert; `test_mode` steht jetzt im Protokoll. Browser-Test
  `e2e/billing-webhook.spec.ts` mit selbst signierten Ereignissen (7 Tests). Zwei Mutationsbranches
  (`test/e2e-webhook-mutation-a` und `-b`, ohne PR, "nicht mergen", bleiben bestehen) machten den Test in
  der CI gezielt rot: A (fünf Schranken gebrochen) fünf von sieben, B (Schutz gegen fremde Kundennummer)
  genau "Konto-Übernahme". **Nicht belegt:** ein echtes Ereignis, die Testmodus-Adresse, Preise inklusive
  Mehrwertsteuer, ob `subscription_payment_refunded` auch bei Teilerstattung feuert (der Code behandelt
  `partial_refund` an beiden Stellen gleich, vorsichtig).
- **E, Dateien über 400 Zeilen** (je Datei: Test-Commit, dann der Schnitt mit unveränderten Tests,
  Mutationen vor und nach dem Schnitt, Rebase-Merge, frische CI): `voice-bar.tsx` 403 auf 352 (#74),
  `settings-workspace.tsx` 410 auf 324 (#76), `attachment-store.ts` 422 auf 299 (#77), `sidebar.tsx` 444
  auf 339 (#79), `github.ts` 501 auf 366 (#80), `api-keys.tsx` 496 auf 324 (#82), `rate-limit.ts` 504 auf
  328 (#83). `hero.tsx` (590) bleibt unangetastet (Nicht-anfassen-Liste); sein Eintrag in
  `tests/guards/file-size.test.ts` ist der letzte. Bei `rate-limit.ts` (Ratenlimit, Kontingent,
  Tagesbudgets) hielten vorab 18 neue Tests fest, was kein Test sah (`readDailyServerKeyUsage` gar nicht,
  die einmaligen Warnsignale, `reserveFailoverCall` im Detail, die Tagesgrenze in UTC, Redis nur bei URL
  **und** Token); Reihenfolge der Schranken und Rückgabe der Reservierungen sind unverändert (ein
  Zeilenvergleich vor und nach dem Schnitt zeigt als einzige Änderung `export` vor `const redis`). Der
  lange Kommentar zu `rateLimitKey` stand dort über dem falschen Abschnitt und steht jetzt über seiner
  Funktion. Mutationen: 7 (Seitenleiste), 18 + 18 (`api-keys`), 23 + 25 (`github`), 30 + 34
  (`rate-limit`), alle gefangen, die Dateien aus einmaligen Sicherungen per Hash wiederhergestellt.
  **Zeitfresser gefunden:** jede Testdatei fährt eine jsdom-Umgebung hoch (rund 90 Sekunden je Lauf auf
  diesem Rechner); Servercode läuft mit `vitest --environment=node` in 2 Sekunden.
  **Konflikte im Größen-Guard:** zwei PRs, die benachbarte Zeilen streichen, kollidieren nach dem ersten
  Merge, und GitHub verweigert "Rebase and merge" für einen Branch mit Merge-Commit oder Konflikt (#75
  und #81 mussten als `-v2`-Branch per Cherry-Pick neu eröffnet werden, #76 und #82). Künftig: solche PRs
  nacheinander mergen und den nächsten Branch erst danach anlegen, oder den Guard erst am Ende bereinigen.
- **F, zod 4 (#78, #84, löst Dependabot #50 ab).** #78 nagelt 356 Fälle fest (Statuscode und die ganze
  Antwort je Eingabe, aufgenommen gegen zod 3.25.76). Das bloße Anheben auf 4.6.5 gab **173
  Abweichungen**: **11** durch strenge UUIDs (zod 4 prüft Version und Variante, zod 3 nahm jede
  8-4-4-4-12-Form; eine lockere `conversationId` wäre mit 400 abgewiesen worden), **2** durch
  Zeitstempel im Webhook (zod 4 verlangt Sekunden und `+02:00`, zod 3 nahm `+0200` und Minutengenauigkeit;
  ein abgewiesener Webhook kostet nach drei Wiederholungen die bezahlte Zustellung), **158** nur im
  Wortlaut von `issues[].message`, **2** durch die Vereinigung im API-Key-Endpunkt (zod 3 meldete mehrere
  weiche Fehler einzeln mit eigenem Pfad). Gegenmaßnahmen: `z.guid()`, der Ausdruck von zod 3.25.76 für den
  Zeitstempel, `src/shared/lib/zod.ts` (Meldungsfunktion mit den zod-3-Texten, `responseIssues()` für
  die 400-Antworten) und ein Guard (`tests/guards/zod-import.test.ts`, `z` nur von dort). **Kein
  bestehender Test geändert**, alle 362 Fest-Tests unverändert grün, 48 Mutationen gefangen. Rückbau, falls
  die neuen Texte gewollt sind: `zod.ts` löschen, Importe zurück auf `"zod"`, Fälle neu aufnehmen
  (`RECORD_VALIDATION=1`); das wäre eine sichtbare Änderung der Antworten und gehört Kasum. Nebenfund:
  `src/shared/lib/project-brain.ts` enthält ein rohes NUL-Byte in einem String-Literal, Git behandelt die
  Datei deshalb als binär.
- **Fehler und Korrekturen.** Im Commit-Text von #80 steht "152 Testdateien (2236 Tests)", das war vorab
  eingesetzt und ist falsch (gemessen 158 und 2588); der Commit ist veröffentlicht (kein Force-Push), der
  PR-Text enthält die Korrektur. Ein Kommentar in der Webhook-Route nennt bei einem Datenbankfehler noch
  "500", die Route antwortet mit 503. Beim Pushen neuer Branches lieferte GitHub rund 20 Minuten lang
  "Internal Server Error" (die Status-Seite meldete nichts), danach ging es ohne Änderung durch.
- **Rechner:** `npm run test` lief lokal teils mit Zeitfenster-Fehlern (5-Sekunden-Frist kalter jsdom-Dateien),
  deshalb `--testTimeout=60000 --maxWorkers=4`; die CI war immer grün.

**Abschluss und Dependabot-Durchgang (2026-10-06 abends, PR #66, #67, Dependabot #44, #45, #46,
#49, #56):** Ziel war ein sauberer, grüner, deployter `main`. Jeder Dependabot-PR wurde vor dem
Merge von Dependabot auf den neuen `main` rebased (`@dependabot rebase`), danach lief die CI
frisch durch (Tests, Browser-Tests, Docker).

- **#67.** Beim Kürzen von `CLAUDE.md` auf 450 Zeilen (#66) war die Regel zum Vercel-Bot-Branch
  (Web Analytics nie mergen) verschwunden, obwohl `docs/SETUP.md` darauf verweist. Sie steht
  wieder unter "Arbeitsregeln". `CLAUDE.md` blieb bei 450 Zeilen: zwei Stellen gestrafft, die
  Grenze nicht angehoben.
- **Gemergt, Actions:** #44 `supabase/setup-cli` 1 auf 3 (v3 installiert die CLI über npm statt
  aus GitHub-Releases, die feste Version 2.119.0 geht, der E2E-Lauf belegt es), #45
  `actions/cache` 4 auf 6 (ESM-Umstellung), #46 `actions/upload-artifact` 4 auf 7 (neuer optionaler
  Parameter `archive`). Der Schritt in #46 läuft nur bei Fehlern und lief in keinem grünen Lauf,
  ein Fehler dort ändert das Ergebnis des Laufs nicht.
- **Gemergt, #56 (Sammel-PR, 17 Updates).** "Minor und Patch" täuscht: React 19.0.0 auf 19.3.0
  (fest gepinnt), `@supabase/ssr` 0.5.2 auf 0.12.7, `@anthropic-ai/sdk` 0.111 auf 0.131 und
  `@google/genai` 2.8 auf 2.27 sind bei 0.x-Versionen große Sprünge. Release Notes gelesen: bei
  `@supabase/ssr` eine neue Cookie-Zerlegung (0.6.0) und `cache`-Header an `setAll` (0.10.0),
  nichts davon bricht den Aufrufer; der Anthropic-Code nutzt nur `messages.create` und drei Typen,
  die Änderungen betreffen Beta-Endpunkte und eingestellte Modelle. Gate lokal grün (138
  Testdateien, 2018 Tests), CI inklusive E2E gegen den lokalen Supabase-Stack. **Nicht belegt:**
  ein Login mit echtem Konto in Produktion und ein echter Anbieter-Aufruf mit den neuen
  SDK-Versionen (kein Login in der Sitzung, die Tests mocken die Anbieter). Vermutung, nicht
  geprüft: im ungünstigsten Fall müssen sich bestehende Nutzer wegen des neuen Cookie-Formats
  neu anmelden.
- **Gemergt, #49 `jsdom` 29 auf 30.** Nur Entwicklungsabhängigkeit. Einziger Breaking Change
  laut Release Notes: Node mindestens `^22.22.2 || ^24.15.0 || >=26`. Die CI läuft auf Node
  24.21.0, Kasums lokales Node war am 2026-10-06 24.14.0 und damit darunter. Lokal gemessen: die
  Tests laufen trotzdem (138 Dateien, 2018 Tests grün), `npm ci` meldet nur `EBADENGINE`.
  `.nvmrc` (`24`) und `engines` (`24.x`) erzwingen die Minor-Version nicht.
- **Nicht gemergt, mit Grund:** #50 `zod` 3.25.76 auf 4.6.5 (Typfehler in
  `src/app/api/chat/route.ts` Zeile 314, `$ZodIssue[]` passt nicht; Zod 4 ist ein Umbau von
  `src/shared/lib/schemas.ts` und jeder Route, Laufzeitunterschiede ungeprüft), #51
  `lucide-react` 0.474 auf 1.51 (das Symbol `Github` ist entfernt, einzige Stelle
  `project-brain.tsx` Zeile 227; ein Ersatz ist ein eigenes SVG oder ein anderes Symbol, eine
  Gestaltungsentscheidung), #24 Key-Assistent (Kasum entschied: heute liegen lassen; 49 Commits
  hinter `main`, nach dem Umbau von `llm.ts` und Chat fast ein Neubau; vorher den
  Datenschutz-Punkt zum kostenlosen Gemini-Tarif klären), #1 Vercel-Bot (Draft, bleibt ungemergt).
- **Produktion:** Deployment auf `e5fa7d1` `READY`, `/api/health` ok, die öffentlichen Seiten
  200, `/chats/new` leitet abgemeldet auf `/login` um, CI, E2E und Docker auf `main` grün. Das
  Laufzeit-Log der neuen Deployments hat keine Einträge (kaum Verkehr).
- **Stashes** (`chat-persistence` vom 2026-08-05, `project-brain` vom 2026-08-03) gelesen: ihr
  Inhalt steckt in `main` (Neu-Erzeugen mit `dropReplacedReply`, die Gedächtnis-Dateien, dort
  weiterentwickelt). Nicht gelöscht, das entscheidet Kasum. Der Worktree `speed-insights` war
  sauber und vollständig in `main` und wurde entfernt.

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
