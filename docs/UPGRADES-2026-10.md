# Major-Upgrades, Plan und Entscheid (Stand 2026-10-20)

Antwort auf Issue #137. Der Plan sagt, was in welcher Reihenfolge angehoben wird und warum
Tailwind 4 zuerst kommt. Gemessen am 2026-10-20 mit `npm outdated` und `npm audit`.

## Korrektur nach dem Umbau (2026-10-20, am Nachmittag)

**Schritt 1 ist umgesetzt (Tailwind 4, Branch `feat/tailwind-4`), und die Annahme dieses Plans war falsch:
Tailwind 4 beseitigt den `braces`-Fund nicht.** Der Plan nannte `eslint-config-next` als zweiten Pfad und schloss
trotzdem auf "der einzige Weg, der den Fund beseitigt". Nach dem Umbau gemessen (`npm ls braces`, `npm audit`):

- Der Pfad über `tailwindcss` (`chokidar`, `micromatch`) ist weg.
- Der Pfad `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob 3.3.1` -> `micromatch 4.0.8` -> `braces 3.0.3`
  bleibt, und mit ihm der Fund. `@next/eslint-plugin-next` 16.4.2 (Next 16) bindet dasselbe `fast-glob 3.3.1` ein,
  die neuesten `fast-glob` (3.3.3), `micromatch` (4.0.8) und `braces` (3.0.3) sind alle betroffen. **Next 16 hilft also auch nicht.**
- Der ausgelieferte Baum ist sauber: `npm audit --omit=dev` meldet `braces` nicht mehr (vorher hing er über `tailwindcss-animate`,
  eine Produktions-Abhängigkeit, die der Umbau entfernt hat), und `.next/standalone/node_modules` enthält keines der Pakete.

**Entschieden am 2026-10-20 (Kasum): Weg 1, das Gate nach Baum trennen.** Umgesetzt in `scripts/audit-gate.mjs`: Produktion streng ohne Ausnahmen, Entwicklungswerkzeuge ohne gepatchte Version melden statt blockieren; die Ausnahmeliste samt Ablaufdatum ist entfernt. Der Absatz "Folge" und die drei Wege darunter sind Stand vor dem Entscheid.

**Folge:** der Rückfall von unten greift jetzt: die Ausnahme ist einmal bis **2026-11-19** verlängert, mit neuer Begründung
(nur noch ESLint) in `scripts/audit-gate.mjs`. **Offen für Kasum, vor dem 2026-11-19:** wie es danach weitergeht. Drei Wege:

1. **Das Gate nach Baum trennen (Empfehlung).** Produktions-Baum streng (`npm audit --omit=dev --audit-level=high`, ohne Ausnahmen),
   Entwicklungs-Werkzeuge getrennt: ein Fund ohne gepatchte Version in einem Werkzeug, das nie ausgeliefert wird, wird gemeldet,
   blockiert aber nicht. Ändert die Regel "jede Ausnahme hat ein Ablaufdatum" von Kasum, deshalb nicht ohne sein Ja.
2. **`eslint-config-next` loswerden** und ESLint nur mit den Plugins fahren, die wir brauchen (react-hooks, jsx-a11y, typescript-eslint).
   Kostet die Next-eigenen Regeln (`no-img-element`, `no-html-link-for-pages` und weitere) und ist ohnehin Teil von #138.
3. **Monatlich verlängern**, bis `micromatch` oder `braces` einen Fix bringen. Der Aufwand ist klein, die Ausnahme aber genau das,
   wovor die Regel im Gate warnt.

## Entscheid zur `braces`-Ausnahme (Stand vor dem Umbau, siehe die Korrektur oben)

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
| 1 | `tailwindcss` 3.4.19 auf 4.3.3, `tailwind-merge` 2.6.1 auf 3.7.0, `tailwindcss-animate` ersetzen | **erledigt am 2026-10-20**; löst die Ausnahme **nicht** (siehe die Korrektur oben) | **gross**, siehe unten |
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
- `tailwindcss-animate` wird nicht mehr als Plugin geladen. Gebraucht wurde es an genau einer Stelle (mobiles Menü der Navigation), dafür gibt es jetzt eine eigene Animation (`--animate-menu-in` im `@theme`) statt der Abhängigkeit `tw-animate-css`.
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
