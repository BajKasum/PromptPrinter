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

## 2026-11-27: Dialoge halten den Tastaturfokus, Sidebar und Mobile-Navigation teilen sich die Listen (Branch `refactor/dialog-und-nav-listen`, #368 und #369)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`).
- **#368 (Low):** Portal, Hintergrund und Animation standen dreimal da, und kein Dialog hielt den Fokus. Neu `shared/ui/dialog.tsx`: `Dialog` und darunter der Hook `useModal` (Fokus nach 20 ms hinein, Tab und Shift+Tab laufen im Fenster um, Escape, Rückgabe an den Auslöser), ohne neues Paket. Tasten gelten nur dem obersten Fenster; ein `preventDefault` beim Klick auf den Hintergrund verhindert, dass der Browser den zurückgegebenen Fokus wieder wegnimmt (in jsdom unsichtbar, in Chromium nachgestellt). `ConfirmDialog` (Schnittstelle unverändert), Konto löschen, Neues Projekt und die Befehlspalette bauen darauf auf.
- Folgen: Escape schliesst Konto löschen auch im Zustand „neu anmelden“ (dort geht der Fokus auf Abbrechen), gesperrt ist der Dialog weiterhin nur während des Löschens (hängt das Abmelden, schliessen Escape und der Klick daneben); Escape in Neues Projekt vergisst jetzt auch die Fehlermeldung; Strg+K öffnet unter einem offenen Dialog keine Palette mehr.
- Der mobile Drawer ist ebenfalls ein modaler Dialog (`role`, `aria-modal`, Name „Menü“ neu in fünf Sprachen, fr/it/es ungeprüft): Fokus auf Schliessen, Tab bleibt darin, Rückgabe an den Menü-Knopf, der Hintergrund ist aus der Tab-Reihe. Escape in „Neues Projekt“ aus dem Drawer schliesst nur noch den Dialog.
- **#369 (Low):** Chat- und Projektliste stehen einmal in `shell/components/nav-lists.tsx` (`ChatNavList`, `ProjectNavList`, `navTab`, `ACTIVE_ROW`/`INACTIVE_ROW`); die beiden Ansichten geben Grösse und Schliessen vor. `list-prefetch.test.ts` prüft `HoverPrefetchLink` in dieser Datei und verbietet dort `next/link`, `<Link` und `<a`; `sidebar.tsx` und `mobile-nav.tsx` müssen beide Listen von dort nehmen, für sie bleibt das Verbot bloßer Zeilen-Links. Zwei Einträge aus der Kommentar-Ratsche entfernt.
- **Geprüft:** 45 Mutationen (25 zu #368, 14 zu #369, 6 nach der Durchsicht), alle erkannt; je eine überlebte im ersten Lauf (Startfokus der Rückfrage, Zeile als `<a>`), danach Test bzw. Schranke geschärft. Headless Chromium mit den echten Komponenten (Dev-Server mit Wegwerf-Seite, Supabase-Antworten abgefangen): 42 von 42 für Tab, Shift+Tab, Escape, Klick daneben, Fokus-Rückgabe und Drawer auf Telefonmass; nach reinem Antippen zeigt der Drawer keinen Fokusring.
- **Gate:** grün auf `9a9434b4` (Audit sauber, Typecheck, Lint, 4739 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet); nach der Durchsicht auf `82ab2bef` Typecheck, Lint und 733 Tests aus Einstellungen, Shell, `shared/ui` und Schranken grün (2 übersprungen).
- **Nicht geprüft:** in der laufenden App mit Login, Safari, Firefox, echtes Handy oder Tablet, Bildschirmleser; „Neues Projekt“ aus dem Drawer nicht im Browser (nur das Stapeln zweier Fenster im Test).

## 2026-11-27: Anbieteraufrufe nennen jedes Feld, UUID-Prüfung, begrenzter Leser und Gedächtnis-Grenzen stehen je einmal (Branch `refactor/llm-aufrufe-doppeltes`, #364 und #394)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`).
- **#364 (Low):** Die Funktionen der Anbieter nahmen bis zu neun Positionsparameter, mehrere Strings hintereinander: vertauscht kompilierte der Aufruf weiter, und der Key wäre als Prompt an den Anbieter gegangen. Jede nimmt jetzt ein Objekt (`ProviderChatCall`, `ProviderStreamCall`, `ProviderAnalyzeCall` in `server/llm/types.ts`, beim eigenen Endpunkt mit `endpoint` und `source`; ohne `source` gilt weiter die strenge Prüfung). Auch die mit fünf Parametern, damit es eine Form gibt. Verhalten unverändert. `llm/call-shape.test.ts` liest den Quelltext und verlangt genau einen Parameter (`Function.length` zählt Vorgabewerte nicht).
- **Lücke dabei:** Dass Abbruch und Fristen beim eigenen Endpunkt des Betreibers (`LLM_BASE_URL`) ankommen, prüfte kein Test; der Weg steht jetzt bei den Fristen in `llm/stream-deadlines.test.ts`.
- **#394 (Low), UUID:** `isUuid` (`shared/lib/uuid.ts`) ersetzt die Kopien in der Status-Route des Gedächtnisses, `chat-wire.ts` (samt `chat-thread.tsx`), `model-history.ts`, `cli-login/saved-prompts.ts` (`isPromptId` entfällt) und in `isSavedPromptId`. Das globale Muster in `speed-insights-event.ts` ersetzt UUIDs mitten in einer Adresse und bleibt, ebenso die Prüfung in `cli/` (eigenes Paket). `uuid.test.ts` verhindert eine neue verankerte Kopie in `src/`.
- **#394, begrenzter Leser:** `readCappedStream` (`server/http/capped-stream.ts`) für Anfragen und Antworten. Über der Grenze bricht es den Strom ab, ohne darauf zu warten; die Fassung für Antworten liess den Rest ungelesen weiterlaufen. Der GitHub-Import braucht dafür kein eigenes `cancel` mehr.
- **#394, Gedächtnis-Grenzen:** `BRAIN_LIMITS` (`shared/lib/project-brain.ts`) für Schema und `salvageFacts`; wäre eine Grenze nur im Schema gesenkt worden, hätte das Lesen das Gedächtnis verworfen.
- **CLI-Vertrag:** in den gepinnten Dateien entfällt nur `isPromptId` (gleiches Muster), das Programm bleibt unverändert. Weil damit `shared/lib/uuid.ts` entscheidet, welche Kennungen die Terminal-App abrufen kann, steht die Datei jetzt in `cli/scripts/check-contract.mjs` und `contract/pins.json`.
- **Geprüft:** 27 Mutationen an den neuen Schranken; zwei überlebten zuerst (Signal beim eigenen Endpunkt, UUID-Filter im Modell-Verlauf), beide mit neuen Tests erkannt. Am gebauten Standalone-Server bekommen zu grosse Anfragen an `/api/contact` (mit und ohne `content-length`, 3 MB, tröpfelnd) weiter 413, ohne Fehler im Log.
- **Gate:** grün auf `b24b0c0f` (die drei Commits dieses Branches auf `main` bei `ed015086`; Audit sauber, Typecheck, Lint, 4712 Tests, 2 übersprungen, Build mit den Platzhaltern der CI); in `cli/` `check`, `contract` und 179 Tests (3 übersprungen) mit `--test-concurrency=2` grün.
- **Nicht geprüft:** gegen keinen echten Anbieter, nicht gegen GitHub live, nicht im Browser und nicht auf Vercel, E2E nicht lokal.

## 2026-11-27: Marketing-Bausteine und Vorschaukarte beim Teilen je einmal (Branch `refactor/marketing-bausteine`, #414 und #367)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), reiner Umbau.
- **#414 (Low):** Kopf und Fuss der Aufgaben- und Vergleichsseiten samt Breadcrumb-, Artikel- und FAQ-Daten stehen in `features/marketing/components/article-shell.tsx`, die nummerierte Anleitung von /skill, /terminal (beide Listen, zwei Töne) und /mcp in `step-list.tsx` (Typ `InstallStep`), die Pille in `shared/ui/pill-switch.tsx` (App als Link mit `aria-current`, Vorschau der Landing als Knopf, neu mit `aria-pressed`). `TabSwitcher` behält Props und Ausgabe. Die zwei falschen Kommentare in `product-showcase.tsx` sind berichtigt, `hero.tsx` ist unverändert. Zwei Einträge aus der Kommentar-Ratsche entfernt.
- **#367 (Low):** `features/marketing/lib/social-card-image.tsx` zeichnet die Karte der Startseite und die der Unterseiten (Farben als Konstanten, ein `displayHost()`), beide Routen laufen weiter auf der Edge-Runtime. Das Etikett „v2.0 Beta“ ist unverändert, als Parameter in `app/opengraph-image.tsx`; ob es bleibt, ist offen.
- **Gemessen** (Dev-Server, vorher gegen nachher): das gerenderte HTML ohne Skripte der 9 Artikelseiten, von /skill, /terminal und /mcp ist gleich, auf der Startseite weichen nur `aria-pressed` und die Prüfsumme der `og:image`-Adresse ab. 22 OG-Bilder byte-gleich, unbekannte Karten weiter 404. Die Prüfsumme folgt nur `opengraph-image.tsx`: eine Änderung allein in `social-card-image.tsx` ändert das Bild, aber nicht die Adresse.
- **Geprüft:** 21 Mutationen an den neuen Tests, alle erkannt.
- **Gate:** grün auf `85538948` (Audit sauber, Typecheck, Lint, 4693 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet); danach auf `ba047af5`, wo das geschützte Leerzeichen des Slogans als ` ` im Quelltext steht, Typecheck, Lint und 35 betroffene Tests grün.
- **Nicht geprüft:** nicht im Browser angeschaut, nicht gegen Produktion, Browser-Tests (E2E) nicht lokal.

## 2026-11-27: Neun Exporte ohne Aufrufer und die Reste der Tool-Auswahl sind entfernt (Branch `refactor/toter-code-362-409-v2`, #362 und #409)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`): toter Code und Reste entfernter Funktionen.
- **#362 (Low):** Entfernt samt Tests: die drei Avatar-Regeln aus `features/settings/lib/avatar.ts` (Reste des Profilbild-Uploads; es bleibt `avatarStoragePath` für „Konto löschen“), `slugify`, `attachmentPathsOfUser`, `turnstileEnabled`, `StatCardSkeleton`, `MAX_FILE_BYTES` und `ContactInput`. Eine Schranke gegen Exporte ohne Import (Guard oder `knip`) ist nicht gebaut.
- **#409 (Low):** `badge` an `SettingsCard`, `mono` an `InfoRow`, `toolList` und `ProjectTools` sind weg. Projektliste, `getProject` und Projektkontext fragen `projects.tools` nicht mehr an; die Suche der Projektliste findet nur noch am Namen, ihre Texte nennen keine Tools mehr (fr, it, es nicht von Muttersprachlern geprüft). Die Spalte bleibt (#140), der Datenexport liefert sie weiter vollständig, ein Test hält das fest.
- **Geprüft:** 5 Mutationen an den neuen Tests (Suche, Export), alle erkannt.
- **Gate:** grün auf `01054d9f` (Audit sauber, Typecheck, Lint, 4637 Tests, 2 übersprungen, Build mit den Platzhaltern der CI).
- **Nicht geprüft:** nicht im Browser angesehen.

## 2026-11-27: Ein Upstash-Client, atomarer Zähler im Leistungsschalter, Testcode aus dem Produktivbaum (Branch `fix/redis-client-und-testcode`, #393 und #363)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`).
- **#393 (Low):** Datei-Cache, Alarm-Drosselung und Leistungsschalter bauten sich je einen eigenen Upstash-Client. Gebaut wird nur noch in `server/security/redis-client.ts`: `redis` für Zähler und Marken, `rawRedis` (ohne JSON-Auswertung) für den Dateitext. Der Schalter zählte mit `incr` und danach `expire`; scheiterte der zweite Befehl, blieb der Zähler ohne Ablauf, und drei Ausfälle über Wochen hätten ihn geöffnet. Jetzt eine Transaktion mit `NX` wie in `reserve-counter.ts`; ein liegengebliebener Zähler bekommt beim nächsten Ausfall seinen Ablauf. Bisher latent, weil der Failover aus ist. Ohne Redis-Werte läuft alles wie bisher. Neuer Guard `upstash-client.test.ts`: unter `src/` holt nur `redis-client.ts` das Paket als Wert.
- **#363 (Low):** Die Redis-Attrappe `redis-double.ts` liegt unter `tests/support/` statt unter `src/server/security/` (dort zählte sie in der Abdeckung als Produktivdatei). Die vier `__…ForTests`-Exporte bleiben (kleinster Schritt aus dem Issue); `tests/guards/test-code-in-src.test.ts` lässt solche Namen außerhalb von Testdateien nur an der Deklaration zu und verbietet unter `src/` jeden Import aus `tests/`.
- **Geprüft:** 14 Mutationen an den neuen Schranken, alle erkannt.
- **Gate:** grün auf dem Stand von `71ba00fd` (Audit sauber, Typecheck, Lint, 4655 Tests, 2 übersprungen, Build mit den Platzhaltern der CI).
- **Nicht geprüft:** gegen kein echtes Upstash (Attrappen; der Datei-Cache mit dem echten Client gegen eine nachgestellte REST-Schnittstelle), kein Failover gegen echtes Gemini, E2E nicht lokal.

## 2026-11-27: Die Terminal-App nennt Z.ai nur noch, wenn es stimmt, und der Vertrag prüft die Fehlerarten des Chats (Branch `fix/terminal-app-411-389`, #411 und #389)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`) an der Terminal-App.
- **#411 (Low):** Vor `/pp --kontext` stand ohne eigenen Key bei jedem Server „Z.ai in Singapur“ als Empfänger des Codes, auch bei einer eigenen Installation mit lokalem Modell. `GET /api/cli/me` meldet jetzt `serverModel: "zai"`, aber nur, wenn ein Zug auf dem Server-Key allein an Z.ai geht (nicht bei Gemini, eigenem Endpunkt oder mit beiden Server-Keys und damit Ausweich-Anbieter), nur als Kennung ohne Adresse, Modell oder Key. Die Terminal-App nennt Z.ai nur auf der voreingestellten Adresse mit dieser Angabe; sonst, auch bei einem Server ohne das Feld, „PromptPrinter unter <Adresse> und das Modell, das dieser Server nutzt“ (`recipientMessage` in `cli/src/account.mjs`, de und en). Ein anderer Server kann den Empfänger damit nicht selbst benennen, bewusst. Alte Terminal-Versionen ignorieren das Feld. Datenschutz unverändert.
- **#389 (Low):** Die Terminal-App unterschied noch `chatMessages`, die Art des entfernten Monatskontingents; Zweig, Text `quota`, `ApiError.limit` und die zwei Testzeilen sind weg. `tests/guards/cli-contract.test.ts` prüft jetzt, dass jede Art, nach der `cli/src` fragt (`err.kind`), von einem `problem(…)` in `api/chat`, `api/cli` oder `server/model-call.ts` gesendet wird. Keine neuen Prüfsummen: sie meldeten jede Änderung dieser Dateien, ohne die Art zu prüfen. Nur `api/cli/me` ist in `cli/contract/pins.json` neu.
- **Geprüft:** 16 Mutationen an den neuen Schranken, alle erkannt.
- **Gate:** grün auf `9f8458c4` (die zwei Commits dieses Branches und `main` bei `79b3f6a2`; Audit sauber, Typecheck, Lint, 4617 Tests, 2 übersprungen, Build mit den Platzhaltern der CI); in `cli/` `check`, `contract` und 179 Tests (3 übersprungen) mit `--test-concurrency=2` grün. Unter Last fielen vorher Tests zum Ordner-Kontext (`context.test.mjs`, `pp-kontext.test.mjs`): `git` braucht dann länger als die Zeitgrenzen in `context.mjs`, dieselben Tests fielen so auch auf `main`.
- **Nicht geprüft:** gegen keinen echten Server und kein echtes Terminal (Stub-Server, Eingabezeile im Test); `npm run mutation` in `cli/` nicht als Ganzes (die neuen Zeilen einzeln, alle 117 Zeilen finden ihre Stelle).

## 2026-11-27: Der Chat sagt jeden Status nur noch einmal an, fertige Nachrichten bleiben beim Streamen und Tippen stehen (Branch `fix/chat-liveregion-neuzeichnen`, #444 und #418)

- **#444 (Low):** `chat.tsx` trug zwei gleiche `aria-live`-Bereiche, ein Bildschirmleser sagte jeden Status doppelt an. Jetzt einer; der Test zählt mit `querySelectorAll`.
- **#418 (Low):** Jedes Textstück und jeder Tastendruck zeichnete den ganzen Verlauf neu und parste jede Antwort erneut. `MarkdownMessage`, Antwortblase, Ergebnis-Panel und die eigene Frage sind jetzt `memo`, die Rückrufe an den Verlauf behalten über `hooks/use-stable-callback.ts` ihre Identität. Der Zustandsautomat bleibt; `pending` aus `<Chat>` zu lösen hätte ihn umgebaut und das Tippen nicht mitgelöst.
- **Gemessen** (React Profiler in jsdom, 100 Nachrichten mit 50 Antworten, Schreibanimation eingefroren, drei Läufe): je Textstück 50 alte Antworten neu geparst, jetzt 0, Commit 813 bis 942 ms, jetzt 31 bis 39 ms; je Taste ebenso 50, jetzt 0, 797 bis 1103 ms, jetzt 20 bis 32 ms. Die Millisekunden gelten nur für jsdom. Je gesendeter Nachricht werden die Antworten weiterhin einmal neu geparst (der Massstab der Prompt-Prüfung ändert sich dann).
- **Nebenfund, mitbehoben:** Im Ergebnis-Panel stand nach „Prompt kopieren“ nie „Kopiert“: das Feiern zeichnete das Panel neu, und der Codeblock wurde dabei neu eingehängt.
- **Geprüft:** 9 Mutationen an den neuen Schranken, alle erkannt.
- **Gate:** grün auf `e13894f6` (Audit sauber, Typecheck, Lint, 4586 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet); nach dem Merge von `main` (`79b3f6a2`) Typecheck und 1679 Tests aus `src/features/chat`, `src/shared/lib`, `tests/guards` grün.
- **Nicht geprüft:** in der laufenden App, auf einem echten Gerät, mit einem Bildschirmleser. Noch offen: die laufende Antwort hängt ihr Markdown bei jedem Schritt neu ein (die Komponenten in `MarkdownMessage` entstehen je Rendern neu).

## 2026-11-27: Satz auf der globalen Fehlerseite berichtigt, Projekt-Chats laden die gespeicherten Prompts mit Grenze (Branch `fix/fehlerseite-projekt-chats`, #401 und #399)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`).
- **#401 (Low):** Auf der globalen Fehlerseite stand "Versuch es erneut , wenn das Problem bleibt, ...". Jetzt zwei ganze Sätze, sonst ist an `global-error.tsx` nichts geändert.
- **#399 (Low, Leistung):** Die beiden Chat-Seiten eines Projekts lasen alle gespeicherten Prompts des Projekts mit vollem Text, ohne Grenze und Sortierung, und gaben sie an den Chat weiter, also in die ausgelieferte Seite. Jetzt wie in den Chats ohne Projekt: neueste zuerst, höchstens `SAVED_PROMPTS_LOAD_LIMIT` (200); ob das Projekt Ergebnisse hat, kommt weiter aus `count`. Folge: der Abgleich "schon gespeichert?" kennt auch im Projekt nur die neuesten 200. Verlaufskommentare der beiden Seiten angeglichen, zwei Einträge aus der Kommentar-Ratsche entfernt.
- **Geprüft:** `global-error.test.tsx` und `projects/[id]/chats/saved-prompts.test.tsx` (Nachbau sortiert, kappt und zählt wie PostgREST); 17 Mutationen, alle erkannt.
- **Gate:** grün auf `4ae3f675` (Audit sauber, Typecheck, Lint, 4589 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet).
- **Nicht geprüft:** nicht im Browser oder gegen echtes Supabase, die Browser-Tests (E2E) nicht lokal.

## 2026-11-27: Die Mobile-Navigation gibt beim Verbreitern das Scrollen frei, die Befehlspalette liest bei jedem Öffnen neu und markiert nach jeder Suche den ersten Treffer (Branch `fix/app-rahmen-424-420`, #424 und #420)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide am App-Rahmen (`src/shell/`).
- **#424 (Low):** Der Drawer der App ist ab 768 px nur per CSS weg (`md:hidden`), `open` blieb wahr und mit ihm `overflow: hidden` auf `body`: nach dem Drehen eines Tablets oder dem Breiterziehen liess sich die Seite erst nach einem Neuladen scrollen. Solange er offen ist, beobachtet er jetzt `(min-width: 768px)` und schliesst sich dort, wie die Navbar der öffentlichen Seiten.
- **#420 (Low):** Die Palette bleibt im Layout gemountet und las Chats und Projekte nur beim ersten Öffnen. Jetzt liest sie bei jedem; die vorige Liste bleibt bis zur Antwort stehen, nach einem Lesefehler auch darüber hinaus (vorher leerte ein Fehler die Liste), eine verspätete Antwort eines früheren Öffnens wird verworfen. Jede Sucheingabe markiert den ersten Treffer, die Pfeiltasten bleiben an beiden Enden stehen. Die Markierung hängt am Eintrag statt an der Zeilennummer: weil die frische Liste nun auch bei offener Palette ankommt, hätte Enter sonst ein anderes Ziel geöffnet. Die Maus wählt erst, wenn sie sich bewegt (`onMouseMove`), ohne eigenen Hover-Stil: mit `onMouseEnter` nahm sich eine Zeile, die unter dem ruhenden Zeiger erschien, die Markierung.
- **Nebenbei:** Der Wettlauf in `command-palette.test.tsx` ("merkt sich den Fokus bei jedem Öffnen neu") ist behoben, der Test wartet vor Escape auf den Fokus. Kommentare der Palette ohne Verlauf, ihr Eintrag in `comment-history.baseline.json` entfällt.
- **Geprüft:** 16 Mutationen, alle erkannt (4 zu #424, 12 zu #420). Headless Chromium mit den echten Komponenten (Dev-Server mit Wegwerf-Seite, Supabase-Antworten abgefangen): 14 von 14, vor dem Entfernen der Hover-Klasse.
- **Gate:** grün auf `ed4b9a8d` mit Basis `1da82d8e` (Audit sauber, Typecheck, Lint, 4595 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet).
- **Nicht geprüft:** in der laufenden App mit Login, Safari, Firefox, echtes Handy oder Tablet.

## 2026-11-27: Anhang-Pfade werden sortiert gelesen, Projektdateien nennen Grössen in MB und in der Sprache der App (Branch `fix/speicher-422-419`, #422 und #419)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`) rund um Speicher und Grössenangaben.
- **#422 (Low):** Die drei Abfragen in `shared/lib/attachment-storage.ts` blätterten ohne `.order`. Zwei Seiten durften sich überschneiden: beim Löschen eines Chats oder Projekts mit mehr als 1000 Anhängen konnte eine Datei als Waise im Bucket bleiben (bei den Projektdateien seit #131 behoben, diese Datei blieb damals aussen vor). Alle drei sortieren jetzt nach `id` und lesen über `collectStoragePaths`, die zweite Seitenschleife und Seitengrösse sind weg. `keepPartialOnError` liefert beim Löschen von Chat und Projekt weiter die Teilliste, ohne den Schalter wirft die Funktion wie bisher (Konto löschen, Abgleich-Skript); ihr zweiter Parameter ist jetzt ein Optionsobjekt.
- **#419 (Low):** Zwei `formatBytes`; die der Projektdateien kannte weder Megabytes noch Sprache ("25600 KB"). Es gibt eine, in `shared/lib/utils.ts`, `chat-attachments.ts` re-exportiert sie. Der Sprach-Tag ist Pflicht, `project-files.tsx` übergibt den der App-Sprache. Unter 10 KB stehen dort jetzt ganze Kilobyte wie im Chat ("2 KB" statt "1.5 KB").
- **Geprüft:** je Issue neue Tests (1003 Anhänge über zwei Seiten für alle drei Abfragen; 25 MB, 2 MB und 900 Byte in de und en, Komma in fr); 16 Mutationen, je 8, alle erkannt.
- **Gate:** grün auf `8fe9cd45` (Audit sauber, Typecheck, Lint, 4613 Tests, 2 übersprungen, Build mit den Platzhaltern der CI).
- **Nicht geprüft:** gegen echtes Supabase und einen echten Bucket, nicht im Browser, E2E nicht lokal.

## 2026-11-26: Formulare zeigen keine Browser-Meldungen mehr, Key entfernen und Escape im Prompt-Editor fragen nach, Kopieren scheitert nicht mehr still (Branch `fix/rueckmeldung-408-407-421`, #408, #407 und #421)

- **Ziel:** drei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), alle dazu, was jemand nach einem Fehlschlag oder vor einem Verlust zu sehen bekommt.
- **#408 (Low):** Acht Komponenten zeigten `error.message`: bei einer HTML-Antwort den SyntaxError von `res.json()` ("Unexpected token '<' ..."), ohne Netz "Failed to fetch" in jeder Sprache auf Englisch. Neu ist `shared/lib/read-problem.ts`: JSON liest der Browser nur bei einem JSON-`content-type`, seine Meldung zeigt nur ein `UserError` (`detail` der Route oder ein Wörterbuch-Text), ein `TypeError` wird zu `common.networkError`, alles andere zum Ersatztext der Aktion. Ein "ok" ohne JSON gilt bei Key speichern, Projekt anlegen und Probelauf als Fehlschlag. "Neues Passwort" zeigt auch Supabases Wortlaut nicht mehr (Status 0: Verbindung, "zu schwach" und "zu lang" eigene Sätze, sonst `UNKNOWN_AUTH_ERROR`). `project-files.tsx` stand in der Liste, zeigte schon vorher nur eigene Sätze; ein Test hält es fest.
- **#407 (Low):** Der Papierkorb eines eigenen Keys löschte sofort, Escape im Prompt-Editor verwarf alle Änderungen. Jetzt fragt der `ConfirmDialog` (Anbieter und eigener Endpunkt), und Escape fragt "Änderungen verwerfen?", sobald der Text abweicht; während `isComposing` und während des Speicherns passiert nichts. Das `stopPropagation` beim Öffnen ist nötig: ohne schliesst sich die Rückfrage im Browser durch dasselbe Escape wieder, jsdom zeigt das nicht (in headless Chromium nachgestellt).
- **#421 (Low):** `useCopyToClipboard` fing eine Ablehnung nicht ab, per http (Selbstbetrieb) warf jeder Kopierknopf und zeigte nichts. `copy` wirft jetzt nie, nimmt ohne oder gegen die Clipboard-API den Weg über ein markiertes Hilfsfeld und meldet einen Fehlschlag per Toast, auf `/geteilt/<token>` (kein ToastProvider) am Knopf und im Formular. Der Zugang zu den Toasts liegt in `shared/ui/toast-context.ts`. Timer in einer Ref, beim Aushängen gelöscht.
- **Geprüft:** 48 Mutationen an den neuen Schranken, alle erkannt. Headless Chromium mit den echten Komponenten (per Vite gebaut): 23 von 23, darunter das Kopieren per http mit nachgelesener Zwischenablage.
- **Gate:** grün auf `86f62cec` mit den Commits dieses Branches und `main` bei `60f278cb` (Audit sauber, Typecheck, Lint, 4472 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet).
- **Nachtrag nach roter Pflichtprüfung:** Ein Test der Escape-Rückfrage drückte das zweite Escape, bevor `ConfirmDialog` (nach 20 ms) den Fokus hatte; auf dem CI-Läufer blieb die Rückfrage offen. Er wartet jetzt auf den Fokus (nur der Test geändert, danach Audit, Typecheck, Lint, Build und ein voller Testlauf mit zwei Workern grün, 4582 Tests). Denselben Wettlauf hat `command-palette.test.tsx` ("merkt sich den Fokus bei jedem Öffnen neu"), noch offen.
- **Nicht geprüft:** in der laufenden App mit Login, Safari, Firefox, iOS, eine echte Eingabehilfe. Texte in fr, it, es nicht von Muttersprachlern geprüft. Nebenbei gefunden, nicht Teil des Branches: im Chat zeigt ein Netzfehler weiter "Failed to fetch" (`run-chat-turn.ts`); die Karte eines gespeicherten Prompts zuklappen verwirft Änderungen im Editor; Escape im Key-Feld des eigenen Endpunkts leert das Formular.

## 2026-11-26: Ein Antwort-Strom hat eine Frist je Zug, auch bei Gemini als Server-Anbieter, und abgeschnittene oder gefilterte Antworten gelten nicht mehr als fertig (Branch `fix/llm-strom-392-404-403`, #392, #404 und #403)

- **Ziel:** drei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), alle am Weg der Antwort vom Anbieter in den Chat; zwei weitere Sitzungen liefen parallel mit je drei anderen Issues.
- **#392 (Low):** Der Server-Zweig von Gemini lief ohne Leerlauf- und Gesamtfrist, jetzt in `withDeadlines`. Dabei gefunden und mitbehoben: Die SDKs von OpenAI und Anthropic beenden einen abgebrochenen Strom ohne Fehler (mit den echten SDKs belegt), eine abgelaufene Frist oder ein Stopp liess den halben Text als fertige Antwort durchgehen; Gemini macht aus dem TimeoutError einen eigenen AbortError. `withDeadlines` wirft jetzt immer den Grund des Signals.
- **#404 (Low):** Die Gesamtgrenze entstand in jedem Versuch neu (schlimmstenfalls rund 330 s bei Z.ai, 390 s beim eigenen Endpunkt). Jetzt legt `chatCompleteStream` mit `turnDeadline` eine Frist je Zug an, für alle Versuche, Wartezeiten und den Failover; `streamDeadlines` kennt nur noch die Frist bis zum ersten Textstück und die Leerlauf-Frist. Chat- und Probelauf-Route nennen den Beginn der Anfrage, damit die Schritte vor dem Modell mitzählen: spätestens 285 s danach ist Schluss.
- **#403 (Low):** Kein Weg las den Abschlussgrund. Neu `server/llm/finish.ts` für alle Wege (Z.ai, eigene Endpunkte, drei SDKs, Strom und Einzelaufruf). Abgeschnitten (Ausgabegrenze): gespeichert wie jede Antwort, `done.truncated`, Hinweis „Gekürzt“ an der Antwort, ohne Migration im Speicher des Tabs bis zum Neuladen, auch über den Wechsel von `/chats/new` auf `/chats/[id]`. Inhaltsfilter und gemeldete Fehler (`error` im Strom, `object: "error"`, `event: error`, `finish_reason` `error`, `network_error`, `insufficient_system_resource`) enden wie jeder Fehler; die beiden Ausfälle zählen als 503 (neuer Versuch, Failover), ein Filter zeigt die Meldung der leeren Antwort. Zum Kommentar im Issue (Strom ohne Abschlussgrund): ohne Grund und ohne `[DONE]` ist die Antwort nicht zu Ende; `[DONE]` ohne Grund ebenso bei Z.ai (die SDKs brauchen immer einen Grund), bei fremden Endpunkten gilt sie als fertig, damit kein funktionierender Server den Hinweis an jeder Antwort bekommt. Die Terminal-App zeigt den Hinweis in der Eingabezeile und im MCP-Ergebnis, ihr Weg ohne Konto wertet `finish_reason` ebenso aus; in `cli/contract/pins.json` nur `chat-stream.ts`.
- **Nebenfund:** `PlaceholderForm` und `PromptActions` im Ergebnis-Panel hatten denselben React-Key; mit dem neuen Hinweis davor baute React das Formular beim Tippen neu auf (zwei bestehende Tests schlugen an).
- **Geprüft:** alle sechs Wege zum Modell mit den echten SDKs, nur `fetch` ersetzt (`stream-deadlines.test.ts`, `finish.test.ts`); Frist je Zug mit künstlicher Uhr (zwei späte 502 und ein langsamer Strom enden bei 270 s, auch über den Failover; Ablauf während einer Wartezeit ohne weiteren Versuch). Mutationen, alle erkannt: 3 zu #392, 11 zu #404, 43 zu #403 und 9 in der Terminal-App. Bildprobe des Hinweises headless (hell, dunkel, Handybreite).
- **Gate:** grün auf `43a84b2a` mit den drei Commits dieses Branches und `main` auf `60f278cb` (Audit sauber, Typecheck, Lint, 4482 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet); in `cli/` `npm run check` und 178 Tests (3 übersprungen) mit `--test-concurrency=2` grün, mit voller Parallelität unter Last einmal die Zeitgrenze in `context.test.mjs`.
- **Nicht geprüft:** gegen keinen echten Anbieter, nicht in der laufenden App im Browser (kein Supabase-Stack), fr/it/es nicht von Muttersprachlern; `insufficient_system_resource` (DeepSeek) und `model_length` (Mistral) nicht an der offiziellen Doku nachgelesen.

## 2026-11-26: Die Anmeldung behält die Abfrage der Zieladresse, das Abmelden im Terminal prüft zuerst das Token, die App-Seiten fragen den Auth-Server nicht mehr selbst (Branch `fix/anmeldung-396-390-405`, #396, #390 und #405)

