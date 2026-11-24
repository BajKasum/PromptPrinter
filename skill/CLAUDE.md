# CLAUDE.md, Projekt-Kontext für Claude-Code-Sessions

Wird bei jedem Session-Start geladen. Kurz: was das Projekt ist, in welchem Zustand es steckt, nach welchen Regeln hier gearbeitet wird.

## Was ist der Skill /pp (`skill/`)?

Der Agent Skill `/pp` (Claude Code, später Codex und VS Code Copilot) plus ein kleines lokales Skript. Er macht aus einer Absicht einen fertigen Prompt für den Coding-Agenten, mit Kontext aus Git, Struktur, Regeldateien und passenden Dateien. Er ändert nie Dateien, führt erst nach ausdrücklichem Ja etwas aus, hat keinen Server und kein Konto. Eigene Produktlinie neben der Web-App PromptPrinter (Entscheid D1 vom 25.10.2026), im Ordner `skill/` des Haupt-Repos `BajKasum/PromptPrinter`, ein eigenes Repo gibt es nicht mehr. Das ZIP für `/skill` (Skill 0.4.1, der Ordner `skill/` per `git archive`) liegt in `public/skill/` der Web-App.

## IST-Zustand (Stand 2026-11-24)

Gegenwart, keine Historie. **Gebaut, dreimal gemessen (0.1.0 bis 0.3.0), Zielwert nicht erreicht; Kasum hat ihn beendet, er wird nicht weiterentwickelt.** Sicherheitsfehler werden trotzdem behoben, die Terminal-App trägt eine Kopie des Skripts. Der Ordner hat README, MIT-Lizenz, `SECURITY.md`, diese Datei, den Skill `pp/` (vom Repo aus `skill/pp/`, Version 0.4.1, nicht gemessen; vier Referenzdateien und das Skript `scripts/context.mjs`), `install.mjs`, Tests (`test/`, `npm test`, `npm run mutation`), die Messung `eval/` (zwölf Aufgaben, Werkzeuge ohne Abhängigkeiten, Ergebnistabellen) Die CI ist `.github/workflows/skill.yml` im Haupt-Repo (Pflichtdateien, Tests auf Ubuntu, Windows und macOS mit Node 22 und 24, Mutationen). Das Skript hat `pack`, `search`, `check`, `save` und `doctor`, keine Abhängigkeit, kein Netzwerk, Git nur über Argumentlisten und mit festem Pfad (`findGit` sucht nur in absoluten PATH-Ordnern, unter Windows sucht Node sonst zuerst im Projektordner), jede Ausgabezeile geschwärzt, erst geschwärzt und dann gekürzt, Exit-Code immer 0. G1 wurde dreimal verfehlt (Recall 84, 88 und 82 von 99 bei verlangten 90; der Auftrag kostet 21 bis 73 % der Ausführung statt rund 15 %); das Skript hat den Recall nicht gehoben (Notiz im Vault: PromptPrinter 2.0 Eval Lauf C v2). Der Schritt `check` läuft nur mit Here-Document direkt hinter dem Befehl: `allowed-tools` gibt genau `node "${CLAUDE_SKILL_DIR}/scripts/context.mjs" *` frei, eine Pipe oder `cat` davor wird verweigert. **Probeläufe aus Git Bash brauchen `MSYS_NO_PATHCONV=1`**, sonst wird aus `/pp` ein Windows-Pfad und der Skill lädt nicht.

Bestätigte Entscheide (25.10.2026): eigene Produktlinie, Lizenz MIT (das eigene Repo gab es bis 2026-11-20, seitdem `skill/` im Haupt-Repo, Kasums Entscheid), Befehl `/pp` (Codex: `$pp`), Start nach dem 23.10., Skill-Datei auf Englisch, Aufträge in der Sprache der Absicht.

## Verhältnis zum Haupt-Repo (BajKasum/PromptPrinter)

Ein Repo, getrennte Pakete: kein gemeinsamer Code, keine Laufzeit-Abhängigkeit. Gemeinsam sind Regeln und Ideen. Der Skill übernimmt Logik als Text oder Neuschreibung, nie per Import:

| Quelle im Haupt-Repo | Wird hier | Wo |
|---|---|---|
| `src/server/system-prompt.ts` (Finns Regeln, Schutzregeln gegen Injection) | Grundregeln des Skills, für Coding geschärft | `SKILL.md` |
| `src/features/projects/lib/project-context.ts` (Rangordnung der Quellen) | verbessert, mit Session, Git und Code | `SKILL.md`, `scripts/` |
| `src/server/brain/github-select.ts` (`SIGNAL_FILES`, Treffer-Deckel) | ins Skript übertragen | `scripts/context` |
| Faktenschema des Projekt-Gedächtnisses | Gliederung des Projektprofils, ohne Modellaufruf | `scripts/context` |
| `extractPrompt`, `normalize-fences` | im Skript für `save` und `check` | `scripts/context` |

**Abgleich:** ändert jemand eine dieser Quellen, prüft er, ob der Skill nachziehen muss (und umgekehrt, wenn hier eine Regel geschärft wird, die auch Finn gilt). `cli/src/context.mjs` ist eine Kopie von `pp/scripts/context.mjs`: ändert sich das Skript, schlägt `tests/guards/cli-contract.test.ts` an, und die Kopie in `cli/` zieht nach.

## Arbeitsregeln (verbindlich, die `CLAUDE.md` des Haupt-Repos gilt)

- **Wie im Haupt-Repo:** nie direkt auf `main`, ein Branch je Arbeitsgang, Pull Request, "Rebase and merge", ein PR nach dem anderen.
- **Branches nie löschen, nie force-pushen.** Staging immer per Dateiname, nie `git add .`.
- **Gate vor Push und Merge:** in `skill/` `npm run check` und `npm test`, dazu das Gate des Haupt-Repos; die CI (`skill.yml`) wiederholt beides und lässt `npm run mutation` laufen (lokal dauert es lange: bei jeder Änderung an einer Schranke oder am Text von `SKILL.md`).
- **Mutationstest für jede neue Schranke:** Schranke kaputt machen, der Test muss anschlagen, danach aus der Sicherung zurücksetzen.
- **Commit-Trailer:** `Co-Authored-By: Claude <aktuelles Modell> <noreply@anthropic.com>`. Nachrichten nach Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`), deutsch, Imperativ, klein nach dem Doppelpunkt.
- **Eval-Läufe** nur in einer Kopie ohne Remote, mit `--strict-mcp-config`, `--disallowedTools "Bash(git push *)" "Bash(gh *)"` und `--max-budget-usd`. Gold-Fakten werden committet, bevor ein Lauf startet.
- **Keine Telemetrie, nichts an PromptPrinter senden.** Das Skript schwärzt Geheimnisse und begrenzt Menge und Zeit.
- **Kein `python` in der Shell** (Windows-Store-Verknüpfung hängt), `node` nehmen.
- **Rechtliches klein halten** (Entscheid 17.10.2026 im Haupt-Projekt): keine Verträge, kein Jurist vorschlagen.
