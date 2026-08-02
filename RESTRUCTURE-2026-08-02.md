# Struktur-Audit & Neustrukturierung, 2026-08-02

Vollständige Bewertung der Ordner- und Modulstruktur von PromptPrinter, mit
umsetzungsfertigem Migrationsplan. Adressat ist ein Entwicklungsteam, das das
Refactoring ohne Rückfragen durchführen soll.

**Erhebungsbasis:** 449 versionierte Dateien, davon ~290 in `src/`. Der
Import-Graph wurde vollständig geparst (alle `import`/`export … from` und
dynamischen `import()` in `src/**/*.{ts,tsx}`, `@/`-Aliase gegen das Dateisystem
aufgelöst). Alle Zahlen unten sind gemessen, nicht geschätzt.

---

## 0. Vorbemerkung, die das Ergebnis relativiert

Der Auftrag lautete „vollständige Neustrukturierung". Nach der Messung ist das
**nicht** die richtige Empfehlung, und es wäre unredlich, sie trotzdem zu geben.
Was der Graph zeigt:

| Metrik | Messwert | Bewertung |
|---|---|---|
| Zyklische Abhängigkeiten | **0** | einwandfrei |
| Nicht auflösbare Imports | **0** | einwandfrei |
| Layer-Verletzungen (`lib` → `components`) | **1** | ein Einzelfall |
| Test-Kolokation (`x.test.ts` neben `x.ts`) | konsistent, 1 Ausnahme | einwandfrei |
| Barrel-Dateien (`index.ts`) | 1 | gut, keine Barrel-Hölle |
| Dateien > 600 Zeilen | 3 von ~290 | unauffällig |

Zum Vergleich: Die typischen Befunde, auf die ein Struktur-Audit zielt, sind
hier **nicht vorhanden**. Es gibt keine zyklischen Abhängigkeiten, keine toten
Import-Pfade, keine parallel gewachsenen Duplikat-Ordner, keine chaotische
Namensgebung. Module, die auf den ersten Blick wie Dubletten aussehen
(`lib/tools.ts` vs. `lib/target-tools.ts`, `lib/plans.ts` vs. `lib/pricing.ts`),
tragen im Datei-Kopf eine explizite Begründung, warum sie getrennt sind — und
die Begründung trägt. Das ist überdurchschnittlich gepflegter Code.

**Die echten Befunde sind vier**, und sie sind alle strukturell, nicht
kosmetisch:

1. `src/lib/` ist ein flacher 54-Dateien-Eimer, der fünf verschiedene
   Laufzeit-Kategorien mischt — inklusive Server-Geheimnis-Code neben
   React-Client-Hooks, **ohne jede compile-time Barriere dazwischen**. (§3.1)
2. `src/components/app/` ist ein flacher 35-Dateien-Eimer über sechs klar
   trennbare Features. (§2.1)
3. Marketing-Routen haben als einzige keine Route-Group und keinen Shared
   Layout — 7 Seiten bauen die Shell von Hand nach. (§1.2)
4. Toter Code und ein Dateiname, der lügt. (§2.2)

Der Plan in §5 ist entsprechend **gestaffelt**: Stufe 1–2 sind billig, risikoarm
und liefern den Großteil des Nutzens. Stufe 3–4 sind mechanische Massenarbeit
mit echtem Regressionsrisiko und sollten nur laufen, wenn die Codebasis
weiterwächst. Ein Big-Bang-Umbau ist für ein Solo-Projekt dieser Größe die
falsche Wahl, und das ist eine Empfehlung, keine Vorsichtsformel.

---

## 1. Aktuelle Strukturanalyse

### 1.1 Ist-Zustand (gemessen)

```
src/
├── app/                    Next.js App Router — Routing UND Marketing-Seiten
│   ├── (app)/              ✅ Route-Group, eigener Layout          19 Dateien
│   ├── (auth)/             ✅ Route-Group, eigener Layout           5 Dateien
│   ├── api/                ✅ 7 Handler, je mit Test               14 Dateien
│   ├── auth/callback/      ⚠️  OAuth-Callback, außerhalb (auth)     2 Dateien
│   ├── agb|datenschutz|impressum|kontakt|rueckerstattung|ueber|
│   │   pricing|docs/       ❌ 8 Marketing-Routen OHNE Route-Group  19 Dateien
│   └── layout|page|robots|sitemap|globals.css|*.png|…              14 Dateien
├── components/
│   ├── app/                ❌ FLACH, 35 Dateien, 6 Features
│   ├── marketing/          ⚠️  14 Dateien, teils Shell teils Sektion
│   ├── auth/                ✅  7 Dateien, kohärent
│   ├── brand/               ✅  8 Dateien, kohärent
│   ├── ui/                  ✅  9 Dateien, Primitives
│   ├── onboarding/          ✅  3 Dateien
│   ├── motion/              ✅  1 Datei
│   └── theme-provider.tsx  ⚠️  einzelne Datei direkt in components/
├── lib/                    ❌ FLACH, 54 Dateien, 5 Laufzeit-Kategorien
│   └── supabase/            ✅ einziger Unterordner, 5 Dateien
├── prompts/                ⚠️  2 Dateien / 47 Zeilen, mit Barrel
├── middleware.ts
└── instrumentation.ts
```

### 1.2 Befund S-1: Marketing-Routen ohne Route-Group und ohne Layout