- **Ziel:** drei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`) an Anmeldung und Sitzung; zwei weitere Sitzungen lösten parallel je drei andere Issues.
- **#396 (Low):** Die Weiterleitung auf `/login` merkte sich nur den Pfad und liess die alten Parameter an der Anmeldeadresse hängen: abgemeldet auf `/chats/new?from=<id>` öffnete sich nach der Anmeldung ein leerer Chat ohne den Ausgangs-Prompt. Beide Weiterleitungen der Middleware (Anmeldung, zweiter Faktor) bauen die Adresse jetzt in `redirectWithNext`: Abfrage geleert, `next` aus Pfad plus Abfrage. Gelesen wird `next` weiter nur über `safeNextPath`. `/api/auth` begrenzt `next` bei Registrieren und erneutem Senden auf 512 Zeichen; über die App ist das nicht erreichbar, die Middleware schickt nur nach `/login`, und der Link zur Registrierung nimmt `next` nicht mit.
- **#390 (Low, Sicherheit):** `/api/cli/logout` fragte `cli_sessions` mit dem Service-Role-Client nach Sitzung und Konto aus dem ungeprüften JWT: mit Werten, die keine UUID sind, 503 und ein Eintrag im Fehlerprotokoll, mit bekannten Kennungen ein Schreibzugriff auf eine fremde Zeile. Jetzt fragt `revokeCliSession(token, { terminalOnly: true })` zuerst den Auth-Server und liest die Tabelle erst danach, über das neue `isCliSession`, das nichts schreibt. `api/cli/token` ruft `revokeCliSession` ohne den Schalter. Eine Sitzung über dem Höchstalter meldet sich jetzt mit 200 ab (ein Ereignis `via: terminal`); vorher beendete die Prüfung sie, und der folgende Aufruf beim Auth-Server hätte sie abgelehnt. Die Terminal-App erneuert ein abgelaufenes Zugriffstoken vor dem Abmelden selbst (`cli/src/account.mjs`, `session.mjs`) und bleibt unverändert, nur der Pin der Route in `cli/contract/pins.json` ist neu.
- **#405 (Low, Leistung):** Fünf Seiten unter `src/app/(app)/` riefen `auth.getUser()` selbst auf, obwohl das Layout den Nutzer je Anfrage schon geholt hatte: mit der Middleware drei Netzaufrufe je Seitenaufbau, wo zwei reichen. Sie nehmen `getSessionUser()`; neue Schranke `tests/guards/app-pages-session.test.ts` (Parser) meldet jeden Zugriff auf `getUser` unter `src/app/(app)/`. `/settings` liest `user_api_keys` einmal statt dreimal (`getByokOverview` in `server/byok.ts`). Kommentar-Ratsche für `byok.ts` von 5 auf 3.
- **Geprüft:** je Issue neue Tests; neun Mutationen, alle erkannt: #396 zwei (alte Abfrage bleibt an `/login`, `next` nur aus dem Pfad), #390 drei (Prüfung gegen die Tabelle entfernt, Tabelle vor dem Auth-Server, Route ohne `terminalOnly`), #405 vier (je `chats` und `settings` zurück auf `auth.getUser()`, zweite Abfrage in `/settings`, `getByokOverview` ohne `user_id`). Der Logout-Test läuft mit dem echten `session.ts` und `sessions.ts`, nur der Service-Role-Client ist nachgebaut.
- **Gate:** grün auf `fa85fe2a` (Audit sauber, Typecheck, Lint, 4372 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet). Am gebauten Stand (`next start` mit Platzhaltern, Anfragen ohne Browser) stehen bei `/chats/new?from=…` und `/projects/…/chats/new?from=…&tab=…` Pfad und ganze Abfrage in `next`, `_rsc` entfernt Next vorher. In `cli/` `npm run check` und `npm test` (173 Tests, 3 übersprungen); bei parallelen Läufen anderer Sitzungen fiel viermal je ein Test in `test/context.test.mjs` an der Zeitgrenze des Kontextpakets (2,5 s), dieselbe Datei lief danach auf diesem Branch und auf einem Export von `main` grün, ebenso der volle Lauf. Der Branch ändert in `cli/` nur den Pin.
- **Nicht geprüft:** gegen echtes Supabase (wie GoTrue ein gefälschtes oder beendetes Token ablehnt, steht in den Attrappen, im Kommentar der Migration 0054 und in `auth-js`), nicht im Browser, die Browser-Tests (E2E) nicht lokal.

## 2026-11-26: Nicht mehr auf die CI warten, gemergt wird per Auto-Merge (Branch `docs/merge-ohne-warten`)

- **Ziel:** Kasum am 2026-11-26: nicht mehr warten, bis alles grün ist, keine Timer. Was zählt: gepusht, auf GitHub, korrekt deployed, keine Fehler. Ein rotes Kreuz ist kein Notfall.
- **Jetzt:** nach dem PR sofort `gh pr merge <nr> --rebase --auto` (`CLAUDE.md`, Ablauf Schritt 3). GitHub mergt, sobald die Pflichtprüfung des Rulesets auf `main` („Typecheck · Lint · Test · Build“) durch ist; E2E, CodeQL und Docker laufen weiter, niemand wartet auf sie. Entfallen sind das Warten auf die ganze CI, das Erneuern eines Laufs, der älter als ein paar Stunden ist, und das zeitversetzte Nachsehen der Sitzungen.
- **Bleibt:** das lokale Gate vor dem Push, Rebase-Merge, keine Branches löschen, kein Auto-Merge für Dependabot.
- **Voraussetzung:** „Allow auto-merge“ in den Einstellungen des Repos, auf Kasums Ja am 2026-11-26 eingeschaltet (nachgelesen: `allow_auto_merge: true`).

## 2026-11-26: Die Gedächtnis-Route antwortet auf eine Kennung, die keine UUID ist, mit 404 und meldet kein fertiges Gedächtnis mehr, das während der Analyse gelöscht wurde (Branch `fix/gedaechtnis-route-397-406`, #397 und #406)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide in `app/api/projects/[id]/brain/route.ts`; #400 und #410 (Terminal-App) sowie #391 und #398 liefen parallel in eigenen Sitzungen.
- **Vorab ein Umbau:** Die Route stand bei 396 von 400 Zeilen (`tests/guards/file-size.test.ts`), schon #397 allein hätte sie darüber gebracht. Der Fehlerweg der Analyse (Fehlerprotokoll, Status `failed`, stabiler Code und Text in der App-Sprache) zog unverändert nach `src/server/brain/analysis-failure.ts`, mit eigenem Test; die Route hat am Ende 372 Zeilen. Ihre Kommentare nennen keine Auditkennungen mehr (der Eintrag in `comment-history.baseline.json` entfällt), die des Routentests haben Umlaute.
- **#397 (Low):** POST und DELETE reichten die Kennung aus der Adresse ungeprüft an Postgres, das eine Kennung, die keine UUID ist, mit einem Fehler ablehnt: 503 und je Aufruf ein Eintrag `brain.project_read_failed` im Fehlerprotokoll. Jetzt prüfen beide zuerst mit `isUuid` (wie `brain/status` und `server/project.ts`), vor Anmeldung, Body und Datenbank, und antworten mit derselben 404 wie für ein fremdes Projekt, über `denied()`. Der Vertrag der Eingabeprüfung (`route.validation.cases.json`) hat den Fall dazu, sein Nachbau lehnt wie Postgres eine andere Kennung in der Spalte `id` ab.
- **#406 (Low):** Das abschließende `update` prüfte nicht, ob es eine Zeile traf. Wurde das Gedächtnis oder das Projekt während der bis zu 300 s langen Analyse in einem zweiten Tab gelöscht, meldete die Route `ready`, und die Karte zeigte "Gedächtnis aktualisiert". Jetzt liefert das `update` per `select("project_id")` die getroffenen Zeilen; ohne Treffer antwortet die Route mit 404 `projectNotFound` über `denied()`, ohne neue Meldung. Die Reservierungen bleiben verbraucht wie bei einem gescheiterten Speichern (das Modell hat gearbeitet), kein Eintrag im Fehlerprotokoll und kein Status `failed`, dafür das Ereignis `brain.analysis_discarded` mit Modell, BYOK und Dauer. Abwägung: wurde nur das Gedächtnis gelöscht, steht in der Karte "Projekt nicht gefunden.", obwohl das Projekt noch besteht; eine eigene Meldung bräuchte einen neuen Text in fünf Sprachen, und `{ status: "idle" }` mit 200 hätte die Karte einen Erfolg melden lassen.
- **Geprüft:** Mit dem alten Code rot: je ein Routentest für POST und DELETE mit einer Kennung, die Postgres ablehnt (22P02), der neue Vertragsfall und der Test zur gelöschten Zeile. 7 Mutationen, alle erkannt: Prüfung in POST bzw. DELETE entfernt, Prüfung in POST erst nach der Anmeldung; keine Trefferprüfung, `update` ohne `select` (der Nachbau liefert Zeilen wie supabase-js nur mit `select`), Ausstieg mit `ready`, Ausstieg als Fehler durch den `catch` (gäbe die Reservierung zurück).
- **Gate:** grün auf `126c428e` mit den Code-Commits dieses Branches (Audit sauber, Typecheck, Lint, 4317 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet); nach dem Merge von `main` mit #400 und #410 sowie #391 und #398 noch einmal ganz.
- **Nicht geprüft:** gegen die echte Datenbank (dass Postgres die Kennung mit 22P02 ablehnt und `update … select` ohne Treffer eine leere Liste liefert, steht nur in den Attrappen), keine echte Analyse über Z.ai, nicht im Browser (wie die Karte die 404 zeigt, ist aus `features/projects/components/project-brain.tsx` gelesen).

## 2026-11-26: Zähler je IP fassen IPv6 je /64 zusammen, Seitenleiste und Chat-Seite grenzen zusätzlich auf user_id ein (Branch `fix/ip-zaehler-user-id-391-398-v2`, #391 und #398)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide zur Eingrenzung je Anschluss und je Konto; #397 und #406 (Gedächtnis-Route) sowie #400 und #410 (Terminal-App) liefen parallel in eigenen Sitzungen. Neu aufgesetzt als `-v2` von `main` (PR #446 geschlossen), weil #400 und #410 vorher am Kopf dieses Changelogs gemergt wurden.
- **#391 (Low, Sicherheit):** Die Ratenlimits ohne Konto (`rateLimitKey`) und die Tagesgrenze des Gratis-Rahmens (`server/free-trial.ts`) zählten je einzelner Adresse, obwohl `addressBucket` ein /64 schon zu einem Anschluss zusammenfasste (genutzt nur beim zweiten Faktor). Wer ein /64 hat, fing mit jeder neuen Adresse von vorn an: die Grenzen von `auth` und `cli-device` galten für ihn praktisch nicht, und über neue Konten liess sich das Tagesbudget des Gratis-Rahmens für alle anderen leeren. Jetzt nimmt jeder Zähler je IP `clientAddressBucket` (`server/security/rate-limit.ts`, `addressBucket(clientIp(req))`): IPv4 bleibt unverändert, auch im Redis-Schlüssel, `::ffff:a.b.c.d` zählt wie die IPv4-Adresse, Turnstile und die Anzeige der Terminal-Anmeldung bekommen weiter die genaue Adresse. Keine Signatur geändert, kein Aufrufer angefasst. Zähler, die Redis bisher je IPv6-Adresse führte, beginnen unter dem neuen Schlüssel bei null; an Produktion nichts geändert. `docs/SETUP.md`, neuer Abschnitt "Grenzen je Anschluss".
- **#398 (Low, Sicherheit):** Die beiden Listen der Seitenleiste (`app/(app)/layout.tsx`) und das Lesen des Chats auf `/chats/[id]` verliessen sich allein auf RLS, entgegen der Regel in `CLAUDE.md`; ginge eine Policy auf `conversations` oder `projects` einmal zu weit, etwa für geteilte Projekte, zeigten sie fremde Titel und einen fremden Chat. Alle drei Abfragen tragen jetzt `.eq("user_id", user.id)` aus der geprüften Sitzung; die übrigen unter `src/app/(app)/` hatten den Filter schon. Neue Schranke `tests/guards/owner-scoped-reads.test.ts`: jede Abfrage auf einem Client mit RLS unter `src/app/(app)/` grenzt je Abfrage auf das Konto ein (`profiles` über `id`), der Admin-Client bleibt draussen. Die Seitentests lesen über `tests/support/supabase-rows.ts`, einen Nachbau ohne RLS, der jede Zeile liefert, die die Abfrage selbst durchlässt. `CLAUDE.md` nennt die Schranke an der Regel "User-scoped Queries".
- **Kommentare:** beim Anfassen angeglichen, ohne Verlauf: die Doc-Kommentare von `rateLimitKey` und `clientIp` (die Begründung zu den Köpfen steht jetzt bei `clientIp`), `layout.tsx` und `chats/[id]/page.tsx`; deren Basiswert in `comment-history.baseline.json` fällt weg.
- **Geprüft:** Mit dem alten Code sind rot: 3 neue Tests in `rate-limit.test.ts`, 3 in `free-trial.test.ts` (Map und Redis-Attrappe), 4 der 5 Seitentests (das Öffnen des eigenen Chats ist von selbst grün) und die Schranke, die genau `layout.tsx:52`, `layout.tsx:58` und `chats/[id]/page.tsx:38` nennt. Dazu 10 Mutationen, alle erkannt: für #391 `clientAddressBucket` ohne `addressBucket`, `rateLimitKey` mit `clientIp` direkt, der Gratis-Rahmen mit der rohen Adresse; für #398 jeder der drei Filter einzeln entfernt, die Schranke immer grün, je Datei statt je Abfrage, ohne Ausnahme für `profiles`, für jeden Client.
- **Gate:** grün auf `126c428e` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4329 Tests, 2 übersprungen, Build mit den Platzhaltern der CI, ein Stylesheet), die CI von PR #446 mit allen neun Prüfungen auch; nach dem Neuaufsetzen auf `fe74f93b` noch einmal ganz grün.
- **Nicht geprüft:** gegen echtes Upstash und mit echtem IPv6-Verkehr, also auch nicht, ob Vercel bei promptprinter.app die IPv6-Adressen der Besucher weiterreicht; RLS nur per Nachbau, nicht gegen die echte Datenbank. Rechtstexte nicht angefasst: die Datenschutzerklärung spricht beim Zählen von der IP-Adresse (Ziffer 2 und 4); für IPv6 zählt jetzt das /64, im Zählerschlüssel steht weniger als vorher, ein Widerspruch ist das nicht.

## 2026-11-26: Die Terminal-App nimmt im Wartehinweis nur kleine Zahlen an und gibt die Anmeldung bei einem kurzen Ausfall des Servers nicht mehr auf (Branch `fix/terminal-app-400-410`, #400 und #410)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide in der Terminal-App unter `cli/`; #397 und #406 sowie #391 und #398 liefen parallel in eigenen Sitzungen.
- **#400 (Low, Sicherheit):** Der Leser des Antwort-Stroms (`cli/src/sse.mjs`) prüfte beim Ereignis `status` nur `phase`. `attempt` und `maxAttempts` gingen ungeprüft in den Wartehinweis ("neuer Versuch (2 von 3)"), ein fremder oder übernommener Server unter `PROMPTPRINTER_URL` hätte so Steuerfolgen ins Terminal schreiben können, etwa OSC 52 für die Zwischenablage. Jetzt nimmt der Leser beide Felder nur als ganze Zahl von 0 bis 100, sonst ist das Ereignis `invalid` und der Zug endet als Protokollfehler, wie bei jedem anderen Feld mit falschem Typ. Das ist strenger als `z.number()` in `shared/lib/chat-stream.ts`, weil JSON auch Brüche, Riesenzahlen und `1e999` kennt; Vertrag und Browser bleiben, wie sie sind.
- **#410 (Low):** Beim Abfragen des Geräte-Codes antwortet `api/cli/token` auf jeden Fehler der Datenbank mit 503 `unavailable`, auch solange der Code gilt, und die Terminal-App gab dann sofort auf. Jetzt fragt sie im üblichen Abstand weiter (`cli/src/login.mjs`), bei `unavailable` und bei einem Status ab 500 ohne `kind`, den nicht die Route schickt, sondern die Plattform davor (etwa ein Timeout am Gateway). Das ist gefahrlos, denn ein Code wird nur einmal abgeholt, danach antwortet die Route `invalid`. Endgültig bleibt `session_failed`, ebenfalls 503, weil der Code dann verbraucht ist. Nach 24 gescheiterten Abfragen in Folge (bei fünf Sekunden Abstand rund zwei Minuten, eine gelungene setzt die Zählung zurück) endet die Anmeldung mit dem neuen Text `loginUnavailable` (deutsch und englisch). Die Texte je Ergebnis stehen dafür als `LOGIN_MESSAGES` neben `runLogin` statt in `cli/src/cli.mjs`. Die Route und der CLI-Vertrag (`cli/contract/pins.json`) bleiben unverändert, die Version der Terminal-App auch.
- **Geprüft:** Je Issue zwei neue Tests in `cli/test/`, alle vier am alten Code rot: für #400 der Leser mit Steuerzeichen in beiden Feldern und mit Zahlen, die keine kleinen ganzen sind, dazu die Eingabezeile, auf der keine OSC-Folge ankommt; für #410 ein Ausfall mitten in der Anmeldung (`pending`, `unavailable`, 504 ohne `kind`, `approved`, jedes Mal nach fünf Sekunden) und die Grenze samt Zurücksetzen. Je eine neue Zeile in `cli/test/mutation.mjs`, beide erkannt. Einmal scheiterte im vollen Lauf unter Last ein Test in `cli/test/pp-kontext.test.mjs` (Schwärzen im Projekt-Kontext), ohne Bezug zu dieser Änderung; einzeln und im nächsten vollen Lauf war er grün.
- **Gate:** grün auf `126c428e` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4309 Tests, 2 übersprungen, Build mit den Platzhaltern der CI); in `cli/` `npm run check` und `npm test` (173 Tests, 3 übersprungen).
- **Nicht geprüft:** keine echte Anmeldung gegen promptprinter.app und kein echter Ausfall der Datenbank, nur gegen den Stub der Tests.

## 2026-11-26: Fotos verlieren ihre Metadaten vor dem Hochladen und vor dem Speichern, der Datenexport nennt Freigaben per Link und angemeldete Terminals (Branch `fix/datenschutz-388-417`, #417 und #388)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide dazu, welche persönlichen Daten wohin gehen; #416 und #423 sowie #395 und #440 liefen parallel in eigenen Sitzungen.
- **#417 (Low, Datenschutz):** Ein Foto bis 1568 px und 1 MB ging mit seinen Originalbytes hoch, samt Exif mit Aufnahmeort, Gerät und Zeit, in den Bucket `chat-attachments` und bei jedem Zug an den Anbieter; nur grössere Fotos verloren die Metadaten beim Neukodieren über das Canvas. Jetzt nimmt `features/chat/lib/image-metadata.ts` (rein, ohne Paket) aus JPEG, PNG und WebP alles heraus, was nicht auf einer Positivliste steht (JPEG: APP0, APP2 nur mit `ICC_PROFILE`, APP14 nur mit `Adobe` und alle Segmente, die weder Anwendungssegment noch Kommentar sind; PNG: kritische Chunks, Farbe, Transparenz, Pixeldichte, APNG; WebP: `VP8`, `VP8L`, `VP8X`, `ALPH`, `ANIM`, `ANMF`, `ICCP`, die Bits für Exif und XMP gelöscht, RIFF-Grösse neu), und schneidet ab, was hinter dem Ende des Bildes hängt (das Video eines Bewegungsfotos, weitere Bilder). Segmente entfernen statt neu kodieren: kein Qualitätsverlust, die Datei wird nur kleiner, eine Animation bleibt. Aus Exif bleibt bei JPEG allein die Drehung, ein neues Segment mit nur diesem Eintrag. Der Browser bereinigt vor dem Hochladen (`prepare-attachment.ts`, der Typ kommt aus den Bytes) und kodiert, was sich nicht vollständig zerlegen lässt, über das Canvas neu; scheitert auch das, lehnt er das Bild als unlesbar ab, wo es früher unverändert hochging (der Test von `use-attachments` schickt deshalb ein echtes Bild, mit Freigabe im Bereich der Sitzung zu #416 und #423). Der Server bereinigt vor dem Speichern noch einmal (`attachment-validation.ts`) und weist ein solches Bild mit `invalid` ab; vorher reichte ihm die Signatur. `isImageMediaType` und `imageMediaTypeForName` waren danach unbenutzt und sind weg. Schon gespeicherte Fotos behalten ihre Metadaten, an der Produktion ist nichts geändert.
- **Fund:** `Buffer.slice` teilt den Speicher, anders als `Uint8Array.prototype.slice`. Das Löschen der Bits im `VP8X`-Kopf hätte auf dem Server die Eingabe verändert; ein Test fand es, jetzt mit Kopie.
- **#388 (Low):** Der Export liess `prompt_shares` und `cli_sessions` aus, ohne dass es begründet war. Neu sind `promptShares` (Prompt und Zeitpunkt, per RLS und `user_id`, ohne Link-Code: die Datei soll gefahrlos in eine Mail) und `terminalSessions` (Gerätename, angemeldet, zuletzt benutzt, gültig bis, ohne Kennung der Sitzung). `cli_sessions` hat für den Nutzer-Client kein Recht (0054); statt einer Migration liest die Route die Terminals über `listCliSessions(user.id)` wie die Einstellungen, nach dem Ratenlimit, und antwortet 503, wenn das scheitert. Der Routentest prüft jetzt, dass der Service-Role-Client nur `cli_sessions` und nur für dieses Konto liest. Neue Schranke `tests/guards/account-export-coverage.test.ts`: jede Tabelle mit `user_id` aus `database.types.ts` ist ein Abschnitt oder steht mit Grund in `EXPORT_EXCLUDED_TABLES` (Webhook-Protokoll des früheren Zahlungsanbieters, Anmeldeanfragen, Wiederherstellungscodes, Sicherheitsprotokoll).
- **Hilfe:** "Konto und Daten" nennt den neuen Inhalt des Exports und dass die Rückfrage beim Teilen Titel und Text prüft (#440), "Chat mit Finn" das Entfernen der Metadaten; dazu `docs/SETUP.md` ("Anhänge im Chat", "Datenbank-Typen").
- **Geprüft:** Testbilder unter `tests/support/images/`, erzeugt mit dem `sharp`, das Next mitbringt (JPEG, progressiv, gedreht mit Farbprofil, PNG, WebP, animiertes WebP, je mit Gerät und GPS in Exif und XMP); bereinigt sind sie Byte für Byte die Fassung ohne Metadaten. Gegenprobe mit sharp (Pixel gleich, Drehung, Farbprofil, Animation) und mit `prepareAttachment` in headless Chromium 158 (ein grosses Foto auf 1568 px verkleinert, ein JPEG, das sich nicht zerlegen lässt, über das Canvas, jeweils ohne Ort). Am alten Code scheitern 15 neue Tests zu #417 und 10 zu #388; 27 von 27 und 13 von 13 Mutationen erkannt.
- **Gate:** grün auf `82601b88` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4275 Tests, 2 übersprungen, Build mit den Platzhaltern der CI); nach den Merges von `main` mit #416 und #423 sowie #440 und #395 noch einmal ganz grün (4309 Tests, Build).
- **Nicht geprüft:** gegen die echte Datenbank (RLS von `prompt_shares`, `listCliSessions`), in Safari und Firefox. Rechtstexte nicht angefasst; für Kasum: die Datenschutzerklärung könnte beim Verkleinern der Fotos das Entfernen der Metadaten nennen, und Ziffer 7 sagt, es gebe keine Schaltfläche für die Herausgabe, obwohl der Export in den Einstellungen steht.

## 2026-11-26: Umbenennen und Teilen prüfen auch den Titel, der Verlauf lädt den Text erst für den Vergleich (Branch `fix/prompts-titel-verlauf-440-395`, #440 und #395)

- **Ziel:** #395 aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`) und #440, der Rest aus #381 (PR #438), beide an den gespeicherten Prompts; #416 und #423 sowie #388 und #417 liefen parallel in eigenen Sitzungen.
- **#440 (Low, Sicherheit):** `/geteilt/<token>` zeigt den Titel als Überschrift. Umbenennen schrieb ihn ohne Prüfung, auch bei einem geteilten Prompt, und der Dialog vor dem ersten Teilen prüfte nur den Text. Jetzt prüft das Feld zum Umbenennen (`features/prompts/components/prompt-rename-field.tsx`, aus der Karte gezogen, die bei 394 von 400 Zeilen stand) einen neuen Titel nach derselben Regel wie Bearbeiten (`risksBeforeWriting`: geteilt, unbekannt oder noch unterwegs fragt, sicher privat nicht). Enter und der Haken fragen nur, erst "Trotzdem umbenennen" schreibt, damit ein doppeltes Enter die Rückfrage nicht überspringt; wer weitertippt, wird neu gefragt. Der Dialog vor dem Teilen prüft Titel und Text zusammen. Neuer Text in fünf Sprachen (fr, it, es nicht von Muttersprachlern geprüft); Hilfe "Prompts speichern" und `docs/SETUP.md` ("Versionen gespeicherter Prompts") nennen den Titel. Die umschriebenen Umlaute in den Kommentaren der Karte sind berichtigt, ihr Eintrag in der Kommentar-Ratsche entfällt.
- **#395 (Low, Leistung):** Der Verlauf an der Karte lud bei jedem Aufklappen und nach jedem Speichern die ersten 20 Fassungen samt Text und rechnete den Wort-Diff, auch wenn niemand ihn öffnete; der Kommentar darüber sagte das Gegenteil, und scheiterte die Abfrage, fehlte der Verlauf still. Jetzt zählt er beim Aufklappen nur (`head: true`, keine Zeilen) und lädt beim Öffnen Nummern und Zeiten, den Text nur der beiden verglichenen Fassungen; ein geladener Text bleibt im Speicher der Karte, denn eine Version ändert niemand (0061). Wiederherstellen prüft und schreibt genau den geladenen Text, ohne ihn gibt es keinen Knopf, und ein alter Vergleich bleibt für eine neue Wahl nicht stehen. Ein Zählfehler steht als eigene Zeile mit "Neu laden" (fünf Sprachen, fr, it, es nicht von Muttersprachlern geprüft). Gewinn bei 20 Fassungen zu je 40 000 Zeichen: je Aufklappen der Karte vorher 801 512 Bytes JSON in 20 Zeilen, jetzt keine Zeile; beim Öffnen des Verlaufs 81 309 Bytes (1 252 für Nummern und Zeiten, 80 057 für zwei Texte).
- **Geprüft:** Mit dem alten Code sind 5 der 6 neuen Tests zu #440 rot (der private Fall ist dort von selbst grün) und alle 7 zu #395, die bestehenden bleiben grün. 16 Mutationen an den neuen Schranken (6 für #440, 10 für #395), alle erkannt.
- **Gate:** grün auf `82601b88` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4243 Tests, 2 übersprungen, Build mit den Platzhaltern der CI).
- **Nicht geprüft:** im Browser. Die Hilfe "Konto und Daten" sagt beim Teilen noch, PromptPrinter weise auf das hin, was es "im Text" findet; den Satz zieht die Sitzung zu #388 nach, die die Datei in dieser Runde hat.

## 2026-11-26: Ein Antwort-Strom ohne Abschluss lässt den Chat nicht mehr hängen, die Spracherkennung startet nach einem bleibenden Fehler nicht in einer Schleife neu (Branch `fix/chat-strom-sprache-416-423`, #416 und #423)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide am Chat im Browser; #395 und #440 sowie #388 und #417 liefen parallel in eigenen Sitzungen.
- **#416 (Low):** Endete der Strom von `POST /api/chat` ohne `done` und ohne `error` (Zeitgrenze der Plattform, ein Proxy schliesst die Verbindung sauber), galt der Zug als erfolgreich: `pending` blieb unfertig, die Eingabe gesperrt, Stopp half nicht; ohne Text stand die Frage ohne Antwort und ohne Meldung da. Jetzt merkt sich `createTurnEventHandler` den Abschluss (`settled()`), und `runChatTurn` wirft ohne ihn einen `TurnUnfinishedError` (`features/chat/lib/turn-outcome.ts`), den `classifyTurnError` ohne neue Regel wie eine abgerissene Verbindung einordnet: mit Text bleibt die Antwort stehen, dazu die Warnung `chat.connectionDropped`, ohne Feier; ohne Text kommt die Frage zurück ins Feld, mit der neuen Meldung `chat.streamEnded` (fünf Sprachen, fr, it, es nicht von Muttersprachlern geprüft) und "Erneut senden". Das Protokoll des Servers und `shared/lib/chat-stream.ts` bleiben unverändert.
- **Fund:** Im Zweig "Verbindung abgerissen" las `commitReply` den `pendingRef`, den erst ein Effekt nach dem Render nachzieht. Ging der Strom in denselben Mikrotasks wie das letzte `delta` zu, stand dort noch `null`, die Antwort wurde nie übernommen und der Zug blieb offen; das galt auch für einen `TypeError` gleich nach dem letzten Wort. Der Zweig setzt den Ref jetzt selbst. Ohne diese Zeile blieben im Test beide Fälle mit Text hängen.
- **#423 (Low):** `use-speech-recognition.ts` startete die Erkennung in `onend` neu, solange nicht bewusst gestoppt wurde; nach `not-allowed`, `service-not-allowed` oder `network` (in Brave immer) lief Start, Fehler, Ende, Start ohne Pause, in der Attrappe 8 bis 12 Starts in 30 ms. Jetzt beendet jeder Fehler, den die Leiste als Meldung zeigt, die Sitzung, also auch `audio-capture` und `language-not-supported`; Stille und `no-speech` starten weiter neu, das nächste Zuhören nach einem Zug versucht es genau einmal wieder. Die Sprachleiste hört dann sichtbar auf: Mikrofon aus (die Aufnahmeanzeige erlischt), Welle `paused`, Finn `sad`, die Meldung auch im Live-Bereich statt "Ich höre zu.". Wer das Mikrofon danach erlaubt, öffnet den Sprachmodus neu. Die optionale Obergrenze für Neustarts je Minute aus dem Issue ist nicht gebaut.
- **Geprüft:** Die neuen Tests sind mit dem alten Code rot (#416: drei in `chat.turn.test.tsx`, dazu `turn-events.test.ts` und `turn-outcome.test.ts`; #423: neun, neu `hooks/use-speech-recognition.test.tsx` gegen eine nachgebaute `SpeechRecognition`, dazu `voice-bar.behavior.test.tsx` und ein Zusammenspiel-Test in `chat.turn.test.tsx`). Elf Mutationen an den neuen Schranken, alle erkannt.
- **Gate:** grün auf `82601b88` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4251 Tests, 2 übersprungen, Build mit den Platzhaltern der CI).
- **Nicht geprüft:** im Browser, mit echtem Mikrofon, in Brave und Chrome; wie Vercel einen Strom an der Zeitgrenze schliesst. Nebenbei gefunden, nicht Teil des Branches: `chat.tsx` hat zwei identische `aria-live`-Bereiche hintereinander, Statusmeldungen werden doppelt angesagt.

## 2026-11-26: Der Redis-Zweig des Gratis-Rahmens läuft in den Tests, sieben Schranken lesen mit dem Parser von TypeScript (Branch `fix/schranken-386-426`, #386 und #426)

- **#386, Ziel:** Die Tests des Gratis-Rahmens ersetzten Redis durch `null`; der Zweig, der in Produktion gilt (`readCount`, `increment`, `rememberDelivered`, `wasDelivered` in `server/free-trial.ts` samt Fehlerbehandlung), lief in keinem Test. Ein entferntes `"NX"` oder ein anderer Rückgabewert im `catch` blieb grün.
- **#386, jetzt:** dieselben Fälle laufen gegen die Map und gegen eine Redis-Attrappe im Test (Zähler, Mengen, Ablaufzeiten; `NX` lässt einen gesetzten Ablauf stehen, `decr` zieht wie das Rückgabe-Skript nur ab, was da ist). Dazu Fälle nur für Redis: Ablauf je Schlüssel (Konto 400 Tage, IP und Tag zwei), ein weiterer Prompt setzt den Ablauf nicht neu, Fehler bei `get`, `incr`, `sadd`, `sismember` und einer Reservierung, ein Ausfall nach der Reservierung. `counterRedisDouble` kann dafür `sadd` in `multi()` und gibt jedem Schritt genau die Argumente des Aufrufs weiter; die Attrappe bleibt in `server/security/` (#363). 14 Mutationen im Redis-Zweig: jede macht den neuen Test rot, den alten liess jede grün. Abdeckung von `free-trial.ts` mit diesem Test allein: Anweisungen 122 von 124 (vorher 101), Zweige 69 von 72 (vorher 50); offen nur die beiden Wächter `if (!redis)` in `increment` und `rememberDelivered`, über die öffentlichen Funktionen nicht erreichbar, und `?? 1` in der Rückgabe der Map. Kein Fehler im Redis-Zweig gefunden.
- **#426, Ziel:** Sieben Schranken in `tests/guards/` prüften per regulärem Ausdruck eine Schreibweise und liessen gleichwertige durch: relative und berechnete Importe (`layer-boundaries`), `let` und Zuweisungen ohne Deklaration, eine Fehlerprüfung in einer anderen Funktion (`db-read-errors`), ein auskommentierter Marker (`server-only`), ein relativer Pfad zum Wrapper und `export { z } from` (`zod-import`), `export function POST` und Re-Exporte (`cross-origin-routes`), `.upsert(` (`owner-scoped-writes`), ein `problem(` über mehrere Zeilen (`security-log-routes`).
- **#426, jetzt:** `tests/guards/parse-source.ts` sammelt mit `ts.createSourceFile` jede Stelle, die ein Modul nennt (Import, Re-Export, `import()`, `require`, `typeof import(…)`, die Modul-Aufrufe von Vitest), löst `@/`, `@tests/` und relative Pfade auf und zählt keine Kommentare. Darauf stehen `layer-boundaries` (ein berechneter Pfad schlägt selbst an; innerhalb von `app/` relativ erlaubt, `@/app/…` bleibt gesperrt), `server-only` (nur die Anweisung `import "server-only";`) und `zod-import`. `db-read-errors` prüft je Funktion (eine innere Funktion mit eigenem Namen meint einen anderen), dazu `let`, Zuweisungen ohne Deklaration, `(await …).data` und `as` um die Abfrage. `cross-origin-routes` liest jede Schreibweise eines Exports (bei `export *` alle vier Methoden), `owner-scoped-writes` zählt `.upsert(` und erkennt den Browser-Client auch relativ, `security-log-routes` liest `problem(` über Zeilen und hinter einer Bedingung, ein Status, der sich nicht ablesen lässt, zählt als Absage. Die Schichtgrenzen bleiben ein Test (minimatch-Override). Je Lücke ein Selbsttest mit einer präparierten Zeichenkette: alle 39 kamen durch die alten Schranken (Gegenprobe mit deren Code), 28 Mutationen an den neuen machen sie rot.
- **Fund:** zwei 403 in geprüften Routen liefen nicht durch `denied()`, weil der Status auf der Zeile nach `problem(` stand: die volle Speichergrenze für Anhänge (`api/chat/gate.ts`) und die Projekt-Grenze (`api/projects/route.ts`). Eigener Commit: beide laufen jetzt durch `denied()` mit Konto und Grund (`attachment_storage`, `project_limit`), die Antwort bleibt gleich. Die Alternative wäre eine benannte Ausnahme im Guard gewesen.
- **Doku:** `docs/SETUP.md` (Tabelle "Sicherheitsprotokoll") und der Kommentar von `denied()` nennen die 403 an einer Grenze mit ihrem `reason`, eigener Commit.
- **Gate:** grün auf `ca500ef2` mit den Commits dieses Branches (Audit sauber, Typecheck, Lint, 4190 Tests, 2 übersprungen, Build mit den Platzhaltern der CI); nach dem Merge von `main` mit #361 und #381 alle Schranken und die Tests unter `server/security/` und des Gratis-Rahmens noch einmal grün.
- **Nicht geprüft:** gegen echtes Upstash (nur die Attrappe); die neuen Logzeilen in Produktion.

