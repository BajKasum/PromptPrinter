# Major-Upgrades, Plan und Entscheid (Stand 2026-10-20)

Antwort auf Issue #137. Der Plan sagt, was in welcher Reihenfolge angehoben wird und warum
Tailwind 4 zuerst kommt. Gemessen am 2026-10-20 mit `npm outdated` und `npm audit`.

## Entscheid zur `braces`-Ausnahme

Die Ausnahme für GHSA-vfj7-8cjw-p6xm in [scripts/audit-gate.mjs](../scripts/audit-gate.mjs)
läuft am **2026-11-04** ab. Am 2026-10-20 neu geprüft:

- `braces` hat weiter keine gepatchte Version (betroffen sind alle bis 3.0.3), `npm audit`
  bietet nur `tailwindcss@4.3.3` als Ausweg an. Der Upstream-Fix, auf den die Ausnahme
  gewartet hat, ist nicht gekommen.
- Die Kette ist unverändert: `tailwindcss 3.4.19` zieht `chokidar` und `fast-glob`, beide
  ziehen `braces`/`micromatch`. Dazu hängt `eslint-config-next` über `fast-glob` daran.
  Keines davon läuft in der ausgelieferten App.

**Entscheid: Tailwind 4, als eigener Branch und nicht in einem Sammel-PR.** Begründung:

1. Es ist der einzige Weg, der den Fund beseitigt statt zu verschieben. Jede Verlängerung
   ist nur ein Aufschub, und die Regel im Gate ("eine Ausnahme ohne Ende ist keine
   Entscheidung") gilt für die zweite Verlängerung doppelt.
2. Der Umbau trifft das ganze Aussehen (137 Dateien mit `className`), also braucht er einen
   eigenen Branch, den man getrennt prüfen, aufhalten und zurücknehmen kann. Das ist der
   Fall "riskanter Umbau" aus den Arbeitsregeln in `CLAUDE.md`.
3. Das Zeitfenster reicht, wenn der Branch bis etwa **2026-10-28** steht. Dann greift auch
   die Vorwarnung von `audit.yml` (sieben Tage vor Ablauf).

**Rückfall, falls der Branch bis zum 2026-11-02 nicht grün ist:** die Ausnahme einmal um
höchstens 30 Tage verlängern, mit erneuter Prüfung des ausgelieferten Builds
(`.next/standalone/node_modules` darf weder `braces`, `micromatch`, `tailwindcss`, `chokidar`
noch `fast-glob` enthalten) und einem neuen Datum in `ACCEPTED`. Nie ohne diesen Beleg, nie
"später".

## Reihenfolge

Je Schritt ein eigener Branch und ein eigener PR, volles Gate vor Push und Merge. Die
Dependabot-PRs dazu nur mit Kasums Ja mergen (`CLAUDE.md`).

| # | Was | Warum jetzt | Umfang und Risiko |
|---|---|---|---|
| 0 | `next` und `eslint-config-next` auf das aktuelle 15.5.x (15.5.28) | Neues Advisory GHSA-4jqv-mc3x-m676 (moderate, Cache-Vergiftung bei selbst gehostetem SSG/ISR) betrifft 15.0.0 bis 15.5.26. Das Gate lässt "moderate" durch, Vercel ist nicht der betroffene Betrieb, trotzdem ein Patch ohne Breaking Change | klein, nur Patch |
| 1 | `tailwindcss` 3.4.19 auf 4.3.3, `tailwind-merge` 2.6.1 auf 3.7.0, `tailwindcss-animate` ersetzen | löst die Ausnahme (siehe oben) | **gross**, siehe unten |
| 2 | Next 16 und der Umstieg von `next lint` auf die ESLint-CLI (#138) | `next lint` fällt in 16 weg, ESLint 10 hängt an `eslint-config-next` 16 | mittel, ein Wechsel der Lint-Aufrufe in `package.json`, CI und Gate |
| 3 | `framer-motion` 11.18.2 auf `motion` mit `LazyMotion` (#135) | spart Main-Thread-Zeit auf der Startseite mobil, ein Paketwechsel | mittel, jede Animation prüfen (`reduced-motion`) |
| 4 | `typescript` 7 und `vitest` 5, einzeln | beide sind für sich ein Major, getrennt lassen sich Fehler zuordnen | je nach Typfehlern |
| – | `@types/node` 26 | **nicht anheben**: Node 24 bleibt (`.nvmrc`), die Typen müssen zur Laufzeit passen | – |

## Schritt 1 im Einzelnen (Tailwind 4)

Was die Umstellung berührt, am Ist-Stand gezählt:

- `tailwind.config.ts` (134 Zeilen) wird zu CSS (`@theme` in `globals.css`). Die Farbtokens
  sind HSL-Kanäle (`hsl(var(--x) / <alpha-value>)`), das muss mit den Deckkraft-Abstufungen
  (`bg-accent/10`, `ring-ring/40`) weiter funktionieren.
- `postcss.config.mjs`: `tailwindcss` und `autoprefixer` werden zu `@tailwindcss/postcss`.
- `tailwindcss-animate` wird nicht mehr als Plugin geladen, Ersatz ist `tw-animate-css`.
- Umbenannte Standardwerte, die still anders aussehen können: `shadow-sm` (2 Stellen),
  nacktes `shadow` (1), nacktes `rounded` (17), nacktes `blur` (4), `outline-none` (34,
  heisst jetzt `outline-hidden`), nacktes `border` (136; die Standard-Rahmenfarbe ist
  nicht mehr `gray-200`, sondern `currentColor`), die Ringbreite von `ring` (3 px auf 1 px).
- `tailwind-merge` 3 gehört zu Tailwind 4 (ein Nutzer im Code).
- Drei Guards lesen `globals.css` mit regulären Ausdrücken (`text-contrast.test.ts`,
  `touch-input-size.test.ts`, `touch-target.test.ts`). Ändert die Umstellung den Aufbau der
  Datei (`@layer`, `@theme`), müssen ihre Muster mit, sonst schlagen sie an oder, schlimmer,
  prüfen nichts mehr.

Ablauf: `npx @tailwindcss/upgrade` in einem frischen Branch, dann Diff lesen und die sechs
Ersetzungen oben von Hand gegenprüfen. Abnahme: Gate komplett grün, E2E in der CI grün, und
**Vorher-nachher-Bilder** von Startseite, `/pricing`, Login, Chat und Projekt in Hell und
Dunkel (Desktop und Handy). Zu klären im Branch, nicht vorher: ob der Tailwind-4-Build
`braces` noch irgendwo im Baum hat (`npm ls braces`), sonst wäre die Ausnahme trotzdem nicht
weg.

## Nicht Teil dieses Plans

- Die Zahlen in der Tabelle von #137 gelten für den 2026-10-18; am 2026-10-20 sind
  `tailwindcss` (4.3.3), `tailwind-merge` (3.7.0), `eslint` (10.13.0), `typescript` (7.0.2)
  und `vitest` (5.0.5) unverändert, `framer-motion` steht inzwischen bei 14.4.0.
- Kleine Patches (`react` 19.3.1, `zod` 4.6.7 usw.) bringt Dependabot montags in der
  gruppierten Minor-und-Patch-Runde.