**Problem.** `src/app/` verwendet Route-Groups konsequent für die eingeloggte App
(`(app)`) und für Auth (`(auth)`) — beide mit eigenem `layout.tsx`. Die
öffentliche Website hat **keine**. Ihre acht Routen liegen direkt im
`app/`-Wurzelverzeichnis, vermischt mit Framework-Infrastruktur
(`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `favicon.ico`, `icon0.png`,
`globals.css`, `global-error.tsx`).

**Konkrete Folge, gemessen.** Weil es keinen gemeinsamen Layout gibt, montieren
sieben Seiten die Shell von Hand:

| Datei | montiert von Hand |
|---|---|
| `src/app/page.tsx` | `Navbar` + `Footer` |
| `src/app/pricing/page.tsx` | `Navbar` + `Footer` |
| `src/app/docs/page.tsx` | `Navbar` + `Footer` |
| `src/app/ueber/page.tsx` | `Navbar` + `Footer` |
| `src/app/kontakt/page.tsx` | `Navbar` + `Footer` |
| `src/components/marketing/legal-shell.tsx` | `Navbar` + `Footer` (für 4 Legal-Seiten) |
| `src/components/marketing/docs-shell.tsx` | eigene Shell für 10 Docs-Artikel |

Das ist derselbe Rahmen in drei verschiedenen Ausprägungen: einmal handverdrahtet
(5×), einmal als `legal-shell`, einmal als `docs-shell`. `navbar.tsx` hat einen
gemessenen Fan-in von 7, `footer.tsx` von 7 — beide könnten **1** sein.

**Warum das die Wartbarkeit trifft.** Jede Änderung an der öffentlichen Shell
(neuer Nav-Link, Cookie-Banner, Skip-Link, Analytics-Snippet) ist heute eine
Änderung an bis zu 7 Stellen mit der Möglichkeit, eine zu vergessen. Genau dieser
Fehlertyp ist im Projekt bereits zweimal aufgetreten und dokumentiert
(CLAUDE.md: die Sidebar-Duplikation Desktop/Mobile, die „auseinanderdriften
kann", und die zwei divergierenden `api-problem`-Kopien).

**Empfehlung.** Route-Group `(marketing)` mit einem `layout.tsx`, das `Navbar` +
`Footer` + `FinnAtmosphere` einmal rendert. Details in §4.2, Migration in §5,
Stufe 2.

### 1.3 Befund S-2: `auth/callback` liegt außerhalb der Auth-Gruppe

`src/app/auth/callback/route.ts` ist der OAuth-/Recovery-Callback und gehört
fachlich zu `(auth)`, liegt aber als eigenes `auth/`-Segment daneben. Das ist
**nicht** frei verschiebbar: `(auth)` ist eine Route-Group, die aus dem Pfad
verschwindet, `auth/callback` ist ein echter URL-Pfad, der in den
Supabase-Dashboard-Redirect-URLs hinterlegt ist.

**Bewertung: kein Bug, aber unbeschriftet.** Die URL muss stabil bleiben. Nötig
ist ein Kommentar im Datei-Kopf, der erklärt, warum dieses Segment nicht in die
Gruppe wandert — sonst „räumt" ein späterer Refactor es auf und bricht Login
über Google/GitHub sowie den Passwort-Reset. Aufwand: 3 Zeilen.

### 1.4 Befund S-3: Hierarchie-Tiefe ist uneinheitlich, aber begründet

`src/app/(app)/projects/[id]/(workspace)/results/page.tsx` ist mit 6 Segmenten
der tiefste Pfad. Das ist **korrekt** und kein Befund: die
`(workspace)`-Gruppe existiert, weil `layout.tsx` die persistente Kontext-Rail
trägt, während die Hauptspalte per Subroute wechselt — genau der Anwendungsfall,
für den Next.js Route-Groups vorgesehen sind (dokumentiert in REDESIGN.md).

Der echte Tiefen-Befund liegt spiegelbildlich: `app/` ist an der richtigen Stelle
tief, `components/` und `lib/` sind an der falschen Stelle **flach**. Siehe §2.1
und §3.1.

### 1.5 Befund S-4: Benennungskonventionen sind konsistent — mit zwei Ausreißern

Die Konvention ist durchgehend `kebab-case.ts(x)` für Dateien, `PascalCase` für
Komponenten-Exports, `x.test.ts(x)` neben `x.ts(x)`. **Das wird eingehalten**,
über 290 Dateien, ohne Ausnahme außer diesen zweien:

1. **`src/lib/text-contrast.test.ts` hat kein Subjekt.** Es existiert kein
   `src/lib/text-contrast.ts`. Die Datei ist kein Unit-Test, sondern ein
   repo-weiter Invarianten-Scan: sie liest mit `readdirSync` den kompletten
   `src/`-Baum und schlägt fehl, sobald jemand `text-foreground/65` oder
   niedriger schreibt (WCAG-Regression-Guard, QA-Befund U-1). Inhaltlich
   wertvoll, aber am falschen Ort: an dieser Stelle erwartet jeder Leser einen
   Test für ein `lib`-Modul.
   → Verschieben nach `tests/guards/text-contrast.test.ts` (§4.4).

2. **`src/components/theme-provider.tsx`** liegt als einzige Datei direkt in
   `components/`, alle anderen sind in Unterordnern kategorisiert.
   → Nach `src/shared/providers/theme-provider.tsx` (§4.3).

### 1.6 Befund S-5: `src/prompts/` ist überstrukturiert

Der Ordner enthält nach der C-1-Aufräumung (Entfernung der `/api/generate`-
Pipeline) noch **zwei Dateien mit zusammen 47 Zeilen**: `system.ts` (46 Zeilen,
ein einziger Export `CHAT_SYSTEM_PROMPT`) und `index.ts` (1 Zeile, ein
Re-Export). Ein eigener Top-Level-Ordner mit Barrel für eine Konstante ist das
Skelett einer Struktur, die es nicht mehr gibt.

**Nicht dramatisch, aber irreführend:** Der Ordnername verspricht eine
Prompt-Bibliothek. Ein neuer Entwickler sucht dort nach den Prompt-Templates und
findet einen leeren Raum, ohne Hinweis, dass die Bibliothek bewusst gelöscht
wurde. → §4.2, zusammenführen zu `src/server/llm/system-prompt.ts`.

---

## 2. Problematische Dateiorganisation

### 2.1 Befund O-1 (schwerwiegend): `src/components/app/` — 35 Dateien, 6 Features, flach

Der gemessene Import-Graph zerfällt in sechs praktisch überschneidungsfreie
Cluster. Das ist keine Interpretation — es ist die Struktur, die die Imports
bereits haben:

| Cluster | Dateien | Kopplung nach außen |
|---|---|---|
| **chat** (11) | `chat`, `chat-composer`, `chat-empty-state`, `chat-list`, `chat-markdown`, `chat-result-panel`, `chat-transcript`, `copy-moment`, `target-picker`, `move-to-project`, `save-prompt-button` | nur `ui/`, `brand/`, `lib/` |
| **settings** (10) | `settings-workspace`, `api-keys`, `avatar-upload`, `change-password`, `delete-account`, `theme-preference`, `tool-picker`, `tool-group`, `plan-badge`, `usage-meter` | nur `ui/`, `brand/tool-logos`, `lib/` |
| **projects** (5) | `new-project`, `delete-project`, `project-card`, `project-files`, `project-rail` | nur `ui/`, `lib/` |
| **shell** (4) | `sidebar`, `mobile-nav`, `command-palette`, `app-header` | `brand/logo`, `projects/new-project` |
| **prompts** (3) | `library-browser`, `library-card`, `saved-prompt-list` | nur `ui/`, `lib/` |
| **voice** (2) | `voice-bar`, `voice-waveform` | `brand/`, `lib/voice-*` |

**Warum das die Wartbarkeit trifft.** Zwei konkrete, heute messbare Effekte:

- *Der Chat-Cluster ist bereits sichtbar geworden und dann wieder verschwunden.*
  CLAUDE.md dokumentiert, wie `chat.tsx` von 667 auf 260 Zeilen zerlegt wurde,
  in sieben neue Dateien. Diese sieben Dateien wurden anschließend **alphabetisch
  in denselben Eimer einsortiert**, in dem schon `avatar-upload.tsx` und
  `usage-meter.tsx` lagen. Die Zerlegung hat die Datei verbessert und die
  Auffindbarkeit verschlechtert: `chat-composer.tsx` steht jetzt zwischen
  `chat-list.tsx` (anderes Feature: Sidebar-Liste) und `chat-empty-state.tsx`
  (gleiches Feature).
- *Die Feature-Grenze ist nicht durchsetzbar.* Nichts hindert
  `usage-meter.tsx` daran, morgen `chat-transcript.tsx` zu importieren. Heute tut
  es das nicht — aber es gibt keine Regel, die es verhindert, und
  `git diff` zeigt so einen Import nicht als Grenzverletzung an.

Der 5. Cluster illustriert es am schärfsten: `library-browser`, `library-card`
und `saved-prompt-list` bedienen dasselbe Feature (gespeicherte Prompts), aber
`library-*` und `saved-prompt-*` sortieren sich alphabetisch an
**entgegengesetzte Enden** der Verzeichnisliste, mit 20 fremden Dateien
dazwischen.

**Empfehlung:** §4.1, Migration §5 Stufe 3.

### 2.2 Befund O-2: Toter Code, gemessen

Drei Dateien, per vollständigem Referenz-Scan über alle `@/`- und relativen
Imports verifiziert:

| Datei | Zeilen | Status |
|---|---|---|
| `src/components/app/tool-group.tsx` | 92 | **Null Referenzen.** Weder `tool-group` noch `ToolGroup` kommt irgendwo sonst im Baum vor. Vollständig tot. |
| `src/components/ui/card.tsx` | 33 | **Null Referenzen.** Exportiert `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Die Codebasis nutzt stattdessen durchgängig die CSS-Utility `card-surface` direkt. |
| `src/components/app/project-card.tsx` | 13 | **Dateiname lügt.** Enthält keine Komponente, nur den Typ `ProjectTools`. Der einzige Consumer ist `projects/page.tsx` mit `import type`. Der Kopfkommentar sagt es selbst: „die ProjectCard-Komponente, nach der diese Datei benannt ist, existiert nicht mehr". |

**Warum das zählt.** `ui/card.tsx` ist der gefährlichere der drei: Er sieht aus
wie das kanonische Card-Primitive eines Design-Systems. Ein neuer Entwickler
(oder ein Coding-Agent — bei diesem Projekt der Regelfall) importiert `Card` in
guter Absicht und umgeht damit still die `card-surface`-Konvention aus
DESIGN.md. Toter Code, der wie die richtige Antwort aussieht, ist teurer als
toter Code, der offensichtlich tot ist.

**Empfehlung:** `tool-group.tsx` und `ui/card.tsx` löschen. `project-card.tsx`
umbenennen zu `src/features/projects/types.ts` bzw. sofort zu
`src/components/app/project-tools-type.ts`, wenn Stufe 3 noch nicht läuft.
Aufwand gesamt: 20 Minuten. §5 Stufe 1.

### 2.3 Befund O-3: Keine Dubletten — ausdrücklich geprüft, ausdrücklich entlastet

Vier Modulpaare wurden auf Redundanz geprüft und sind **berechtigt getrennt**.
Das gehört ins Protokoll, damit ein späteres Refactoring sie nicht „aufräumt":

- **`lib/tools.ts` vs. `lib/target-tools.ts`** — ersteres sind die vier
  Build-Target-Defaults eines Nutzers (Settings, Zod-validiert), letzteres die
  Ziel-Tool-Liste für einen einzelnen Prompt (Freitext erlaubt). Unterschiedliche
  Lebensdauer, unterschiedliche Validierung.
- **`lib/plans.ts` vs. `lib/pricing.ts`** — ersteres die *durchgesetzten*
  Limits, letzteres die *vermarkteten* Preise. `pricing.ts` importiert
  `PLAN_LIMITS`, die Richtung stimmt, die Zahl steht an einer Stelle.
- **`lib/nav.ts` vs. `lib/docs-nav.ts`** — App-Sidebar-Navigation vs.
  Docs-Leseweg mit Prev/Next-Ordnung. Keine gemeinsame Form.
- **`(app)/prompts/page.tsx` vs. `(app)/projects/[id]/(workspace)/results/page.tsx`**
  — global vs. projektbezogen, teilen sich bereits `SavedPromptList` und
  `mapGenerationRowsToSavedPrompts`. Die Duplikation beschränkt sich auf ~15
  Zeilen Query-Setup mit unterschiedlichen Limits (200 vs.
  `SAVED_PROMPTS_LOAD_LIMIT`). Zusammenlegen würde eine Abstraktion für zwei
  Aufrufer bauen — **nicht empfohlen**.

### 2.4 Befund O-4: Root-Verzeichnis, 9 Markdown-Dateien / 4.677 Zeilen

```
CLAUDE.md                     792   Session-Kontext (bei jedem Start geladen)
QA-AUDIT-2026-07-27.md       2102   Zeitpunkt-Artefakt
SECURITY-AUDIT-2026-07-29.md  664   Zeitpunkt-Artefakt
MASCOT.md                     352   lebende Spezifikation
REDESIGN.md                   279   lebende Spezifikation
DESIGN.md                     188   lebende Spezifikation
README.md                     126   Einstieg
DOCKER.md                     121   Betrieb
PRODUCT.md                     53   Positionierung
```

Zwei getrennte Probleme:

**(a) Zeitpunkt-Artefakte auf Augenhöhe mit lebenden Dokumenten.** Die beiden
Audit-Dateien (2.766 Zeilen, 59 % der gesamten Doku) sind abgeschlossene
Berichte. Sie stehen im Root gleichrangig neben `DESIGN.md`, das eine gültige,
zu befolgende Spezifikation ist. Ein Leser kann von außen nicht unterscheiden,
was Regel und was Historie ist.
→ `docs/audits/` (§4.5).

**(b) `CLAUDE.md` ist zum Changelog geworden.** 792 Zeilen, die laut eigenem
Vorspann „schnell Orientierung geben" sollen und **bei jedem Session-Start
vollständig in den Kontext geladen werden**. Tatsächlich besteht der weit
überwiegende Teil aus chronologischen Änderungsprotokollen („Kostenpass",
„Kritik-Pass F-1", „Handoff entfernt", …), also aus Informationen, die Git
bereits vollständig und präziser vorhält.

Das ist der teuerste Einzelbefund dieses Audits, weil er **bei jedem einzelnen
Arbeitsschritt** anfällt: Kontextbudget, das für den Code fehlt, plus die
wachsende Wahrscheinlichkeit, dass eine tatsächlich verbindliche Regel
(Staging-Pflicht, Quality-Gate, Secrets-Policy) zwischen 700 Zeilen Historie
untergeht.

→ Aufteilen: `CLAUDE.md` auf ≤ 150 Zeilen reine Gegenwart (was ist das Projekt,
welche Regeln gelten, wo liegt was, was ist gerade offen). Alles Chronologische
nach `docs/history/CHANGELOG.md`, verlinkt statt eingebettet. §4.5.

---

## 3. Abhängigkeitsanalyse

### 3.1 Befund D-1 (schwerwiegend): `src/lib/` mischt fünf Laufzeit-Kategorien ohne Barriere

54 Dateien, flach. Nach tatsächlicher Laufzeit-Bindung kategorisiert:

| Kategorie | Anz. | Beispiele | Darf in den Browser? |
|---|---|---|---|
| **Server-Geheimnisse** | 10 | `crypto.ts`, `llm.ts`, `turnstile.ts`, `env.ts`, `rate-limit.ts`, `alerting.ts`, `url-safety.ts`, `csp.ts`, `project-file-cache.ts`, `supabase/admin.ts` | **NIEMALS** |
| **Next-Request-gebunden** | 7 | `api-problem.ts`, `site-url.ts`, `project.ts`, `request-body.ts`, `supabase/server.ts`, `supabase/middleware.ts`, `supabase/cookie-options.ts` | nein |
| **React-Client-Hooks** | 9 | `use-copy-to-clipboard`, `use-sidebar-collapse`, `use-mic-analyser`, `use-speech-recognition`, `use-smooth-stream`, `use-library-favorites`, `use-library-filter`, `use-sidebar-resize`, `use-visual-viewport-inset` | **nur** dort |
| **Reine Domäne / geteilt** | ~26 | `plans`, `pricing`, `chat-limits`, `saved-prompts`, `schemas`, `legal`, `password`, `avatar`, `utils`, `target-tools`, `tools`, … | ja |
| **Sonstiges** | 2 | `voice-engine` (Browser-Audio), `pdf-export` (Browser, lazy) | ja |

**Das eigentliche Problem ist nicht die Mischung, sondern die fehlende
Durchsetzung.** Gemessen:

```
Vorkommen von `import "server-only"` im gesamten Baum:  0
Vorkommen von `import "client-only"` im gesamten Baum:  0
```

Es gibt keinen einzigen Mechanismus, der einen Import von
`@/lib/crypto` (AES-Schlüsselableitung aus `API_KEY_ENCRYPTION_SECRET`) oder
`@/lib/llm` (Provider-API-Keys) aus einer Client-Komponente heraus **zum
Build-Fehler macht**. Was heute schützt, ist ausschließlich Disziplin: die
Autoren wissen, welche Datei wohin gehört. Der Import-Pfad `@/lib/crypto` und
der Import-Pfad `@/lib/utils` sehen für einen Menschen — und für einen
Coding-Agenten — identisch harmlos aus.

**Zur Präzision, was ein Fehlgriff konkret auslösen würde:** Next.js inlined
nicht-`NEXT_PUBLIC_`-Variablen in Client-Bundles nicht; der Schlüssel selbst
würde also nicht im Klartext im Bundle landen. Der Schaden wäre je nach Modul
ein stiller Laufzeitfehler (`undefined` statt Secret) oder das Mitbündeln von
Server-SDKs (`@anthropic-ai/sdk`, `openai`, `@upstash/redis`) in den
Client-Chunk. Das ist **kein akutes Leck** — aber es ist eine Sicherheitsgrenze,
die auf Konvention statt auf dem Compiler ruht, in einem Projekt, das seine
anderen Grenzen (RLS + explizites `.eq("user_id")`, fail-closed
Turnstile-Verifikation, SSRF-Allowlist) ausdrücklich doppelt absichert. Die
Lücke ist eine Inkonsistenz im eigenen Sicherheitsanspruch.

**Empfehlung.** `import "server-only"` als erste Zeile in alle 17 Dateien der
Kategorien 1 und 2, `import "client-only"` in die 9 Hooks. Danach ist der
Fehlgriff ein Build-Fehler mit einer expliziten Meldung.

> **Beide Pakete müssen zuerst installiert werden** — geprüft, nicht
> angenommen:
> ```
> npm ls server-only  →  (empty)
> npm ls client-only  →  next@15.5.22 └─ styled-jsx@5.1.6 └─ client-only@0.0.1
> ```
> `server-only` fehlt vollständig; `client-only` liegt nur **transitiv** unter
> einem Next-Internal (`styled-jsx`) und darf deshalb nicht direkt importiert
> werden — dieser Pfad kann bei jedem Next-Minor verschwinden. Beide gehören als
> explizite Dependencies deklariert:
> ```bash
> npm install server-only client-only
> ```

**Aufwand: 26 Zeilen + 1 Install, ~30 Minuten, null Verhaltensänderung.** Das ist
der beste Aufwand/Nutzen-Posten des gesamten Audits. §5 Stufe 1.

### 3.2 Befund D-2: Die einzige Layer-Inversion

```
src/lib/use-library-favorites.ts  →  src/components/ui/toast.tsx
```

Das ist die **einzige** Kante im gesamten Graphen, die von `lib/` nach
`components/` zeigt. Alle 53 anderen `lib`-Dateien sind komponentenfrei.

**Warum es stört.** `lib/` ist ansonsten die abhängigkeitsärmste Schicht.
Diese eine Kante bedeutet: Wer `lib/` in einen anderen Kontext ziehen will
(Worker, Skript, Test-Harness), zieht die React-Komponentenschicht mit. Bei
genau einer Kante ist der Schaden theoretisch — aber es ist die Kante, an der
sich die nächste anlagert.

**Empfehlung.** Zwei Optionen, je nach Stufe:
- *Sofort (Stufe 1):* Hook gibt Erfolg/Fehler zurück, der Aufrufer
  (`library-browser.tsx`) ruft den Toast. Aufwand: ~20 Zeilen.
- *Mit Stufe 3:* Der Hook wandert nach `src/features/prompts/hooks/`, wo ein
  Import auf `shared/ui/toast` eine legale Feature→Shared-Kante ist. Kein
  Codeumbau nötig.

### 3.3 Befund D-3: Fan-in-Verteilung ist gesund

Top-Module nach Anzahl importierender Nicht-Test-Dateien:

```
40  lib/utils.ts                    ← cn(), erwartbar
25  components/motion/fade-in.tsx
25  lib/supabase/server.ts
25  components/ui/button.tsx
20  components/brand/animated-mascot.tsx
17  lib/supabase/client.ts
15  lib/chat-limits.ts
14  components/ui/toast.tsx
```

Das ist die Signatur einer funktionierenden Schichtung: Primitives und
Infrastruktur oben, Features unten, kein „God-Modul" mit 80 Abhängigen. `lib/utils.ts`
mit 40 ist unauffällig — es enthält im Wesentlichen `cn()`.

**Kein Handlungsbedarf.** Explizit festgehalten, damit dieser Bereich in
Stufe 3 nicht angefasst wird.

### 3.4 Befund D-4: Fehlende Abstraktionsebene zwischen Komponenten und Supabase

Gemessen importieren **10 Client-Komponenten** `@/lib/supabase/client` und
schreiben ihre Queries inline:

```
app/avatar-upload · app/chat-list · app/command-palette · app/delete-project
app/move-to-project · app/project-files · app/project-rail
app/save-prompt-button · app/saved-prompt-list · app/settings-workspace
app/sidebar · app/mobile-nav
```

Das ist bewusst so gebaut (CLAUDE.md: „setzt `conversations.project_id` per
RLS-scoped Client-Update, kein neuer API-Endpunkt") und für RLS-geschützte
Tabellen legitim. **Aber:** Die verbindliche Projektregel lautet „RLS scope
*plus* explizit `.eq("user_id", …)` (Defense-in-depth)". Diese Regel wird
derzeit an 12 verstreuten Stellen von Hand befolgt. Es gibt keinen Ort, an dem
man prüfen könnte, ob sie überall eingehalten wurde, und keinen, an dem eine
Verletzung auffiele.

**Empfehlung (mittelfristig, nicht Teil der Pflicht-Stufen).** Pro Feature ein
dünnes `data-access`-Modul (`features/projects/data.ts` etc.), das die Queries
kapselt und die `user_id`-Bedingung an genau einer Stelle setzt. Damit wird die
Defense-in-depth-Regel auditierbar statt geglaubt. Fällt in Stufe 3 als
natürlicher Nebeneffekt an.

---

## 4. Vorgeschlagene neue Ordnerstruktur

### 4.0 Leitprinzipien

1. **Grenze nach Laufzeit vor Grenze nach Thema.** Was nie in den Browser darf,
   ist an einem eigenen, im Pfad erkennbaren Ort und zusätzlich per
   `server-only` compilergeschützt.
2. **Feature-Kolokation, wo die Imports schon Cluster bilden.** Nicht als
   Dogma — nur dort, wo §2.1 sie gemessen hat.
3. **`app/` ist ausschließlich Routing.** Segmente enthalten `page`/`layout`/
   `route`/`loading`/`error` und dünne Server-Component-Composition, keine
   Feature-Logik.
4. **Ein Ordner rechtfertigt sich ab ~3 Dateien.** Kein `prompts/` mit einer
   Konstante und einem Barrel (§1.6).
5. **Bestehende, dokumentiert getroffene Entscheidungen bleiben.**
   Test-Kolokation, `kebab-case`, Route-Groups im Workspace, die getrennten
   Modulpaare aus §2.3.

### 4.1 Zielstruktur

```
src/
├── app/                                    ROUTING ONLY
│   ├── (marketing)/                        ← NEU (§1.2)
│   │   ├── layout.tsx                      ← NEU: Navbar + Footer, einmal
│   │   ├── page.tsx                        (war: app/page.tsx)
│   │   ├── pricing/page.tsx
│   │   ├── docs/…                          (11 Seiten)
│   │   ├── ueber/  kontakt/
│   │   └── legal/                          ← Sub-Group für die 4 Legal-Seiten
│   │       ├── layout.tsx                  (war: marketing/legal-shell.tsx)
│   │       ├── agb|datenschutz|impressum|rueckerstattung/page.tsx
│   ├── (app)/                              unverändert
│   ├── (auth)/                             unverändert
│   ├── auth/callback/route.ts              BLEIBT (§1.3) + Warnkommentar
│   ├── api/                                unverändert
│   ├── layout.tsx  globals.css  robots.ts  sitemap.ts  opengraph-image.tsx
│   └── favicon.ico  icon*.png  apple-icon.png  global-error.tsx  not-found.tsx
│
├── features/                               ← NEU: vertikale Schnitte (§2.1)
│   ├── chat/
│   │   ├── components/   (11 aus components/app/chat-*, target-picker,
│   │   │                  move-to-project, save-prompt-button, copy-moment)
│   │   ├── hooks/        (use-smooth-stream, use-copy-to-clipboard,
│   │   │                  use-visual-viewport-inset)
│   │   └── lib/          (chat-limits, chat-variants, chat-stub,
│   │                      chat-persistence, sse-stream, target-tools)
│   ├── projects/
│   │   ├── components/   (new-project, delete-project, project-files,
│   │   │                  project-rail)
│   │   ├── lib/          (project-files, project-context, storage-cleanup)
│   │   └── types.ts      (war: project-card.tsx, §2.2)
│   ├── prompts/
│   │   ├── components/   (library-browser, library-card, saved-prompt-list)
│   │   ├── hooks/        (use-library-favorites, use-library-filter)
│   │   └── lib/          (saved-prompts, pdf-export)
│   ├── settings/
│   │   ├── components/   (settings-workspace, api-keys, avatar-upload,
│   │   │                  change-password, delete-account, theme-preference,
│   │   │                  tool-picker, plan-badge, usage-meter)
│   │   └── lib/          (tools, avatar, password, byok)
│   ├── voice/
│   │   ├── components/   (voice-bar, voice-waveform)
│   │   ├── hooks/        (use-mic-analyser, use-speech-recognition)
│   │   └── lib/          (voice-engine)
│   ├── billing/
│   │   └── lib/          (plans, pricing)
│   └── shell/
│       ├── components/   (sidebar, mobile-nav, command-palette, app-header)
│       ├── hooks/        (use-sidebar-collapse, use-sidebar-resize)
│       └── lib/          (nav)
│
├── server/                                 ← NEU: alles `import "server-only"`
│   ├── llm/
│   │   ├── client.ts                       (war: lib/llm.ts, 833 Z. → siehe §4.2)
│   │   ├── providers/                      (zai, gemini, anthropic, openai, custom)
│   │   └── system-prompt.ts                (war: prompts/system.ts + index.ts)
│   ├── security/
│   │   ├── crypto.ts  turnstile.ts  url-safety.ts  csp.ts  rate-limit.ts
│   ├── supabase/
│   │   ├── admin.ts  server.ts  middleware.ts  cookie-options.ts
│   ├── observability/
│   │   ├── observability.ts  alerting.ts
│   ├── cache/
│   │   └── project-file-cache.ts
│   ├── http/
│   │   ├── api-problem.ts  request-body.ts
│   ├── env.ts
│   └── project.ts                          (getProject, React cache())
│
├── shared/                                 ← NEU: runtime-neutral, cross-feature
│   ├── ui/            (button, input, label, password-input, skeleton,
│   │                   toast, confirm-dialog, menu-toggle-icon)
│   ├── brand/         (8 Dateien, unverändert)
│   ├── motion/        (fade-in)
│   ├── providers/     (theme-provider, §1.5)
│   ├── lib/           (utils, schemas, legal, site-url, auth-client,
│   │                   auth-errors, sse-writer, docs-nav)
│   └── supabase/      (client.ts — der Browser-Client)
│
├── components/
│   ├── marketing/     (13 Sektionen, unverändert — Landing ist ein Feature)
│   ├── auth/          (7, unverändert)
│   └── onboarding/    (3, unverändert)
│
├── middleware.ts
└── instrumentation.ts

tests/
└── guards/
    └── text-contrast.test.ts               (§1.5)

docs/
├── audits/    QA-AUDIT-2026-07-27.md  SECURITY-AUDIT-2026-07-29.md
├── history/   CHANGELOG.md                 (aus CLAUDE.md extrahiert, §2.4)
└── (DESIGN.md  MASCOT.md  REDESIGN.md  DOCKER.md  PRODUCT.md)
```

### 4.2 Begründung je Ordner

**`app/` = nur Routing.** Next.js zwingt Dateinamen (`page`, `layout`, `route`)
und Ordnernamen (= URL) auf. Jede Datei, deren Name *nicht* vom Framework
diktiert ist, gehört woanders hin. Das macht `app/` beim Überfliegen zur
lesbaren Sitemap.

**`features/` = vertikale Schnitte.** Die Cluster aus §2.1 werden zu
Verzeichnissen. Der Test dafür ist mechanisch: *„Wenn Feature X ersatzlos
gestrichen wird — welche Dateien fallen weg?"* Für alle sieben Features ist die
Antwort ein zusammenhängender Unterbaum. Genau das ist im Projekt schon zweimal
passiert (Handoff-Entfernung, `/api/generate`-Entfernung) und war beide Male
eine Suche über den ganzen Baum statt eines `rm -r`.

**`server/` = die Sicherheitsgrenze, im Pfad sichtbar.** Der Ordnername macht
den Fehlgriff im Diff sichtbar (`import … from "@/server/…"` in einer
`"use client"`-Datei springt ins Auge), `server-only` macht ihn zum
Build-Fehler. Zwei unabhängige Schichten für dieselbe Grenze — dasselbe Muster,
das dieses Projekt bei RLS bereits anwendet.

**`server/llm/providers/` — Aufteilung von `llm.ts` (833 Zeilen).** Die größte
Datei im Projekt und der einzige Ort, an dem die Zerlegung noch aussteht (die
anderen God-Objects wurden bereits aufgelöst). Sie enthält vier Provider plus
Custom-Provider plus Stub-Modus plus Routing-Logik. Schnitt entlang der
Provider-Grenze: `providers/zai.ts`, `providers/gemini.ts`,
`providers/anthropic.ts`, `providers/openai.ts`, `providers/custom.ts`,
`providers/stub.ts` + `client.ts` als Auswahl-/Fallback-Logik.
**Wichtig:** `customComplete()` enthält die SSRF-Absicherung
(`assertPublicHttpsUrl`, `redirect: "error"`, S-1-Fix). Diese Datei ist beim
Aufteilen 1:1 zu übernehmen, nicht zu „vereinfachen" — sie ist eine
Sicherheitskontrolle mit Testabdeckung.

**`shared/` statt weiterhin `components/ui` + `lib`.** Der Name sagt die Regel:
Was hier liegt, darf von überall importiert werden und importiert selbst nichts
aus `features/` oder `server/`. Eine Regel, die man in einem Satz sagen kann,
wird befolgt.

**`components/marketing|auth|onboarding` bleiben.** Diese drei sind bereits
kohärent (§1.1) und haben keine Feature-Lib-Anteile in `lib/`, die man
mitziehen müsste. Sie zu verschieben wäre Bewegung ohne Gewinn.

### 4.3 Benennungskonventionen (verbindlich, ab Migration)

| Gegenstand | Regel | Beispiel |
|---|---|---|
| Ordner | `kebab-case`, Substantiv **Plural** für Sammlungen, Singular für Features | `features/chat/components/` |
| Komponenten-Datei | `kebab-case.tsx`, Default-Export `PascalCase` | `chat-composer.tsx` → `ChatComposer` |
| Hook-Datei | `use-*.ts`, **immer** mit `import "client-only"` | `use-sidebar-collapse.ts` |
| Server-Modul | unter `src/server/`, **immer** mit `import "server-only"` | `server/security/crypto.ts` |
| Reine Logik | `kebab-case.ts`, benannte Exports, kein Default | `saved-prompts.ts` |
| Test | `<subjekt>.test.ts(x)` **neben** dem Subjekt | `crypto.ts` / `crypto.test.ts` |
| Repo-Invarianten-Test | `tests/guards/<regel>.test.ts` | `tests/guards/text-contrast.test.ts` |
| Typ-Only-Modul | `types.ts` im Feature-Ordner | `features/projects/types.ts` |
| Barrel (`index.ts`) | **nur** wenn ein Feature > 5 öffentliche Exports hat | derzeit: nirgends |

### 4.4 Erlaubte Abhängigkeitsrichtungen

```
app/  ──────────►  features/  ──────────►  shared/
  │                   │                       ▲
  │                   └──────► server/ ───────┘
  └──────────────────────────► server/

VERBOTEN:  shared/  → features/ | server/ | app/
VERBOTEN:  features/A → features/B          (außer über shared/)
VERBOTEN:  server/  → features/ | app/ | components/
VERBOTEN:  jede "use client"-Datei → server/
```

Die letzte Regel ist die einzige, die nicht von einem Linter geprüft werden
muss, weil `server-only` sie zum Build-Fehler macht. Die anderen vier gehören in
die ESLint-Konfiguration (§6.4).

### 4.5 Doku-Struktur

```
README.md          Einstieg, Setup, Befehle                    (bleibt Root)
CLAUDE.md          ≤150 Z.: Was ist das, welche Regeln,
                   wo liegt was, was ist offen                 (bleibt Root)
docs/
  DESIGN.md  MASCOT.md  REDESIGN.md  DOCKER.md  PRODUCT.md     lebende Specs
  history/CHANGELOG.md                                         aus CLAUDE.md
  audits/QA-AUDIT-2026-07-27.md
  audits/SECURITY-AUDIT-2026-07-29.md
  audits/RESTRUCTURE-2026-08-02.md                             dieses Dokument
```

Für `CLAUDE.md` gilt ab dann die Regel: **Gegenwart, keine Historie.** Ein
Eintrag beantwortet „was gilt jetzt", nicht „was wurde wann geändert". Historie
gehört ins Changelog und in die Commit-Messages.

---

## 5. Migrationsplan

### Grundregeln für alle Stufen

- **Eine Stufe = ein Commit = ein grünes Gate.** Nie zwei Stufen mischen.
- **`git mv`, nie `mv`.** Erhält die Datei-Historie und `git log --follow`.
- **Verschieben und Ändern nie im selben Commit.** Ein Commit, der Inhalt
  ändert *und* verschiebt, ist im Review nicht lesbar.
- **Gate nach jeder Stufe:**
  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```
- **`.next/` leeren, wenn der Build nach einer Verschiebung von Route-Dateien
  meckert.** Dokumentierter Präzedenzfall im Projekt (C-1-Aufräumung: der Cache
  hielt einen Typ für eine gelöschte Route).

---

### Stufe 1 — Aufräumen & Grenzen ziehen · **~2 h · Risiko: sehr gering**

Kein Verschieben, kein Umbenennen. Reine Additionen und Löschungen.

**1.1 Toten Code löschen** (§2.2)
```bash
git rm src/components/app/tool-group.tsx
git rm src/components/ui/card.tsx
```
Verifikation: `npm run build` — beide haben null Referenzen, der Build darf
keine Zeile anfassen.

**1.2 `server-only` / `client-only` setzen** (§3.1) — der wichtigste Schritt

Zuerst installieren (beide fehlen bzw. liegen nur transitiv vor, siehe §3.1):
```bash
npm install server-only client-only
```

`import "server-only";` als **erste Zeile** in:
```
lib/crypto.ts          lib/llm.ts             lib/turnstile.ts
lib/env.ts             lib/rate-limit.ts      lib/alerting.ts
lib/url-safety.ts      lib/csp.ts             lib/project-file-cache.ts
lib/api-problem.ts     lib/site-url.ts        lib/project.ts
lib/request-body.ts    lib/supabase/admin.ts  lib/supabase/server.ts
lib/supabase/middleware.ts                    lib/supabase/cookie-options.ts
```
`import "client-only";` als erste Zeile in alle 9 `lib/use-*.ts`.

> **Erwartete Reibung:** `npm run build` schlägt möglicherweise fehl, wenn eine
> dieser Dateien heute *doch* von einer Client-Komponente erreicht wird. **Das
> ist kein Rückschlag, das ist der Befund** — genau dafür wird der Guard
> gesetzt. Der Fehler nennt die Import-Kette; die betroffene Funktion wird
> aufgeteilt (Server-Teil bleibt, Client-Teil wandert nach `shared/lib/`).
> `lib/site-url.ts` (Fan-in 8) und `lib/api-problem.ts` sind die
> wahrscheinlichsten Kandidaten — beide vor dem Commit einzeln prüfen.

**1.3 Layer-Inversion auflösen** (§3.2) —
`lib/use-library-favorites.ts` gibt statt `toast()` ein Ergebnis zurück,
`library-browser.tsx` toastet.

**1.4 `project-card.tsx` umbenennen** (§2.2)
```bash
git mv src/components/app/project-card.tsx src/components/app/project-tools-type.ts
```
Ein Import anzupassen: `src/app/(app)/projects/page.tsx:10`.

**1.5 Warnkommentar in `app/auth/callback/route.ts`** (§1.3) — 3 Zeilen:
warum dieses Segment nicht nach `(auth)` wandert (URL steht in den
Supabase-Redirect-URLs).

**1.6 Doku sortieren** (§2.4a)
```bash
mkdir -p docs/audits
git mv QA-AUDIT-2026-07-27.md SECURITY-AUDIT-2026-07-29.md docs/audits/
git mv DESIGN.md MASCOT.md REDESIGN.md DOCKER.md PRODUCT.md docs/
```
Achtung: Querverweise in `README.md` und `CLAUDE.md` anpassen (`grep -rn
"DESIGN.md\|MASCOT.md\|REDESIGN.md\|DOCKER.md\|PRODUCT.md" --include=*.md .`).

**Nutzen dieser Stufe:** Die Sicherheitsgrenze ist compilergeschützt, 125 Zeilen
toter Code sind weg, die einzige Layer-Inversion ist weg, das Root-Verzeichnis
ist lesbar. **Das ist der größte Teil des Gesamtnutzens dieses Audits.**

---

### Stufe 2 — Marketing-Route-Group · **~3 h · Risiko: gering–mittel**

**2.1 Gruppe anlegen und Routen verschieben**
```bash
mkdir -p "src/app/(marketing)/legal"
git mv src/app/page.tsx        "src/app/(marketing)/page.tsx"
git mv src/app/pricing         "src/app/(marketing)/pricing"
git mv src/app/docs            "src/app/(marketing)/docs"
git mv src/app/ueber           "src/app/(marketing)/ueber"
git mv src/app/kontakt         "src/app/(marketing)/kontakt"
git mv src/app/agb             "src/app/(marketing)/legal/agb"
git mv src/app/datenschutz     "src/app/(marketing)/legal/datenschutz"
git mv src/app/impressum       "src/app/(marketing)/legal/impressum"
git mv src/app/rueckerstattung "src/app/(marketing)/legal/rueckerstattung"
```

> **⚠ Kritisch: Route-Groups ändern die URL nicht — `legal/` schon.**
> `(marketing)` verschwindet aus dem Pfad, `legal` **nicht**. Aus
> `/agb` würde `/legal/agb`. Das ist ein Bruch für Rechtstexte, die verlinkt,
> indexiert und ggf. bei Zahlungsanbietern hinterlegt sind.
> **Zwei zulässige Auflösungen — eine wählen, nicht improvisieren:**
> - **(a) empfohlen:** Group-Syntax verwenden — `(legal)` statt `legal`. URLs
>   bleiben exakt `/agb`, `/datenschutz`, `/impressum`, `/rueckerstattung`.
> - **(b)** `legal/` als echtes Segment + permanente Redirects in
>   `next.config.ts` von den vier alten Pfaden. Mehr Aufwand, kein Vorteil.

**2.2 `(marketing)/layout.tsx` anlegen** — rendert `Navbar` + `Footer` einmal.

**2.3 `(legal)/layout.tsx` anlegen** aus `marketing/legal-shell.tsx`; die vier
Legal-Seiten geben ihre `<LegalShell>`-Umhüllung auf.

**2.4 Handmontage aus 5 Seiten entfernen** — `Navbar`/`Footer`-Imports und
-JSX aus `page.tsx`, `pricing`, `docs`, `ueber`, `kontakt` streichen.

**Verifikation (Pflicht, Browser):**
```bash
npm run dev
```
Alle 9 Routen + 10 Docs-Artikel einmal aufrufen. Prüfen: Navbar/Footer genau
**einmal** im DOM, kein doppelter Footer, `sitemap.ts` liefert unveränderte
URLs, `/agb` (nicht `/legal/agb`) antwortet 200.

> **Regressionsrisiko:** `sitemap.ts` und `robots.ts` erzeugen Pfade teils
> literal. Nach dem Verschieben `curl localhost:3000/sitemap.xml` gegen die
> Ausgabe **vor** der Migration diffen. Vorher sichern.

---

### Stufe 3 — Feature-Slices · **~2–3 Tage · Risiko: mittel**

> **Erst starten, wenn Stufe 1+2 stabil laufen.** Diese Stufe berührt ~90
> Dateien und erzeugt einen Diff, den niemand vollständig liest. Sie ist
> **optional** und lohnt sich, wenn die Codebasis weiterwächst; bei
> eingefrorenem Umfang ist der Nutzen gering.

Reihenfolge nach steigender Kopplung — jedes Feature ein eigener Commit, jedes
mit grünem Gate:

| # | Feature | Dateien | Kommentar |
|---|---|---|---|
| 3.1 | `voice` | 5 | Am isoliertesten, idealer Pilot. Bestätigt das Vorgehen. |
| 3.2 | `prompts` | 7 | Löst §3.2 strukturell mit auf. |
| 3.3 | `billing` | 2 | Nur `plans` + `pricing`; Fan-in beachten (9 + 4). |
| 3.4 | `projects` | 8 | |
| 3.5 | `settings` | 13 | |
| 3.6 | `chat` | 20 | Größter Cluster, zuletzt. |
| 3.7 | `shell` | 7 | Berührt Sidebar + Mobile-Nav (geteilte Konstanten). |
| 3.8 | `shared/` + `server/` | Rest | Was nach 3.1–3.7 übrig ist. |

**Mechanik pro Schritt:**
```bash
mkdir -p src/features/<name>/{components,hooks,lib}
git mv src/components/app/<datei>.tsx src/features/<name>/components/
git mv src/components/app/<datei>.test.tsx src/features/<name>/components/
git mv src/lib/<datei>.ts src/features/<name>/lib/
# Imports repo-weit umschreiben, dann:
npm run typecheck   # findet 100 % der gebrochenen Imports
```

Import-Rewrite (PowerShell, pro Datei, **nicht** als Sammel-Regex):
```powershell
Get-ChildItem -Recurse src -Include *.ts,*.tsx |
  ForEach-Object {
    (Get-Content $_ -Raw) -replace
      '@/components/app/voice-bar', '@/features/voice/components/voice-bar' |
    Set-Content $_ -NoNewline
  }
```

> **`typecheck` ist hier das vollständige Sicherheitsnetz.** `strict: true` +
> `noEmit` + der `@/*`-Alias bedeuten: ein nicht umgeschriebener Import ist
> garantiert ein Compile-Fehler, kein Laufzeitfehler. Deshalb ist diese Stufe
> trotz ihres Umfangs mechanisch beherrschbar. **Ausnahmen, die `tsc` nicht
> sieht und die manuell zu prüfen sind:** dynamische `import()`-Ausdrücke
> (`pdf-export` wird lazy geladen), String-Pfade in `vitest.config.ts`, und
> `tour-steps.ts` mit seinen `data-tour`-Selektoren (die zeigen auf DOM, nicht
> auf Module — vom Verschieben unberührt, aber beim Anfassen der Shell prüfen).

**3.9 `llm.ts` aufteilen** (§4.2) — **eigener Commit, nach 3.8.** 833 Zeilen in
`server/llm/providers/*`. Bedingung: `llm.test.ts` (499 Zeilen) muss vor *und*
nach der Aufteilung unverändert grün sein. Die SSRF-Kontrolle in
`customComplete()` wird 1:1 übernommen.

---

### Stufe 4 — Durchsetzung & Doku · **~4 h · Risiko: sehr gering**

**4.1** ESLint-Boundary-Regeln (§6.4) — dann sind die Regeln aus §4.4 keine
Vereinbarung mehr, sondern CI-geprüft.
**4.2** `tests/guards/text-contrast.test.ts` verschieben; `vitest.config.ts`
`include` auf `["src/**/*.test.ts", "tests/**/*.test.ts"]` erweitern.
**4.3** `CLAUDE.md` auf ≤ 150 Zeilen kürzen, Historie nach
`docs/history/CHANGELOG.md` (§2.4b).
**4.4** `README.md` um einen Abschnitt „Wohin gehört eine neue Datei?" (§6.2).

---

### Risikoregister

| Risiko | Stufe | Wahrsch. | Gegenmaßnahme |
|---|---|---|---|
| Legal-URLs brechen (`/agb` → `/legal/agb`) | 2 | **hoch, wenn unbedacht** | `(legal)` als Route-Group, nicht als Segment. Nach Deploy alle 4 URLs prüfen. |
| `sitemap.xml` ändert sich still | 2 | mittel | Ausgabe vor/nach diffen. |
| `server-only` bricht den Build | 1 | mittel | **Erwünscht** — es ist der Befund. Betroffene Module aufteilen. |
| Doppelter Navbar/Footer nach Layout-Einführung | 2 | mittel | Handmontage in 5 Seiten *im selben Commit* entfernen; DOM prüfen. |
| Dynamische Imports übersehen | 3 | niedrig | `grep -rn "import(" src` vor jedem Schritt. |
| Merge-Konflikte durch Massenverschiebung | 3 | mittel | Feature-für-Feature, jedes sofort mergen. Keine parallelen Branches. |
| Git-Historie verloren | alle | niedrig | Ausschließlich `git mv`; Verschieben und Ändern getrennt committen. |
| `.next`-Cache hält Typen gelöschter Routen | 1,2 | niedrig | `rm -rf .next` bei unerklärlichen Build-Fehlern (Präzedenzfall dokumentiert). |

### Aufwandsübersicht

| Stufe | Aufwand | Risiko | Nutzen | Empfehlung |
|---|---|---|---|---|
| 1 — Aufräumen & Grenzen | ~2 h | sehr gering | **hoch** | **sofort** |
| 2 — Marketing-Group | ~3 h | gering–mittel | hoch | **sofort danach** |
| 3 — Feature-Slices | 2–3 Tage | mittel | mittel | wenn die Codebasis wächst |
| 4 — Durchsetzung & Doku | ~4 h | sehr gering | mittel–hoch | mit Stufe 3, oder Teile (4.3) sofort |

**Wenn nur ein Tag zur Verfügung steht: Stufe 1 + Stufe 2 + Punkt 4.3.**
Das sind ~9 Stunden und liefert die compilergeschützte Server-Grenze, die
entdoppelte Marketing-Shell und ein Kontext-Dokument, das wieder ein
Kontext-Dokument ist.

---

## 6. Best Practices & Empfehlungen

### 6.1 Warum die neue Struktur künftige Entwicklung erleichtert

Drei konkrete, im Projekt bereits eingetretene Szenarien:

- **Ein Feature wird gestrichen.** Zweimal passiert (Handoff, `/api/generate`)
  und beide Male eine Suche über den ganzen Baum — CLAUDE.md listet die
  betroffenen Dateien einzeln auf, weil sie einzeln gefunden werden mussten. Mit
  Feature-Slices ist es `git rm -r src/features/<name>/` plus `npm run typecheck`,
  der jeden verbliebenen Import zeigt.
- **Ein Provider kommt dazu.** Heute: eine 833-Zeilen-Datei bearbeiten.
  Danach: eine Datei in `server/llm/providers/` anlegen und registrieren.
- **Ein Agent bearbeitet das Projekt.** Bei diesem Repo der Normalfall.
  Ein Agent, der `features/chat/` liest, hat den vollständigen Kontext für eine
  Chat-Änderung. Heute muss er 35 Dateien in `components/app/` und 54 in `lib/`
  sichten, um sicher zu sein, nichts übersehen zu haben — und genau dieser
  Kontextverbrauch ist das Kernproblem, das PromptPrinter selbst adressiert.

### 6.2 Regeln für neue Dateien (in `README.md` aufnehmen)

```
Ich schreibe eine neue Datei — wohin?

1. Läuft sie im Browser UND liest sie ein Geheimnis?      → Fehler im Entwurf.
2. Berührt sie ein Geheimnis / einen Server-Key?          → src/server/…
                                                            + import "server-only"
3. Ist es ein React-Hook?                                 → …/hooks/
                                                            + import "client-only"
4. Gehört sie zu genau EINEM Feature?                     → src/features/<f>/…
5. Brauchen sie ≥ 2 Features?                             → src/shared/…
6. Ist es page/layout/route/loading/error?                → src/app/…
7. Nichts davon trifft zu?                                → Der Zuschnitt stimmt
                                                            noch nicht. Nicht
                                                            anlegen, erst klären.

Immer: Test als <name>.test.ts(x) DANEBEN.
Nie:   eine Datei in src/features/A, die aus src/features/B importiert.
```

### 6.3 Skalierbarkeit

Die heutige Struktur skaliert bis etwa 60–70 Dateien pro Eimer, dann kippt sie —
`lib/` mit 54 ist nah dran, `components/app/` mit 35 zeigt es bereits an der
alphabetischen Zerstreuung (§2.1). Die Feature-Struktur skaliert
**horizontal**: ein neues Feature ist ein neuer Ordner, kein Zuwachs in einem
bestehenden. Kein Verzeichnis in §4.1 überschreitet 20 Dateien, und wenn eines
das täte, wäre die Abhilfe eine Unterteilung *innerhalb* des Features, ohne
irgendetwas anderes zu berühren.

### 6.4 Werkzeuge zur Durchsetzung

**(a) ESLint-Boundaries** — ohne neue Abhängigkeit, mit
`no-restricted-imports` in `eslint.config.mjs`:

```js
// shared/ darf nichts aus features/, server/, app/ importieren
{
  files: ["src/shared/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@/features/*", "@/server/*", "@/app/*"],
      message: "shared/ ist die unterste Schicht — siehe RESTRUCTURE §4.4" }
  ]}]}
},
// server/ darf nichts aus der UI-Welt importieren
{
  files: ["src/server/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@/features/*", "@/components/*", "@/app/*"],
      message: "server/ ist UI-frei — siehe RESTRUCTURE §4.4" }
  ]}]}
},
```
Cross-Feature-Importe (`features/A` → `features/B`) brauchen eine
Datei-relative Regel; falls das mit `no-restricted-imports` zu umständlich wird,
ist `eslint-plugin-boundaries` die eine gerechtfertigte neue Dev-Dependency.

> **Nebenbefund beim Verifizieren des Gates, betrifft diesen Punkt direkt:**
> `npm run lint` gibt aus
> „`next lint` is deprecated and will be removed in Next.js 16", mit
> Migrationspfad `npx @next/codemod@canary next-lint-to-eslint-cli .`.
> Das Lint-Skript in `package.json` ist damit auf Zeit gebaut. Da §6.4 ohnehin
> `eslint.config.mjs` anfasst, ist der Umstieg auf die ESLint-CLI in Stufe 4
> quasi kostenlos mitzunehmen — später ist es ein eigener, erzwungener Umbau
> beim Next-16-Upgrade. Kein akutes Problem, aber der günstigste Zeitpunkt ist
> jetzt.

**(b) `server-only` / `client-only`** — der Compiler als Wächter (§3.1).
Wirksamer als jede Lint-Regel, weil er die *transitive* Kette prüft.

**(c) Der bestehende `text-contrast`-Test als Vorbild.** Das Projekt hat bereits
einen Invarianten-Test, der den Quellbaum scannt (§1.5). Dasselbe Muster eignet
sich für weitere Struktur-Regeln, z. B. „jede Datei unter `src/server/` beginnt
mit `import "server-only"`" — 15 Zeilen, und der Guard kann nicht vergessen
werden.

**(d) `npm audit` in CI** — bereits vorhanden. Der `overrides`-Block in
`package.json` ist vorbildlich kommentiert (jede Zeile mit Advisory-Begründung).
Diese Sorgfalt ist der Grund, warum das Dependency-Kapitel dieses Audits leer
ist.

### 6.5 Zusammenarbeit im Team

Für ein Solo-Projekt ist das derzeit theoretisch — aber genau deshalb relevant:
die Struktur entscheidet, wie teuer die erste zusätzliche Person wird.
Feature-Slices erlauben, eine Aufgabe als „`features/voice/`, sonst nichts
anfassen" zu vergeben. Merge-Konflikte entstehen dann in einem Feature-Ordner
statt in einem gemeinsamen 54-Dateien-Verzeichnis. Dasselbe gilt eins zu eins
für parallel arbeitende Coding-Agenten.

---

## Anhang A — Vollständige Datei-Zuordnung Stufe 3

<details>
<summary><code>src/components/app/</code> → <code>src/features/</code> (35 Dateien)</summary>

| Heute | Ziel |
|---|---|
| `chat.tsx` | `features/chat/components/chat.tsx` |
| `chat-composer.tsx` | `features/chat/components/` |
| `chat-empty-state.tsx` | `features/chat/components/` |
| `chat-list.tsx` | `features/chat/components/` |
| `chat-markdown.tsx` | `features/chat/components/` |
| `chat-result-panel.tsx` | `features/chat/components/` |
| `chat-transcript.tsx` | `features/chat/components/` |
| `copy-moment.tsx` | `features/chat/components/` |
| `target-picker.tsx` | `features/chat/components/` |
| `move-to-project.tsx` | `features/chat/components/` |
| `save-prompt-button.tsx` | `features/chat/components/` |
| `voice-bar.tsx` | `features/voice/components/` |
| `voice-waveform.tsx` | `features/voice/components/` |
| `new-project.tsx` | `features/projects/components/` |
| `delete-project.tsx` | `features/projects/components/` |
| `project-files.tsx` | `features/projects/components/` |
| `project-rail.tsx` | `features/projects/components/` |
| `project-tools-type.ts` *(Stufe 1.4)* | `features/projects/types.ts` |
| `library-browser.tsx` | `features/prompts/components/` |
| `library-card.tsx` | `features/prompts/components/` |
| `saved-prompt-list.tsx` | `features/prompts/components/` |
| `settings-workspace.tsx` | `features/settings/components/` |
| `api-keys.tsx` | `features/settings/components/` |
| `avatar-upload.tsx` | `features/settings/components/` |
| `change-password.tsx` | `features/settings/components/` |
| `delete-account.tsx` | `features/settings/components/` |
| `theme-preference.tsx` | `features/settings/components/` |
| `tool-picker.tsx` | `features/settings/components/` |
| `plan-badge.tsx` | `features/settings/components/` |
| `usage-meter.tsx` | `features/settings/components/` |
| `sidebar.tsx` | `features/shell/components/` |
| `mobile-nav.tsx` | `features/shell/components/` |
| `command-palette.tsx` | `features/shell/components/` |
| `app-header.tsx` | `features/shell/components/` |
| ~~`tool-group.tsx`~~ | **gelöscht (Stufe 1.1)** |

Jede `*.test.tsx` wandert mit ihrer Subjekt-Datei.
</details>

<details>
<summary><code>src/lib/</code> → <code>server/</code> | <code>shared/</code> | <code>features/</code> (54 Dateien)</summary>

| Heute | Ziel | Guard |
|---|---|---|
| `crypto.ts` | `server/security/` | `server-only` |
| `turnstile.ts` | `server/security/` | `server-only` |
| `url-safety.ts` | `server/security/` | `server-only` |
| `csp.ts` | `server/security/` | `server-only` |
| `rate-limit.ts` | `server/security/` | `server-only` |
| `llm.ts` | `server/llm/` *(→ aufteilen, 3.9)* | `server-only` |
| `env.ts` | `server/` | `server-only` |
| `project.ts` | `server/` | `server-only` |
| `project-file-cache.ts` | `server/cache/` | `server-only` |
| `alerting.ts` | `server/observability/` | `server-only` |
| `observability.ts` | `server/observability/` | `server-only` |
| `api-problem.ts` | `server/http/` | `server-only` |
| `request-body.ts` | `server/http/` | `server-only` |
| `supabase/admin.ts` | `server/supabase/` | `server-only` |
| `supabase/server.ts` | `server/supabase/` | `server-only` |
| `supabase/middleware.ts` | `server/supabase/` | `server-only` |
| `supabase/cookie-options.ts` | `server/supabase/` | `server-only` |
| `supabase/client.ts` | `shared/supabase/` | — |
| `utils.ts` `schemas.ts` `legal.ts` `site-url.ts` | `shared/lib/` | — |
| `auth-client.ts` `auth-errors.ts` `sse-writer.ts` `docs-nav.ts` | `shared/lib/` | — |
| `chat-limits.ts` `chat-variants.ts` `chat-stub.ts` | `features/chat/lib/` | — |
| `chat-persistence.ts` `sse-stream.ts` `target-tools.ts` | `features/chat/lib/` | — |
| `use-smooth-stream.ts` `use-copy-to-clipboard.ts` | `features/chat/hooks/` | `client-only` |
| `use-visual-viewport-inset.ts` | `features/chat/hooks/` | `client-only` |
| `project-files.ts` `project-context.ts` `storage-cleanup.ts` | `features/projects/lib/` | — |
| `saved-prompts.ts` `pdf-export.ts` | `features/prompts/lib/` | — |
| `use-library-favorites.ts` `use-library-filter.ts` | `features/prompts/hooks/` | `client-only` |
| `tools.ts` `avatar.ts` `password.ts` `byok.ts` | `features/settings/lib/` | — |
| `plans.ts` `pricing.ts` | `features/billing/lib/` | — |
| `voice-engine.ts` | `features/voice/lib/` | — |
| `use-mic-analyser.ts` `use-speech-recognition.ts` | `features/voice/hooks/` | `client-only` |
| `nav.ts` | `features/shell/lib/` | — |
| `use-sidebar-collapse.ts` `use-sidebar-resize.ts` | `features/shell/hooks/` | `client-only` |
| `text-contrast.test.ts` | `tests/guards/` | — |

> **Achtung `site-url.ts` (Fan-in 8):** vor dem Setzen von `server-only` prüfen,
> ob ein Client-Pfad darauf zugreift. Falls ja: die reine URL-Bildung nach
> `shared/lib/` ziehen, nur den env-lesenden Teil in `server/` belassen.
</details>

---

## Anhang B — Was ausdrücklich NICHT geändert werden soll

| Bereich | Grund |
|---|---|
| `supabase/migrations/` (36 Dateien, `NNNN_name.sql`) | Vorbildlich. Fortlaufend, sprechend, teils live angewandt. Niemals umnummerieren. |
| Test-Kolokation `x.test.ts` neben `x.ts` | Konsequent über ~290 Dateien durchgehalten. Bleibt (Ausnahme §1.5). |
| `(app)/projects/[id]/(workspace)/` | Die Tiefe ist begründet (persistente Shell + wechselnde Subroute), dokumentiert in REDESIGN.md. |
| `lib/tools.ts` ⟂ `lib/target-tools.ts` | Getrennt aus dokumentiertem Grund (§2.3). Keine Dublette. |
| `lib/plans.ts` ⟂ `lib/pricing.ts` | Getrennt aus dokumentiertem Grund (§2.3). Richtung stimmt. |
| `components/marketing|auth|onboarding` | Bereits kohärent, kein Feature-Lib-Anteil in `lib/`. |
| `public/mascot/` (16 Assets) | Flach und vollständig — richtig für eine State-Registry. |
| `package.json` `overrides` | Jede Zeile mit Advisory-Begründung. Vorbild. |
| `.claude/skills/promptprinter-design/` | Bewusst versioniert (siehe `.gitignore`-Kommentar). Kein Struktur-Befund. |
| Mascot-States, Hero-Demo, Footer, Auth-Flow, RLS-Policies | In CLAUDE.md als „nicht anfassen, stabil" markiert. Diese Migration berührt nur Pfade, nie deren Inhalt. |

---

## Zusammenfassung in fünf Sätzen

Die Codebasis ist strukturell gesund: null Zyklen, null kaputte Imports, eine
einzige Layer-Inversion, konsistente Namensgebung über ~290 Dateien.
Der schwerwiegendste Befund ist nicht Unordnung, sondern eine **fehlende
Durchsetzung**: Server-Geheimnis-Code und React-Client-Hooks liegen ununterscheidbar
im selben flachen `lib/`-Ordner, ohne `server-only`/`client-only` — und das in
einem Projekt, das seine anderen Sicherheitsgrenzen ausdrücklich doppelt
absichert.
Der zweitwichtigste ist die fehlende Marketing-Route-Group, wegen der sieben
Seiten dieselbe Shell von Hand nachbauen.
Beide sind an einem Arbeitstag behoben (Stufen 1 + 2) und liefern den Großteil
des Nutzens; die Feature-Slices (Stufe 3) sind eine Investition in Wachstum, kein
Fix für einen bestehenden Schaden.
Ein Big-Bang-Umbau wäre hier die falsche Empfehlung — die Struktur verdient eine
Nachschärfung, keine Neustrukturierung.