## 2026-11-26: Ein womöglich geteilter Prompt fragt bei jedem neuen Text vor Geheimnissen nach, der Wackeltest der Karte prüft die Karte (Branch `fix/geteilte-prompts-361-381`, #361 und #381)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`), beide an den gespeicherten Prompts; #386 und #426 liefen parallel in einer zweiten Sitzung.
- **#361 (Medium, Wackeltest):** `saved-prompt-list.test.tsx` suchte den bearbeiteten Text mit `findByText` im ganzen Dokument. Ein gesteuertes `<textarea>` trägt seinen Wert auch als Textknoten (React setzt `defaultValue`), die Suche traf also das Feld des Editors, solange er offen war; schloss er in der Lücke vor der Prüfung, hing das Element nicht mehr im Dokument. Jetzt sucht der Test das `<pre>` der Karte und prüft, dass der Editor zu ist. Einzeln gestartet vorher 2 von 8 Läufen rot, nachher 25 von 25 grün. Dieselbe Falle in `chat.test.tsx` ("retries the same text on demand"): grün auch mit einem "Erneut senden", das nichts sendet (nachgeprüft); jetzt im Verlauf (`role="log"`) gesucht. Weitere Stellen fand die Suche nicht (ein `<input>` hat keinen Textknoten).
- **#381 (Medium, Sicherheit):** Ein geteilter Prompt steht unter `/geteilt/<token>` in der aktuellen Fassung. Die Rückfrage vor Schlüsseln und persönlichen Angaben galt nur beim Bearbeiten, und dort nur, wenn die Abfrage von `prompt_shares` rechtzeitig und ohne Fehler antwortete: Lesefehler und Speichern vor der Antwort galten als "nicht geteilt". Wiederherstellen und "Als neue Version" im Chat schrieben ohne Prüfung.
- **Jetzt:** ein Stand der Freigabe an einer Stelle (`shared/lib/prompt-share-status.ts`: lädt, geteilt, privat, Fehler); privat nur bei ausdrücklichem `token: null` von `GET /api/prompts/<id>/share`, Fehler und laufende Abfrage zählen beim Schreiben wie geteilt. Die Karte lädt ihn einmal je Aufklappen (`features/prompts/hooks/use-share-status.ts`) und reicht ihn an Teilen, Editor und Verlauf; der Editor liest `prompt_shares` nicht mehr selbst und weiss sofort, wenn der Prompt bei offenem Editor geteilt wird. Wiederherstellen fragt wie Speichern (Hinweis bei geteiltem Prompt, die Funde, "Version n trotzdem wiederherstellen"). "Als neue Version" liest den Stand nur, wenn der Text etwas Auffälliges enthält, und fragt bei geteilt oder unbekannt in einem Dialog; ein neuer Prompt ist noch nirgends geteilt und fragt nicht. Neue Texte in fünf Sprachen (fr, it, es nicht von Muttersprachlern geprüft); Hilfe-Artikel "Prompts speichern" und `docs/SETUP.md` ("Versionen gespeicherter Prompts") nachgezogen.
- **Geprüft:** 7 der neuen Tests sind mit dem alten Code rot (Lesefehler, Speichern vor der Antwort, Teilen bei offenem Editor, Wiederherstellen einer Fassung mit Schlüssel, "Als neue Version" bei geteiltem und bei nicht lesbarem Stand, Abbrechen); für die Karte lief dabei eine Kopie der Testdatei, deren Mock auch `prompt_shares` wie die Route beantwortet. Sieben Mutationen, alle erkannt (unbekannt gilt als privat, Editor, Verlauf und Chat ohne Prüfung, leere Antwort gilt als privat, zugeklappte Karte lädt, Leiste meldet Teilen nicht zurück). Gate grün.
- **Nicht geprüft:** im Browser. Umbenennen prüft den Titel nicht, obwohl auch er unter dem Link steht (nicht Teil von #381). #382 (ein veralteter Tab überschreibt `outputs`) bleibt offen, es braucht eine Migration oder einen Entscheid.

## 2026-11-25: Nutzungsrichtlinie und Datenschutz nennen das Teilen per Link, die Ladezeit-Messung kürzt den Link-Code (Branch `docs/rechtstexte-geteilte-prompts-v2`, #415)

- **Ziel:** Fund aus #412 (PR #432): Die Nutzungsrichtlinie sagte "Die Inhalte der Nutzer sind nicht öffentlich einsehbar", die Datenschutzerklärung erwähnte das Teilen per Link nicht. Kasum hat am 2026-11-25 entschieden, beide Texte anzupassen. Nicht juristisch geprüft.
- **Ladezeit-Messung (#415):** `scrubSpeedInsightsEvent` (`shared/lib/speed-insights-event.ts`) ersetzte nur UUIDs. Der Link-Code in `/geteilt/<token>` ging vollständig an Vercel Speed Insights, obwohl Datenschutz und `/cookies` gekürzte Kennungen versprechen, und wer ihn kennt, liest den Prompt. Jetzt wird der Pfad zu `/geteilt/[token]`; Test, Mutation erkannt. Die allgemeinere Variante aus dem Issue (immer das Seitenmuster `route` senden) ist bewusst nicht genommen, damit die übrigen Messreihen bleiben, wie sie sind.
- **Nutzungsrichtlinie:** Ziffer 1 nennt geteilte Prompts, Ziffer 5 die Verantwortung beim Teilen (der Hinweis auf Schlüssel und persönliche Angaben ist keine Inhaltsprüfung), Ziffer 6 das Aufheben eines Links bei Verstössen, Ziffer 7 die Ausnahme von "nicht öffentlich einsehbar".
- **Datenschutz:** neuer Abschnitt "Geteilte Prompts (optional)" in Ziffer 2: Link-Code, Konto-Kennung und Zeitpunkt gespeichert; lesbar für jeden mit dem Link, ohne Namen und E-Mail-Adresse; `noindex`; Widerruf oder Löschen von Prompt oder Konto löscht den Link-Code; Kopien Dritter lassen sich nicht zurückholen; Aufrufe je IP-Adresse begrenzt. Dazu Ziffer 2 (Messung), 3, 6 und 8; `LEGAL.lastUpdated` 25. November 2026.
- **Gate:** grün auf dem Stand von `main` mit #380 und #425 (Audit, Typecheck, Lint, 4159 Tests, Build). Im ersten Lauf für #435 war einzig `saved-prompt-list.test.tsx` einmal rot (der bekannte Wackeltest, #361) und einzeln grün.
- **Nicht geprüft:** juristisch; die Seiten im Browser; ob Speed Insights auf promptprinter.app `/geteilt/[token]` meldet (erst nach dem Deployment).
- **Erster PR:** #435 (Branch `docs/rechtstexte-geteilte-prompts`) ist geschlossen: nach dem Merge von #380 und #425 ging "Rebase and merge" am Kopf dieser Datei nicht mehr. Die beiden Commits sind unverändert übernommen (`git range-diff`).

## 2026-11-25: Konto löschen entfernt die Dateien erst nach dem Konto, das Abgleich-Skript findet Waisen (Branch `fix/speicher-380-425-v2`, #380 und #425)

- **#380, Ziel:** `DELETE /api/account` entfernte alle Objekte in `chat-attachments`, `project-files` und `avatars`, bevor `deleteUser` lief. Scheiterte das Löschen (Störung bei Supabase Auth, fehlender Service-Role-Key), blieb das Konto bestehen, und jede Datei fehlte dauerhaft, die Zeilen in `message_attachments` und `project_files` zeigten ins Leere.
- **#380, jetzt:** die Pfade vor dem Löschen einsammeln (mit der Sitzung, seitenweise wie bisher), dann `deleteUser`, dann `account.deleted` ins Sicherheitsprotokoll, erst danach die Objekte mit dem Admin-Client entfernen: die Sitzung gehört dann zu einem Konto, das es nicht mehr gibt. Ein Fehler beim Aufräumen hält das Löschen weiter nicht auf, die Ereignisnamen sind gleich geblieben; was liegen bleibt, findet das Skript aus #425. **Nur der eigene Ordner:** der Admin-Client umgeht die RLS des Buckets, die vorher fremde Ordner ausschloss, und `project_files` schreibt der Browser selbst. Entfernt werden deshalb nur Pfade, deren erster Abschnitt genau die Kennung des Kontos ist; andere bleiben liegen und stehen nur gezählt im Log (`account.cleanup_foreign_path_skipped`), nie mit Pfad. Eine gefälschte Zeile lehnt schon der Insert-Trigger aus 0042 ab (das Objekt muss für den Aufrufer sichtbar sein, die Select-Policy zeigt nur den eigenen Ordner); das Löschen verlässt sich nicht darauf. Gefunden hat die Lücke die Durchsicht des ersten PR. `tests/guards/second-factor.test.ts` verlangt jetzt die AAL2-Prüfung vor `deleteUser`, dem ersten unumkehrbaren Schritt, und das Entfernen der Objekte danach, jeden Schritt genau einmal.
- **Annahme dahinter:** Die Supabase-Doku sagt noch, ein Nutzer, dem Storage-Objekte gehören, lasse sich nicht löschen (`objects_owner_fkey`). Das ist veraltet: `supabase/storage` entfernt den Schlüssel mit der Migration `0017-drop-owner-foreign-key.sql` (0018 den von `buckets`), im Repo spätestens seit Januar 2024. Projektdateien lädt der Browser mit der Sitzung hoch (`owner` ist der Nutzer); gäbe es den Schlüssel noch, scheiterte `deleteUser` an ihnen. Gegen das Produktionsschema nicht geprüft.
- **#425, Ziel:** `scripts/reconcile-project-files-storage.mjs` fand nie eine Waise. Es übersprang Einträge ohne `id`, `list()` liefert Ordner aber mit `id: null`, und es las nur die erste Seite (100 Einträge, 1000 Zeilen). Nach der naheliegenden Korrektur hätte `--delete` lebende Dateien gelöscht, sobald eine Liste unvollständig war, ebenso ein Objekt, dessen Zeile beim Hochladen noch fehlte.
- **#425, jetzt:** Ordner an `id` null erkennen und in jeden absteigen, jede Ebene mit `limit` und `offset`; die Zeilen über `collectStoragePaths` (Seiten nach `id`), danach zählt die Datenbank; direkt vor dem Löschen jede Waise noch einmal in der Tabelle suchen; nur Objekte löschen, die älter als eine Stunde sind. Könnte eine Liste unvollständig sein, bricht das Skript mit Exit 2 ab und löscht nichts. Es importiert `src/shared/lib/storage-cleanup.ts` direkt (Node 24 lässt die Typen weg und meldet einmal `MODULE_TYPELESS_PACKAGE_JSON`) und exportiert `run(...)` wie `rotate-byok-secret.mjs`. Bedienung: `docs/SETUP.md`, „Verwaiste Dateien im Speicher".
- **Geprüft:** Routentest: scheitert `deleteUser` (Fehler, Wurf, kein Admin-Zugang), ruft niemand `storage.remove`; Pfade vor, Entfernen nach dem Löschen; entfernt wird nur über den Admin-Client; fremde Pfade (anderer Nutzer, Präfix ohne Schrägstrich, führender Schrägstrich) erreichen `remove` nicht und stehen in keiner Meldung. Mit der alten Route sind die neuen Tests rot. Mutationen (Entfernen vor dem Löschen, Einsammeln danach, Sitzung statt Admin-Client, Faktor-Prüfung nach dem Löschen, kein Ordner-Filter, Präfix ohne Schrägstrich, Pfade in der Meldung) schlagen an. Skripttest (`tests/scripts/`) gegen eine Attrappe von `list()` und PostgREST (Ordner mit `id` null, über 100 Einträge je Ebene, über 1000 Zeilen, frisches Objekt, Seitengrenze unter 1000, verrutschte Seiten, Lesefehler, beide Buckets) und ein Start mit Node ohne Vitest; mit dem alten Skript scheitert die Datei schon beim Import. Die drei alten Fehler einzeln zurück und jede neue Schranke (Alter, Zählung, letzte Prüfung) einzeln weg: jede Mutation schlägt an. Gate grün, auf dem Stand von `main` mit #384 und #412.
- **Nicht geprüft:** nicht gegen echtes Supabase Auth und keinen echten Bucket; das Skript lief nie mit echten Keys. Das e2e `account.spec.ts` löscht in der CI ein Konto gegen den lokalen Stack, aber nur mit einem Chat-Anhang (vom Server hochgeladen), nicht mit einer Projektdatei aus dem Browser. Der Bucket `avatars` hat keinen Abgleich: keine Tabelle mit Pfaden, laut Migration 0048 ein Altobjekt. Der erste PR (#433, Branch `fix/speicher-380-425`) ist geschlossen: nach dem Merge von #384 und #412 ging „Rebase and merge" am Kopf dieser Datei nicht mehr.

## 2026-11-25: Analyse schickt Z.ai-Felder nur an Z.ai, Hilfe zu Teilen, `/save` und Registrierung stimmt (Branch `fix/analyse-hilfe-384-412`, #384 und #412)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`); #380 und #425 liefen parallel in einer zweiten Sitzung.
- **#384 (Medium):** Die Gedächtnis-Analyse (`server/llm/analyze.ts`) nahm von den Feldern, mit denen Z.ai das Denken steuert (`thinking` oder `reasoning_effort` aus `zaiThinkingParams`), nur `LLM_BASE_URL` aus, nicht den Custom-Slot. Ein eigener Endpunkt, der unbekannte Felder ablehnt, liess so nur die Analyse scheitern, Key-Test und Chat liefen. Jetzt entscheidet der Host: `isZaiEndpoint` (`server/llm/config.ts`) vergleicht ihn mit dem von `ZAI_ENDPOINT`, für die Felder und für das Verwerfen des Denktexts (vorher am Label `"Z.ai"`); `endpointCheck` regelt nur noch die SSRF-Prüfung. Server-Key unverändert (glm-4.5-air mit `thinking` aus, Modelle, die immer denken, mit `reasoning_effort: low`). Ein anderer Host bekommt keine Felder mehr, auch bei einem GLM-Modellnamen.
- **Entscheid zu `api.z.ai`:** Der Custom-Slot auf `api.z.ai` behält die Felder. Die Einstellungen schlagen genau diese Adresse als Beispiel vor, Z.ai kennt seine Felder, und ohne sie denkt GLM selbst und verbraucht die 1500 Token der Analyse; nur der feste Weg (`fixed`) hätte diese Nutzer verschlechtert, ohne dass für sie ein Fehler bestand. Ein Denktext ohne Antwort wird dort jetzt verworfen statt als Faktenliste übernommen. `LLM_BASE_URL` auf `api.z.ai` bekommt die Felder jetzt auch (dieselbe Regel). Der Chat über einen eigenen Endpunkt schickt weiter keine Z.ai-Felder, auch nicht an `api.z.ai` (unverändert).
- **#412 (Medium):** "Konto und Daten" sagte, es gebe keine Teilen-Funktion. Jetzt steht dort das Teilen per Link: jeder mit dem Link liest Titel und Text, ohne Namen und E-Mail-Adresse, Widerrufen oder Löschen lässt den Link ins Leere führen, dazu der Verweis auf "Prompts speichern". "Terminal und MCP": `/save [Datei]` schreibt eine Markdown-Datei in den aktuellen Ordner (`cli/src/system.mjs`), nicht zu den gespeicherten Prompts. "Erste Schritte": der Satz zur Bestätigungsmail ist gestrichen, "Confirm email" ist aus; wird sie eingeschaltet, kommt er mit dieser Umstellung zurück. `updated` der drei Artikel auf 2026-11-25.
- **Tests und Mutationen:** `llm-providers.test.ts`, `llm-endpoint.test.ts`, `server/llm/config.test.ts`. Mit dem alten `analyze.ts` sind 5 der neuen Tests rot; die zu `LLM_BASE_URL` ohne Felder waren schon vorher grün, weil der alte Code `server` ausnahm. Acht Mutationen, alle erkannt: alter Code, Felder immer, Felder nie, Entscheidung nach Modellname, Denktext nach Label, Host per `endsWith`, ganze Adresse per `includes`, ohne `try`/`catch`. Gate grün (Audit, Typecheck, Lint, 4138 Tests, Build).
- **Für Kasum (Rechtstexte, nicht angefasst):** Die Nutzungsrichtlinie sagt "Die Inhalte der Nutzer sind nicht öffentlich einsehbar"; für geteilte Prompts stimmt das nicht. Die Datenschutzerklärung erwähnt das Teilen per Link nicht.
- **Nicht geprüft:** gegen einen echten fremden Endpunkt und gegen das echte Z.ai über den Custom-Slot; die Hilfe-Seiten nicht im Browser angesehen. Offen ist, ob GLM im Chat über den Custom-Slot auf `api.z.ai` von sich aus denkt und der Denktext dann im Chat erscheint (dort `reasoning: "fallback"`).

## 2026-11-24: `/skill` verteilt Skill 0.4.1 statt 0.3.0 (Branch `fix/skill-zip-375`, #375)

- **Ziel:** Der Download auf `/skill` war noch Skill 0.3.0, dessen Lücken beim Schwärzen erst 0.4.0 schloss; die Fixes aus #373 und #374 kamen dort gar nicht an. Kasum hat am 2026-11-24 entschieden, das ZIP neu zu bauen.
- **Version:** Skill 0.4.1 mit Skript 0.2.1, kein ZIP unter 0.4.0. `install.mjs --update` ersetzt nur eine ältere Version: wer 0.4.0 aus einem Klon installiert hatte (das README nannte bisher nur diesen Weg), bekäme die Fixes unter derselben Nummer nicht, und `--version` nennte für beide Skripte 0.2.0. Die Kopie `cli/src/context.mjs` und `cli/contract/context-pin.json` ziehen mit (Commit `f9624e70`, wie im Eintrag darunter der Stand von `main`, auf dem der Pull Request aufsetzt).
- **ZIP:** `public/skill/promptprinter-pp-0.4.1.zip` ist der Ordner `skill/` so, wie er im Repo steht (Baum `00f8fa14`, 42 Dateien unter `promptprinter-pp-0.4.1/`), gebaut mit `git -c core.autocrlf=false archive --format=zip --prefix=promptprinter-pp-0.4.1/ --mtime="2026-11-24 12:00:00 +0000" HEAD:skill`, SHA-256 `25ee9101…`. Ohne `core.autocrlf=false` packte Git unter Windows alle 41 Textdateien mit CRLF (nachgeprüft); den Befehl nennt `skill-data.ts`. Das ZIP mit 0.3.0 ist entfernt. Es war ein Archiv des alten Repos mit dem Skill unter `skill/pp/`; jetzt liegt `pp/` neben `install.mjs`, die Seite sagt deshalb "den Ordner pp/".
- **Geprüft:** entpackt gleich `skill/` im Worktree (`diff -r` ohne Unterschied, keine CR); `node install.mjs` aus dem entpackten Ordner legt in einem leeren Home-Ordner 0.4.1 nach `.claude/skills/pp` und `.agents/skills/pp`, das Skript meldet `pp-context 0.2.1`; über ein 0.3.0 aus dem alten ZIP verweigert `node install.mjs` mit Hinweis auf `--update`, `--update` ersetzt es durch 0.4.1. Tests in `skill/` (74) und `cli/` grün, der Vertrag unverändert, `skill-data.test.ts` rechnet die neue Prüfsumme nach.
- **README des Skills:** nennt zuerst den Weg über das ZIP (Prüfsumme vergleichen, `node install.mjs`, `--update`), danach den Klon.
- **Nicht geprüft:** ein Lauf von `/pp` aus dem ZIP in Claude Code; der Download auf promptprinter.app erst nach dem Deployment.

## 2026-11-24: Kontext-Skript startet git nie aus dem Projekt und schwärzt `*_PASS`, Redis-URLs und Werte mit Klammer (Branch `fix/kontext-sicherheit-373-374`, #373 und #374)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`) im Kontext-Skript des Skills (`skill/pp/scripts/context.mjs`) und seiner Kopie in der Terminal-App (`cli/src/context.mjs`); #372 und #383 liefen parallel in einer zweiten Sitzung. `skill/` wird nicht weiterentwickelt, Sicherheitsfehler im Skript werden trotzdem behoben, weil die Terminal-App eine geprüfte Kopie davon trägt.
- **#373 (High, Windows):** Node sucht ein Programm ohne Pfad unter Windows zuerst im Arbeitsordner des Kindprozesses, und das Skript startete `git` mit dem fremden Projekt als Arbeitsordner. Nachgestellt (Node 24.14, Kopie von `cmd.exe` als `git.exe` in einem Ordner im Scratchpad, danach gelöscht): `pack` meldete deren Ausgabe als Wurzel des Repos, `doctor` als Git-Version, `search` stürzte ab. Jetzt sucht `findGit` git vorher im PATH, nur in absoluten Ordnern, auf allen Systemen (ein leerer oder relativer Eintrag meint auch unter Linux und macOS den Arbeitsordner). `cli/src/system.mjs` startet PowerShell (`/copy`) und rundll32 (Browser bei der Anmeldung) mit festem Pfad aus `%SystemRoot%\System32`, wie `session.mjs` schon `whoami` und `icacls`. `NoDefaultCurrentDirectoryInExePath` bleibt ungesetzt: gemessen wirkt die Variable nur in der Umgebung des startenden Prozesses, nicht in der des Kindes; mit festen Pfaden bringt sie für die eigenen Aufrufe nichts, und in der Umgebung der Terminal-App erbten sie `/an claude` und `/an codex`, deren `cmd.exe` dann keine Programme im Projektordner mehr fände. Beobachtet: in dieser Sitzung setzte Claude Code die Variable für seine eigenen Werkzeuge (nicht im Benutzer- oder Systemprofil), der Skill unter Claude Code war auf diesem Rechner also schon geschützt, die Terminal-App nicht.
- **#374 (Medium):** `pass` ist ein Stichwort, nur als eigenes Wort im Namen (`SMTP_PASS`, `DB_PASS`, `pass:`, nicht `bypass`); das URL-Muster lässt einen leeren Benutzer zu (`redis://:geheim@host`, Platzhalter wie `redis://:password@host` bleiben); ein Wert mit Klammer gilt nur ohne Anführungszeichen als Code; `cut` schwärzt vor dem Kürzen (vorher standen am Schnitt etwa `postgres://admin:hunter2h…` und `ghp_FAK…` in der Ausgabe). Weil damit ganze Zeilen geschwärzt werden, hat das Schema im URL-Muster höchstens 64 Zeichen: ohne Grenze lief das Muster auf einer Zeile wie `a.a.a.…` quadratisch (200 KB: über 30 s), ein fremdes Repo hätte das Skript so hängen lassen können; vorher schützte nur das Kürzen davor.
- **Kopie und Pin:** `cli/src/context.mjs` je Commit neu kopiert, `cli/contract/context-pin.json` nennt als Commit `e82896c1`, den Stand von `main`, auf dem der Pull Request aufsetzt; ein Commit aus ihm selbst hätte nach dem Rebase-Merge eine andere Kennung. Der Kopf der Kopie sagt deshalb "und die Commits danach, die diese Kopie ändern". Keine Versionsnummer angehoben, kein neues ZIP für `/skill` (#375, Kasums Entscheid).
- **Regeln:** `cli/CLAUDE.md` nennt jetzt, dass kein Programm nur mit seinem Namen startet, `skill/CLAUDE.md` den festen Pfad für git und dass vor dem Kürzen geschwärzt wird.
- **Tests und Mutationen:** je Issue Tests in `skill/test/` und `cli/test/`, alle mit dem Stand vor der Änderung rot (in einer Kopie im Scratchpad gelaufen). #373: `findGit` mit leeren, relativen und fehlenden PATH-Einträgen, eine gepflanzte `git`-Datei im Projekt (unter Windows eine Kopie von `cmd.exe`, sonst ein Skript über einen leeren PATH-Eintrag), PowerShell und rundll32 mit `SystemRoot`. #374: die drei Formen aus dem Issue mit Gegenbeispielen, der Fall aus dem Issue über `search`, ein Geheimnis am Schnitt in Trefferzeile und Betreff, eine lange `a.a.a.…`-Zeile im Zeittest. Mutationen, alle erkannt: im Skill 13 neue oder angepasste Zeilen (git mit Namen in `pack` und `search`, relative PATH-Einträge, Shell, `pass` entfernt, `pass` am Wortende, Benutzer Pflicht, Schema ohne Grenze, Klammer in Anführungszeichen als Code, Code geschwärzt, Kürzen vor dem Schwärzen, zwei auf den neuen Code gezogen), im CLI zwei (powershell und rundll32 mit Namen).
- **Nicht geprüft:** Linux und macOS nur über die CI, lokal lief alles unter Windows; den vollen Mutationssatz fährt die CI, lokal liefen die neuen und angepassten Zeilen.

## 2026-11-24: Datei-Cache liefert Text statt JSON, GitHub-Import mit Größengrenze je Datei (Branch `fix/projektdateien-372-383`, #372 und #383)

- **Ziel:** zwei Funde aus dem Code-Review vom 2026-11-23 (Label `review-2026-11-23`); #373 und #374 liefen parallel in einer zweiten Sitzung.
- **#372 (High):** `server/project-file-cache.ts` las mit `redis.get<string>()`, der Upstash-Client wertet mit seiner Voreinstellung aber jede Antwort aus, die sich als JSON lesen lässt. Ab dem zweiten Zug innerhalb einer Stunde kam eine `package.json` als Objekt zurück, "42" als Zahl, eine Liste als Array; im Projektkontext stand "[object Object]", und `remaining -= undefined` machte das Zeichenbudget zu `NaN`, an dem keine Grenze mehr griff. Jetzt baut der Cache seinen Client mit `automaticDeserialization: false` und nimmt nur einen String als Treffer; `renderFilesContext` (`features/projects/lib/project-context.ts`) lässt einen Inhalt aus, der kein Text ist, und nennt die Datei wie eine, die nicht geladen werden konnte. Bestehende Einträge in Upstash sind schon Text (der Client schickt Strings unverändert), sie bleiben gültig. Die übrigen eigenen Upstash-Clients bleiben Sache von #393.
- **#383 (Medium):** `server/brain/github.ts` las jede Rohdatei mit `res.text()` ganz in den Speicher und kürzte erst danach; die `size` aus GitHubs Baum blieb unbeachtet. Jetzt gilt `MAX_REPO_FILE_BYTES` (200 000) zweimal: Baumeinträge darüber kommen nicht in die Auswahl (ihr Platz geht an die nächste Signaldatei, im Baum und in der Anzahl zählen sie mit), und der Body wird mit `readCappedText` (`server/llm/http.ts`) begrenzt gelesen; wird er größer, schließt `fetchRawFile` die Verbindung, und die Datei zählt wie eine fehlende. Eine Signaldatei über 200 KB fehlt damit in der Analyse, vorher gingen ihre ersten 20 000 Zeichen mit.
- **Tests und Mutationen:** `project-file-cache.test.ts` mit dem echten `@upstash/redis` 1.41.0 gegen eine nachgestellte REST-Schnittstelle (der Client bündelt von sich aus unter `/pipeline`) statt der `Map`, die das Verhalten nie sah: `package.json`, "42", eine Liste, Markdown als Gegenprobe, dazu ein Treffer, der kein Text ist. `project-context.test.ts`: ein Objekt aus dem Cache erscheint nicht im Prompt, die Datei danach bleibt in ihrer Grenze. `github.test.ts`: eine Datei mit einer `size` von 50 MB wird nicht abgerufen und gibt ihren Platz weiter, ein Body von 10 MB wird nach wenigen Stücken abgebrochen. Alle gegen den alten Code rot. Sieben Mutationen, alle erkannt: ohne die Client-Option (dann lädt jede JSON-Datei jeden Zug neu), ohne die Typprüfung im Cache, ohne die im Budget, ohne Größenfilter, `res.text()` statt `readCappedText`, ohne Abbruch der Verbindung, Filter erst nach der Auswahl.
- **Nicht geprüft:** gegen echtes Upstash und echtes GitHub; das Speicherverhalten auf Vercel ist nicht gemessen.

## 2026-11-22: `@google/genai` 3 mit fester API-Version `v1beta` (Branch `chore/google-genai-3`, ersetzt #333)

- **Ziel:** Kasum: alle offenen PRs prüfen und mergen, wenn sie nichts mehr brauchen. #356 (Dependabot, Minor und Patch, 13 Updates) ist gemergt und live geprüft (`/api/health`, acht öffentliche Seiten ohne Hydrationsfehler). #333 (`@google/genai` 2.32 auf 3.6.1) brauchte noch etwas: ab 3.0 spricht der SDK ohne Angabe die API `v1` statt `v1beta` an, und dort fehlen die `-latest`-Aliase und manche `-preview`-Modelle. Ob `gemini-3.5-flash` (Standard für einen eigenen Gemini-Key, der Weg des Key-Assistenten) auf `v1` läuft, lässt sich ohne echten Key nicht prüfen, und die bisherigen Tests ersetzen den SDK. Kasum: "Ja, festlegen".
- **Geändert:** `package.json` und `package-lock.json` genau wie in #333 (ein lokales `npm install` liess die `libc`-Angaben im Lockfile weg, deshalb Dependabots Diff übernommen). `server/llm/config.ts`: `GEMINI_API_VERSION = "v1beta"`; `server/llm/gemini.ts` baut alle drei Clients (Chat, Stream, Analyse) über `geminiClient()` mit dieser Version. Die Angabe im Code geht `GOOGLE_GENAI_API_VERSION` vor. Der Rest der Release Notes 3.0 bis 3.6.1 trifft uns nicht: Node ab 22 (wir haben 24), eine Typänderung nur in der Interactions-API, sonst neue Funktionen.
- **Geprüft:** derselbe Aufruf mit ersetztem `fetch` gegen beide Pakete: 2.32 ohne Angabe `/v1beta/models/gemini-3.5-flash:generateContent`, 3.6.1 ohne Angabe `/v1/…`, 3.6.1 mit Angabe wieder `/v1beta/…`. Die Adresse bleibt also dieselbe wie vor dem Update.
- **Tests und Mutationen:** neu `server/llm/gemini.test.ts` mit dem echten SDK und ersetztem `fetch`: Chat, Stream und Analyse gehen an `/v1beta/models/gemini-3.5-flash:…`, auch mit `GOOGLE_GENAI_API_VERSION=v1` in der Umgebung. `llm-providers.test.ts` erwartet `apiVersion: "v1beta"` im Konstruktor. Zwei Mutationen, beide erkannt (je 8 Tests rot): Angabe entfernt und Version `v1`.
- **Nicht geprüft:** ein Aufruf gegen die echte Gemini-API (kein Key in dieser Sitzung, auf dem Server bewusst kein `GEMINI_API_KEY`).

## 2026-11-21: Pulsringe in "So geht's" per CSS, React-Fehler #418 auf der Startseite behoben (Branch `perf/schritt-ringe-v4`, ersetzt #349, #350 und #353)

- **Ziel:** Kasum nach `perf/ladezeit`: die drei pulsierenden Ringe um die Knoten in "So geht's" ebenfalls auf CSS umstellen. Sie waren die letzte Endlos-Bewegung der Startseite in framer-motion und wurden nur ohne reduzierte Bewegung gerendert (`{!reduceMotion && …}`): der Server kennt die Einstellung nicht, also lieferte er die Ringe aus, und ein Browser mit reduzierter Bewegung renderte sie nicht. Das war der React-Fehler #418, der auf `/` nach `perf/ladezeit` noch übrig war.
- **Geändert:** `features/marketing/components/how-it-works.tsx` rendert den Ring immer als `<span class="finn-pulse">` mit der Verzögerung inline (`PULSE_STAGGER_S` = 0,45 s je Schritt); `.finn-pulse` in `app/globals.css`: 2,8 s, `ease-out`, Grösse 1 auf 1,6, Deckkraft 0,55 auf 0, unter reduced-motion `display: none`. Das CSS liegt weiter in einer Datei: 100 010 Bytes auf dem Stand von `perf/ladezeit`, 100 745 Bytes nach dem Rebase auf die Versionen (Paket 2). Die Grenze liegt damit zwischen 100 745 und 102 379 Bytes, es bleiben rund 1,6 KB; der CI-Schritt `check-css-chunks.mjs` schlägt an, sobald sie überschritten ist.
- **Geprüft:** headless mit reduzierter Bewegung auf `/`, `/terminal`, `/open-source`, `/mcp`, `/skill`: im Build von `main` #418 auf `/`, mit der Änderung auf keiner Seite ein Fehler. Die Ringe abgetastet: in beiden Builds Grösse 1 bis 1,6, Deckkraft 0 bis 0,55, Periode rund 2,8 s, Versatz rund 450 ms.
- **Gemessen** (Lighthouse 13.6 mobil, sechs Läufe je Build im Wechsel gegen `main`, Median): Score 89 auf 92, TBT 456 auf 347 ms, Hauptthread 3,84 auf 3,37 s (in allen sechs Paaren niedriger), FCP und LCP 956 gegen 959 ms, Speed Index 1,41 gegen 1,55 s (Spannen überlappen). CPU-Profil (zehn Paare, 10 s, 4x CPU): JavaScript-Zeit in acht von zehn Paaren niedriger (Median 1,95 auf 1,75 s), der Leerlauf insgesamt nicht von der Streuung zu trennen. Der Gewinn ist klein; der Grund für die Änderung ist vor allem #418.
- **Tests und Mutationen:** `how-it-works.test.tsx` (drei Ringe mit 0, 0,45 und 0,9 s; gleiches HTML mit und ohne reduzierte Bewegung, über ein geschaltetes `useReducedMotion`; Werte und reduced-motion in `globals.css`). `floaters.test.tsx` liest die gemeinsame Regel `.finn-floaters, .finn-pulse`. Sieben Mutationen, alle erkannt: Klasse nur ohne reduzierte Bewegung, Versatz 0,5, Dauer 3 s, Grösse 1,5, `.finn-pulse` und `.finn-floaters` unter reduced-motion umbenannt (zweimal); eine erste, zu lockere Fassung des Floaters-Tests liess `.finn-floatersX` durch und ist ersetzt.

## 2026-11-21: Passwort zurücksetzen übernimmt vorher Eingetragenes (Branch `fix/reset-password-prefilled`)

- **Ziel:** der Fund aus dem Eintrag darunter gilt auch für `/reset-password` (statisch mit Formular seit dem Ladezeit-Durchgang) und `/reset-password/update` (auf dem Server gerendert). Kasum: "Yes, do it here".
- **Live belegt, vor der Änderung** (headless Playwright gegen promptprinter.app, alle Skripte der Seite zurückgehalten, `/api/auth` abgefangen, nichts erreichte den Server): auf `/reset-password` eine Adresse vor dem Hydrieren eingetragen, dann geklickt: "Bitte eine gültige Email eingeben" neben der sichtbaren Adresse, danach war das Feld leer. Auf `/login` (mit dem Eintrag darunter) blieb die Adresse stehen, die Meldung war die Mensch-Prüfung. Ein erster Versuch hielt auf Vercel kein Skript zurück (die Seite war schon hydriert) und zeigte deshalb nichts; zurückhalten nach Herkunft und Typ, nicht nach dem Pfad `/_next/static/chunks/`.
- **Geändert:** `request-password-reset-experience.tsx` übernimmt die Adresse, `update-password-experience.tsx` beide Passwortfelder einmal nach dem Einhängen (`features/auth/lib/prefilled-input.ts`).
- **Geprüft:** lokaler Produktions-Build, dieselbe Probe: die vorher eingetragene Adresse geht an `/api/auth`, die Seite zeigt "Email unterwegs". `/reset-password/update` braucht eine Sitzung aus einem Reset-Link, dort nur im Test.
- **Tests und Mutationen:** neu `request-password-reset-experience.test.tsx` (gab es nicht: ungültige Adresse, Senden, Formular im Server-HTML, Übernahme beim Hydrieren), in `update-password-experience.test.tsx` zwei Fälle mit Hydrieren (beide Felder gleich, beide verschieden). 4 Mutationen, alle erkannt: Adresse nicht übernommen, je ein Passwortfeld nicht übernommen, die Felder vertauscht (fiel erst mit verschiedenen Werten auf, deshalb der zweite Fall).

## 2026-11-21: Anmelden, Registrieren und zweiter Faktor mit Formular im HTML (Branch `perf/auth-ssr`)

- **Ziel:** der offene Punkt aus dem Eintrag "Ladezeit, Finn und die Teilchen per CSS" vom selben Tag: `/login`, `/signup` und `/login/zweiter-faktor` sollen ihr Formular schon im statischen HTML ausliefern. Sie bleiben statisch vom CDN (`X-Nextjs-Prerender: 1`); `searchParams` auf dem Server hätte sie dynamisch gemacht und jeden Besuch die Antwortzeit gekostet, deshalb nicht.
- **Geändert:** kein `useSearchParams` und kein `Suspense` mehr. `next` und `error` liest der Browser in Handlern und Effekten aus `window.location` (`features/auth/lib/location-search.ts`), `safeNextPath` und `authCallbackErrorMessage` unverändert; beim Rendern liest niemand die Adresse, Server und Browser rendern also dasselbe. `OAuthButtons` hat keine Prop `next` mehr und liest das Ziel beim Klick. Der zweite Faktor liest `next` im Prüf-Effekt und nach dem Code. Die Meldung aus `?error=` erscheint nach dem Hydrieren.
- **Gefunden beim Umbau:** React, wie Next 16.4 es ausliefert (19.3 canary), lässt beim Hydrieren einen schon eingetragenen Wert im Feld stehen, löst dafür aber kein onChange aus (erst `react-dom-experimental` tut das, `queueChangeEvent`). Steht das Formular im HTML, füllen Browser und Passwort-Manager es oft vor dem Hydrieren: der State bliebe leer, das Formular meldete "Bitte eine gültige Email eingeben" neben einer sichtbar eingetragenen Adresse, und das nächste Rendern leerte das Feld. `features/auth/lib/prefilled-input.ts` übernimmt Adresse, Passwort, das AGB-Häkchen und den Code des zweiten Faktors (nur Ziffern) einmal nach dem Einhängen.
- **Gemessen** (Produktions-Builds, Basis `main` = `a0f6e4b` auf Port 3111, Änderung auf 3112, je ein Worktree mit eigenem `npm ci`):
  - HTML: Basis ohne Formular (17,5 KB, gzip 3,9 KB), Änderung mit (`/login` 36,6 KB, gzip 7,2 KB), beide `x-nextjs-prerender: 1`, auch mit Query.
  - Lighthouse 13.6 mobil, Chrome 152, echte Drosselung (`--throttling-method=devtools`, langsames 4G, 4x CPU), im Wechsel: `/login` LCP 7,2 auf 3,3 s (Median, Spanne 6,0 bis 7,8 gegen 2,7 bis 3,5 s, Basis 3 Läufe, Änderung 5; zwei Basisläufe brachen mit NO_NAVSTART ab), `/signup` 5,9 auf 3,0 s (4,4 bis 6,9 gegen 2,0 bis 3,3 s, je 3). FCP gleich LCP.
  - Simulierte Drosselung: LCP gleich (`/login` 945 gegen 937 ms, `/signup` 962 gegen 967 ms), wie im Ladezeit-Eintrag vermutet: die Simulation rechnet für das erste Bild nur blockierende Ressourcen und sah das leere HTML nicht.
  - TBT ist mit echter Drosselung höher (`/login` 1,8 s gegen 0,4 s): TBT zählt erst ab dem ersten Bild, und das kommt jetzt vor dem JavaScript statt danach. Chromes eigene Zähler (`Performance.getMetrics`, 6 s nach dem Laden, 4x CPU, je 4 Läufe im Wechsel) zeigen keinen Mehraufwand: Aufgaben gesamt `/login` 4,0 gegen 4,4 s, `/signup` 5,8 gegen 5,2 s (Spanne 4,3 bis 8,3 gegen 5,0 bis 7,1 s), Layout 0,46 gegen 0,45 s und 0,51 gegen 0,60 s.
  - CLS 0 ohne Query. Mit `?error=oauth_cancelled` und echter Drosselung 0,072 (ein Lauf): die Meldung erscheint nach dem Hydrieren über dem Knopf. Unter der Grenze 0,1 und nur auf Fehler-Links nach `/auth/callback`.
- **Im Browser geprüft** (headless Playwright gegen den Produktions-Build): `/login?error=oauth_cancelled` zeigt die Meldung ohne Konsolenfehler und ohne Hydrationsfehler; mit zurückgehaltenen Skripten ist das Formular sichtbar, vor dem Hydrieren gefüllte Felder kommen danach an `/api/auth` an, und `next` führt weiter zu `/login/zweiter-faktor?next=%2Fprojects%2F42`; der zweite Faktor ohne Sitzung schickt mit `next` zurück zur Anmeldung.
- **Tests und Mutationen:** `tests/support/static-page.tsx` rendert wie Next ohne Query vor und hydriert mit Query (Fehler beim Hydrieren werden gesammelt). Neue Fälle in den Tests von Anmelden, Registrieren, zweitem Faktor und `OAuthButtons`, dazu `location-search.test.ts`, `prefilled-input.test.ts`, `app/(auth)/auth-pages.test.tsx` (Formular im Server-HTML, kein `useSearchParams`, kein `Suspense`) und drei Fälle in `e2e/prod/produktion.spec.ts` (das gebaute HTML enthält das Formular; gegen den Build von `main` scheitern alle drei). Die Attrappe von `next/navigation` bietet `useSearchParams` nicht mehr an. 22 Mutationen, alle erkannt: je ein übernommenes Feld weggelassen (Adresse und Passwort beim Anmelden, Adresse und Häkchen beim Registrieren, der Code), der Code ohne Ziffernfilter übernommen, `?error=` nicht gezeigt und beim Rendern gelesen (scheitert am Hydrieren), `next` fest statt aus der Adresse (Anmelden, zweiter Faktor beim Anmelden, Registrieren, erneutes Senden, Ziel nach dem Registrieren, Prüf-Effekt und Code des zweiten Faktors, OAuth), `safeNextPath` weggelassen, leeres Feld und leeres Häkchen übernommen, `useSearchParams` zurück, `/login` wieder mit `Suspense`, die E2E-Fälle gegen den Build von `main`. Das Ziel nach dem Registrieren mit Sitzung hatte vorher keinen Test mit eigenem `next` und überlebte die erste Runde, jetzt mit Fall.
- **Offen:** ein Klick auf "Einloggen", bevor die Skripte laufen, schickt das Formular ohne JavaScript ab: die Seite lädt als `/login?` neu, die Felder sind leer und `next` ist weg (ohne `name` an den Feldern landen keine Zugangsdaten in der Adresse). Das galt schon für `/reset-password`. Der Prefetch von `/login` und `/signup` auf öffentlichen Seiten bleibt offen wie im Ladezeit-Eintrag.

## 2026-11-21: Migration 0062 in Produktion (Branch `docs/0062-produktion`)

- **Kasums Ja** in der Session, die 0062 gebaut hat ("Ja, anwenden"), nach dem Merge von #348. Angewendet mit dem Supabase-Werkzeug, Inhalt genau die Datei aus `main` (`e994513`); Migration `20261121125815 saved_prompts_ceiling_execute`.
- **Vorher gelesen:** Stand `0061`, `enforce_saved_prompts_bytes_on_update()` ohne `execute` (md5 des Funktionstexts `23182ada…`, gleich dem Text aus 0058), ACL nur `postgres`, Trigger wie in 0058, 3 gespeicherte Prompts.
- **Nachher lesend geprüft:** eine Funktion, md5 des Funktionstexts `d284a87f…`, gleich dem Text aus der Datei in `main`, mit `for account in execute $sql$`; `security invoker`, `search_path=""`, ACL unverändert, `anon` und `authenticated` ohne EXECUTE; Trigger-Definition unverändert, aktiv und auf dieselbe Funktion; 3 Prompts, 3 Versionen. Advisors gleich wie vorher: Sicherheit 2 Hinweise (`billing_events` ohne Policy, Schutz vor geleakten Passwörtern aus), Performance 2 Fremdschlüssel ohne Index und 15 ungenutzte Indizes.
- **Nicht geprüft:** ein Update auf Produktion (keine Testdaten, nur lesend), die Zeiten dort.
- **Doku:** `CLAUDE.md` nennt 0001 bis 0062 als angewendet.

## 2026-11-21: Die Byte-Grenze beim Ändern plant jeden Aufruf neu, Migration 0062 (Branch `fix/byte-trigger-plan`)

- **Ziel:** der offene Befund aus Paket 2 (Eintrag "Versionen gespeicherter Prompts, die Datenbank", "Gefunden, nicht behoben"). `enforce_saved_prompts_bytes_on_update()` aus 0058 sucht die geänderten Konten mit einem Join von `new_rows` und `old_rows` als feste Abfrage. plpgsql behält deren Plan je Verbindung, geplant beim ersten Aufruf; war das ein Update über eine Zeile, verbindet derselbe Plan später 5 000 Zeilen Zeile für Zeile. Heute trifft es niemanden (Produktion hat 3 gespeicherte Prompts, die Oberfläche ändert einen je Befehl), es ist Vorsorge.
- **Migration `0062_saved_prompts_ceiling_execute.sql`:** die Funktion per `create or replace`, die Schleife über `for account in execute $sql$ … $sql$ loop`. Sonst gleich: dieselbe Sperre (`pg_advisory_xact_lock`, Schlüssel wie 0051) vor dem Zählen, dieselbe Summe (`pg_column_size`), dieselbe Meldung (`P0001`), `security invoker`, `search_path = ''`, `revoke` von `public`, `anon`, `authenticated`. Der Trigger aus 0058 bleibt unverändert, er zeigt auf dieselbe Funktion (`create or replace` behält sie).
- **Hürde, vor der Messung festgelegt:** je Punkt 3 Läufe in frischen Prozessen (eine Verbindung je Prozess), Median. Befund gilt als nachgestellt, wenn das Update über 5 000 Prompts nach einem über einen mindestens 5-mal so lange braucht wie als erster Aufruf. 0062 besteht, wenn es danach höchstens 1,5-mal so lange braucht und unter 1 s bleibt. 0051 kommt nur mit, wenn ein Einfügen über 5 000 Zeilen nach einem über eine mindestens 1,5-mal so lange braucht und mindestens 300 ms mehr.
- **Gemessen** (PGlite 0.3.14, Postgres 17 als WASM, im Scratchpad; Nachbau der Supabase-Umgebung mit den Indizes auf `user_id`, echte Dateien 0051, 0057, 0058, auf Wunsch 0061; Messreihe ohne Nebenlast):

  | Update über 5 000 Prompts | erster Aufruf | nach einem Update über einen |
  |---|---|---|
  | vorher, 0051 + 0058 | 373 ms | 19 869 ms |
  | mit 0062 | 227 ms | 199 ms |
  | vorher, dazu 0061 (wie Produktion) | 597 ms | 12 842 ms |
  | mit 0062, dazu 0061 | 511 ms | 516 ms |

  Die erste Messreihe lief zum Teil gegen einen parallelen vitest-Lauf und streute stärker (vorher 330 gegen 29 138 ms, mit 0062 323 gegen 313 ms; mit 0061 und 0062 1,2 bis 1,3 s, kalt wie warm), die Richtung war dieselbe.
- **0051 bleibt, wie es ist (Entscheid nach Messung):** `enforce_account_ceiling()` und `enforce_project_cap()` lesen in ihrer Schleife nur `new_rows`, ohne Join. Ein behaltener Plan sortiert dort schlimmstenfalls anders, er verbindet nichts. Gemessen, Einfügen nach einem Einfügen über eine Zeile gegen als ersten Aufruf: 5 000 gespeicherte Prompts 204 gegen 409 ms, 5 000 Chats 187 gegen 171 ms, 5 000 Projekte eines Admins 291 gegen 161 ms, 2 000 Chats über 2 000 Konten 531 gegen 707 ms (erste Reihe 619/643, 695/529, 467/537, 1083/980). Keine Differenz erreicht 300 ms.
- **Verhalten geprüft:** dieselben Fälle (14 Prüfungen) gegen 0058 und gegen 0062 (je mit und ohne 0061), Ergebnis gleich: eine Zeile ändern, knapp unter der Grenze vergrössern, über die Grenze (`P0001`, nichts geändert), ein Konto über der Grenze kann den Text nicht ändern, auch nicht verkleinern, aber denselben Wert schreiben und eine andere Spalte ändern, fremde Zeilen (RLS, 0 Zeilen), zwei Konten in einem Befehl, die Advisory-Sperre mit dem Schlüssel aus 0051 wird gehalten, nach dem Löschen einiger Prompts unter der Grenze wieder änderbar. Dazu Funktion (`security invoker`, `search_path` leer, `EXECUTE` im Text), kein EXECUTE-Recht für `public`, `anon`, `authenticated`, Trigger-Definition vorher und nachher gleich, 0062 zweimal angewendet. 37 Prüfungen je Stapel grün.
- **Guards** (`tests/guards/migrations.test.ts`): eine Funktion darf Transition-Tabellen (die Namen aus allen `referencing`-Klauseln) nicht in einer festen Abfrage mit Join lesen, geprüft an der letzten Fassung jeder Funktion über alle Migrationen; der Erkenner hat einen eigenen Test (Schleifenkopf, Komma-Join, Join mit einer Tabelle, `EXECUTE`, eine Tabelle allein). Ein zweiter Test hält fest, dass 0062 nur den Schleifenkopf ändert: der Funktionstext ohne die `EXECUTE`-Hülle ist zeichengleich mit 0058 (Leerraum ausgenommen), dazu das `revoke`, kein Trigger angefasst. Vor 0062 schlug der erste Guard an genau dieser Funktion an.
- **Eine Verbindung mit dem alten Plan:** auf derselben Verbindung erst ein Update über einen Prompt, dann 0062 angewendet, dann das Update über 5 000: 54 ms (mit 0061 241 ms), ohne 0062 dazwischen 7 512 ms (7 613 ms). `create or replace` verwirft den behaltenen Plan also; dass andere, schon offene Verbindungen es ebenso tun, folgt aus der Prüfung der Katalogzeile bei jedem Aufruf in plpgsql, gemessen ist es nicht (PGlite hat eine Verbindung).
- **Mutationen**, je an einer Kopie von 0062 und gegen den Prüfstand: Sperre weg, Meldung geändert, `security definer`, Vergleich der `outputs` weg, Grenze immer gerissen, feste Abfrage statt `EXECUTE`, `search_path = public`, Schleife findet keine Konten: 8 erkannt. `revoke` weg überlebt dort zu Recht: `create or replace` behält die Rechte, die 0058 schon entzogen hat; den Fall fängt der Guard. An den Guards, in der echten Datei: feste Abfrage, 0062 fehlt, Meldung, `security definer`, ohne `revoke`, Trigger neu angelegt, zusätzlicher fester Komma-Join, eine neue Funktion in einer 0063 mit festem Join: 8 von 8 erkannt; 0062 danach aus der Sicherung zurückgeschrieben und byte-gleich. Eine erste Fassung der Mutation `security definer` traf den Kopfkommentar statt der Funktion und überlebte deshalb, korrigiert und wiederholt.
- **Doku:** `CLAUDE.md` (0062 noch nicht in Produktion, die Regel zu Joins über Transition-Tabellen), `docs/SETUP.md` ("Grenzen je Konto": wo die Funktion jetzt steht).
- **Nicht geprüft:** ein echtes Postgres (lokaler Stack in der CI spielt 0062 ein, die E2E läuft dort); die Zeiten auf Produktion, PGlite ist langsamer als ein natives Postgres.
- **Nicht in Produktion:** `0062` wartet auf Kasums einzelnes Ja.

## 2026-11-21: Versionen gespeicherter Prompts, die Oberfläche (Branch `feat/prompt-versionen-v2`)

- **Ziel:** der zweite PR von Paket 2 der Deck-Ideen, nach `0061` in Produktion (Kasums Ja am 21.11., angewendet und lesend geprüft: 3 Prompts, 3 Versionen, eine Leserechts-Policy, Sicherheits-Hinweise unverändert).
- **Speichern fragt nach der Version (DI-5):** gibt es einen Kandidaten mit anderem Text, klappt Speichern im Ergebnis-Panel zwei Wege auf, "Als neue Version" von „Titel“ und "Als neuen Prompt"; sonst bleibt es ein Klick. Der Kandidat kommt vom Server (`server/prompt-version-target.ts`, RLS plus `user_id`): zuletzt aus diesem Chat gespeichert (`saved_prompts.conversation_id`), sonst der Ursprung des Chats (`conversations.source_prompt_id`), in einem neuen Chat `?from=`. Eine neue Version ändert nur den Text, der Titel bleibt. Ein neuer Prompt vermerkt seinen Chat. Entscheid: eine aufklappende Wahl (Disclosure mit zwei Knöpfen, Escape und Klick daneben schliessen) statt zwei Knöpfen nebeneinander, weil der Kopf des Panels auf dem Handy für zwei nicht reicht, und statt eines ARIA-Menüs, das Pfeiltasten verlangte.
- **Ursprung beim ersten Zug:** ein Chat aus "Als Ausgangspunkt nutzen" schickt beim ersten Zug `fromPromptId` (`shared/lib/schemas.ts`, nur solange der Chat keine ID hat). `openTurn` liest den Prompt mit `user_id` und setzt `source_prompt_id` nur für einen eigenen, sonst startet der Chat still ohne Ursprung (die Policy aus 0061 lehnte sonst den ganzen Zug ab). Die CLI schickt das Feld nie.
- **Text an der Karte bearbeiten (DI-6):** `prompt-text-editor.tsx`, Feld bis 40 000 Zeichen wie eine Antwort im Chat; jede Änderung wird in der Datenbank eine Version. Ist der Prompt geteilt, sagt ein Hinweis, dass die neue Fassung sofort unter dem Link steht, und die Prüfung auf Schlüssel und persönliche Angaben fragt vor dem Speichern nach ("Trotzdem speichern"), wie vor dem Teilen.
- **Verlauf und Wiederherstellen:** `prompt-history.tsx` erscheint ab zwei Versionen ("Verlauf (n Versionen)"), lädt beim Aufklappen die neuesten 20 und auf Wunsch ältere, vergleicht zwei gewählte Versionen Wort für Wort und stellt eine alte wieder her (sie wird die neueste Version, Toast "Version 1 ist wieder aktuell, als Version 3"). Entfernt steht in `del` (durchgestrichen), Neues in `ins` (unterstrichen), dazu je ein Wort für Screenreader, also nicht nur Farbe. Nur die zuletzt gestartete Abfrage zählt, sonst zeigte ein Nachladen von vor dem Wiederherstellen den alten Stand. Bearbeiten und Wiederherstellen setzen den Text in der Karte erst, wenn er geschrieben ist: optimistisch gesetzt lud der Verlauf vor dem Schreiben nach und blieb bei der alten Zahl stehen (gefunden in der ersten CI von #347, der E2E-Spec wartete vergeblich auf "Verlauf (2 Versionen)"; der Mock im Unit-Test hatte die Version schon beim Aufruf angelegt). Eine alte Fassung mit demselben Text wie die aktuelle bietet kein Wiederherstellen an, die Datenbank legte dafür keine Version an.
- **Wort-Diff ohne Paket:** `shared/lib/word-diff.ts`, Myers über Wörter und Leerraum, gespeichert nur D² Zahlen; über 2 000 Schritten über Zeilen, danach als ein Block. Der Test verlangt für 6 000 Wörter mit zwei Änderungen unter 500 ms.
- **Export des Kontos:** `savedPromptVersions` (nach Prompt und Nummer), dazu `conversationId` am Prompt und `sourcePromptId` am Chat.
- **Unverändert:** CLI, MCP, `api/cli/prompts*`, `/geteilt/<token>`, Export für Entwickler und PDF lesen die aktuelle Fassung; `shared/lib/saved-prompts.ts` und Finns Systemprompt sind unberührt, `cli-contract.test.ts` grün. `saved-prompt-list.tsx` bleibt unter 400 Zeilen, dafür sind ihre Verlaufs-Kommentare gekürzt (Ratsche gesenkt).
- **Recht:** Datenschutz und `/cookies` nicht geändert. Versionen sind dieselbe Art Daten wie gespeicherte Prompts, kein neuer Empfänger, kein Cookie, kein `localStorage`; Vorschlag an Kasum: nichts ändern.
- **Texte:** de/en/fr/it/es (fr/it/es nicht muttersprachlich geprüft), Hilfe "Prompts speichern" mit zwei neuen Abschnitten (`updated`), README ("Versions"), `CLAUDE.md`, `docs/SETUP.md`.

## 2026-11-21: Ladezeit, Finn und die Teilchen per CSS, GSAP erst bei Bedarf, Text ohne Einblenden (Branch `perf/ladezeit`)

- **Ziel:** Kasum: die Seite lade "ewig", dazu eine Liste (Bilder, Formate, Lazy Loading, ungenutzter Code, JavaScript, Schriften, Caching, Layout-Verschiebungen, LCP, Eingabeverzögerung, langsames Handy-Netz, Lighthouse vorher und nachher). Gemessen statt der Liste nach gebaut: zuerst live (Lighthouse 13.6 mobil, Chrome 152 aus dem Puppeteer-Cache; Chrome 158 von Playwright bricht Lighthouse mit NO_NAVSTART ab), dann zwei Produktions-Builds im Wechsel (Basis `main` = `22afd9c` auf Port 3101, Änderung auf 3102, je ein eigener Worktree mit eigenem `node_modules`, weil Turbopack eine Junction ausserhalb des Projekts ablehnt).
- **Befund:** live Startseite mobil Score 73, TBT 1330 ms, Speed Index 4,1 s, LCP 1,2 s, CLS 0. Ein CPU-Profil mit Source Maps (Diagnose-Build, nur lokal) zeigte, wohin der Hauptthread geht: mit reduced-motion 3,2 s Leerlauf in 10 s, ohne 0,1 s. Die Endlos-Bewegungen von Finn (`AnimatedMascot`) und den Sternen und Blasen (`Floaters`, unter `sm` `hidden` und trotzdem animiert) liefen über framer-motion je Bild; GSAP mit ScrollTrigger lud beim Hydrieren, auch wenn "So geht's" weit unten lag. Die Wasserkante (CSS) kostet messbar nichts. Auf `/open-source` und den Seiten zum Passwort-Zurücksetzen war das grösste Element ein Absatz in einem Einstieg mit `opacity: 0` im HTML (LCP 3,4 bis 4,2 s).
- **Geändert:**
  - `shared/brand/animated-mascot.tsx`: der Leerlauf ist eine CSS-Klasse je Preset (`.finn-idle-*` in `app/globals.css`), Werte, Dauer und Easing wie die framer-Presets; die Kreuzblende beim Zustandswechsel bleibt framer-motion. Headless jede sichtbare Finn-Instanz auf sechs Seiten abgetastet (Startseite, `/open-source`, `/skill`, `/terminal`, `/mcp`, `/kontakt`): Ausschlag und Drehung in beiden Builds gleich, auf der Startseite auch die Periode (float, lean, nod, think, bob, peek; cheer und sigh hält nur der Test fest).
  - `shared/brand/floaters.tsx`: CSS (`.finn-floater`), ohne Hook und ohne "use client"; unter reduced-motion `display: none` statt `null`. Die Abschlusssektion rendert sie jetzt auf dem Server.
  - `features/marketing/components/how-it-works.tsx`: die GSAP-Linie lädt erst, wenn die Schrittleiste auf 600 px herankommt (`useInView`, `SPINE_MARGIN`); sie zeichnet sich ab "top 80%".
  - `/open-source`: der erste Abschnitt in `Rise` statt `FadeIn`. `features/auth/components/auth-experience-shell.tsx`: `Rise` mit 0,4 s statt framer-motion mit `opacity: 0`.
  - Ungenutztes CSS aus `globals.css` entfernt (`.btn-ghost`, `.input-base`, `.glass`, `.mask-fade-b`, zusammen 2,4 KB, in `src` nirgends benutzt). Anlass: mit den neuen Keyframes legte Turbopack das CSS der Schriften in ein zweites Stylesheet (98 772 + 3 607 Bytes statt 100 533 in einer Datei), und das blockiert das erste Bild ebenfalls: FCP und LCP der Startseite stiegen in der Messung von rund 960 auf 1250 ms. Mit 99 842 Bytes ist es wieder eine Datei. Die Grenze liegt also zwischen 100 533 und 102 379 Bytes; neu prüft `scripts/check-css-chunks.mjs` in der CI nach dem Build, dass es genau ein Stylesheet gibt.
- **Gemessen** (Lighthouse 13.6 mobil, simulierte Drosselung, Basis und Änderung im Wechsel, Median):
  - Startseite, 12 Läufe je Seite aus zwei Runden: Score 89 auf 96, TBT 453 auf 234 ms (Spanne 142 bis 886 gegen 113 bis 542), Speed Index 2,03 auf 1,27 s, Hauptthread 3,80 auf 3,18 s, Skripte 412 auf 357 KiB, FCP und LCP 948 gegen 956 ms (zweite Runde, gleich), CLS 0. Die erste Runde allein zeigte TBT 729 auf 205 ms, die zweite 407 auf 287 ms: TBT streut auf diesem Rechner stark, die Richtung war in beiden Runden dieselbe.
  - CPU-Profil Startseite (10 s, 4x CPU, mobil, vier Läufe je Seite im Wechsel): Leerlauf des Hauptthreads 2,2 auf 4,5 s, Stil, Layout und Malen 5,55 auf 3,36 s.
  - `/open-source` LCP 3,39 auf 0,94 s, `/reset-password` 3,93 auf 0,93 s, `/login` 4,18 auf 0,93 s (je vier Läufe), Score 89,5 auf 95, 87 auf 100, 81 auf 96.
  - Echte Drosselung (Lighthouse `--throttling-method=devtools`, langsames 4G und 4x CPU, je zwei Läufe): `/reset-password` LCP 5,2 auf 2,0 s, `/open-source` 4,2 bis 4,7 auf 2,1 bis 2,8 s, `/login` 5,4 auf 5,0 s (siehe Offen).
- **Geprüft, nicht geändert:** Bilder gehen schon als WebP über `next/image`, je Platz in passender Breite (`sizes`) und unterhalb des ersten Bildes `loading="lazy"` (5 von 8 auf der Startseite; die 3 übrigen sind Logo und Hero-Finn, vorgeladen). AVIF spart auf der Startseite rund 22 KB (sharp, gleiche Breiten), im ersten Bild rund 3 KB, und erzeugt bei Vercel je Bild und Breite eine zweite Umwandlung: weggelassen. Schriften kommen über `next/font` (selbst ausgeliefert, latin, `swap`, vorgeladen, Ersatzschrift mit angepassten Massen; CLS 0 auf neun gemessenen Seiten). `/_next/static` ist live ein Jahr `immutable`; optimierte Bilder liefert Vercel mit `max-age=0` aus (Treffer im CDN, lokal setzt Next 4 Stunden), das ist eine Einstellung der Plattform, nicht des Codes. Speed Insights bleibt (Entscheid 2026-10-06). Die Hero-Demo tippt weiter je Zeichen ein React-Rendern (Nicht-anfassen-Liste).
- **Offen:** `/login`, `/signup` und `/login/zweiter-faktor` rendern erst im Browser: `useSearchParams` in einem `Suspense` mit `fallback={null}` lässt im statischen HTML nur den Titel stehen, auf echtem langsamem 4G erscheint das Formular nach 4,5 bis 5,6 s. Der Lighthouse-Wert von 0,93 s für `/login` ist deshalb zu optimistisch (die Simulation rechnet für die erste Darstellung nur blockierende Ressourcen). Ein eigener PR, weil er den Anmeldeweg ändert. Ausserdem lädt jede öffentliche Seite `/signup` und `/login` vorab (Supabase und zod, rund 96 KiB), obwohl `FreshDocumentForThirdParties` diese Seiten ohnehin neu lädt.
- **Tests und Mutationen:** `animated-mascot.test.tsx` (Werte je Preset aus `globals.css`, Klasse am Rahmen, reduced-motion), `floaters.test.tsx`, `how-it-works.test.tsx` (Linie erst nach dem Beobachter mit 600 px), `auth-experience-shell.test.tsx`, ein Fall in `open-source/page.test.tsx`, `tests/guards/css-chunks.test.ts`. Mutationen, alle erkannt: Ausschlag `-8px` auf `-9px`, Dauer von cheer, Klasse unter reduced-motion umbenannt, Preset-Klasse nicht gesetzt, Deckkraft der Teilchen, "use client" zurück, Verzögerung weggelassen, Linie ohne Beobachter, `once: false`, `opacity: 0` an der Auth-Hülle, 0,8 statt 0,4 s, erster Abschnitt von `/open-source` wieder in `FadeIn`, CI-Schritt ersetzt, Prüfung erst ab drei Dateien.

## 2026-11-21: Versionen gespeicherter Prompts, die Datenbank (Branch `feat/prompt-versionen-db`)

- **Ziel:** Paket 2 der Deck-Ideen (Vault, "PromptPrinter Deck-Ideen"). Kasum hat am 20.11. den Entscheid vom 08.11. gegen Versionen aufgehoben (DI-2) und entschieden: Speichern erkennt eine neue Version im selben Chat und in einem Chat aus "Als Ausgangspunkt nutzen" (DI-5), der Text lässt sich an der Karte bearbeiten (DI-6), die Grenze gilt nur je Konto (DI-7). Zwei PRs: zuerst diese Migration ohne laufenden Code, dann die Oberfläche, gemergt erst, wenn `0061` in Produktion liegt (Vercel liefert `main` sofort aus). `0061` auf Produktion nur mit Kasums einzelnem Ja (DI-4).
- **Migration `0061_saved_prompt_versions.sql`:** `saved_prompts.outputs` bleibt die aktuelle Fassung, CLI, MCP, `api/cli/prompts`, Teilen und der Export lesen unverändert. Neu `saved_prompt_versions` (je Version der ganze Text, Nummer je Prompt, `unique (prompt_id, version)`, Fremdschlüssel `(prompt_id, user_id)` auf `saved_prompts (id, user_id)` mit `on delete cascade`, Grösse wie `outputs`). Zwei Trigger auf `saved_prompts` (Funktion `log_saved_prompt_versions()`, `security definer`, von `public`, `anon`, `authenticated` entzogen) hängen nach jedem Einfügen und nach jeder Änderung von `outputs->>'prompt'` eine Version an; Umbenennen und ein Update mit demselben Text nicht. Jeder Prompt im Bestand bekommt Version 1 mit seinem `created_at`. Grenze 20 000 Versionen und 40 MiB je Konto über `enforce_account_ceiling` (0051), `ACCOUNT_CEILINGS.savedPromptVersions`. Dazu `saved_prompts.conversation_id` und `conversations.source_prompt_id` (`on delete set null`, Teilindizes), beide mit Eigentümer-Prüfung in der Policy.
- **Abweichungen von der Arbeitsliste, mit Grund:**
  - Trigger je Befehl mit Transition-Tabellen statt je Zeile: ein Befehl mit vielen Zeilen schreibt seine Versionen in einem Einfügen, die Grenze zählt einmal statt einmal je Zeile (beim Auffüllen in `account-limits.spec.ts` 5 000-mal). Transition-Tabellen vertragen nur ein Ereignis und keine Spaltenliste, deshalb zwei Trigger, der für das Update vergleicht den Text selbst.
  - `user_id` verweist auf `public.profiles` statt `auth.users`, wie jede andere Tabelle (`prompt_shares` aus 0057); `profiles` hängt selbst per `on delete cascade` an `auth.users`.
  - Auch `service_role` darf nur lesen (wie `security_events`, 0053): der Server schreibt nie eine Version, also kann ihn auch niemand dazu bringen. Der Export des Kontos liest.
  - Ein Prompt ohne `prompt` im JSON bekommt eine Version mit leerem Text, statt dass sein Einfügen scheitert: die E2E-Tests der Grenzen fügen `outputs: {}` ein, und das Einfügen gespeicherter Prompts soll sich durch die Migration nicht ändern.
  - `conversations_updated_at` bekommt `when (old.source_prompt_id is not distinct from new.source_prompt_id)`: das Leeren durch das Löschen eines Prompts ist keine Aktivität im Chat, sonst sprängen dessen Chats an den Anfang der Liste.
  - Die Update-Policy von `saved_prompts` prüft den Chat mit, obwohl `authenticated` in Produktion nur `outputs` ändern darf (gelesen am 21.11.: Spaltenrecht `outputs:UPDATE`): der lokale Stack gibt mit den Standardrechten von Supabase die ganze Tabelle frei.
- **Typen:** `database.types.ts` von Hand im Format der Generierung (lokal kein Stack, Docker Desktop öffnet beim Start ein Fenster); der Schritt "Datenbank-Typen sind aktuell" in `e2e.yml` vergleicht die Datei mit `supabase gen types`.
- **Geprüft ohne Docker:** ein Prüfstand mit PGlite (Postgres 17 als WASM, nur im Scratchpad, keine Abhängigkeit des Projekts) baut die Umgebung von Supabase nach (Rollen, `auth.uid()`, Standardrechte), führt die echten Dateien 0051, 0057, 0058 und 0061 aus (0061 zweimal) und prüft 46 Fälle: Bestand, Nummern, Umbenennen, Wiederherstellen, mehrzeilige Updates, Lesen und Schreiben je Rolle, Eigentümer beider Verweise, Löschen samt `updated_at`, Grenze nach Zeilen und Bytes, Konto löschen. 18 Mutationen am SQL, alle erkannt (unter anderem Policy ohne `user_id`, Schreibrecht für `authenticated` oder `service_role`, Trigger ohne oder mit falschem Textvergleich, je eine Eigentümer-Prüfung weg, `updated_at` ohne `when`, ohne Bestand, `security invoker`, Funktion nicht entzogen, Grenzen verschoben, ohne `cascade`, Nummer immer 1). Guards: `migrations.test.ts` hält Rechte, Policy, Funktion, Trigger und Bestand von 0061 fest und verbietet späteren Migrationen ein Schreibrecht am Verlauf; `account-ceilings.test.ts` die Zahlen und die Eigentümer-Prüfungen samt der mitgezogenen Projekt-Prüfung; 16 Mutationen an den Guards, alle erkannt (dazu: feste Abfrage statt `EXECUTE`). Gate lokal grün (293 Testdateien, 4006 Tests, Build).
- **E2E:** `e2e/prompt-versions-db.spec.ts` prüft dasselbe als `authenticated` über PostgREST gegen den lokalen Stack; er läuft in der E2E der CI, lokal nicht (Docker).
- **Gefunden in der ersten CI, behoben:** der Zeilen-Test lief beim ersten Versuch in die Zeitgrenze der Data API (`57014`) und erst in der Wiederholung durch. Ursache, im Prüfstand nachgestellt: plpgsql behält den Plan einer festen Abfrage je Verbindung, geplant beim ersten Aufruf. War das ein Update über eine Zeile, verbindet der Plan später die Transition-Tabellen von 5 000 Zeilen Zeile für Zeile. Gemessen nach einem Update über eine Zeile, dann über 5 000 Prompts: mit beiden Triggern 13 bis 16 s, nur 0058 rund 9,5 s, nur der neue 2,3 bis 2,8 s; frisch geplant 0,1 bis 0,4 s. Der neue Trigger plant deshalb per `EXECUTE` bei jedem Aufruf (danach 0,3 s, der Guard hält es fest); der Test füllt in Gruppen zu 1 000.
- **Gefunden, nicht behoben:** `enforce_saved_prompts_bytes_on_update()` aus 0058 hat denselben behaltenen Plan, auf Produktion seit dem 2026-11-12. Es trifft nur ein Update über sehr viele gespeicherte Prompts in einem Befehl (die Oberfläche ändert einen), das dann an der Zeitgrenze scheitert. Die Korrektur wäre dieselbe (`EXECUTE`), braucht aber eine eigene Migration und Kasums Ja.
- **Nicht in Produktion:** `0061` wartet auf Kasums Ja. Gelesen am 21.11.: Produktion bei 0060, 3 gespeicherte Prompts, alle mit Text; nach dem Anwenden müssen es 3 Versionen sein.

## 2026-11-20: Vorlagen ausfüllen, "Als Ausgangspunkt nutzen", Export für Entwickler (Branch `feat/vorlagen-export-v2`)

- **Ziel:** Paket 1 der Deck-Ideen (Vault, "PromptPrinter Deck-Ideen", DI-1 von Kasum am 20.11.): ein gespeicherter Prompt bleibt kein Einzelstück, sondern wird wiederverwendet und in eigenen Code übernommen. Keine Migration, keine Modellkosten, Finns Systemprompt unverändert. Versionen (Paket 2) und der Vergleich im Probelauf (Paket 3) warten auf Kasum (DI-2, DI-3), weil "Versionen" am 08.11. bewusst weggelassen wurde.
- **Platzhalter in `shared/`:** `placeholders.ts` nach `shared/lib/`, `placeholder-form.tsx` nach `shared/ui/`, Importe direkt umgestellt (kein Re-Export), weil `features/prompts` `features/chat` nicht kennen darf. `fillPlaceholders` setzt jetzt auf `mapPlaceholders` auf (Verhalten gleich).
- **Ausfüllen bei gespeicherten Prompts und auf `/geteilt/<token>`:** dasselbe Formular, mit eigenem Hinweis (dort gibt es keinen Probelauf). Die geteilte Seite hat keinen i18n-Provider, `useT()` fällt auf Deutsch zurück wie die Seite. **Entscheid:** Kopieren in der Leiste der Karte nimmt weiter den gespeicherten Text, die ausgefüllte Fassung kopiert der Knopf im Formular, wie im Chat (Arbeitsliste: "Kopieren nimmt dann den ausgefüllten Text"). Grund: ein zugeklapptes Formular soll nie unbemerkt ändern, was die Leiste kopiert, und es bleibt ein Verhalten an drei Orten.
- **"Als Ausgangspunkt nutzen":** neuer Chat im Projekt des Prompts (sonst global) mit `?from=<id>`; `/prompts` liest dafür `project_id` mit. `server/start-from-prompt.ts` lädt mit der Sitzung (RLS) und zusätzlich `.eq("user_id", …)`, nur für eine UUID; fremd, gelöscht oder unsinnig ergibt still einen leeren Chat, ein Datenbankfehler wird nicht als "gibt es nicht" gelesen (`orThrow`). Der Text steht ungesendet im Eingabefeld, darüber "Pass diesen Prompt an: " mit dem Cursor dort. **Entscheid:** passt der Prompt samt dieser Zeile nicht in eine Nachricht (8000 Zeichen), fehlt der Knopf und die Seite füllt nichts vor, statt einen Text zu setzen, den der Server ablehnt. `saved-prompts.ts` blieb unberührt, es ist im Vertrag der CLI gepinnt.
- **Export für Entwickler** (`shared/lib/prompt-export.ts`, Feld `prompt-export-panel.tsx` an der Karte): JSON für OpenAI-kompatible Server, Anthropic und Gemini; curl (Here-Document mit gequotetem Ende), Python (nur Standardbibliothek), JavaScript (fetch, ES-Modul); `.prompt.md` mit YAML-Kopf (Titel, `template: mustache`, Variablen, auf Wunsch `system`, `ai_generated: true` im Kopf statt eines Kommentars davor, der den Kopf für Leser unbrauchbar machte). Offene Platzhalter werden erst hier zu `{{name}}` (Umlaute ausgeschrieben, gleiche Namen nummeriert), ausgefüllte Werte stehen im Text, "kein Platzhalter" bleibt wörtlich. Standard ist eine `user`-Nachricht; "Ersten Absatz als Systemnachricht" trennt bis zur ersten Leerzeile, ohne zweiten Absatz ist der Schalter aus. Key nur als Umgebungsvariable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`; OpenAI-kompatibel zusätzlich `OPENAI_BASE_URL`, ohne Key erlaubt für Ollama), Modell als `MODEL_NAME`. Export nur an der Karte, nicht im Ergebnis-Panel des Chats (dort ist es voll genug; erst speichern, dann exportieren).
- **Schnittstellen geprüft (20.11.):** OpenAI Chat Completions in der API-Referenz (developers.openai.com: `model`, `messages`, Rollen `system` und `developer`, "with o1 models and newer, developer messages replace the previous system messages"; `system` bleibt, weil jeder kompatible Server es versteht). Anthropic Messages (platform.claude.com: `x-api-key`, `anthropic-version: 2026-10-21` als aktuelle Version, `max_tokens`, `system` oben, Antwort `content[0].text`). Gemini `generateContent` aus dem Discovery-Dokument (`generativelanguage.googleapis.com/$discovery/rest?version=v1beta`: POST `v1beta/models/{model}:generateContent`, `systemInstruction` und `contents` als `Content` mit `role` und `parts[].text`, `Candidate.content`), der Kopf `x-goog-api-key` von der Key-Seite der Doku. Die Text-Beispiele der Gemini-Doku zeigen inzwischen die Interactions-API; `generateContent` steht weiter in der Referenz.
- **Tests und Mutationen:** der JavaScript-Export läuft im Test mit einem Stub für `fetch` (Adresse, Kopf, Rumpf, Antwortpfad je Anbieter); curl und Python werden als Text geprüft (Rumpf zurückgelesen, Kopf, Antwortpfad), Python läuft auf diesem Rechner nicht. 13 Mutationen, alle erkannt: ohne `.eq("user_id")`, `user_id` durch `id`, ohne ID-Prüfung, Fehler ungelesen, ohne Längengrenze, Zusatz in der Adresse; markierte Klammern als Variable, Werte nicht eingesetzt, Anthropic ohne `max_tokens`, Key als Text in JavaScript, Python und für Gemini, Here-Document ungequotet.
- **Texte:** alle neuen Texte in de/en/fr/it/es (fr/it/es nicht muttersprachlich geprüft), Hilfe "Prompts speichern" mit drei Abschnitten (`updated`), README (Funktionen), `CLAUDE.md`.
- **Nicht geprüft:** kein Aufruf gegen eine echte Schnittstelle mit dem exportierten Code (auch nicht, ob `anthropic-version: 2026-10-21` angenommen wird); wie gut glm-4.5-air mit "Pass diesen Prompt an:" umgeht, ist nicht gemessen.

## 2026-11-20: Footer, die drei Knöpfe auf dem Handy in einer Reihe (Branch `feat/footer-handy-symbole`)

- **Ziel:** Kasum nach dem Live-Blick: auf dem Handy sollen alle drei Knöpfe nebeneinander stehen, GitHub und LinkedIn nur mit ihrem Symbol, Portfolio mit Namen; im Browser bleibt es, wie es ist.
- **Neu:** unter 640 px sind GitHub und LinkedIn quadratisch (44 px, `max-sm:w-11 max-sm:px-0`), ihr Name steht dort nur für Screenreader (`max-sm:sr-only`), der Linkname bleibt "GitHub" und "LinkedIn". Das Raster Finn links, Spalten rechts gilt erst ab 1024 px (`lg:` statt `md:`): bei 820 px rutschte "Portfolio" sonst in eine zweite Reihe.
- **Geprüft:** headless bei 375, 820 und 1280 px, alle drei Knöpfe mit derselben Oberkante, kein waagrechtes Scrollen; `footer.test.tsx` hält die Klassen fest.

## 2026-11-20: Footer mit Spalten und drei Knöpfen (Branch `feat/footer-spalten`)

- **Ziel:** Kasum wollte den Footer "so richtig", nicht mehr als lose Link-Zeile: Seiten in Spalten mit Überschrift, das kazuvate-Logo weg, Finn bleibt, dazu GitHub, LinkedIn und sein Portfolio als blaue Knöpfe.
- **Neu:** links Finn, ein Satz in seiner Stimme ("Ich mache aus deiner Idee den fertigen Prompt. Kostenlos und Open Source.") und drei Knöpfe der Variante `accent` (44 px hoch, neuer Tab): GitHub (`REPO_URL`), LinkedIn und Portfolio (`features/marketing/lib/author-links.ts`). Rechts drei Spalten: Produkt (Funktionen, Open Source, Skill, CLI, MCP), Hilfe und Kontakt (Hilfe, Vergleiche, Über PromptPrinter, Kontakt), Rechtliches (Impressum, Datenschutz, Cookies, AGB, Nutzungsrichtlinie); Links 32 px hoch, auf Touch per `touch-hit-y` 44 px. Darunter Linie und Copyright. Das LinkedIn-Symbol ist eine eigene Komponente wie das GitHub-Symbol (`shared/ui/linkedin-icon.tsx`, Pfade aus lucide 0.474, lucide 1.x hat keine Marken-Symbole mehr).
- **Weg:** der kazuvate-Credit samt Farbton `--kazuvate` in `globals.css` (nur dafür da), die Wasser-Pille (`NavWave`) an den Footer-Links. Die Brand-Regel "keine corporate Footer-Spalten" in `CLAUDE.md` hat jetzt diese Ausnahme.
- **Geprüft:** headless mit Playwright auf `/ueber` bei 1280, 820 und 375 px: kein waagrechtes Scrollen, Knöpfe 44 px hoch (auf dem Handy rutscht "Portfolio" in eine zweite Reihe), kein "kazuvate" mehr im Text. `footer.test.tsx`: nur Seiten, die es gibt, jede einmal, alle Navbar-Punkte dabei, die drei Spalten, die drei Knöpfe mit Adresse, neuem Tab und blauer Fläche.

## 2026-11-20: Die Repos promptprinter-cli und promptprinter-pp werden gelöscht (Branch `chore/alte-repos-loeschen`)

- **Ziel:** Kasum will die beiden alten Repos nicht archiviert, sondern ganz gelöscht ("keine Public Archives, sondern komplett gelöscht"). Ihr Inhalt liegt seit PR #340 in `cli/` und `skill/`; ihr Git-Verlauf geht mit ihnen verloren (der Import war je ein Commit).
- **Was daran hing:** `/skill` lieferte das ZIP von `github.com/BajKasum/promptprinter-pp/archive/4451250e….zip`, `skill-archive.yml` lud es wöchentlich nach. Mit dem Repo wäre der Knopf ins Leere gegangen.
- **Neu:** dieselbe Datei (Skill 0.3.0, SHA-256 `88bceb21…` unverändert, 151 184 Bytes) liegt als `public/skill/promptprinter-pp-0.3.0.zip` und kommt von promptprinter.app selbst, der Knopf mit `download`. Unter `/skill/`, weil der Middleware-`matcher` auch `.zip` erfasst und `/skill` schon in `PUBLIC_PREFIXES` steht; ein Ordner `/downloads` hätte Besucher ohne Konto auf `/login` geleitet. Der Satz mit dem Commit fällt weg (den Commit gibt es danach nirgends mehr). `skill-data.test.ts` rechnet die Prüfsumme der Datei bei jedem Testlauf nach und prüft den öffentlichen Pfad; `skill-archive.yml`, `scripts/verify-skill-archive.mjs` und sein Guard entfallen, denn eine eigene Datei ändert ihre Bytes nicht wie ein Archiv, das GitHub neu packt. `.gitattributes`: `*.zip binary`.
- **Nebenbei:** `SECURITY.md` in `cli/` und `skill/` zeigen auf den Security-Tab des Haupt-Repos; der Pin der Kontext-Kopie (`cli/contract/context-pin.json`, Kopf von `cli/src/context.mjs`) nennt `BajKasum/PromptPrinter` und den Import-Commit `e0edf3a0` statt des alten Repos.

## 2026-11-20: CLI und Skill /pp liegen im Haupt-Repo (Branch `feat/cli-und-skill-im-repo`)

- **Ziel:** Kasums Frage, ob CLI und Skill noch nötig sind und ins Haupt-Repo gehören. Empfehlung: die CLI ist der wichtigste Teil des Open-Source-Wegs (`--local` ohne Konto), der Skill ist entbehrlich (dreimal gemessen, Ziel verfehlt, beendet). Kasums Wahl: beide ins Haupt-Repo ("Skill auch reinholen"). Ein Repo fürs Portfolio statt drei.
- **Übernommen:** `BajKasum/promptprinter-cli` (Stand `7d6db0b`) nach `cli/`, `BajKasum/promptprinter-pp` (Stand `2e3e545`) nach `skill/`, der Skill selbst in `skill/pp/` (gleicher Pfad wie im ZIP). Je ein Commit aus den versionierten Dateien (`git archive`); der Verlauf bleibt in den beiden Repos, die danach archiviert werden. Ohne die eigenen `.github/` der Repos; `skill/install.mjs`, die Tests und `npm run check` zeigen auf `pp/` statt `skill/pp/`.
- **Eigene Pakete (Entscheid):** beide bleiben ohne Abhängigkeiten, mit `node:test` und Mutationen, nicht im npm-Baum der Web-App. ESLint, TypeScript (`tsconfig.json`, `exclude`) und das Docker-Image lassen `cli/` und `skill/` aus. Workflows `cli.yml` und `skill.yml` (nur bei Änderungen dort, drei Systeme, Node 22 und 24, Mutationen, bei der CLI auch unter Windows) und `cli-release.yml` (Tag `cli-vX.Y.Z` statt `vX.Y.Z`, weil im Repo schon Tags wie `v1-saas` stehen; sonst wie bisher: Trusted Publishing, Provenance, kein Token). Der Workflow `contract.yml` der CLI entfällt.
- **Vertrag:** `cli/scripts/check-contract.mjs` liest den Web-Teil im selben Checkout statt von GitHub. `tests/guards/cli-contract.test.ts` lässt ihn in jedem `npm run test` laufen und prüft dazu Finns Regeln in `cli/src/finn-prompt.mjs` Zeichen für Zeichen gegen `CHAT_SYSTEM_PROMPT`. Er fand gleich `api/cli/me`, geändert mit dem Selbst-Hosten (#335): die Antwort ist gleich geblieben, Prüfsummen erneuert.
- **Guards:** `node-version.test.ts` erlaubt eine Node-Matrix nur in `cli.yml` und `skill.yml`, und nur mit der Untergrenze aus `engines.node` des Pakets und der Version aus `.nvmrc`. `comment-paths.test.ts` kennt die Dateien in `cli/` und `skill/`. Mutationstest: 8 Mutationen (gepinnte Datei, Kopie der Regeln, Quelle von `context.mjs`, Matrix ohne 24, mit 20, mit 26, `engines` auf 20, Matrix in `ci.yml`), alle erkannt.
- **CLI:** `whoami` kennt kein Pro mehr (ein alter Wert `pro` zeigt Free). Die Abnahme (`cli/acceptance/`) nutzt ein Admin-Konto statt des mit #339 entfernten `makePro` und findet die Web-App im Ordner darüber. `package.json` zeigt auf das Haupt-Repo (`directory: "cli"`).
- **Seiten und Texte:** `/terminal`, `/mcp` und der Hilfe-Artikel "Terminal und MCP" (`updated`) klonen das Haupt-Repo (`git clone --depth 1`, `cd PromptPrinter/cli`) und verlinken `tree/main/cli`; `/skill` verlinkt `tree/main/skill`, das ZIP kommt weiter vom festen Commit im archivierten Repo (Prüfsumme gleich, `skill-archive.yml` rechnet weiter nach). README (Wege, Funktionen samt Skill und seiner Messung, Tests, Struktur, Lizenz-Ausnahme für die Logos in `cli/assets/` und `skill/assets/`), `CLAUDE.md`, die READMEs und `CLAUDE.md` in `cli/` und `skill/`.
- **Nicht geprüft:** die Workflows `cli.yml` und `skill.yml` laufen erst auf GitHub; `cli-release.yml` erst mit Kasums erstem Tag `cli-v…` (vorher die erste Version von Hand, Trusted Publisher auf npmjs.com neu für `BajKasum/PromptPrinter`). Die Abnahme der CLI lief nicht (braucht den lokalen Stack).

---

## 2026-11-19: Bezahlung und Pro ausgebaut (Branch `feat/ohne-bezahlung-v2`)

- **Ziel (Open Source, Schritt 5, Teil Bezahlung):** Kasums Wahl: "Alles ausbauen: Lemon Squeezy, Checkout, Webhook, Kundenportal, /billing, Pro-Plan komplett aus dem Code löschen (bleibt im Tag v1-saas)", ausdrücklich samt AGB, Rückerstattung, Datenschutz und Cookies. Danach gibt es einen Weg: auf promptprinter.app drei Gratis-Prompts auf dem Server-Key, dann der eigene Key; im Einzelbetrieb (`SELF_HOSTED=1`) bleibt alles wie seit PR #335. Ein echtes Abo wurde nie verkauft.
- **Gelöscht:** `src/server/billing/`, `/api/webhooks/lemonsqueezy`, `lemon-squeezy.ts`, `use-lemon-squeezy.ts`, `lemon-checkout-button.tsx`, `pro-checkout-cta.tsx`, `pricing-grid.tsx`, `pricing.ts`, `pro-availability.ts`, die Seiten `/billing`, `/plans`, `/pricing`, `/pro-bald`, `/rueckerstattung`, `faq.tsx`/`faq-data.ts`, `docs/PRO-WIEDERAUFNAHME.md`, `e2e/billing-webhook.spec.ts` und der Guard `pro-availability.test.ts`, jeweils mit ihren Tests. Konto löschen kündigt kein Abo mehr.
- **Ein Plan (Entscheid):** `PlanKey = "free"`. `profiles.plan` bleibt als Spalte, der Code liest den Wert nicht: eine alte Zeile mit `'pro'` ist Free und läuft weiter (Tests in Chat, Gedächtnis, Einzelbetrieb, `cli/me`, Projekte, Sitzung). `api/cli/me` und die Ablehnungen tragen das Feld `plan` weiter, die Terminal-App sieht dieselbe Form. Keine Migration.
- **Admin (Entscheid):** bleibt wie zuvor: keine Projekt-Grenze, Server-Key ohne Grenze, kein Stundenlimit; Tagesbudget und Z.ai-Einwilligung gelten. Das **Monatskontingent** entfällt (`reserveMonthlyQuota`, `chatQuotaKey`, `getMonthlyQuotaUsage`, `texts.monthlyLimit`, `api.chatLimit`, `api.brainLimit`): kein Konto hat noch ein endliches Kontingent auf dem Server-Key, Admins hatten `Infinity`. Die Reihenfolge der übrigen Ausstiege hält `route.exits.test.ts` weiter fest. Mutationstest: Pro wieder auf den Server-Key gestellt, vier Tests rot.
- **Weitere Entscheide:** PDF-Export für alle (war Pro). Ein Abzeichen nur noch für Admins (`admin-badge.tsx`), "Free" hätte kein Gegenstück. `/usage` zeigt Projekte (x von 3), Gratis-Prompts und ob ein eigener Key hinterlegt ist. Registrierung ohne `?plan=pro` und `interested_in`. Umleitungen (308): `/pricing`, `/pro-bald` → `/open-source`; `/rueckerstattung` → `/agb`; `/billing`, `/plans` samt Unterpfaden → `/usage`.
- **Öffentlich:** neue Seite `/open-source` in Finns Ich-Form ohne Preis (Demo, selbst betreiben, Terminal mit `--local`, Code und MIT-Lizenz mit den Ausnahmen aus dem README; die Anleitung verlinkt den Hilfe-Artikel "Selbst betreiben"). `features/marketing/lib/open-source.ts` entstand in beiden Branches, zusammengeführt (dazu `FREE_OFFER_TEXT`). Navbar "Preise" → "Open Source", Footer mit GitHub-Link. Sitemap, `llms.txt`, `app-routes.ts`, `site-schema.ts` (ein Angebot zu 0 Euro, `sameAs` mit dem Repo), Vergleiche, Aufgaben- und Kontaktseite, fünf Hilfe-Artikel (`updated` nachgezogen).
- **Sicherheit:** CSP, `thirdPartiesFor`, `FreshDocumentForThirdParties` kennen nur noch Turnstile; der Webhook ist keine Ausnahme der Herkunftsprüfung mehr; `env.ts` und `.env.example` ohne Lemon-Squeezy-Variablen.
- **Rechtstexte** (nur entfernt, keine neue Aussage, Stand 19. November 2026): AGB ohne Ziffer 10 "Pläne, Preise und Zahlung" (11 bis 18 werden 10 bis 17, Verweise der Nutzungsrichtlinie nachgezogen); Datenschutz ohne Lemon Squeezy (Ziffern 4 und 5), Pro-Plan, Monatskontingente und Rechnungsunterlagen, Ziffern bleiben 1 bis 9; Cookies ohne Preise und Lemon Squeezy, Ziffern bleiben. Gefunden, nicht geändert: Datenschutz Ziffer 6 nennt bis zu 45 Tage, die Zähler des Gratis-Rahmens leben 400 Tage.
- **Wörterbücher:** alle fünf Sprachen ohne `pages.billing`, `pages.plans`, `planCopy`, `byokRequiredSoon` und die Pro-Sätze, neue Texte für `/usage`; fr, it und es nicht muttersprachlich geprüft.
- **Weg:** PR #338 liess sich nach dem Merge der Open-Source-Seiten nicht mehr per Rebase mergen (`CLAUDE.md`, Changelog, `open-source.ts`), deshalb `-v2` frisch von `main` mit denselben Commits.
- **Geprüft:** Gate grün (Audit, Typecheck, Lint, 3939 Tests, Build). Headless mit Playwright gegen `npm start` (Platzhalter-Supabase, `SELF_HOSTED=1`): sieben Umleitungen, Webhook 404, `/open-source` (eine h1, kein Preis, GitHub-Link, kein Überlauf bei 320 und 390 px; "--local" brach am Bindestrich um, behoben), Navbar bei 1024 px ohne Umbruch, Footer, CSP ohne Lemon Squeezy, `/agb`, `/datenschutz`, `/cookies`, `/nutzungsrichtlinie`, Hilfe, Sitemap, `llms.txt`. Nicht im Browser geprüft: die eingeloggten Seiten (`/usage`, Konto-Menü, Einstellungen), das deckt der E2E-Lauf der CI.
- **Bei Kasum:** in Vercel `NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL` und `LEMON_SQUEEZY_*` löschen; bei Lemon Squeezy Produkt und Live-Webhook archivieren; der Trigger `enforce_project_cap` nimmt Zeilen mit `plan = 'pro'` weiter von der Projekt-Grenze aus, der Code nicht (Update oder Migration auf Produktion nur mit seinem Ja); Tabellen und Abo-Spalten bleiben bis zu einer späteren Migration; `npm run contract` in der CLI meldet geänderte Serverdateien.

---

## 2026-11-19: Open Source auf den öffentlichen Seiten, Speed Insights nur auf Vercel (Branch `feat/open-source-seiten`)

- **Ziel (Open Source, Schritt 5, Teil öffentliche Seiten):** sichtbar machen, dass PromptPrinter Open Source ist und ohne Konto oder selbst betrieben läuft. Entschieden ohne Rückfrage (Kasum schlief), Gründe hier und im PR.
- **Landing** (Finns Ich-Form, `hero.tsx` unberührt): Die Karte unter den drei Schritten trägt einen zweiten Absatz "Ganz ohne Key: Ich bin Open Source ..." mit Link auf GitHub und auf `/docs/selbst-betreiben`. In derselben Karte statt in einer eigenen Sektion, weil er dieselbe Frage beantwortet wie der Key (womit rede ich?). Der Abschluss sagt, dass der Code offen liegt; "Fang kostenlos an, ohne Kreditkarte" ist weg, es gibt nichts zu bezahlen. Nur Textlinks, kein GitHub-Knopf, kein Preis, kein Bau-Tool.
- **Über-Seite:** Abschnitt "Der Code ist offen" (MIT, Name, Logo und Finn-Bilder ausgenommen, Selbstbetrieb in der Hilfe). Das Versprechen "Der Free-Plan ist echt gemeint" heisst "Mit eigenem Key kostet es nichts", ohne Plan-Begriff.
- **/terminal:** Abschnitt "Ohne Konto, mit einem freien Modell": `ollama pull qwen3`, `node bin/promptprinter.mjs --local` (Standard Ollama auf `http://localhost:11434/v1`), anderer Server mit `--base-url`, Modell mit `--model`, Key nur über `PROMPTPRINTER_API_KEY`; gegen README und `local.mjs` von `promptprinter-cli` gelesen. `NPM_PUBLISHED` bleibt false, `/mcp` unverändert (braucht ein Konto).
- **Hilfe-Artikel "Selbst betreiben"** (neue Gruppe "Open Source"): Kurzfassung von `docs/SETUP.md`, die Befehle in `features/marketing/lib/self-hosting.ts`, ein Test vergleicht jede Zeile mit den Codeblöcken von SETUP.md und jeden Schlüssel mit `.env.example`. Ehrlich, was nicht geprüft ist (kein echtes Ollama, Qualität mit kleinen Modellen nicht gemessen). `llms.txt` hat einen Abschnitt "Open Source".
- **Codeblöcke in der Hilfe:** `DocsShell` hatte keine Stile für `<pre>`, eine lange Befehlszeile verbreiterte die Seite auf dem Handy ("Terminal und MCP" bei 375 px 357 px zu breit, auch auf promptprinter.app gemessen). Jetzt scrollt der Block in sich.
- **Speed Insights nur auf Vercel** (Folgepunkt aus Schritt 4): `SiteSpeedInsights` ist eine Server-Komponente und rendert den Client-Teil (`speed-insights-client.tsx`, mit `beforeSend`) nur mit `NODE_ENV=production` und `VERCEL` gesetzt. Vorher lud jede Seite einer eigenen Installation ein Skript, das mit 404 scheiterte. Was gesendet wird, ist gleich, Datenschutz und `/cookies` bleiben. Der Browser-Test gegen den Produktionsaufbau ersetzt `/_vercel/**` nicht mehr: eine Anfrage dorthin wäre dort ein Fund.
- **Audit:** `npm run audit:gate` am 2026-11-19 sauber, `npm audit` meldet 0. Der Dev-Fund vom 18.11. (`picomatch`, GHSA-fc5q-39xc-vjpf) ist von GitHub am 2026-11-18 zurückgezogen.
- **Tests:** `site-speed-insights.test.tsx` (Vercel gerendert; Produktion ohne `VERCEL`, leeres `VERCEL`, Entwicklung, Test nicht), `self-hosting.test.ts`, `terminal-data.test.ts` (Weg ohne Konto, kein Key in einem Befehl), `docs-shell.test.ts`, Guard `open-source-pages.test.ts` (alle Stellen, keine nennt Pro, Preis oder Bau-Tool). Mutationstest: 5 Mutationen an `measuresSpeed`, 8 an den neuen Guards, alle rot.
- **Im Browser geprüft** (Chromium headless, `npm start` mit Platzhaltern, `SELF_HOSTED=1`, ohne `VERCEL`): Landing, `/ueber`, `/terminal`, `/docs/selbst-betreiben`, `/docs`, `/llms.txt`, hell und dunkel, 1280 und 375 px: Texte da, 0 px waagrecht zu breit, keine Konsolenfehler, keine Anfrage an `/_vercel/`. Nicht geprüft: Speed Insights auf Vercel nach dem Deploy (im HTML der Startseite muss `SpeedInsightsClient` stehen).
- **Gefunden, nicht behoben:** Mit "reduzierter Bewegung" (Systemeinstellung) wirft React auf `/` und `/terminal` den Hydrationsfehler #418, auch auf promptprinter.app vor diesem Branch. Folgepunkt.

---

## 2026-11-19: README auf Englisch und GitHub-Auftritt (Branch `docs/readme-englisch`)

- **Ziel (Open Source, Schritt 5, Teil README):** Das README ist das Gesicht des offenen Projekts und jetzt englisch: was Finn tut, drei Wege zum Ausprobieren (Demo auf promptprinter.app, die CLI mit `--local` und Ollama aus dem Quelltext, die Web-App mit `SELF_HOSTED=1`), Funktionen ohne Pro, Preise und Bau-Tools, "Under the hood", Struktur, Lizenz mit der Ausnahme für Name, Logo und Finn (jetzt auch die Screenshots in `docs/readme/`) und Tag `v1-saas`. Die Anleitungen in `docs/` bleiben deutsch, das README sagt es an jeder Verweisstelle.
- **Bilder:** drei Screenshots in `docs/readme/`, headless mit Playwright von promptprinter.app (hell, je unter 110 KB): Rückfrage und fertiger Prompt der Hero-Demo, die Workspace-Vorschau. Die Navbar ist weggeschnitten, weil sie an dem Tag noch "Preise" trug; `/skill` und `/terminal` nicht, weil `/terminal` nur den Weg mit Konto zeigte und der Skill nicht mehr gepflegt ist.
- **Zahlen nur gemessen** (2026-11-19): `vitest run` 4228 Tests in 293 Dateien, 60 Migrationen, 52 Guard-Testdateien, 201 gemergte PRs. Im README gerundet ("over 4,000", "more than 50", "over 200"), weil der Ausbau von Pro in derselben Nacht Tests und Guards entfernt.
- **GitHub:** Beschreibung "Open-source AI chat that asks one bundled question and writes a finished prompt for any AI. Next.js and Supabase, self-hostable with Ollama.", Homepage promptprinter.app, Themen dazu `open-source`, `self-hosted`, `ollama`, `supabase`, `typescript`, `llm` (die bisherigen sieben bleiben). Sonst keine Repo-Einstellung.
- **Geprüft:** `doc-links.test.ts`, jeder externe Link per `curl -sI` (alle 200), das README über die Markdown-API von GitHub gerendert und angesehen, Gate grün. Nicht geprüft: die drei Wege mit einem echten Ollama (auf dem Rechner nicht installiert).

---

## 2026-11-18: Selbst betreiben mit eigenem Modell (Branch `feat/selbst-hosten`)

- **Ziel (Open Source, Schritt 4):** `git clone`, eine `.env`, `npm run dev` oder das Docker-Image, dann läuft Finn mit einem Modell über eine OpenAI-kompatible Schnittstelle (Standard Ollama), ohne Upstash, Turnstile, Resend und Lemon Squeezy. promptprinter.app wird an keiner Stelle lockerer.
- **Schalter `SELF_HOSTED=1`** (`src/server/self-hosted.ts`): nur der Wert `1`, nie auf Vercel (dort bricht der Start ab, statt den Wert still zu übergehen). Er macht Upstash in der Startprüfung und in `/api/health` optional und lässt das Ratenlimit in Produktion im Speicher zählen statt geschlossen zu scheitern.
- **Eigener Endpunkt `LLM_BASE_URL` + `LLM_MODEL` (+ optional `LLM_API_KEY`):** dritter Server-Anbieter `endpoint` nach Z.ai und Gemini, über den Weg des Custom-Slots (`llm/custom.ts`), durch `llm-retry.ts`; das Failover bleibt Z.ai/Gemini. Ohne Key geht kein Authorization-Kopf mit, die Z.ai-Felder (`thinking`) gehen nicht an fremde Server. `env.ts` warnt, wenn der Endpunkt ungenutzt bleibt (kein Modell, von einem Z.ai- oder Gemini-Key verdrängt, http ohne Einzelbetrieb).
- **SSRF:** `assertServerEndpointUrl` lässt den Endpunkt des Betreibers nur im Einzelbetrieb lokal und über http zu. Endpunkte der Nutzer (BYOK) gehen weiter immer durch `assertPublicHttpsUrl`, auch im Einzelbetrieb.
- **Kostenkette:** Im Einzelbetrieb zählt ein Zug ohne eigenen Key auf dem eigenen Endpunkt nicht gegen Monatskontingent und Gratis-Rahmen (`model-call.ts`), der Chat zeigt keinen Key-Hinweis (`session.ts`, `api/cli/me`). Stundenlimit und Tagesbudget bleiben. Die Einwilligung zu Z.ai galt schon nur für den Z.ai-Pfad.
- **Tests:** `tests/guards/self-hosted-strict.test.ts` prüft für fünf Umgebungen ohne gültigen Einzelbetrieb (darunter promptprinter.app und `SELF_HOSTED=1` auf Vercel) jede Stelle, die der Schalter lockert, mit Gegenprobe. Dazu Tests je Stelle (`self-hosted`, `env.self-hosted`, `llm-endpoint`, `chat/route.self-hosted`, `session`, Ratenlimit, URL, Health, `cli/me`). Mutationstest: 18 Mutationen (Schalter, Startprüfung, Ratenlimit, Health, URL-Prüfung, Chat, Analyse, Kostenkette, Key-Hinweis, Authorization-Kopf), alle rot.
- **Im Browser geprüft:** lokaler Supabase-Stack, Stub mit der Schnittstelle von Ollama, `npm run build` + `npm start` und das Docker-Image (per `docker run`): Registrieren, Chat-Antwort über den Endpunkt, Verlauf nach Neuladen, Projekt anlegen. Nicht geprüft: ein echtes Ollama (auf dem Rechner nicht installiert), Linux als Docker-Host.
- **Doku:** `docs/SETUP.md`, Abschnitt "Selbst betreiben"; `.env.example` nennt die neuen Variablen und trägt `ZAI_API_KEY` leer statt `...` (eine kopierte Vorlage wählte sonst Z.ai mit dem Schlüssel "..."); `scripts/check-env.mjs` verlangt Upstash im Einzelbetrieb nicht; `docker-compose.prod.yml` kennt `host.docker.internal` auch unter Linux.

---

## 2026-11-17: Open Source unter MIT (Branch `chore/open-source-mit`)

- **Kasums Entscheid:** PromptPrinter wird kein Produkt mehr, sondern ein offenes Projekt fürs Portfolio, das jeder mit freien Modellen nutzen kann. Erster Schritt: die Lizenz.
- **`LICENSE`:** MIT statt "All Rights Reserved, nur zum Ansehen", wie schon `promptprinter-cli` und `promptprinter-pp`. `package.json` trägt `"license": "MIT"`, bleibt `private` (kein npm-Paket).
- **Ausgenommen:** Name, Logo (`docs/brand/`) und die Bilder von Finn (`public/mascot/`). Die Bilder sind mit Higgsfield entstanden (`z_image`, `nano_banana_pro`); welche Rechte daran weitergegeben werden dürfen, ist nicht geprüft, deshalb gibt die Lizenz sie nicht weiter. Hinweis im README und in `docs/brand/logo/README.md`, nicht im Lizenztext, damit GitHub die Lizenz als MIT erkennt.
- **Tag `v1-saas`** auf `0fda41d`: der letzte Stand als SaaS (Pro, Lemon Squeezy, alte Lizenz), bevor die Bezahlteile ausgebaut werden.

---

## 2026-11-14: Review-Befunde in Server, Gedächtnis und Anbietern (Branch `fix/review-server-2`)

- **Ö17, Gedächtnis:** Scheiterte nach dem Modellaufruf nur das Speichern, gingen alle Reservierungen zurück, obwohl das Modell gearbeitet hatte. Jetzt bleiben sie (`BrainSaveError`), wie im Chat bei `persist_failed`.
- **Ö43, "veraltet" nach Neu analysieren:** Der Zwischenspeicher hielt bis zu fünf Minuten die ältere SHA. Nach dem Speichern schreibt `rememberRepoHead` die gelesene SHA.
- **Ö44, Abbruch:** Ein abgebrochener Aufruf des Browsers setzte das Fehlerzeichen für 60 s für alle. Jetzt nur noch echte Fehler bei GitHub.
- **Ö20, eigener Key:** Nach dem Speichern hiess ein Lesefehler beim aktiven Key "nicht gespeichert". Jetzt "nicht aktiviert".
- **Ö16, Suche im Terminal:** Mit einem Stern griff das Limit vor dem Sieb. Jetzt liest die Suche dann bis zu 200 Zeilen je Spalte.
- **Ö23, Webhook:** Zwei Konten mit derselben Kundennummer warfen wie ein Datenbankausfall (5xx, Lemon Squeezy schickt wieder). Jetzt keines, eigene Warnung `billing.webhook_customer_id_ambiguous`.
- **Ö66, Sicherheitsprotokoll:** Die Bearer-Routen unter `api/cli` (me, prompts, prompts/[id], refresh, logout) gaben 401 und 404 ohne `denied()`. Jetzt mit, und der Guard kennt sie.
- **Ö48, Strom:** Ein zurückgehaltenes CR und ein letzter Rahmen ohne Leerzeile gingen am Ende verloren.
- **Ö47, BYOK-Ströme:** Anthropic, OpenAI und Gemini per eigenem Key hatten keine Fristen. Jetzt dieselben wie Z.ai und Custom, mit 90 s bis zum ersten Stück.
- **Ö61, Probelauf mit eigenem Key:** 6000 statt 1500 Token, denkende Modelle zählen das Denken zur Ausgabe.
- **Ö53, Anmelde-Sperre:** Der Kommentar verspricht nur noch "nicht im Klartext"; ungesalzen, die Schlüssel leben 15 Minuten.
- **Ö49 verworfen:** Wiederholt wird nur vor dem ersten Wort, drei Versuche bis zur Erstfrist bleiben unter `maxDuration` 300, und der Probelauf hat seit dem Branch `fix/review-gratis` ebenfalls 300.
- **Ö50 verworfen:** betrifft nur Modelle, die immer denken; der Standard bleibt glm-4.5-air (Kasums Entscheid 2026-11-08).

Mutationstest für Ö48 (alte Fassung: beide neuen Tests rot).

---

## 2026-11-14: Review-Befunde auf öffentlichen Seiten und im Chat (Branch `fix/review-oberflaeche`)

- **Ö11, geteilter Prompt:** `/geteilt/<token>` zeigt jetzt über dem Kopieren einen Hinweis, wenn die Prompt-Prüfung Befehle, Dateizugriffe oder Versuche findet, frühere Regeln aufzuheben (wie im Chat). Schlüssel und persönliche Angaben prüft schon der Dialog vor dem Teilen.
- **Ö25, Kontrast im Kopf:** Die Deckkraft der Kopf-Fläche steigt von 0.82 auf 0.9, damit die Links auch über dunklem Inhalt darunter bei 4,5:1 bleiben.
- **Ö34, verdeckter Fokus:** `scroll-padding-top: 6rem` auf Seiten mit dem festen Kopf: Fokus, Seitensuche und Anker landen unter Leiste und Wasserkante.
- **Ö32, Platzhalter:** Routensegmente (`/[id]/`, `[...slug]`) und Tupel (`Array<[string, number]>`) galten als Platzhalter.
- **Ö36, Skill-Download:** `/skill` bot neben dem ZIP des festen Commits das Klonen an, das Commit und Prüfsumme umgeht. Jetzt nur das ZIP, mit Hinweis auf die Prüfsumme.
- **Ö37, Beispiel-Prompts:** Zwei Beispiele auf `/aufgaben` setzten Angaben ein, die in der Antwort der Person fehlten (Technik der Imkerei-Seite, Zahl der Mitglieder). `TASK_GUIDES_UPDATED` auf 2026-11-14.
- **Ö31, teilweise:** `mode` im `done`-Ereignis ist ein String, ein neuer Wert bricht ältere Browser nicht. Eine kaputte Nutzlast nach Text bleibt bewusst ein Protokollfehler (#210, `chat.test.tsx`).
- **Ö28 verworfen:** Projekt-Anweisungen und "Über mich" müssten über Seite, Chat und Thread bis in den Browser, nur damit ein wegklickbarer Link-Hinweis seltener erscheint.

---

## 2026-11-14: Letzte Review-Befunde der Runde (Branch `fix/review-rest`)

- **Ö9, Sidebar-Listen:** Scheiterte das Lesen der letzten Chats oder Projekte, fiel die ganze eingeloggte App in `global-error`. Jetzt bleibt die Liste leer und der Fehler geht an `captureError`; die Seiten selbst lesen weiter mit `orThrow`.
- **Ö26, llms.txt:** "Vier Wege" und "Fünf Aufgaben" standen fest im Text. Das Zahlwort kommt jetzt aus der Länge der Listen (`numberWord`), ein Test hält es fest.
- **Ö35, Erscheinungsdatum der Hilfe:** Jeder Artikel nannte in Metadaten und JSON-LD den Start der Hilfe (2026-07-25), auch "Terminal und MCP" vom 29.10. `DocArticle` hat ein optionales `published`, `docPublished` nimmt es, der Test verlangt `published` zwischen Start und letzter Änderung.
- **Ö65, Ausnahmen des Lesefehler-Guards:** Der Schlüssel `Datei:data` deckte jede `data`-Abfrage der Datei. Die drei Stellen haben eigene lokale Namen (`signed`, `recentProfiles`, `profile`).
- **Ö24, globals.css:** Der Kommentar zu `@theme inline` nannte den Kopf der Seite als Element mit eigener `.dark`-Klasse (trägt er nicht mehr), und der Block des Kopfs stand zwischen dem Kommentar zu den Nav-Links und deren Regeln. Beides gerade gerückt, keine Regel geändert.
- **Ö64, Pfad-Guard der Kommentare:** prüfte `playwright.prod.config.ts`, `postcss.config.mjs` und `e2e/` nicht. Jetzt jede `*.config.ts`/`.mjs` im Wurzelverzeichnis und `e2e/`; heute ohne neue Funde.

---

## 2026-11-14: Review-Befunde in Server und Betrieb (Branch `fix/review-server`)

- **Ö52, Wiederherstellungscodes:** `replaceRecoveryCodes` löschte die alten Codes vor dem Einfügen der neuen; scheiterte das Einfügen, stand das Konto ohne Rückweg da. Jetzt erst einfügen, dann nur die älteren Zeilen dieses Kontos löschen (`not id in (…)`).
- **Ö55, Marken in "Über mich":** `aboutMeBlock` entfernte nur die genaue Schreibweise `<angaben_der_person>`. Verschachtelt (`<angaben<angaben_der_person>_der_person>`), grossgeschrieben oder mit Leerraum kam eine Marke durch. Jetzt jede Form, so lange, bis keine mehr da ist.
- **Ö14, eine Abfrage je Zug weniger in Folge:** "Über mich" wird neben dem Projektkontext gelesen statt davor, die Reihenfolge der Blöcke im Systemprompt bleibt.
- **Ö10, Nutzungsseite:** Ein Lesefehler der Nachrichtenzählung brach die Seite auch dann, wenn sie den Wert aus Redis zeigt. Jetzt nur, wenn die Zählung der Rückfallwert ist.
- **Ö6, Port des Prod-Containers:** `docker-compose.prod.yml` bindet ihn nur an `127.0.0.1` (`HOST_BIND`), die App vertraut `X-Forwarded-For` (docs/DOCKER.md).
- **Ö7, Rotationsskript:** blättert nach `id` statt nach dem nicht eindeutigen `created_at`.
- **Ö38, /terminal:** beschrieb `/save` als Speichern bei den gespeicherten Prompts; das Programm schreibt eine Markdown-Datei in den aktuellen Ordner.

Mutationstest für Ö52 und Ö55 (alte Fassung: die neuen Tests schlagen an).

---

## 2026-11-14: Weitere öffentliche Review-Befunde (Branch `fix/review-gratis`)

Niedrige Befunde aus dem Code-Review vom 12.11., nach Wirkung ausgewählt (Begründung jeweils am PR des Befunds):

- **Gratis-Rahmen und Probelauf:** Ein Redis-Fehler beim Zählen meldete "0 Gratis-Prompts übrig", jetzt fehlt das Feld (Ö45). Waren die Probeläufe des Kontos verbraucht, hiess es "diesen Prompt schon ausprobiert", jetzt ein eigener Text `testRunsUsed` (Ö46). Das Ergebnis eines Probelaufs blieb nach dem Ausfüllen der Platzhalter stehen (Ö27). `api/test-run` hat wie der Chat `maxDuration = 300`, damit der catch-Zweig vor dem Abbruch durch Vercel läuft (Ö22).
- **Linkprüfung (`shared/lib/prompt-check.ts`):** Der Benutzerteil vor "@" galt als Host (Ö60), Hosts mit Buchstaben anderer Schriften fielen durch (Ö57), Namen wie `10.fremd.ch` galten als private Adresse (Ö58), und ein Teilstring dessen, was die Person schrieb, machte einen Host bekannt, auch in der Prüfung auf Geheimnisse, die an einen Host gehen sollen (Ö59). `logo@2x.png` und `git@github.com` galten als E-Mail-Adresse (Ö56).
- **Ladezustände:** Verschieben in ein Projekt und der Stand des zweiten Faktors drehten nach einem Lesefehler für immer, jetzt ein Hinweis mit "Erneut versuchen" (Ö29, Ö42). "Über mich" überschrieb, was während des Speicherns getippt wurde (Ö41).
- **404 statt Fehlerseite:** Eine Chat- oder Projekt-Kennung, die keine UUID ist, gibt `notFound()` (`shared/lib/uuid.ts`), statt dass der Lesefehler von Postgres die Fehlerseite zeigt (Ö8, Ö51).
- **Terminal abmelden:** `api/cli/logout` beendet nur noch Terminal-Sitzungen, das Token einer Browser-Sitzung bekommt 401 (Ö15).
- **Kommentar-Ratsche:** prüft jetzt auch `scripts/` und verlangt, dass ein Basiswert nach einer Bereinigung gesenkt wird (Ö62, Ö63); dazu zwei Kommentare mit Verlauf oder falschem Funktionsnamen (Ö30, Ö33). Toter Prop `collapsed` im Logo entfernt (Ö54).
- **Projekt löschen:** Die Projektdateien gingen vor dem Löschen des Projekts aus dem Speicher; scheiterte es, blieben Zeilen ohne Dateien. Jetzt erst nach dem Löschen, wie die Anhänge (Ö39).

Neue UI-Texte in fünf Sprachen, fr/it/es ungeprüft. Mutationstest für Ö41 und Ö59.

---

## 2026-11-14: Supabase kann das CAPTCHA prüfen (Schalter, aus), dazu Review-Befunde im Konto (Branch `feat/auth-captcha-schalter`)

- **Anmelde-Sperre je Konto, direkter Weg:** Die Sperre und Turnstile gelten nur in `/api/auth`, den Passwort-Grant von Supabase Auth erreicht man mit dem Anon-Key auch direkt (Befund vom 12.11., `docs/SETUP.md`, "Anmelden: Sperre je Konto"). Neu ist der Schalter `AUTH_CAPTCHA_VIA_SUPABASE` (`server/security/auth-captcha.ts`, Standard aus): Steht er auf `true`, prüft `/api/auth` das Token nicht selbst, sondern gibt es Anmelden, Registrieren, Reset und erneutem Senden als `captchaToken` mit, denn ein Token ist nur einmal einlösbar. Lehnt Supabase es ab (`captcha_failed`), antwortet die Route wie bei der eigenen Prüfung (403, `kind: "captcha"`), auch beim Reset, der sonst immer gleich antwortet: Supabase prüft das CAPTCHA vor dem Konto. Alle Aufrufe, die Supabase dann prüft, laufen nur über diese Route; OAuth, der zweite Faktor, `/auth/callback` und die Terminal-Anmeldung (Admin-Client) sind nicht betroffen. Umschalten ist Kasums Schritt (Dashboard, Vercel, neu ausliefern, in dieser Reihenfolge), die Anleitung steht in `docs/SETUP.md`, "Umschalten: Supabase prüft das CAPTCHA". Dashboard und Vercel sind unverändert.
- **Ö12:** `activate` tauschte mit einem Code des schon aktiven Faktors still alle Wiederherstellungscodes aus und protokollierte falsche Codes nicht. Jetzt 400 `already_enabled`, wenn ein Faktor bestätigt ist, und `mfa.verify_failed` bei falschem Code.
- **Ö13:** Nach entferntem Faktor meldeten `recover` und `disable` 503, wenn nur das Löschen der übrigen Codes scheiterte. Jetzt meldet `captureError` das, die Aktion gilt.
- **Ö21:** `api_key.removed` stand im Protokoll, auch wenn es keinen Key zu entfernen gab. `removeByokRow` sagt jetzt, ob eine Zeile weg ist.

Mutationstest: ohne `captchaToken` beim Reset schlägt der Test an.

---

## 2026-11-14: Öffentliche Review-Befunde beim Teilen (Branch `fix/review-teilen`)

Befunde Ö3, Ö18, Ö19 und Ö40 aus dem Code-Review vom 12.11. (Begründung an #306):

- **Ö3, Fehler beim Nachsehen:** Scheiterte der Abruf, ob ein Prompt geteilt ist, zeigte die Leiste "Nur für dich sichtbar.", auch für einen geteilten Prompt mit offenem Link. Jetzt ein eigener Zustand mit Hinweis und Knopf "Neu laden" (zwei neue Texte, fr/it/es ungeprüft).
- **Ö18, ein Topf für alles:** Nachsehen, Teilen und Widerrufen teilten 60 Aufrufe in der Stunde, das Aufklappen vieler Prompts verbrauchte so das Widerrufen. Jetzt `prompt-share-read` (300), `prompt-share` (60) und `prompt-share-revoke` (60).
- **Ö19, geschwärzte Kennung:** `promptId` enthält das Wort "prompt" und landete im Sicherheitsprotokoll als `[redacted]`. Der Schlüssel heisst jetzt `savedId`, ein Test prüft ihn gegen `redactContext`.
- **Ö40, "kopiert" ohne Kopie:** Der Toast meldete "Link erstellt und kopiert", auch wenn die Zwischenablage ablehnte. Jetzt ein eigener Text dafür (fr/it/es ungeprüft).

---

## 2026-11-14: Öffentliche Review-Befunde im Chat (Branch `fix/review-chat`)

Die mittleren Befunde Ö1, Ö2, Ö4 und Ö5 aus dem Code-Review vom 12.11. (Begründung an #265 und #268):

- **Ö1, leerer Chat bei Lesefehler:** Scheiterte nach dem Embed der Anhänge auch die einfache Abfrage, zeigte `loadConversationMessages` einen bestehenden Chat leer. Jetzt wirft sie (`orThrow`), der Fehler des Embeds geht an `captureError`.
- **Ö2, Platzhalter `[constructor]`:** `fillPlaceholders` und das Formular lasen `values[key]` auch aus `Object.prototype`, das Ergebnis stürzte ab. Jetzt nur eigene Schlüssel (`Object.hasOwn`).
- **Ö4, Hinweis der Platzhalter:** versprach "weder gesendet noch gespeichert", der Probelauf schickt aber die ausgefüllte Fassung. Text in fünf Sprachen angepasst (fr/it/es ungeprüft).
- **Ö5, Lesefehler-Guard:** `db-read-errors.test.ts` übersah Ergebnisse unter einem Namen (`const x = await supabase…`, `const [x] = await Promise.all(…)`). Jetzt gilt ein späteres `x.data`, `x.count` oder Zerlegen ohne `x.error` oder `orThrow(x` als Fund. Heute ohne neue Funde; gegen die alte Fassung von `load-messages.ts` schlägt er an.

---

## 2026-11-14: Restliche Sicherheitsbefunde aus dem Code-Review (Branch `fix/gratis-rahmen-sicherheit`)

Die übrigen nicht öffentlichen Befunde vom 12.11., auf Kasums Ja vom 14.11.:

- **Gestoppter Zug mit fertigem Prompt:** zählte nicht als Gratis-Prompt, ein Stopp kurz nach dem Codeblock brachte so bis zu zehn statt drei Prompts je Konto. `finishAborted` (`api/chat/reply-stream.ts`) zählt ihn jetzt wie `finishCompleted`. Ein Stopp mitten im Codeblock zählt weiter nicht.
- **Gratis-Probelauf mit beliebigem Text:** `api/test-run` nahm jeden Text, im Gratis-Rahmen also drei rohe Modellaufrufe je Konto ohne Finns Systemprompt. Jetzt legt `promptDelivered` den Hash jedes gelieferten Prompts je Konto in Redis ab (`free-trial:delivered:<konto>`, 400 Tage), der Browser schickt neben dem ausgefüllten Text den gelieferten Prompt (`original`), und der Server lässt den Text nur zu, wenn er nur in den Platzhaltern abweicht (`isFilledFrom` in `features/chat/lib/placeholders.ts`). Ein Platzhalter steht dabei für beliebigen Text: was dort steht, hat die Person selbst eingesetzt, und der Rest des Prompts muss stehen bleiben. Der Schlüssel "ein Probelauf je Prompt" nimmt jetzt den gelieferten Prompt, anders gefüllte Platzhalter bringen keinen zweiten. BYOK und Pro unberührt. Folge: Prompts, die vor dieser Auslieferung geliefert wurden, bekommen im Gratis-Rahmen keinen Probelauf mehr (neuer Text `testRunNotDelivered`, fr/it/es ungeprüft).
- **Anmelde-Sperre je Konto:** prüfte und zählte danach, gleichzeitige Versuche kamen so alle an der Sperre vorbei. Jetzt reserviert jeder Versuch vor `signInWithPassword` (`reserveSignInAttempt`, `server/security/sign-in-throttle.ts`) und gibt den Platz zurück, wenn er nicht an falschen Zugangsdaten scheitert.
- **Zweiter Faktor:** Frische Anmeldung beim Einrichten und Code beim Ausschalten gelten nur in `api/auth/mfa`, Supabase Auth nimmt beides auch direkt mit der Sitzung an. Im Code nicht zu schliessen (MFA Verification Hook erst ab Tarif Teams), in `docs/SETUP.md` ("Zweiter Faktor") festgehalten.

Mutationstest je Schranke, danach aus der Sicherung zurück: Zählung im Abbruch entfernt, Prüfung "geliefert" entfernt, Abgleich der Platzhalter abgeschaltet, Rückgabe nach jedem Versuch statt nur nach Erfolg. Jeder Test schlug an.

---

## 2026-11-14: Tooltip ignoriert den Fokus eines Klicks (Branch `fix/tooltip-pointer-focus`)

Dependabot #319 (jsdom 31) war rot: jsdom 31 behandelt `:focus-visible` wie `:focus`, der Klick auf den Plus-Knopf öffnete die Pille deshalb wieder. `shared/ui/tooltip.tsx` merkt sich jetzt zwischen `pointerdown` und `pointerup` (zurückgesetzt auch bei `pointercancel`, `pointerleave` und `blur`), dass ein Zeiger drückt, und ignoriert den Fokus aus diesem Druck. `:focus-visible` bleibt als zweite Bedingung. Unter jsdom 31 lokal geprüft: alle zehn Tooltip-Tests grün, ohne die neue Bedingung schlägt "goes away on click" an.

---

## 2026-11-12: Sicherheits-Runde aus dem Code-Review (Branch `fix/code-review-sicherheit`)

Das erste Code-Review auf GitHub (Reviews an den seit den Audits vom 01.11. gemergten PRs #257 bis #314 und an den offenen Dependabot-PRs #316 bis #319) fand neben den öffentlichen Kommentaren Befunde zur Sicherheit, die erst nach der Behebung hier stehen. Auf Kasums Ja vom selben Tag:

- **Probelauf:** Brach der Browser einen Probelauf ab, gab `api/test-run` alle Reservierungen zurück (Probelauf je Prompt, Zähler des Kontos, Platz der Adresse, Gratis- und Tagesbudget), auch wenn das Modell schon Text erzeugt hatte. Jetzt wie `finishAborted` im Chat: kam schon Text, bleiben sie stehen, nur ein Abbruch vor dem ersten Text gibt sie zurück. Zwei Routentests.
- **Eigene API-Keys:** `authenticated` hatte seit 0015 insert, update und delete auf `user_api_keys`. Über die Data API liessen sich damit der zweite Faktor und der Probeaufruf der Route umgehen, etwa `base_url` eines custom-Keys auf einen fremden Host setzen. Migration 0059 legt `set_active_byok_provider_for` an (nur `service_role`), geschrieben wird nur noch über `saveByokRow`, `activateByokProvider` und `removeByokRow` in `server/byok.ts` mit dem Service-Role-Schlüssel und der `user_id` der geprüften Sitzung, Migration 0060 entzieht `authenticated` die Schreibrechte und entfernt `set_active_byok_provider`. Reihenfolge auf Produktion: 0059, Code, 0060. In den Routentests liest die Sitzung nur, ein Schreiben über sie scheitert laut; ohne Service-Role-Schlüssel antwortet die Route 500 und schreibt nichts.
- **Byte-Grenze der gespeicherten Prompts:** Der Trigger aus 0051 lief nur beim Einfügen, `outputs` darf `authenticated` aber ändern (0026). Viele kleine Zeilen, die danach wachsen, brachten ein Konto so auf rund 1 GB statt 20 MiB. Migration 0058 prüft die Grenze auch nach jedem UPDATE, das `outputs` eines Kontos ändert, mit derselben Sperre wie beim Einfügen. Ein Vergleich "wird es grösser?" war der erste Entwurf; ihn hat die Gegenprüfung verworfen, weil die Transition-Tabelle neue Werte unkomprimiert und alte komprimiert misst und ein kürzerer, schlechter komprimierbarer Text mehr Platz belegen kann. Folge: Ein Konto über der Grenze kann gespeicherte Prompts nur lesen und löschen. Guard in `account-ceilings.test.ts`, E2E in `account-limits.spec.ts`.
- **Zweiter Faktor:** Alle Code-Aktionen teilten einen Zähler je Konto. Wer das Passwort kannte, leerte ihn und sperrte den Besitzer aus, auch vom Rückweg mit Wiederherstellungscode. Jetzt zehn Versuche je Konto und Anschluss (`rateLimitKeyPerAddress`, IPv6 je /64 über `addressBucket` in `server/security/url-safety.ts`), getrennt für Codes und Wiederherstellungscodes (Bereich `mfa-recover`). Bewusst keine Grenze je Konto über alle Anschlüsse: Der erste Entwurf hatte eine (fünfzig), die Gegenprüfung zeigte, dass fünf Adressen sie leeren und den Besitzer wieder aussperren; gegen Durchprobieren brächte sie wenig, weil Supabase Auth Codes direkt annimmt und nur je IP begrenzt (15 in der Minute). Vier neue Routentests, einer angepasst, drei Tests für die Schlüssel je Anschluss; `rate-limit-scopes.test.ts` kennt `rateLimitKeyPerAddress`.
- **Anmelde-Sperre je Konto:** gilt nur für `/api/auth`, den Passwort-Grant von Supabase Auth erreicht man mit dem Anon-Key auch direkt, dort gilt nur dessen Grenze für `/auth/v1/token` (1800 in der Stunde je IP). Im Code nicht zu schliessen: den Password Verification Hook gibt es nur ab Tarif Teams, das CAPTCHA von Supabase Auth bräuchte einen neuen Entscheid, und eine engere Grenze im Dashboard träfe auch das Erneuern der Sitzungen. Die Wege stehen in `docs/SETUP.md`, "Anmelden: Sperre je Konto", der Entscheid liegt bei Kasum.

Mutationstest je Schranke, danach aus der Sicherung zurück: Probelauf (Freigabe ohne Bedingung), Key-Route (Löschen mit der Sitzung), Migration 0058 (andere Zahl, Sperre entfernt), Grenzen des zweiten Faktors (Rückweg im selben Zähler, Codes nur je Konto, kein /64). Jeder Test schlug an. Neun Prüfer haben die Fixes danach angegriffen (Umgehung und Regression je Fix, dazu die Doku); ihre Funde sind oben eingearbeitet. Die Migrationen prüft lokal niemand (Docker lief nicht), sondern der E2E-Lauf der CI, der sie auf einen frischen Stack spielt und die Datenbank-Typen neu erzeugt.

---

## 2026-11-08: Das Modell bleibt glm-4.5-air (Kasums Entscheid, Branch `docs/modell-bleibt-air`)

Kasum hat die Empfehlung aus dem Eintrag "Feste Bauteile gemessen und verworfen" abgelehnt: `ZAI_MODEL` bleibt in Vercel ungesetzt, Produktion antwortet weiter mit `glm-4.5-air`. glm-5.3-flash war blind klar besser und billiger, braucht für eine ganze Antwort aber rund 9,6 s statt 2,6 s.

- **Folge für die festen Bauteile und die Prompt-Anatomie:** Auf glm-4.5-air verfehlten die Bauteile die Hürde deutlich (2 : 6 : 4). Solange das Modell bleibt, sind beide vom Tisch.
- **Der Code für glm-5.3 bleibt** (`zaiThinkingParams`, `reasoning: "drop"`). Er wirkt nur, wenn `ZAI_MODEL` ein Modell nennt, das immer denkt, und kostet sonst nichts.

---

## 2026-11-08: Z.ai-Einwilligung in den Einstellungen nennt die Gratis-Prompts (Branch `fix/zai-einwilligung-einstellungen`)

Die Karte in den Einstellungen sagte noch "Deine Zustimmung für Chats im Pro-Plan", seit dem Gratis-Rahmen gilt sie für jeden Chat ohne eigenen Key. Text in fünf Sprachen angeglichen (fr/it/es ungeprüft). `ZAI_CONSENT_VERSION` bleibt 2026-11-08: Empfänger, Land und Risiko sind unverändert, und der Einwilligungstext im Chat dieser Fassung sagt schon "ohne eigenen Key".

---

## 2026-11-08: Feste Bauteile gemessen und verworfen, In ChatGPT/Claude öffnen, Probelauf, Z.ai-Modelle, die immer denken (Branch `feat/prompt-knoepfe-probelauf-v3`, Auftrag vom 08.11.2026)

Auftrag: der fertige Prompt soll feste, beschriftete Bauteile haben (Rolle, Aufgabe, Kontext, Vorgaben, Vermeiden, Ausgabeformat), gemessen alt gegen neu, Hürde vorher festgelegt.

- **Hürde** (vor dem ersten Ergebnis): neu gewinnt blind ≥ 8 von 12 fertigen Prompts; Rückfrage neu ≥ 10 von 12 gleich gut oder besser und maschinell nicht öfter verletzt; 12 von 12 genau ein Block, ≥ 11 von 12 mit Bauteilen; "Kürzer" ≥ 10/12, "Auf Englisch" ≥ 10/11 behalten sie.
- **Messung:** 12 erfundene Ideen (Text, Webseite, Datenbank, Sicherheitsprüfung, Lernplan, Bild, Präsentation, Formel, Businessplan, Analyse, en, fr), Idee, Rückfrage, vorbereitete Antwort, Prompt; echtes Z.ai; sechs Fassungen getunt, je ein Lauf; blind bewertet von drei frischen Subagenten.
- **Ergebnis glm-4.5-air (Produktion):** fertiger Prompt neu 2, alt 6, gleich 4; Rückfrage neu 5, alt 5, gleich 2. Maschinell 11/12 ein Block (einmal schrieb es das SQL selbst), 1-2 Entwürfe statt Rückfrage, zweimal keine Rückfrage (alt: 12/12, keine Entwürfe). **Verfehlt, nicht gemergt.** `system-prompt.ts` bleibt, damit auch der Skill `/pp` unberührt.
- **glm-5.3-flash:** neu gegen alt 6 : 4 : 2 (verfehlt, Bild-Prompts leiden unter der Gliederung). Neu auf glm-5.3-flash gegen alt auf glm-4.5-air: 12 : 0, Rückfrage 10 : 0 : 2. Der Hebel ist das Modell.
- **Kosten** (Preisliste docs.z.ai, 08.11.2026; alter Prompt, je Zug gemessen): glm-4.5-air 0,20/1,10 $ je Mio. Token, 0,00058 $ je Zug, ganze Antwort 2,6 s; glm-5.3-flash 0,15/0,50 $, 0,00042 $ je Zug, 9,6 s (denkt immer, `reasoning_effort: low`). **Empfehlung für Kasum:** `ZAI_MODEL=glm-5.3-flash` in Vercel, billiger und blind klar besser, spürbar langsamer bis zum ersten Wort.
- **Code dafür (dieser Branch):** glm-5.3 und neuer lehnen `thinking: disabled` mit 400 ab (Code 1210); `zaiThinkingParams` (`server/llm/config.ts`) sendet dort `reasoning_effort: "low"`, Strom und Analyse lesen bei Z.ai ohne Denktext (`reasoning: "drop"`, `server/llm/http.ts`). glm-4.5-air unverändert.
- **Punkt Prompt-Anatomie** entfällt damit: ohne beschriftete Bauteile im Prompt hat die Ansicht nichts zu zeigen.
- **In ChatGPT öffnen, In Claude öffnen** (`features/chat/components/prompt-actions.tsx`, `lib/open-in.ts`): kopieren und die Seite leer in neuem Tab öffnen, Meldung "Kopiert, einfach dort einfügen." Eine Adresse mit vorbelegtem Text (`?q=`) ist bei keinem Anbieter offiziell dokumentiert (Websuche 08.11.2026: nur Forenbeiträge und Erweiterungen; Tenable meldet das sofortige Absenden bei ChatGPT als Prompt-Injection-Weg), deshalb gilt Kasums Rückfall für beide. Ausgefüllte Platzhalter (`placeholder-form.tsx`) gehen mit.
- **Probelauf** (`POST /api/test-run`): der Prompt geht einmal unverändert an das Modell der Person, ohne Finns Systemprompt (nur "You are a helpful assistant.", weil Anthropic einen leeren Systemtext ablehnt), höchstens 1500 Token, nicht gespeichert, die Antwort in einem einklappbaren Bereich "So antwortet eine KI auf deinen Prompt". Dieselbe Kostenkette wie der Chat (`model-call.ts`, Ratenlimit `test-run` 30 je Stunde), kein Platzhalter-Stub (ohne Server-Anbieter 503). Im Gratis-Rahmen ein Probelauf je Prompt (Hash), höchstens drei je Konto, er zählt nicht als Gratis-Prompt, aber gegen Grenze je IP und Tagesbudget (`reserveFreeTrialTestRun`); ein zweiter ist `403 testRunUsed`.
- **Finn am Ergebnis** (`chat-result-panel.tsx`, `lib/prompt-copied.ts`): der kleine Finn im Kopf denkt, solange ein Zug läuft, liefert beim fertigen Prompt, erklärt bei einer Rückfrage und freut sich gut zwei Sekunden nach dem Kopieren (auch über die Öffnen-Knöpfe); `AnimatedMascot`, still bei reduzierter Bewegung.
- **Nicht gebaut:** Prompt-Anatomie (siehe oben). fr/it/es der neuen Texte nicht von Muttersprachlern geprüft.

---

## 2026-11-08: Header v2 nach Kasums Kritik (Branch `feat/header-v2-b`)

Kasum zum Wasserband von #303: "mitscrollen" hiess sichtbar bleiben, nicht wegscrollen; das dunkle Band "sieht aus wie eine Fassade", die Bogenkante wie eine Markise; die Punkte klebten am Logo.

- **Fest oben, ohne Verwandlung:** `fixed`, oben wie nach dem Scrollen gleich (keine Pille, keine auftauchende Linie, kein Abdunkeln). Das Mobilmenü öffnet an jeder Stelle ohne Sprung nach oben (headless gemessen: bei 900 px Scroll bleibt `scrollY` 900).
- **Hell statt Band:** `--header-surface` (205 58% 91%) zu 82 % deckend mit Blur, eine Spur dunkler als der Hero; kein `.dark` mehr im Kopf. `--header-shallow` ist weg, `--header-deep` trägt nur noch das Terminal-Fenster. Kontraste gerechnet auf der Fläche über dem Hero: Links (`text-secondary`) 5,8:1, Logo-Akzent 5,0:1.
- **Raster `1fr auto 1fr`** ab `lg`: Logo links, die fünf Punkte in der Mitte der Seite (gemessen 720 von 1440 px), grösserer Abstand (`gap-2`, ab `xl` `gap-4`), Knöpfe rechts.
- **Wasserkante:** drei durchscheinende Lagen in der Farbe der Fläche, jede eine Summe aus drei Sinuswellen mit ganzzahligen Perioden je Kachel (unregelmässig und doch nahtlos, `header-water.test.ts`), eigene Phase und Geschwindigkeit (43 bis 79 s, eine gegenläufig), 18 px flach. Nur `transform`, unter reduced-motion still.
- **Fehler am selben Tag:** #306 (Teilen) wurde gemergt, obwohl der E2E-Schritt "Datenbank-Typen sind aktuell" rot war: der Merge lief nach einem gescheiterten `gh pr checks --watch` weiter. Die von Hand geschriebenen Typen für `prompt_shares` wichen vom generierten Stand ab (Formatierung, `isOneToOne`); #307 ersetzt sie durch die Ausgabe von `supabase@2.119.0 gen types`, `main` war rund 20 Minuten rot. Seitdem mergt das Skript nur bei Exit 0 und ohne `fail`.

---

## 2026-11-08: Drei Prompts gratis ohne eigenen Key (Branch `feat/gratis-prompts-v3`, Auftrag vom 08.11.2026)

Kasum: "Ohne Key, drei Prompts sind gratis." Bisher musste ein neues Free-Konto erst einen Key holen, bevor es einen einzigen Prompt sah.

- **Regel:** Free ohne eigenen Key bekommt `FREE_TRIAL.prompts` = 3 fertige Prompts über den Server-Key, höchstens `FREE_TRIAL.turns` = 10 Züge (`shared/lib/plans.ts`). Gezählt wird ein Zug, dessen Antwort einen Prompt-Block trägt (`extractPrompt`); eine Rückfrage ist ein Zug, aber kein Prompt. `free.chatMessages` bleibt 0, der Rahmen ist kein Monatskontingent, er gilt einmal je Konto. BYOK unverändert.
- **Missbrauch und Kosten** (`server/free-trial.ts`): Konten entstehen ohne Mailbestätigung, deshalb drei Grenzen, die nicht am Konto hängen: 20 Züge je IP und Tag, ein eigenes Tagesbudget von 200 Zügen (`FREE_TRIAL_DAILY_CALLS`, im ungünstigsten Fall rund 2,40 $ am Tag auf glm-4.5-air), dahinter das allgemeine Tagesbudget des Server-Keys. Zähler in Redis ohne Migration, Konto-Zähler 400 Tage. **Ohne Redis gibt es den Rahmen in Produktion nicht** (fail closed, anders als Kontingent und Tagesbudget); in Entwicklung zählt eine Map.
- **Reihenfolge** in `server/model-call.ts` (nur der Chat setzt die Option `freeTrial`, die Gedächtnis-Analyse nicht): erst ob noch etwas übrig ist (sonst Key-Weg), dann die Z.ai-Einwilligung, dann der Platz; Stundenlimit, Tagesbudget und Konfiguration danach wie bisher, jeder Ausstieg gibt den Platz zurück.
- **Einwilligung:** der Hinweis im Chat sagt jetzt "ohne eigenen Key" statt "im Pro-Plan", `ZAI_CONSENT_VERSION` 2026-11-08 (bestehende Zustimmungen werden neu erfragt). Der gleichlautende Text in den Einstellungen (`settings.consentBody`) ist unverändert, er gehört zu den Einstellungen.
- **Oberfläche:** "Noch 2 Gratis-Prompts" unter dem Eingabefeld (`done` trägt `freePromptsLeft`, `api/cli/me` ebenso), bei 0 steht der Key-Hinweis ("Ab hier brauche ich deinen eigenen KI-Key."), ein leeres Tagesbudget ist `403 freeTrialBudget` und nennt im Key-Hinweis, dass es morgen weitergeht.
- **Texte:** Abschluss der Startseite, Karte unter den drei Schritten ("Gut zu wissen"), Preisseite (Kopf, Free-Karte, Beschreibung), Registrierung, Vergleich, Hilfe (Eigene API-Keys, Pläne und Limits), Plan-Texte der App in fünf Sprachen; der Guard `landing-key-hint.test.ts` verlangt "drei Prompts" und hält die Zahl an `FREE_TRIAL`.
- **Offen:** Datenschutz nennt Z.ai nur für Pro; Vorschlag für Kasum im PR. Nicht im Browser gegen ein echtes Konto geprüft, die Browser-Tests (`e2e/chat.spec.ts`, `cli-login`, `cli-me`) laufen in der CI.

---

## 2026-11-08: Gespeicherte Prompts per Link teilen (Branch `feat/teilen`, Migration 0057, Auftrag vom 08.11.2026 ohne Einzelfreigabe)

- **Wo:** in der Liste der gespeicherten Prompts (`/prompts` und Projekt-Ergebnisse), im aufgeklappten Prompt unter den Knöpfen, nicht im Chat. "Per Link teilen" fragt vorher nach: der Text wird öffentlich, Name und E-Mail-Adresse stehen nicht dabei, widerrufbar. Findet die Prompt-Prüfung einen Schlüssel oder persönliche Angaben, steht das im selben Dialog. Danach Link kopieren oder widerrufen.
- **Seite `/geteilt/<token>`:** Titel, Prompt, Kopieren-Knopf, Finn und "Mach deinen eigenen Prompt mit Finn". `noindex, nofollow`, `no-referrer`, nicht in der Sitemap. Ratenlimit je Adresse (`share-view`, 60 in 10 Minuten) vor jeder Datenbankabfrage. Unbekannt, widerrufen oder gelöscht ist 404.
- **Migration 0057:** Tabelle `prompt_shares` (`token` 32 Zeichen base64url aus 24 Zufallsbytes, höchstens eine Freigabe je Prompt). Ein zusammengesetzter Fremdschlüssel `(prompt_id, user_id)` auf `saved_prompts (id, user_id)` (neue Eindeutigkeit `saved_prompts_id_user_key`) lässt nur den Eigentümer teilen und räumt die Freigabe mit dem Prompt oder Konto weg. Schreiben nur der Server über `/api/prompts/[id]/share` (Ratenlimit `prompt-share`), `authenticated` liest nur eigene Zeilen, `anon` nichts. Sicherheitsprotokoll `prompt.shared` und `prompt.unshared`.
- **Prompt-Prüfung** liegt jetzt in `shared/lib/prompt-check.ts` (Inhalt unverändert), `features/chat/lib/prompt-check.ts` leitet weiter, damit der Chat nichts ändern musste.
- **SEO-Guard:** dynamische Seiten mit `noindex` sind namentlich ausgenommen (nur `/geteilt/[token]`).
- **Geprüft:** Einheit, Route, Komponente, Seite; E2E gegen den lokalen Stack (fremdes Konto scheitert am Fremdschlüssel, öffentliche Seite ohne E-Mail, `anon` liest nichts, nach dem Widerruf 404); Migration zweimal angewendet (wiederholbar).
- **Produktion:** 0057 am 2026-11-08 angewendet (Version `20261108145053`), lesend geprüft: RLS an, eine Policy, `anon` ohne Rechte, `authenticated` nur `select`, alle fünf Constraints und `saved_prompts_id_user_key` da.
- **Offen (Rechtstext, nur Vorschlag):** ein Satz in der Datenschutzerklärung zum Teilen (siehe PR).

---

## 2026-11-08: "Über mich" für Finn (Branch `feat/ueber-mich`, Migration 0056, Auftrag vom 08.11.2026 ohne Einzelfreigabe)

- **Feld:** in den Einstellungen eine eigene Karte, freiwillig, bis 1000 Zeichen (Beruf, Sprache, meistgenutzte KI, Ton), mit dem Hinweis "keine Kontaktdaten". Eigener Speichern-Knopf, damit ein halb getippter Name in der Profilkarte nicht mitgespeichert wird.
- **Datenbank:** Spalte `profiles.about_me` (`not null default ''`), Prüfung `char_length <= 1000`, Spaltenrecht `update (about_me)` für `authenticated`. Die Grenze steht in der Datenbank, weil der Browser direkt schreibt; der E2E-Test belegt sie gegen den lokalen Stack.
- **Chat:** `buildSystemInstruction` (`api/chat/turn.ts`) hängt den Text als Block `<angaben_der_person>` an, vor dem Projektkontext. Der Block sagt selbst, dass Gespräch und Projekt-Anweisungen vorgehen und Befehle darin nicht gelten; seine Marken werden aus dem Text entfernt. Ein Lesefehler lässt den Block weg, der Zug läuft weiter. Der Systemprompt (`server/system-prompt.ts`) bleibt unberührt. Browser, Projekt und Terminal laufen über dieselbe Route.
- **Export und Löschen:** der Export trägt `account.aboutMe`, das Löschen des Kontos nimmt die Profilzeile mit.
- **Produktion:** 0056 am 2026-11-08 angewendet (Version `20261108143129`), lesend geprüft: Spalte, Prüfung, Spaltenrecht nur für `authenticated`, `is_admin` weiter gesperrt.
- **Wörterbuch-Grenze** im Guard von 1000 auf 1100 Zeilen: "Über mich", Teilen und die Gratis-Prompts bringen Texte in fünf Sprachen. fr/it/es nicht von Muttersprachlern geprüft.
- **Offen (Rechtstext, nur Vorschlag):** ein Satz in der Datenschutzerklärung zu "Über mich" (siehe PR).

---

## 2026-11-08: Header als Wasserband, Seiten `/terminal` und `/mcp` (Branch `feat/header-cli-mcp-v2`, Auftrag vom 08.11.2026)

Kasum: der Kopf soll mitscrollen, sich sichtbar vom Hero absetzen ("nicht eine Farbe einfach so langweilig, soll auch irgendwas Spezielles haben") und CLI und MCP direkt nennen, ohne Gruppe "Für Entwickler".

- **Header:** nicht mehr `fixed`, sondern `absolute`; die Logik "ab 8 px zur Pille mit Rand und Blur" und das einklappende Logo sind weg. Ein Band in dunklerem Blau (`--header-deep` 214 58% 15% nach `--header-shallow` 207 55% 24%) mit einem ruhigen Licht und einer weichen Wellenkante, die 14 px in den Hero hängt und langsam seitwärts zieht (nur `transform`, unter reduced-motion still). `.dark` auf dem `<header>` setzt Schrift, Knöpfe und Akzent auf die schon kalibrierten Dunkel-Werte. Gemessen im Browser auf dem helleren Ton: Links 6,9:1, Akzent und Logo 6,0:1, "Einloggen" 7,5:1, "Jetzt starten" 17,5:1.
- **`@theme inline` für die Farben:** sonst erben Utilities die an `:root` aufgelöste `--color-*`-Variable, und `.dark` auf einem einzelnen Element wirkt nicht (im Browser gesehen: der Kopf blieb dunkel beschriftet). Am `<html>` ändert sich nichts.
- **Links:** Funktionen, Preise, Skill, CLI (`/terminal`), MCP (`/mcp`), alle direkt in der Leiste, im Mobilmenü und im Footer. Fünf Links passen erst ab `lg`, darunter öffnet der Menüknopf das Blatt; beim Öffnen geht die Seite nach oben, weil der Knopf mit dem Kopf wegscrollt.
- **`/terminal` und `/mcp`:** Aufbau wie `/skill`, ein nachgebautes Terminal-Fenster in HTML. Befehle nach dem Vertrag mit `promptprinter-cli` in `terminal-data.ts`. `NPM_PUBLISHED = false`: beide Seiten zeigen den Weg aus dem Quellcode (`git clone`, `node bin/promptprinter.mjs`, für MCP der Pfad statt `npx`) und sagen, dass ein Paket gleichen Namens auf npm nicht von uns ist. Nach Kasums Veröffentlichung die Konstante und die eine Zeile im Test umstellen.
- **Geprüft:** Desktop 1440 und Handy 375 im Browser, hell; keine Überbreite auf 375 (die Rasterspalten brauchten `min-w-0`).

---

## 2026-11-08: Terminal-App, gespeicherte Prompts für den MCP-Server (Branch `feat/cli-gespeicherte-prompts`)

Der MCP-Server des Terminal-Programms (`promptprinter mcp`, Werkzeuge `list_saved_prompts` und `get_saved_prompt`) soll einer anderen KI die gespeicherten Prompts des Kontos geben. Dafür gab es keine Route: Bearer galt nur für Chat, Abmelden und `api/cli/me`.

- **`GET /api/cli/prompts`:** `{ prompts: [{ id, title, createdAt, preview }] }`, neueste zuerst. `limit` Standard 20, eine Zahl ausserhalb von 1 bis 50 wird geklemmt, keine Zahl ist 400 `invalid`. `q` höchstens 200 Zeichen (länger 400 `invalid`), ohne Gross/Klein in Titel und Prompttext. `preview` sind die ersten 200 Zeichen, Zeilen ohne lesbaren Prompt fallen weg (die Liste kann dann kürzer sein als `limit`).
- **`GET /api/cli/prompts/[id]`:** `{ id, title, content, createdAt }`. Keine UUID 400 `invalid`, fremd und nicht vorhanden gleich 404 `notFound`.
- **Suche ohne `.or()`:** je Spalte eine Abfrage mit `ilike` auf `outputs->>title` und `outputs->>prompt`, der Suchtext steht nie in einem Logikausdruck von PostgREST. `\`, `%` und `_` sind maskiert; ein `*` (PostgREST macht daraus `%`) wird ein Einzelplatzhalter, die Treffer werden danach genau nachgesiebt.
- **Wie `api/cli/me`:** nur per Bearer, eigenes Ratenlimit je Route (`cli-prompts`, `cli-prompt`) vor dem Auth-Server, `getUser()` und `checkCliSession`, RLS plus `.eq("user_id")`, Lesefehler 503. Keine Migration.
- **Hilfe:** `/docs/terminal-anmeldung` heisst jetzt "Terminal und MCP" und beschreibt Programm, Befehle und MCP-Einrichtung. Das Paket liegt noch nicht auf npm, der Artikel zeigt deshalb den Weg aus dem Quellcode und keinen `npm install` (nach der Veröffentlichung nachziehen).
- **Geprüft:** Routentests, `e2e/cli-prompts.spec.ts` gegen den lokalen Stack (echtes PostgREST, Sonderzeichen, fremdes Konto), Guard `bearer-routes.test.ts`, Mutationen von Hand 8 von 8 erkannt (je Route Bearer-Prüfung, `checkCliSession` und `user_id`-Filter weg, dazu UUID-Prüfung und Maskierung weg).

---

## 2026-11-06: 21 von 34 Seiten im Google-Index, #246 erledigt (Branch `docs/search-console-246-abschluss`)

Kasum hat sich im Browser-Pane neu bei Google angemeldet (die Anmeldung vom 03.11. war abgelaufen), den Rest hat Claude dort gelesen. Die Liste je Seite steht in #246.

- **Bericht "Seiten":** meldet drei Tage nach dem Einrichten weiter "Die Daten werden verarbeitet". Deshalb jede der 34 Adressen der Sitemap einzeln in der URL-Prüfung (Stand des Index, kein Live-Test).
- **Ergebnis:** 21 indexiert, darunter `/vergleich`, `/skill` und `/docs/chat-mit-finn`, für die am 03.11. die Indexierung beantragt war. Nicht indexiert: `/aufgaben` "Gecrawlt – zurzeit nicht indexiert", `/docs/tastenkuerzel` und `/nutzungsrichtlinie` "Gefunden – zurzeit nicht indexiert", zehn weitere "URL ist Google nicht bekannt" (Google hat die Sitemap erst am 05.11. gelesen).
- **Kein technischer Grund:** alle 13 antworten als Googlebot mit 200, ohne `noindex` und `X-Robots-Tag`, mit eigener Canonical, `robots.txt` erlaubt sie. Keine Indexierung neu beantragt.
- **Leistung, 02. bis 04.11.:** 2 Impressionen, 0 Klicks, mittlere Position 4, Suchanfragen anonymisiert.
- **Bing:** Sitemap "Success", 34 Adressen erkannt, 0 Fehler, 0 Warnungen.

---

## 2026-11-03: Search Console eingerichtet, die Seite ist im Index (Branch `docs/search-console-246`, Issues #246, #249)

Kasum hat sich im Browser-Pane angemeldet, den Rest hat Claude dort erledigt. Die Zahlen im Einzelnen stehen in #246.

- **Property:** Domain-Property `promptprinter.app`. Sie deckt http, https und www ab und ist über einen TXT-Eintrag `google-site-verification=…` auf der Hauptdomain in Vercel DNS bestätigt. Der Eintrag wurde mit Kasums Ja angelegt und bei `ns1.vercel-dns.com`, `8.8.8.8` und `1.1.1.1` zurückgelesen. `GOOGLE_SITE_VERIFICATION` bleibt leer, ein Redeploy war nicht nötig. Den Eintrag nicht löschen (steht in `docs/SETUP.md`).
- **Sitemap:** eingereicht, Status "Erfolgreich", 34 erkannte Seiten.
- **Index:** `/`, `/pricing`, `/docs` und `/docs/chat-mit-finn` sind indexiert. Die Suchen vom 31.10., auf denen #246 beruhte, lagen also falsch, das Suchwerkzeug war nicht Google. `/vergleich` war Google unbekannt, `/aufgaben` und `/skill` nicht indexiert: für alle drei die Indexierung beantragt. Für `/docs/chat-mit-finn` ebenfalls, weil Google noch die Fassung vom 09.08. hält, deren Canonical auf die Startseite zeigte; live stimmt sie seit dem SEO-Durchgang vom 01.10.
- **Bing:** Kasum hat sich mit Google angemeldet und Bing den Lesezugriff auf die Search Console erteilt (`webmasters.readonly`). Importiert wurde nur `promptprinter.app`, das ebenfalls gefundene `kazuvate.ch` nicht. Ohne Meta-Tag, `BING_SITE_VERIFICATION` bleibt leer. Sitemap eingereicht ("Processing"), die Startseite ist "Indexed successfully". Der einzige Hinweis von Bing, "Alt attribute for images is missing", betrifft die drei Finn-Bilder mit `alt=""`: Sie sind Schmuck neben Text und bleiben so (WCAG). Im fertigen DOM hat jedes der acht Bilder ein `alt`.
- **Offen:** Die Berichte "Seiten" und "Leistung" verarbeitet Google noch (ein bis zwei Tage), damit ist das vierte Kriterium von #246 offen. Die Anmeldung im Browser-Pane bleibt bestehen, eine spätere Sitzung kann den Bericht dort lesen.

**#249:** Der About-Text von `BajKasum/PromptPrinter` trägt jetzt den Standardsatz wörtlich ("what's" statt "whats"). Future Tools hat Kasum am 2026-11-03 selbst eingereicht, mit dem Text aus dem Issue; live ist der Eintrag erst nach der Prüfung durch die Seite. AlternativeTo braucht sein eigenes Konto und steht aus.

## 2026-11-03: Die Leseseite des BYOK-Formats ohne `pp2.` ist ausgebaut (Branch `fix/byok-altformat-weg`, Kasums Ja)

Am 2026-11-02 blieb sie bewusst stehen (#239): nur dort galt die Bindung an die Zeile nicht. Vor dem Ausbau lesend gezählt: `user_api_keys` in der Produktion hat 0 Zeilen, also auch 0 im alten Format. Neu verschlüsselt wurde nichts.

- **App:** `decrypt()` in `server/security/crypto.ts` wirft bei jedem Wert ohne `pp2.`, scrypt und das feste Salz sind aus dem Quelltext, ein Test hält das fest. `getUserOverride()` meldet so einen Key als unlesbar, der Nutzer speichert ihn neu.
- **Skript:** `rotate-byok-secret.mjs` dient nur noch der Rotation, ein Wert ohne `pp2.` zählt als "von keinem lesbar" (Exit 3, nichts geschrieben, nichts gelöscht). Ohne `API_KEY_ENCRYPTION_SECRET_PREVIOUS` ist der Probelauf eine reine Prüfung.
- **Geprüft:** Unit-Tests und Guard, `e2e/byok-rotation.spec.ts` (Rotation mit drei Zeilen, ein Wert ohne `pp2.` bleibt liegen) in der CI, Mutationen 6 von 6 erkannt (Präfix-Prüfung weg, scrypt-Leseseite in App und Skript zurück, Bindung weg in App und Skript, `classify` falsch).
- **Grenze:** Ein lokaler Stack mit Zeilen aus der Zeit davor zeigt diese Keys als unlesbar.

---

## 2026-11-02: Terminal-App, Phase 2: `GET /api/cli/me` (Kasums Entscheid D-T9)

Das Terminal soll im Startbild sagen, wer angemeldet ist und ob der nächste Zug laufen kann. Dafür gab es keine Route: Bearer galt nur für Chat und Abmelden, und aus dem JWT liesse sich zwar die Adresse lesen, aber weder Plan noch Key. Ohne die Route erführe ein Free-Konto ohne Key erst nach der ersten Idee, dass nichts geht, genau das, was `getNeedsOwnKey` im Browser verhindert.

- **Nur lesend, nur per Bearer**, ein Cookie gilt hier nicht. Antwort: `email`, `plan`, `hasOwnKey`, `needsOwnKey`, `needsConsent`. Kein Anbieter, kein Schlüssel.
- **Keine Migration.** Liest mit dem Client des Nutzers unter RLS plus `.eq`, entscheidet über `getUser()` beim Auth-Server und, wie der Chat, über `checkCliSession`: das Token einer Browser-Sitzung gilt hier nicht. Ein Lesefehler ergibt 503, nie "Free ohne Key".
- **Geprüft:** Routentest, `e2e/cli-me.spec.ts` gegen den lokalen Stack (echte Sitzung, gelöschtes Konto), Eintrag im Guard `bearer-routes.test.ts`, eigener Ratenlimit-Name.
- **Das Programm selbst** liegt im Repo `BajKasum/promptprinter-cli`, Plan und Stand im Vault ("PromptPrinter Terminal-App Stand und Restplan").

---

## 2026-11-02: Sicherheits-Runde, BYOK-Format, Protokoll, Terminal-Sitzungen, zweiter Faktor (PRs #283, #285, #288, #290, #291, #293, #294, Issues #228, #235, #237, #238, #239)

**Migrationen (je mit Kasums Ja, erst Migration, dann Merge):** 0052 `20261102224736`, 0053 `20261102231453`, 0054 `20261102233122`, 0055 `20261102235100`. Lesend geprüft: RLS, Rechte, zwei Jobs in `cron.job`.

**#238:** `'unsafe-inline'` bleibt auf den Anmeldeseiten (Messung im Issue). Die Bedingung für einen neuen Entscheid steht in `server/security/csp.ts`.

**#239:** Kein fester Rückfallschlüssel mehr, Format `pp2.<kid>.<payload>` mit HKDF statt scrypt und `user_id|provider` als authentifizierte Daten. Der Start verlangt mindestens 32 Zeichen und keinen Platzhalter; Kasum hat die Länge bestätigt, ohne den Wert zu nennen, und die Vorschau lief mit dem echten Wert, bevor der Code live ging. In Produktion liegen 0 Zeilen in `user_api_keys`, das Skript lief dort nicht. **Bewusst offen:** die Leseseite des alten Formats, nur dort gilt die Bindung noch nicht.

**Konto löschen (kein Issue, beim Aufräumen von #239 gefunden):** Ein Konto mit aktivem eigenem Key liess sich nicht löschen, `/api/account` antwortete 500. Der Löschtrigger auf `user_api_keys` feuert bei der Kaskade aus `auth.users` erst am Ende des äusseren Befehls, also als `supabase_auth_admin`. Erst der Test allein rot, dann mit Migration 0052 (`security definer`) grün. Betroffen war niemand.

**#235:** `security-log.ts` fürs Log (Absagen als Stichprobe, jede zehnte), Tabelle `security_events` für Keys, Einwilligung, Terminals, zweiten Faktor und Konto löschen. Ohne Fremdschlüssel, weil "Konto gelöscht" das Konto überleben muss; auch die Service-Role kann nichts ändern. Nach 180 Tagen löscht ein Job in der Datenbank. Der Datenschutz nennt das seit PR #291 (Wortlaut von Kasum freigegeben, juristisch nicht geprüft). **Nicht geprüft:** die Menge an einem echten Tag, es gibt kein Staging.

**#228, Entscheid von Kasum: absichern, kein neuer Token-Typ** (`docs/SETUP.md`, "Terminal-Anmeldung"). `/cli` zeigt Adresse, Ort und Programm der Anfrage, `cli_sessions` listet die Terminals, der Einzelwiderruf löscht die Zeile in `auth.sessions`, Höchstalter 30 Tage per Prüfung und stündlichem Job. Grenze: Ein ausgestelltes Access-Token gilt an der Data API noch bis zu einer Stunde.

**#237, Entscheid von Kasum: optionales TOTP.** AAL2 für Konto löschen, Keys verwalten, Terminal freigeben. Rückweg: zehn Wiederherstellungscodes (nur als Hash), danach der Betreiber. Beim Gegenlesen dazugekommen: Einrichten verlangt eine frische Anmeldung, sonst sperrt ein gestohlenes Cookie den Besitzer mit einem fremden Faktor aus. **Grenze:** Eine AAL1-Sitzung erreicht weiter Chat, Export und Data API, RLS verlangt kein AAL2. **Nicht geprüft:** ein Faktor auf dem Produktionsprojekt.

**Geprüft:** Browser-Tests gegen den lokalen Stack in der CI auf jedem PR, Mutationen je Änderung: #239 22, #235 28, #228 29, #237 37, alle erkannt.

**Fallen:**
- Ein Einfügen mehrerer Zeilen über PostgREST setzt fehlende Spalten auf `null`, nicht auf ihren Standardwert, sobald eine Zeile sie nennt.
- `getByRole("alert")` trifft auch `#__next-route-announcer__`: immer nach Text filtern oder auf `form` eingrenzen.
- Die Suite kam über 30 Anmeldungen in zehn Minuten und damit ins Ratenlimit: `signIn()` nennt je Konto eine eigene Adresse, dafür `TRUSTED_PROXY_HOPS=1` im Testserver.
- `database.types.ts` wird Byte für Byte verglichen, leere `Relationships` tragen 20 Leerzeichen. Die erzeugte Datei ist von `file-size.test.ts` ausgenommen.
- `gh api … -F x=y` sendet POST, auch ohne `-X`: zum Lesen `-X GET`.

## 2026-11-02: Grenzen je Konto in der Datenbank, Eigentümer der Elternzeile, Tag-Schutz, SHA-Pinning (PRs #281, #286, Issues #227, #232, #233, #240, #241)

**#227 und #233, Migration 0051 (Kasums Ja, auf Produktion seit 2026-11-02, Version `20261102211918`).** Der Browser schreibt direkt in die Tabellen, die Grenzen galten nur in den Routen.
- **Trigger nach dem Befehl statt vor jeder Zeile, anders als im Issue vorgeschlagen:** ein Befehl mit vielen Zeilen zählt einmal, und die Policy hat vorher geprüft, die Sperre nimmt also nie ein fremdes Konto.
- **Zeilen und Bytes:** 50 000 Nachrichten mit je 40 000 Zeichen wären 2 GB bei 500 MB Kontingent. Gezählt wird `pg_column_size`, es liest ausgelagerte Werte nicht.
- **Budget im Bucket, nicht an `project_files`:** Objekte brauchen keine Zeile und überleben das Löschen ihres Projekts, Anlegen und Löschen im Kreis liefe sonst an jeder Grenze je Projekt vorbei.
- **Nur die Policy ist die Prüfung für #233**, nicht zusammengesetzte Fremdschlüssel: der Service-Role-Weg bleibt ungeprüft, er geht nur über Routen, die schon prüfen.
- **Geprüft:** `e2e/account-limits.spec.ts` als `authenticated` gegen den lokalen Stack. Mutationstest: ohne Sperre 4 statt 3 Projekte, ohne Trigger und Policy-Bedingungen 10 von 10 rot, der Guard schlägt bei geänderten Zahlen an. Objekt 500 und 501 einmal von Hand über die echte Storage-API. Auf Produktion nur lesend: vorher 6 Konten, keines über einer Grenze, 0 fremde Elternzeilen; nachher dieselben Mengen, Trigger und Policies wie in der Datei. **Die Grenzen wurden auf Produktion nie ausgelöst**, die Anzeige an einer Grenze hat niemand gesehen.
- **Bewusst offen:** Viele Konten zusammen können die Kontingente weiter füllen. An einer Grenze erscheint die allgemeine Fehlermeldung, die freundliche Absage von `/api/projects` bleibt, wie sie ist.

**#232:** Auth-Werte der Produktion im Dashboard gelesen, nichts geändert: Time-box und Inaktivität 0 (nie, nur im Pro-Tarif änderbar), Access-Token 3600 Sekunden, Erkennung wiederverwendeter Refresh-Tokens an, Reuse-Intervall 10 Sekunden. Stehen in `docs/SETUP.md`, "Sitzungs-Cookie". Eine Sitzung läuft also nicht von selbst ab.

**#240:** Ruleset 26395833 in `BajKasum/promptprinter-pp` (Kasums Ja): `refs/tags/v*`, kein Verschieben, kein Löschen, keine Ausnahmen. Lesend geprüft, ein echtes Verschieben nicht versucht.

**#241, Punkt 5:** `sha_pinning_required` an (Kasums Ja). Danach grün: CI, E2E, E2E Produktion, Docker, Audit, Skill-Archiv (`workflow_dispatch`), CodeQL auf PR #281, Dependabot `github_actions` über "Check for updates". **Falle:** Läufe von CodeQL und Dependabot (`dynamic`) lassen sich nicht per `gh run rerun` wiederholen. Dependabot für npm unter der Einstellung nicht gesehen, kommt mit dem Montagslauf.

**Falle:** `claude-md-state.test.ts` verlangt die höchste Migration in `CLAUDE.md` im selben Branch wie die Migration; die Zeile lässt sich also nicht bis in den Changelog-Branch aufschieben.

---

## 2026-11-02: Tippflächen gemessen, Antwortvorschläge und Qualitätszeile ausgebaut, Live-Prüfliste der Suche (PR #282, Issues #225, #243, #245, #246, #249, #254)

**Messungen am echten Modell** (`glm-4.5-air`, Aufruf wie `src/server/llm/zai.ts`, in Vercel ist kein `ZAI_MODEL` gesetzt, also dasselbe Modell wie in Produktion; nur erfundene Eingaben; ein Lauf je Messung; Skripte nur im Scratchpad). Die Zahlen im Einzelnen stehen in den Issues.

- **#245 Verfeinern per Tipp: bestanden, bleibt.** 12 Prompts aus deutschen Gesprächen, alle fünf Tipps: 60 von 60 mit vollständigem Prompt, "Auf Englisch" 12 von 12 englisch. Zusatz in en, fr, it, es: 40 von 40, englisch 8 von 8. Der Wortlaut bleibt. "Vollständig" ist eine Heuristik (Codeblock, kein Diff, nicht abgebrochen, nicht zusammengefallen), die kürzesten Fälle sind gelesen. **Bekannte Schwäche:** "Kürzer" gab in 2 von 20 Fällen denselben Prompt Byte für Byte zurück, der Tipp kostet dann einen Zug und bewirkt nichts.
- **#225 Antwortvorschläge: verfehlt, ausgebaut.** 10 von 20 in der strengen Form (verlangt 16; nur Rückfragen als Nenner: 9 von 15), einmal ein Block neben Rückfragen, die in einem `text`-Block standen und als "Dein Prompt" erschienen wären. Fertige Prompts blind bewertet von einem frischen Subagenten: 7,10 mit Absatz gegen 8,55 ohne, 5 gegen 12 Paare besser. Ein Lauf, ein Modell als Bewerter; der Abstand trägt die Entscheidung trotzdem, weil die Form unabhängig davon durchfiel.
- **#243 Qualitätszeile: verfehlt, ausgebaut.** 48 echte Prompts, 18 davon bewusst unvollständig, Etiketten von einem frischen Subagenten, der die Erkennung nicht kannte (schwächer als ein Mensch). Aufgabenart 72,9 % (verlangt 90), zu Unrecht "fehlt" 12,1 %, zu Unrecht "enthalten" 14,3 % (je höchstens 10). Die Erkennung traf handgeschriebene Prompts und nicht Finns; gerade bei unvollständigen Prompts meldete sie falsche Sicherheit. Das Issue sagt: reicht die Quote nicht, wird die Idee nicht gebaut.

**Ausgebaut:** `CHOICES_RULE`, `ANSWER_CHOICES_ENABLED`, `features/chat/lib/choices.ts`, `choice-chips.tsx`, `prompt-quality.ts`, `prompt-quality-line.tsx`, die Wörterbuch-Schlüssel `chat.quality` und `chat.choices`, die Etiketten in `tests/support/prompt-corpus.ts`. Der Text des Systemprompts blieb Byte für Byte (SHA-256 gleich), beides war im Produkt nie an. Die Prompts der Sammlung bleiben für Prompt-Prüfer und Platzhalter.

**#246 Live-Prüfliste per curl:** `http` auf `https`, `www` auf die Hauptadresse und `promptprinter.vercel.app` auf `promptprinter.app` je ein 308. `/pricing/`, `/features` und der alte Vergleich leiten um, `/gibtsnicht` gibt 404. `canonical`, `og:url` und alle 34 Sitemap-Adressen stehen auf `https://promptprinter.app`, alle 34 geben als Googlebot 200. `robots.txt`, `sitemap.xml`, `llms.txt` geben 200 für Googlebot, Bingbot, OAI-SearchBot und PerplexityBot. **Eine Abweichung:** `http://www.` braucht zwei Sprünge (Vercel wechselt erst auf HTTPS, dann auf die Hauptadresse), steht aber in keinem Link. Search Console und Bing sind nicht eingerichtet, das braucht Kasums Logins; das Issue bleibt offen.

**#249:** Topics von `BajKasum/PromptPrinter` ergänzt, Homepage von `BajKasum/promptprinter-pp` auf `https://promptprinter.app/skill`, seine Beschreibung bleibt. **Der eine Standardsatz:** "An AI chat that asks what's missing and writes you the finished prompt, for any AI and any task." Die deutsche Fassung ist `SITE_DESCRIPTION`. Gewählte Verzeichnisse: AlternativeTo und Future Tools, die fertigen Texte stehen im Issue, einreichen tut Kasum. Offen, bis zwei Einträge live sind.

**#254:** geschlossen. Es fehlten nur die Search-Console-Zahlen nach 8 bis 12 Wochen, sie stehen ab Februar 2027 unter "Offen" in `CLAUDE.md`.

---

## 2026-11-02: GitHub aufgeräumt, Vitest 5, minimatch 11, Webhook ignoriert den Testmodus (Branch `chore/github-aufraeumen-2026-11-02`)

Kasums Auftrag: nur die 16 Issues bleiben offen, alle PRs durch, keine Scanner-Funde. Vorher: #273 grün, #274 rot, Dependabot-Alarm #3, `npm audit` 16 moderate (eine Ursache), drei Advisory-Entwürfe.
- **Vitest 5 und `@vitest/coverage-v8` 5 zusammen:** #274 hob nur die Abdeckung, sie verlangt als Peer genau dieselbe Vitest-Version, `npm ci` scheiterte mit ERESOLVE. Den Vitest-Sprung (#163) hatten wir am 19.10. geschlossen, Dependabot schlug ihn deshalb nicht wieder vor. In `dependabot.yml` jetzt eine eigene Gruppe `vitest`, auch für Majors.
- **`minimatch` 11 per Override (GHSA-g3hv-75wg-m249):** betroffen ist laut Advisory alles unter 11.0.1, Dependabot kann es nicht selbst heben (`security_update_not_possible`), ESLint und seine Plugins verlangen weiter 3 und 10. **Geprüft:** ESLint liest mit 11 und mit 3.1.5 dieselben 673 Dateien und meldet bei eingebauten Fehlern dasselbe, `.next` bleibt ignoriert. **Falle:** 11 hat keinen aufrufbaren Default-Export, `jsx-a11y/label-has-associated-control` stürzt damit ab (Exit 2), heute ist keine solche Regel aktiv. Steht im `//overrides` von `package.json`. Erreichbar war der Fehler nicht: 3.1.5 kennt `optimizationLevel` gar nicht, 10.2.6 nur ab Stufe 2, und niemand setzt sie.
- **Webhook (GHSA-4hvx-rhrq-fr4r):** `test_mode: true` ändert kein Konto mehr, 200 und `ignored` in `billing_events`, auch für einen Entzug. Vorher schaltete ein Testkauf Pro frei, und Testkarten sind öffentlich. Schalter `LEMON_SQUEEZY_ACCEPT_TEST_MODE=1` für Prüfungen ausserhalb der Produktion, auf Vercel mit `VERCEL_ENV=production` wirkungslos; kein neuer Wert in Vercel nötig. **Mutationstest:** Schranke weg, Schranke immer, Produktionssperre weg, Schalter ohne Wert: alle vier erkannt. **Offen, bei Kasum:** im Lemon-Squeezy-Dashboard prüfen, ob ein Testmodus-Webhook auf die Live-Adresse zeigt und das Testprodukt noch da ist, erst dann wird der Entwurf geschlossen.
- **Bleibt offen:** GHSA-r5hq-66jj-rwjv ("Confirm email" aus): Mail-Test und Dashboard-Schalter bei Kasum.
- **Nachtrag (Branch `ci/dependabot-eslint-major`):** Der Merge löste drei neue Dependabot-PRs aus. #277 und #278 gemergt, #279 (ESLint 10) geschlossen: CI grün und in einer Wegwerf-Kopie dieselben 673 Dateien und Meldungen, aber die Plugins erlauben nur ESLint bis 9 (`npm ls`: invalid), und der Sprung behebt nichts. ESLint-Majors stehen deshalb in `ignore`, sonst käme der PR mit jedem 10.x wieder.

---

## 2026-11-01: Zweite Nachkontrolle (Branch `fix/nachkontrolle-2-2026-11-01`)

Kontrolle der PRs #265, #268 und #270: Gate, Code der neuen Chat-Teile, Live-Seite auf Desktop und bei 375 Pixeln, Prüfsumme des Skills gegen die echte Datei. Geändert:
- **`/skill`:** Prüfsumme und Befehle standen als Textwand direkt unter dem Download-Knopf, dem Kasten, den Kasum bewusst schlicht wollte. Sie stehen jetzt aufklappbar darunter (#240 bleibt erfüllt).
- **`/api/projects/[id]/brain/status`:** eigene Stundengrenze; ohne sie gab es keine Bremse je Konto vor den Anfragen an GitHub.
- **#202:** letzte Stelle (`move-to-project.tsx`) liest den Fehler, die Ausnahmeliste des Guards ist leer.
- **`testTimeout` 20 s:** im vollen lokalen Lauf rissen gesunde Tests die 5 s, wenn alle Kerne belegt waren (einzeln rund 1 s, CI grün).

---

## 2026-11-01: CI, Browser-Test im Produktionsaufbau, Abdeckung, Skill-Prüfsumme, Startseite und Aufgabenseiten (PR #270, Branch `chore/ci-marketing-2026-11-v2`; #266 ging wegen eines Merge-Commits nicht per Rebase und ist ersetzt)

- **#222 Ein Lauf je Commit:** `ci.yml`, `e2e.yml`, `docker.yml` und die neuen Workflows hören bei `push` nur auf `main`, jeder Branch mit PR läuft über `pull_request` (Stand nach dem Merge in `main`). **Entscheid:** das einzige Mittel, bei dem jeder Lauf nur einmal *startet* (eine gemeinsame Concurrency-Gruppe hätte beide gestartet und einen abgebrochen). **Folge:** ein Branch ohne PR hat keinen Lauf (`workflow_dispatch` in `ci.yml`), und ein PR mit Merge-Konflikt bekommt keinen. `verify` hat `timeout-minutes: 20` (längster Lauf der letzten 30: 303 s); `workflows.test.ts` verlangt je Job eine Zeitgrenze und push nur auf `main`, wo `pull_request` mitläuft. Gegengeprüft, beide rot. Beleg am PR: je Commit ein Lauf je Workflow, keiner doppelt.
- **#220 Browser-Test im Produktionsaufbau:** eigener Workflow `e2e-prod.yml` (nicht in `e2e.yml`), `playwright.prod.config.ts`, `e2e/prod/produktion.spec.ts`: `next build` und `next start`, acht öffentliche Seiten (auch eine 404), Policy ohne `'unsafe-eval'`, kein `securitypolicyviolation`, keine Konsolenfehler, Menü öffnet sich (Hydration), `/api/health`, auf `/chats/new` mit Anmeldung der Nonce an jedem Inline-Skript und eine Gegenprobe mit einem Inline-Skript ohne Nonce. Die Anmeldung läuft über selbst geschriebene Cookies, nicht `/api/auth` (in Produktion ohne echtes Upstash 429). Mutationstests, je neu gebaut: Nonce aus `(app)/layout.tsx` entfernt (rot), `isAppPath()` immer wahr (11 von 12 Tests der öffentlichen Seiten rot). Zwei Ausnahmen in der Konsolenprüfung: `/_vercel/` (nur auf Vercel) und der auf https umgestellte Prefetch (nur auf der http-Adresse der Tests). Der erste Lauf in der CI fand einen harmlosen Fund: abgebrochene Prefetch-Anfragen (`_rsc=`, `ERR_ABORTED`) auf `/chats/new`, jetzt als dritte Ausnahme begründet ausgenommen. Lokal lief der Test gegen einen eigenen Stack auf anderen Ports.
- **#221 Abdeckung:** `@vitest/coverage-v8`, `npm run test:coverage`, Tabelle je Verzeichnis (`scripts/coverage-summary.mjs`), Job `coverage` in `ci.yml` neben `verify`, nicht blockierend, ohne Schwelle. **Basiswert:** `src/server/` 87,8 % der Zweige, `src/app/api/` 90,9 %, Seiten unter `src/app/` 9,5 %. Am dünnsten in `src/server/`: `project.ts`, `session.ts`, `cli-login/store.ts` (je 0 Zweige). Offen: Ratsche (Kasums Entscheid), die ungedeckten Zweige der drei komplexen Funktionen als Aufgaben.
- **#240 Skill-Download (teilweise, offen):** `/skill` liefert das ZIP des Commits `4451250e` (Spitze von `v0.3.0`) und zeigt die SHA-256 `88bceb21…` samt `shasum`- und `Get-FileHash`-Befehl; `skill-data.test.ts` hält Version, Commit und Prüfsumme zusammen, `skill-archive.yml` lädt das ZIP wöchentlich und bei jeder Änderung und vergleicht (GitHub sagt für diese Archive keine feste Byte-Folge zu). **Offen, bei Kasum:** der Tag-Schutz (Ruleset für `v*`) im Schwester-Repo.
- **#247 Startseite:** ein Absatz in HowItWorks, "PromptPrinter ist ein Prompt-Generator, der erst nachfragt. Ich bin Finn: …". **Entscheide:** Kategoriebegriff "Prompt-Generator" (steht schon in `keywords`); die `keywords` im Root-Layout **bleiben** (Google ignoriert sie, sechs Einträge sind kein Stopfen, ein Test hält den Begriff dort fest); Titel der Startseite unverändert. `hero.tsx`, Hero-Demo und Footer unberührt.
- **#255 Vergleich:** vierte Seite `prompt-verbessern-lassen`; `COMPARISONS_UPDATED` 2026-11-01 (die drei älteren Einträge wurden dabei gegen die Regeln im Kopf von `comparisons.ts` gelesen, nicht inhaltlich neu geprüft).
- **#254 Aufgabenseiten (teilweise, offen):** `/aufgaben` mit Übersicht und fünf Seiten (Brief, Webseite, Datenbank, Sicherheitsprüfung, Lernplan), Daten in `task-guides.ts`. **Entscheid (Kasum gab Themen und Ton ab):** Ton wie Hilfe und Vergleiche, nicht Finns Ich-Form. Die Beispiel-Prompts sind von Hand nach den Regeln in `server/system-prompt.ts` geschrieben und als Beispiel gekennzeichnet, nicht mit dem laufenden Produkt erzeugt; keine Messwerte, keine Kundenstimmen. **Offen:** die Search-Console-Zahlen je Seite nach 8 bis 12 Wochen (hier einzutragen).
- **Nicht geprüft:** die Wirkung der neuen Seiten auf Suchanfragen; der Job `coverage` ist nur grün gelaufen, seine Zahlen stehen nicht im Vergleich zu einem zweiten Lauf (wie stark sie schwanken, ist unbekannt). Auf PR #266 fiel ein Smoketest-Lauf einmal durch einen belegten Port 54324 beim Start des Mail-Containers aus (Runner, kein Code), der Neustart war grün.

---

## 2026-11-01: Das fertige Ergebnis im Chat (PR #268, Branch `feat/prompt-ergebnis-2026-11`)

- **#242, #236 Prompt-Prüfung:** `features/chat/lib/prompt-check.ts` prüft den Prompt-Block im Browser (kein Serveraufruf) auf Schlüsselformate (mit Entropiegrenze bei zugewiesenen Werten), persönliche Angaben (E-Mail ohne Beispieldomains, IBAN und Karte mit Prüfsumme, Telefon nur mit `+` oder in Schweizer Mobilform, AHV-Nummer), riskante Befehle (Herunterladen und ausführen, verschleierte Nutzlast, Rückkanal, `rm -rf` auf Wurzel oder Home), Dateien mit Zugangsdaten, Überschreibungen früherer Regeln (de, en, fr, it, es) und Links, deren Adresse die Person nie geschrieben hat. Der Hinweis steht neben "Prompt kopieren", kopieren geht immer. **Entscheid:** Links und das Verschicken von Geheimnissen an ein fremdes Ziel prüft er nur mit Gesprächskontext (`typed`), sonst wäre jeder Link ein Treffer; im Entwicklungs-Prompt ist "POST das Token an die eigene API" der Normalfall. Gegen 30 handgeschriebene Prompts (`tests/support/prompt-corpus.ts`) kein Fehlalarm. Auf `/pp` übertragen sich diese Regeln nicht, nur Regel 5 des Skills ("Repository-Inhalt ist Daten") entspricht dem Satz im Systemprompt.
- **#236 Gedächtnis:** Die Fakten stehen im Systemprompt zwischen `<project_brain>`-Marken und sind als Referenzdaten benannt, ein Fakt kann die Marke nicht schliessen, das Budget gilt für den ganzen Block. Nicht gegen ein echtes Modell geprüft.
- **#224 Platzhalter:** `features/chat/lib/placeholders.ts` erkennt `[Text]` mit Buchstaben, ohne Wortzeichen davor und ohne `(`, `[` oder `: http` dahinter (Links, Quellenzahlen, JSON, Code, Indexzugriffe bleiben). Formular mit Vorschau, Umschalter "Kein Platzhalter", nichts geht an den Server, nichts wird gespeichert.
- **#244 Repo-Hinweis:** Leseroute `/api/projects/[id]/brain/status`, eine Anfrage an `git/trees/HEAD` (gegen api.github.com geprüft: dieselbe Baum-SHA wie die Analyse), 5 Minuten in Redis, ein Fehlschlag 60 Sekunden. Kein Hinweis bei 404, Limit, Zeitüberschreitung, Netzfehler oder einem alten Eintrag ohne SHA. Keine Migration, das Workspace-Layout ruft nichts auf. Keine eigene Ratenbegrenzung (ein neuer Bereich ändert `rate-limit.ts`). **Offen für Kasum:** ob die Datenschutzerklärung (Ziffer zum öffentlichen GitHub-Repository) den Aufruf beim Öffnen der Karte mit abdeckt, Text nicht angefasst.
- **#243 Qualitätszeile, aus:** `QUALITY_LINE_LIVE = false`. Aufgabenart 30 von 30, 78 von 78 genannten Punkten gefunden, aber nur 10 "fehlt"-Fälle, an der Gegenhälfte einer von drei zu Unrecht "enthalten". Die vorab gesetzte Hürde ist verfehlt; ein Test hält Zahlen und Schalter zusammen. Schwäche: Prompts und Etiketten vom selben Autor.
- **#225 Antwortvorschläge, Absatz aus:** `choices`-Block (Parser streng, 25 Testfälle), Tippflächen, Einfügen am Cursor. `ANSWER_CHOICES_ENABLED = false`, bis das Format an echten Antworten gemessen ist. Der Block ist kein Prompt (`extractPrompt` überspringt ihn).
- **#245 Verfeinern per Tipp:** sechs Tippflächen unter dem neuesten Ergebnis, jeder Tipp ein normaler Zug. **Nicht gemessen:** ob Finn bei jedem Tipp den vollständigen Prompt liefert, auch bei "Auf Englisch".
- **Offen:** #225, #243, #245 bleiben offen (je eine Messung gegen das echte Modell, bei #243 eine bessere Sammlung). fr, it, es nicht von Muttersprachlern geprüft. Der Repo-Hinweis ist im Browser nicht gegen ein echtes Repo gesehen. Die Dateigrenze der Wörterbücher stieg von 900 auf 1000 Zeilen.
- **Arbeitsweise:** Mutationstests für jede neue Schranke (92, jede Mutation nachweislich angewendet und gefangen). Browser-Tests `e2e/prompt-result.spec.ts` und ein Telefon-Test bei 375 Pixeln, gelaufen gegen den lokalen Stack im Stub-Modus.

---

## 2026-11-01: Typen, Fehlerpfade, Handler (PR #265)

- **Prüfung `reserveCounter`:** `EXPIRE ... NX` wird unterstützt. Die Upstash-Seite zu EXPIRE nennt `[NX | XX | GT | LT]`, das SDK 1.39 typisiert und sendet die Option. Keine Änderung, nichts gegen eine echte Redis-Instanz ausgeführt, also nur aus der Doku belegt.
- **#241:** Basis-Image per Digest, Aktualisierung von Hand (`docs/SETUP.md`). Offen: die GitHub-Einstellung, bei Kasum.
- **#217:** Ratsche `tests/guards/comment-history.test.ts` mit Basiswert je Datei.
- **#209:** Typen aus dem lokalen Stack (CLI 2.119.0, `--schema public`), alle Fabriken typisiert, CI vergleicht in `e2e.yml`. `maybeSingle<T>` und `as` verdeckten falsche Spalten und sind weg. Ungeprüft bleiben Spalten in `account-export.ts` und `accountsWithRows`.
- **#202:** Rest umgestellt, offen nur `move-to-project.tsx`. Ein Lesefehler im `(app)`-Layout zeigt die globale Fehlerseite.
- **#211:** drei Optionen an. `allowJs` bleibt (Guards importieren `.mjs`), `noUncheckedIndexedAccess` abgelehnt (365 Funde).
- **#215:** keine Funktion in `src/app/api`, `model-call.ts` und `decideBillingUpdate` über 100 Zeilen oder Komplexität 15 (Wegwerf-Messung), Route-Tests unverändert.
- **#232:** Cookie bleibt lesbar (`docs/SETUP.md`). Auth-Einstellungen der Produktion nicht gelesen, Issue offen.

## 2026-11-01: Nachkontrolle der drei Sessions (Branch `fix/nachkontrolle-2026-11-01`)

Unabhängig gelesen und live geprüft (CSRF-Schranke, `security.txt`, Sitemap, OG-Bilder, Structured Data). Zwei Funde:
`auth.unknown_error` konnte eine Mailadresse aus der GoTrue-Meldung ins Log tragen, und ein Test der Befehlspalette (#151) scheiterte im
vollen Lauf unter Last, weil er den Fokus sofort nach dem Schliessen las. Beides behoben. `EXPIRE … NX` in `reserveCounter` ist nicht gegen
das echte Upstash geprüft; schlüge es dort fehl, gäbe der Zähler `null` zurück und die Grenzen liefen still offen.

---

## 2026-11-01: Modellzugang und Chat-Umbau (PR #262, Branch `refactor/llm-chat-2026-11`)

- **#204 Zeitgrenzen:** Z.ai und der Custom-Slot teilen `streamDeadlines` (`server/llm/http.ts`): Frist bis zum ersten Textstück (Z.ai 30 s, Custom 60 s), danach 45 s Leerlauf (jedes Textstück startet neu), dazu 270 s Gesamtgrenze unter `maxDuration` 300 s. Überschreibbar mit `LLM_STREAM_IDLE_TIMEOUT_MS` und `LLM_STREAM_TOTAL_TIMEOUT_MS`, die Gesamtgrenze nie über 285 s. Die Zeit, die der Verbraucher für ein Stück braucht, zählt nicht gegen den Anbieter. Nicht gegen einen echten Anbieter geprüft.
- **#216 BYOK-Modelle:** `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL` (bei Gemini dieselbe Variable wie beim Server-Anbieter). Die Standardnamen sind nicht gegen die Modelllisten der Anbieter geprüft.
- **#214 Auswertung:** `throwProviderError` und `readCompletion` je einmal in `llm/http.ts`. `zaiComplete` und der Server-Zweig von `chatComplete` waren im Betrieb nie erreichbar und sind samt Tests entfernt, `chatComplete` verlangt `override`. Zwei kleine Abweichungen: der Fehler-Body von Z.ai wird auf 2 MB begrenzt gelesen, die Frist des Custom-Stroms beginnt vor der DNS-Prüfung.
- **#213 Kostenkette:** `reserveModelCall` (`server/model-call.ts`) ersetzt die doppelte Kette in `chat/allowance.ts` und der Gedächtnis-Route. **Entscheid:** Ohne Redis zählt auch die Analyse die Datenbank (vorher entfiel das Monatskontingent dort), ihre Ablehnung nennt wie im Chat `current`. Das Stundenlimit prüft der Aufrufer selbst (`rate-limit-scopes.test.ts` verlangt den Bereich als Literal).
- **#210 Strom-Schema:** `shared/lib/chat-stream.ts` hält Ereignisse, Nutzlast und Protokoll. `send` ist typisiert, der Browser liest mit `parseChatStreamEvent`. Der Leser ist nachsichtiger als der Sender (fehlende Kontextfelder sind kein Fehler), eine kaputte Nutzlast zeigt `chat.streamInvalid` (fr/it/es nicht von Muttersprachlern geprüft). Bundle-Größe nach dem zod-Import im Chat nicht gemessen.
- **#212 runChatTurn:** Reducer (`turn-state.ts`), Fehlerklassifikation und Anfrage (`turn-outcome.ts`), Ereignishandler (`turn-events.ts`). Keine Funktion in `run-chat-turn.ts` über 74 Zeilen oder Komplexität 9, `ChatTurnContext` hat 7 Mitglieder. `useChatTurn` selbst ist mit 257 Zeilen (viel Kommentar) nicht kleiner geworden als nötig.
- **#202 Datenbankfehler (teilweise, offen):** `orThrow` (`server/supabase/query.ts`), Lesefehler antworten mit 503 und geben Reservierungen zurück. Umgestellt: Profil und Zählung in der Kostenkette, `getUserOverride`, Konversation, Projektkontext samt Dateiliste, Projekt-Limit beim Anlegen, Gedächtnis-Route (sechs Stellen), Konto löschen, `getSessionProfile`, `getNeedsOwnKey`, `getProject`. Der Guard `db-read-errors.test.ts` führt den Rest in seiner Ausnahmeliste (Seiten der App, `settings/api-key`, Browser-Komponenten, Anhänge, Quellen des Gedächtnisses, Befehlspalette). `auth.getUser()` und `getClaims()` sind bewusst ausgenommen: ein Fehler heißt dort "nicht angemeldet".
- **Nicht geprüft:** ein echter Anbieter-Strom, der Browser (E2E lief in der CI), `session.ts` und `project.ts` ohne eigene Fehlertests. Die lokalen Tests liefen teils mit längerem Timeout, weil parallele Sitzungen den Rechner auslasteten.

---

## 2026-11-01: Sicherheits-Issues aus dem Audit des Tages (PR #258, Branch `fix/sicherheit-2026-11`)

- **#229 CSRF:** Die Middleware weist fremde ändernde Anfragen an `/api/` mit 403 ab (`server/security/request-origin.ts`), keine Route wurde angefasst. Sec-Fetch-Site zuerst, ohne den Kopf Origin. Ausgenommen: Webhook, die vier Geräte-Routen ohne Cookie, Bearer. **Entscheid:** Eine Anfrage ohne beide Köpfe läuft durch, sie kommt nicht aus einem Browser. Die vorgeschlagene Content-Type-Pflicht ist weggelassen, ein fremdes Formular scheitert schon an der Herkunft.
- **#207 Client-IP:** Weiterleitungs-Köpfe gelten nur mit `VERCEL` oder dem neuen, optionalen `TRUSTED_PROXY_HOPS`. Sonst teilen sich anonyme Anfragen einen Zähler, beim Start erscheint eine Warnung. In Produktion ist nichts zu setzen.
- **#206 Zähler:** Monatskontingent und Tagesbudgets laufen über `reserveCounter` (Zählen und Ablauf in einer Transaktion, Rückgabe legt keinen Wert -1 an). Die Budget-Warnung kommt je Tag statt je Prozess.
- **#231 Anmeldung:** Ab 10 Fehlversuchen in 15 Minuten ist die gehashte Adresse gesperrt, auch mit richtigem Passwort, unbekannte Adressen zählen genauso. **Entscheid:** Feste Sperre mit Ablauf statt wachsender Verzögerung. Wer stetig rät, kann das Passwort-Login eines Opfers aufhalten, Reset und OAuth bleiben offen. Nicht gebaut: die Besucher-IP an GoTrue weitergeben.
- **#230 Konto-Auskunft:** Reset und Erneut-Senden antworten auch im Mail-Cooldown gleich und warten mindestens 1,5 s. Die Mindestdauer ist nicht gegen den echten Mailversand gemessen. **Abstrich:** Die Registrierung nennt vergebene Adressen, solange "Confirm email" aus ist (docs/SETUP.md, "Auth-Mails").
- **#238 CSP (offen):** `'unsafe-inline'` bleibt auf `/login`, `/signup`, `/reset-password`. Lokal gemessen hatte die Nonce-Variante zwei- bis dreifache Zeit bis zum ersten Byte (`/login` 4 bis 6 ms gegen 10 bis 16 ms), `/login` und `/signup` mehr als doppelt so viel HTML, und der Cache fiel weg. Messwerte im Issue.
- **#241 (offen):** `/.well-known/security.txt`, allgemeiner Text für unbekannte Auth-Fehler (Wortlaut im Log), kein Produktionsstart mit http-Adresse ohne `ALLOW_INSECURE_APP_URL=1`, Proxy-Abschnitt in docs/DOCKER.md. Die Wildcard-CORS der Plattform bleibt, nur öffentliche statische Antworten. Offen: Basis-Image per Digest, GitHub-Einstellung für SHA-Pinning (Kasum).
- **Nicht geprüft:** der Zähler gegen ein echtes Upstash, die Sperre gegen einen echten Auth-Server, der Docker-Pfad von Hand. Die lokalen Tests liefen mit `--testTimeout=60000`, weil parallele Sitzungen den Rechner auslasteten.

---

## 2026-11-01: SEO, Structured Data, Sitemap und Docker-Kontext (Branch `chore/seo-docs-2026-11`, PR #259)

- **#248 Structured Data:** Organisation, Website, Software und Person tragen feste `@id` (`features/marketing/lib/entity-ids.ts`) und stehen
  einmal in `site-schema.ts`. Website und Software verweisen mit `{ "@id" }` auf die Organisation, Artikel und Gründer tragen `@id` plus Name
  (nur die `@id` allein hätte im Rich-Results-Test den Autor ohne Namen gezeigt). **Entscheid: kein `sameAs`**, weil keine öffentliche Seite ein Profil
  verlinkt (das Repository promptprinter-pp steht nur auf `/skill`); sobald `/ueber` oder der Footer GitHub zeigen, gehört die Adresse
  in `organization.sameAs`, ein Test hält das bis dahin fest. `inLanguage` der Software sind die fünf Sprachcodes (Urteil, die Startseite zeigt sie nicht, die Hilfe
  schon). `datePublished` je Vergleich (`published`): 2026-10-01, bei `direkt-in-die-ki-tippen` 2026-10-11, weil die Adresse erst seit der Umbenennung besteht.
  Kategorie und Angebote unverändert (#127). Die Beschreibung kommt aus `shared/lib/site-description.ts`, wie die Meta-Beschreibung.
- **#250 Titel:** `/skill` nennt Claude Code, `/docs` heisst "Hilfe und Anleitungen", `/ueber` "Über PromptPrinter: wer es baut und warum". Der Titelvorschlag
  für `/skill` aus dem Issue war mit Marke 70 Zeichen lang (Grenze 65), gewählt: "Skill /pp für Claude Code: fertige Aufträge".
- **#251 Sitemap:** `lastModified` ist das Datum, das die Seite zeigt (Hilfe `updated`, Vergleiche `COMPARISONS_UPDATED`, Rechtstexte das Datum aus `legal.ts`, über
  `shared/lib/german-date.ts` in ISO gewandelt, `legal.ts` blieb unberührt). Startseite, Preise, Skill, Über und Kontakt haben keins.
- **#252 Sprachen:** Abschnitt "In welchen Sprachen funktioniert PromptPrinter?" in "Konto und Daten" (`updated` 2026-11-01), `llms.txt` mit Satz und englischer
  Zusammenfassung. Die öffentlichen Seiten bleiben deutsch.
- **#253 Vorschau:** `/og/<art>/<slug>.png` (`src/app/og/[kind]/[slug]/route.tsx`, Edge, gleicher Aufbau wie die Karte der Startseite) für Hilfe und Vergleiche,
  `og:type=article` mit Daten aus Autorenzeile und JSON-LD (`article-metadata.ts`). Die Adresse endet auf `.png`, damit der Matcher der Middleware sie auslässt.
  Cache-Header ein Tag statt des Standards "ein Jahr, unveränderlich". **Build-Grösse:** `.next/standalone` +69 KB, Client-JS unverändert, die neue Edge-Funktion
  839 KB gzip (die bestehende `/opengraph-image` 843 KB).
- **#218 Kommentar-Pfade:** der Guard liest auch `next.config.ts`, Konfigurationen, Dockerfile, Compose, `scripts/`, `.github/` und Dateinamen ohne Ordner (nur ausserhalb `src/`,
  dort stehen Kurznamen wie `llm.ts`).
- **#223 Docker-Kontext:** `.dockerignore` ohne `.claude`, `docs`, `supabase`, `scripts`, `.github`, `tests/*` und `e2e/*`. **`tests/support` und `e2e/support`
  müssen bleiben:** der TypeScript-Schritt von `next build` liest `src/**/*.test.tsx` (`@tests/support/…`) und `playwright.config.ts` (`e2e/support/env`). Kontext von etwa 51 auf
  17,7 MB; mit geänderter `docs`- und `tests`-Datei blieben `COPY . .` und `npm run build` im Cache (lokal, Docker 29.6.2). Der Docker-Workflow lief auf dem PR grün.
- **Nicht geprüft:** Schema Markup Validator, Rich-Results-Test, LinkedIn Post Inspector; die Vorschau-Karten wurden nur lokal gesehen.

---

## 2026-11-01: Sieben Issues aus den Audits des Tages (Branch `fix/issue-runde-2026-11-01`)

- **#226 Open Redirect:** `safeNextPath` prüfte nur das Textpräfix, der Browser liest den Wert aber mit dem URL-Parser ("/\host"
  und "/" + Tab + "/host" führten nach dem Anmelden auf einen fremden Host). Jetzt sperrt die Prüfung Backslash und Steuerzeichen und
  löst selbst auf. Der Vorschlag im Issue hätte den normalisierten Pfad zurückgegeben: aus "/a/..//host" wäre "//host" geworden. Deshalb geht
  der Rohwert zurück, und die Pfadform "//" wird abgelehnt.
- **#201 Webhook:** Datenbankfehler bei der Konto-Zuordnung, beim Wiederaufnehmen und in `finish` enden in `failed` und 503, nicht in "Kauf ohne Konto".
- **#234 Mail im Log:** `billing.webhook_unmatched` nennt die Mailadresse nicht mehr, die Freischaltung von Hand läuft über die Bestellnummer
  im Lemon-Squeezy-Dashboard. `redactContext` schwärzt `email`, `mail`, `phone`.
- **#203 Unlesbarer Key:** `getUserOverride` gibt `"unreadable"` zurück und meldet `byok.key_unreadable`. Chat und Gedächtnis antworten 409
  `byokUnreadable`. **Entscheid:** auch Pro fällt nicht auf den Server-Key zurück, wer einen eigenen Key gewählt hat, soll nicht still auf Betreiberkosten
  laufen. Nicht gebaut: die Anzeige "Key nicht lesbar" in den Einstellungen (nötig wäre dort ein Entschlüsselungsversuch beim Laden).
- **#205 SSE:** CRLF und CR werden wie LF gelesen, ein vorzeitiges Ende bricht die Antwort beim Anbieter ab. Mehrere `data:`-Zeilen eines Ereignisses
  werden weiter einzeln gelesen, nicht verbunden: so kommen auch Server durch, die Rahmen nur mit einem Zeilenende trennen.
- **#208 IPv6:** Adressen werden in acht Gruppen zerlegt und auf Zahlen geprüft, dazu NAT64, 6to4, IPv4-kompatibel, Multicast, Site-Local,
  Dokumentation, Discard.
- **#219 Doku:** Migration 0050 liegt seit dem 2026-10-29 auf Produktion (Version `20261029183929`, in der Migrationsliste der Datenbank gelesen), der Eintrag
  vom 2026-10-29 unten beschreibt den Stand davor. Neuer Guard `claude-md-state.test.ts`.

---

## 2026-10-29: `/skill`: Download-Kasten nach oben, "Ehrlich vorab" entfernt (Branch `feat/skill-seite-kasten`)

Auftrag von Kasum: unter der Überschrift soll sofort der Download stehen, nicht erst unter der Erklärung, und der Abschnitt
"Ehrlich vorab: ein Experiment" soll von der Seite verschwinden.

- **Umgebaut:** direkt unter der Überschrift ein hellblauer Kasten (`bg-accent/30`, Rand `accent/60`, im Dunkelmodus ein
  gedämpftes Blau) mit "So bekommst du ihn", Version und Lizenz, den Knöpfen "ZIP herunterladen" und "Auf GitHub ansehen" und
  den drei Schritten (Herunterladen, Installieren, Benutzen). Darunter der erklärende Absatz und die drei Karten ("Er liest,
  was da ist", "Er schreibt einen Auftrag", "Er wartet auf dein Ja"), am Ende der Hinweis auf den Chat.
- **Entfernt:** der Abschnitt "Ehrlich vorab" samt den Zahlen der Messung (`SKILL_MEASUREMENT`, `SKILL_MISSED_BAR`), der
  Satz "mit der ehrlichen Messung dazu" in `llms.txt`. Die Messung steht weiter im README von `promptprinter-pp`, die Seite
  sagt nichts mehr dazu. Das ist Kasums Entscheid; er ersetzt den Satz im Eintrag darunter ("Ehrlich, bevor man lädt").
- **Test:** `page.test.tsx` prüft, dass der Kasten (Region "So bekommst du ihn", Klasse `bg-accent`) die zwei Links und die
  drei Schritte trägt und im Text vor den Karten steht, und dass kein Wort von Experiment, Messlatte oder Messzahlen auf der
  Seite steht.
- **Geprüft:** im Browser Desktop hell und dunkel und Handy (375 Pixel, kein Überlauf, eine h1), Konsole ohne Fehler.

---

## 2026-10-29: Download auf `/skill` auf den Tag v0.3.0 gestellt (Branch `fix/skill-download-tag`)

Auftrag von Kasum. Das Schwester-Repo hat jetzt den Tag `v0.3.0`; das ZIP auf `/skill` zeigt auf
`/archive/refs/tags/v0.3.0.zip` statt auf `main.zip`. Warum: der Download ist damit genau die Fassung, deren Zahlen die Seite
nennt (`SKILL_VERSION` 0.3.0, Messung 82 von 99), auch wenn `main` später weiterzieht. Geändert: `SKILL_ZIP_URL` in
`skill-data.ts`, die wörtliche Adresse in `skill/page.test.tsx`. Der Satz im Eintrag darunter ("es gibt nur `main`")
beschreibt den Stand bis hierher.

---

## 2026-10-29: Seite `/skill` (der Skill `/pp` zum Herunterladen), dritter Link im Header (Branch `feat/skill-seite`)

Auftrag von Kasum nach dem Merge von PR #196: im Header neben "Funktionen" und "Preise" ein dritter Link, dahinter eine
Seite im Stil von `/pricing`, auf der man den Skill aus `promptprinter-pp` herunterladen kann, mit Finn.

- **Gebaut:** `src/app/(marketing)/skill/page.tsx` (`PageHeader` mit den zwei Finns, drei Karten mit je einem Finn
  `researching`, `delivering`, `waiting`, "Ehrlich vorab", Download mit drei Schritten, Schluss mit Link auf die Anmeldung),
  Daten in `features/marketing/lib/skill-data.ts`. Navbar und Footer führen "Skill", `PUBLIC_PREFIXES`, Sitemap und `llms.txt`
  ebenso.
- **Download:** ZIP von `main` (`/archive/refs/heads/main.zip`) und Link auf das Repository. Das Schwester-Repo hat weder
  Release noch Tag, es gibt also nur `main`; ein Release ist der sauberere Weg, sobald Kasum eines schneidet.
- **Ehrlich, bevor man lädt:** die Seite sagt vor dem Download, dass der Skill seine eigene Messlatte dreimal verfehlt hat
  (82 von 99 Fakten, verlangt 90, Plan-Modus 83; besser bei der Bewertung des Auftrags, 170 statt 153 von 176), dass Claude
  bewertet hat und nicht blind, dass nur Claude Code gemessen ist und der Skill vorerst nicht weiterentwickelt wird. Der Satz
  "verfehlt" hängt an `SKILL_MISSED_BAR` (Zahl gegen Latte), `page.test.tsx` liest, was auf der Seite steht. Quelle der Zahlen:
  das README von `promptprinter-pp` vom 2026-10-29. Ändert sich die Messung, ändert sich zuerst `skill-data.ts`.
- **Bewusst nicht:** keine Bau-Tools genannt (CLAUDE.md, 2026-10-11), nur Claude Code; kein Preis (der Skill ist frei, MIT);
  keine Änderung am Schwester-Repo (dessen GitHub-Beschreibung sagt noch "nothing installable yet", das ist Kasums Entscheid).
- **Geprüft:** fünf Mutationen (Kasten, Zahlen, Repo-Adresse, `PUBLIC_PREFIXES`, Sitemap), alle erkannt; im Browser Desktop
  und Handy (375 Pixel, kein Überlauf, eine h1, beide Links stimmen), Konsole ohne Fehler.

---

## 2026-10-29: Terminal-App, Phase 1 (Server): Anmeldung per Geräte-Code (Branch `feat/cli-login`)

Auftrag von Kasum (Phase 1 der Terminal-App, Entwurf und Nachweis im Vault: "PromptPrinter Terminal-App Architektur"
und "Phase 0"). Ein Branch, mehrere Commits, ein PR, **nicht gemergt**. **Migration 0050 ist nicht auf Produktion
angewendet**: erst die Migration (nach Kasums Ja), dann der Merge, sonst antworten die Routen unter `api/cli` mit 503.
Der Client (Phase 2) und `/pp` mit Kontext (Phase 3) sind nicht Teil davon.

- **Bearer neben dem Cookie:** `createClientForRequest(req)` in `server/supabase/server.ts`. Sagt der Kopf `Authorization`
  "Bearer", bekommt der Client genau dieses Token und liest keine Cookies, setzt keine; ein ungültiges oder leeres Token ist
  ein 401, das Cookie rettet es nicht. Ohne Kopf (oder mit Basic) alles wie vorher. Die Prüfung bleibt `getUser()` beim
  Auth-Server (ein gelöschtes Konto ist sofort draußen, das JWT allein gälte bis `exp`). Nur der Chat (`gate.ts`) nutzt es;
  `tests/guards/bearer-routes.test.ts` verlangt für jede weitere Datei, die den Kopf liest, einen Eintrag mit Grund.
  `server.bearer.test.ts` belegt gegen die echte supabase-js-Bibliothek, dass `getUser()` ohne Sitzung das Token des Kopfes
  an `/auth/v1/user` schickt.
- **Migration `0050_cli_device_requests.sql`:** Tabelle der Anfragen, höchstens zehn Minuten gültig. Nur der SHA-256 des
  Geräte-Codes liegt in der Datenbank, der Nutzer-Code hat acht Zeichen aus 28 (Konsonanten ohne Y und die Ziffern 2 bis 9,
  rund 38 Bit). RLS an, die Policy erlaubt `anon` und `authenticated` ausdrücklich nichts, `revoke all`, Rechte nur für die
  Service-Role; `pending` hat keinen Nutzer, jede Entscheidung hat einen (`check`); `user_id` mit `on delete cascade` und
  Index (wie 0047). Lokal mit `supabase start` angewendet, auf Produktion **nicht**. Rückweg im Kopf der Datei.
- **Routen unter `api/cli/`:** `device` (anonym, 20 je 10 Minuten und Adresse), `approve` (nur Cookie, Origin-Prüfung vor
  allem anderen, 10 je Minute und Nutzer, zählt auch die Vorschau), `token` (240 je 10 Minuten und Adresse, dazu zwei
  Sekunden Abstand je Code, sonst `slow_down`; holt die Sitzung mit einem Update `approved` nach `consumed` ab),
  `refresh` und `logout` (je 30 je 10 Minuten und Adresse). Je Route ein eigener Name in `RateLimitScope`.
- **Entscheide beim Bauen, und warum:**
  - **Die Sitzung stellt der Server ohne Mail aus** (`generateLink` mit `magiclink`, dann `verifyOtp` mit dem Hash; Phase 0).
    `generateLink` legt zu einer unbekannten Adresse ein NEUES Konto an, deshalb prüft `issueCliSession`, dass die Sitzung
    dem freigegebenen Konto gehört, und ein zwischen Freigabe und Abholung gelöschtes Konto bekommt keine.
  - **Abholen verbraucht den Code zuerst:** scheitert danach das Ausstellen, ist der Code weg und die Anmeldung beginnt von
    vorn (503 `session_failed`). Lieber das als eine Sitzung zweimal auszuliefern.
  - **Abmelden über `admin.auth.admin.signOut(jwt, "local")`:** ein supabase-js-Client ohne Sitzung hat bei `signOut` nichts
    zu beenden. Die Route liest das Token mit `bearerToken()`, prüft es beim Auth-Server und beendet nur diese Sitzung.
  - **Die Freigabe nimmt kein Bearer an:** ein angemeldetes Terminal gibt mit seinem Token kein weiteres Gerät frei.
  - **Antworten an das Terminal sind englisch und maschinennah** (`server/cli-login/messages.ts`, das Terminal liest `kind`);
    die an den Browser (Freigabe) stehen in den fünf Wörterbüchern, fr, it und es nicht von Muttersprachlern geprüft.
  - **Kein Code in der Adresse:** weder der Server (`verificationUri` ist `/cli`) noch die Seite lesen einen Code aus der
    Adresse; ein vorausgefüllter Link ließe sich jemandem unterschieben.
  - **Schwärzliste:** `device_code` und `user_code` (in jeder Schreibung) stehen auf ihr, als Wortpaare, weil `code` allein
    `statusCode` und `error_code` unlesbar machte.
- **Hilfe-Artikel `/docs/terminal-anmeldung`** (`updated` 2026-10-29): beschreibt eine Anmeldung, zu der es den Client noch
  nicht gibt, und sagt das im ersten Satz. Er steht mit dem Merge in Sitemap und `llms.txt`.
- **Messungen:** 32 Mutationen an Schranken (Fabrik 2, Guard 1, Migration 4, Routen und Codes 13, Schwärzliste 2, Seite 6, Browser-Tests
  4), alle von einem Test erkannt, der Quelltext danach aus der Sicherung zurückgeholt. Browser-Tests: die elf neuen Tests (`e2e/cli-login.spec.ts`) laufen grün. Die ganze Suite lief mit Chromium 1243 mit 31 von 36 grün; vier der fünf Ausfälle (Passwort-Reset, Projekte, Mobil-Menü, Smoke am Zeitlimit mit 58,7 s von 60 s) fallen auf `main` mit demselben Browser genauso aus, der fünfte (`billing-webhook`, "ignored") ist ein Rest des vorigen Laufs in der lokalen Datenbank (fester Ereignisschlüssel, Antwort `duplicate`) und braucht einen frischen Stack. Gate: grün (Audit, Typecheck, Lint, 220 Testdateien mit 3150 Tests und 2 übersprungenen, vorher 3071, Build mit den Platzhaltern der CI).
- **Funde:** (1) Das Playwright des Repos (1.64.1) will Chromium 1248, installiert war 1243; die Läufe liefen mit einer
  nicht eingecheckten Konfiguration auf das vorhandene Chromium, ohne etwas herunterzuladen. (2) `next dev` schreibt seit 16
  eine `AGENTS.md` ins Repo (untracked, nicht committet). (3) Nach den Mutationsläufen war `.next` offenbar veraltet: ein Lauf der ganzen Suite scheiterte an allen Tests, die im Browser klicken (Chat, Konto, Anmelden), derselbe Stand mit geleertem `.next` lief grün. `.next` leeren gilt also auch nach Mutationsläufen, nicht nur zwischen Branches. (4) Am Akku liefen die Tests wie am 28.10. rund
  dreimal so langsam; das Gate lief mit `--testTimeout=30000`.
- **Offen:** vier Werte der Produktion sind nicht gelesen (Lebensdauer des Access-Tokens, Rotation und Wiederverwendungsfenster
  der Refresh-Tokens, Zeitbegrenzung der Sitzungen, Grenzen je Adresse), und ein echtes OAuth-Konto (Google, GitHub) ist nicht
  geprüft: `verifyOtp` setzt `app_metadata.provider` auf `email`, ob dabei eine zusätzliche E-Mail-Identität entsteht, ist offen
  (Phase 0, Abschnitt 2). Für den Datenschutz wäre ein Satz zu den neuen Daten (Gerätename und Zeitpunkte der Anfrage, kein neuer
  Empfänger) zu entscheiden; geändert ist er nicht.

---

## 2026-10-28: Next 16 und framer-motion 14 (die Dependabot-PRs #189 und #190)

Die fünf offenen Dependabot-PRs (#187 bis #191) wurden am 28.10. auf Kasums Auftrag bearbeitet. Dependabot hat
beim Schliessen die Zweige gelöscht, `@dependabot reopen` griff nicht; die Änderungen stehen deshalb neu auf `main`.

- **Gruppe Minor und Patch (#187):** `@google/genai` 2.31.0, `lucide-react` 1.61.0, `openai` 7.43.0,
  `postcss` 8.5.31, `puppeteer-core` 25.16.0 (PR #192).
- **framer-motion 14.6.0 (#189, PR #193):** eine Feder mit drei Werten (`y: [16, -10, 0]` in
  `success-celebration.tsx`) wirft in 14 ("Only two keyframes currently supported with spring"), der Kontomenü-Knopf
  wurde nie stabil und der Browser-Test zur Anmeldung lief in den Zeitablauf. Scale und Deckkraft bleiben Feder, `y`
  läuft als Tween über dieselben drei Werte.
- **Next 16.4.2 mit `eslint-config-next` 16.4.2 (#190):** `eslint.config.mjs` lädt die Next-Regeln als Flat-Config
  (`eslint-config-next/core-web-vitals` und `/typescript`) statt über `FlatCompat`. Vier Compiler-Regeln von
  `eslint-plugin-react-hooks` 7 sind aus (`set-state-in-effect` 18 Funde, `refs` 9, `immutability` 1, `purity` 1),
  weil sie dem React Compiler gelten, den das Projekt nicht einsetzt; ein eigener Auftrag kann den Code später
  umstellen. Die zwei gewollten harten Navigationen in `delete-account.tsx` tragen einen Ausschluss für
  `@next/next/no-location-assign-relative-destination`. Die Pinnung von `brace-expansion` (`^5.0.12`) gilt nicht mehr
  für `minimatch` 3: dessen Aufruf `expand` bricht mit Version 5 ("expand is not a function"), sobald ESLint ein
  Muster mit Klammern gegen die Next-Konfiguration prüft; `minimatch` 3 bekommt `brace-expansion` ^1.1.12 (gepatcht,
  Audit sauber). `tsconfig.json`: `jsx` auf `react-jsx` und `.next/dev/types`, wie Next 16 es setzt. Der Build läuft
  mit Turbopack; er warnt, dass `middleware.ts` zu `proxy.ts` wird und die Edge Runtime auslaufend ist (beides
  offen, nicht geändert).
- **Zwei Fehler, die erst die Browser-Tests mit Next 16 zeigten:** (1) `use-chat-turn.ts` setzte `mountedRef` nur beim Abräumen
  auf `false`, nie wieder auf `true`; der React-Strict-Mode im Entwicklungsserver räumt den Effekt nach dem ersten
  Einhängen einmal ab, danach navigierte der erste Zug nie auf `/chats/[id]` (in Produktion läuft kein Strict Mode,
  dort war es nicht zu sehen). Behoben, mit einem Test unter `<StrictMode>`, der ohne die Korrektur anschlägt.
  (2) Nexts Dev-Anzeige klappt seit 16 wegen der React-Meldung zum `script`-Element von `next-themes` links unten
  auf ("1 Issue") und deckt das Kontomenü ab, Playwright fand den Knopf nie "stabil". `PP_E2E=1` aus
  `e2e/support/env.ts` schaltet sie nur für den Test-Server aus (`next.config.ts`).
- **Nicht übernommen:** `typescript` 7.0.2 (#188): `typescript-eslint` unterstützt TS 7.0 nicht ("does not support
  TS 7.0", Unterstützung ab 7.1 angekündigt), das Lint stürzt ab; der Typecheck allein liefe nach einer Deklaration
  für `*.css` grün. `eslint` 10.13.0 (#191): `eslint-plugin-jsx-a11y` 6.10 (über `eslint-config-next`) erlaubt nur
  ESLint bis 9, die Installation scheitert an den Peer-Abhängigkeiten. Beide warten auf die Werkzeuge.
- **Messung auf dem Entwicklungsrechner:** am Akku (Energieplan "Ausbalanciert") laufen die Tests rund dreimal so
  langsam, einzelne Animations- und Formulartests scheitern dann an der Zeitgrenze von 5 s und laufen einzeln grün;
  das volle Gate lief mit `--testTimeout=30000` grün (3071 Tests). Die CI auf Linux ist davon nicht betroffen.

---

**Schwester-Repo `promptprinter-pp` (2026-10-25):** PromptPrinter 2.0 (Skill `/pp` plus lokales Skript für Coding-Agenten) bekommt ein eigenes öffentliches Repo, MIT-Lizenz (Entscheide D1 bis D5 und D9, Kasum am 25.10.2026, alle wie empfohlen). **Kein gemeinsamer Code, keine Laufzeit-Abhängigkeit:** die Regeln aus `src/server/system-prompt.ts`, die Rangordnung aus `project-context.ts`, `SIGNAL_FILES` aus `github-select.ts` und `extractPrompt` werden dort als Text oder Neuschreibung übernommen; die Herkunftstabelle steht in `CLAUDE.md` des Schwester-Repos, hier ein Verweis im Abschnitt zu Finn. Wer eine dieser Quellen ändert, prüft die andere Seite. Das Repo ist ein Gerüst (README, Lizenz, CI auf Pflichtdateien), gebaut ist nichts; der Plan liegt im Second Brain.

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
