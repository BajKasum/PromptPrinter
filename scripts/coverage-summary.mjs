/**
 * Die Testabdeckung je Verzeichnis, aus der Datei coverage-summary.json im
 * Berichtsordner (`npm run test:coverage`, Reporter `json-summary` in vitest.config.ts).
 *
 * Vitest nennt eine Gesamtzahl und eine Zahl je Datei. Die Frage, auf die es
 * ankommt, steht dazwischen: wie dünn ist die Absicherung in `src/server/` und
 * in `src/app/api/`, den Stellen mit Geheimnissen, Geld und Ratenlimit? Dieses
 * Skript rechnet die Dateien je Verzeichnis zusammen (aus Treffern und
 * Gesamtzahlen, nicht aus Mittelwerten von Prozenten) und schreibt eine
 * Markdown-Tabelle, in die CI zusätzlich in die Zusammenfassung des Laufs.
 *
 * Es gibt bewusst keine Schwelle und keinen Fehlschlag wegen einer Zahl (#221):
 * erst ein Basiswert (docs/SETUP.md, "Testabdeckung"), danach eine Ratsche, wenn
 * Kasum es will. Der Exit-Code sagt nur, ob der Bericht lesbar war.
 *
 * Usage: node scripts/coverage-summary.mjs [Pfad zur coverage-summary.json]
 * Exit:  0 Tabelle geschrieben · 1 Bericht fehlt oder ist unlesbar
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Die Gruppen der Tabelle. Eine Datei gehört in die erste, die passt; "Rest"
 * fängt ab, was keine nennt, damit die Zeilen zusammen die Gesamtzahl ergeben.
 *
 * @type {{ label: string, test: (path: string) => boolean }[]}
 */
export const GROUPS = [
  { label: "src/server/", test: (p) => p.startsWith("src/server/") },
  { label: "src/app/api/", test: (p) => p.startsWith("src/app/api/") },
  { label: "src/app/ (Seiten, ohne api)", test: (p) => p.startsWith("src/app/") },
  { label: "src/features/", test: (p) => p.startsWith("src/features/") },
  { label: "src/shared/", test: (p) => p.startsWith("src/shared/") },
  { label: "src/shell/", test: (p) => p.startsWith("src/shell/") },
  { label: "Rest", test: () => true },
];

const KINDS = /** @type {const} */ (["lines", "statements", "branches", "functions"]);

/** Der Pfad ab `src/`, mit `/`, egal ob der Bericht unter Windows oder Linux entstand. */
export function relativePath(path) {
  const unix = path.replaceAll("\\", "/");
  const at = unix.lastIndexOf("/src/");
  return at >= 0 ? unix.slice(at + 1) : unix;
}

/**
 * @param {Record<string, Record<string, { total: number, covered: number }>>} summary Inhalt von coverage-summary.json
 * @returns {{ label: string, files: number, lines: Cell, statements: Cell, branches: Cell, functions: Cell }[]}
 *
 * @typedef {{ covered: number, total: number }} Cell
 */
export function summarize(summary, groups = GROUPS) {
  const rows = groups.map((group) => ({
    label: group.label,
    files: 0,
    ...Object.fromEntries(KINDS.map((kind) => [kind, { covered: 0, total: 0 }])),
  }));

  for (const [path, entry] of Object.entries(summary)) {
    if (path === "total") continue;
    const rel = relativePath(path);
    const index = groups.findIndex((group) => group.test(rel));
    if (index < 0) continue;
    rows[index].files += 1;
    for (const kind of KINDS) {
      rows[index][kind].covered += entry[kind]?.covered ?? 0;
      rows[index][kind].total += entry[kind]?.total ?? 0;
    }
  }

  const total = summary.total;
  const all = {
    label: "Gesamt",
    files: rows.reduce((sum, row) => sum + row.files, 0),
    ...Object.fromEntries(KINDS.map((kind) => [kind, { covered: total?.[kind]?.covered ?? 0, total: total?.[kind]?.total ?? 0 }])),
  };
  return [...rows.filter((row) => row.files > 0), all];
}

/** "83,4 %" oder "-" für eine Kennzahl ohne Nenner (eine Gruppe ganz ohne Zweige). */
export function percent({ covered, total }) {
  if (total === 0) return "-";
  return `${((covered / total) * 100).toFixed(1).replace(".", ",")} %`;
}

export function toMarkdown(rows) {
  const lines = [
    "| Verzeichnis | Dateien | Zeilen | Anweisungen | Zweige | Funktionen |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map(
      (row) =>
        `| ${row.label} | ${row.files} | ${percent(row.lines)} | ${percent(row.statements)} | ${percent(row.branches)} | ${percent(row.functions)} |`
    ),
  ];
  return lines.join("\n");
}

function main() {
  const path = process.argv[2] ?? "coverage/coverage-summary.json";
  if (!existsSync(path)) {
    console.error(`coverage-summary: ${path} fehlt. Erst \`vitest run --coverage\` (npm run test:coverage).`);
    process.exit(1);
  }
  let summary;
  try {
    summary = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`coverage-summary: ${path} ist kein lesbares JSON (${err instanceof Error ? err.message : err}).`);
    process.exit(1);
  }

  const table = toMarkdown(summarize(summary));
  console.log(`\nTestabdeckung je Verzeichnis\n\n${table}\n`);

  // In der CI landet dieselbe Tabelle in der Zusammenfassung des Laufs.
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) appendFileSync(stepSummary, `### Testabdeckung je Verzeichnis\n\n${table}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
