import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// #139: Kommentare verwiesen auf Dateien, die es nicht mehr gibt (`lib/llm.ts` liegt seit dem 06.10.2026 in
// `src/server/llm/`, `src/lib/` gibt es nicht). Ein Verweis auf eine fehlende Datei schickt Leser und KI-Sitzungen
// in die falsche Richtung, und er veraltet still, sobald jemand eine Datei verschiebt.
//
// Geprüft werden Pfade in Kommentarzeilen unter `src/` und in den Konfigurations- und Betriebsdateien
// (CHECKED_ROOT, CHECKED_DIRS; #218): ein Pfad mit mindestens einem Schrägstrich und einer Endung wie .ts, .tsx,
// .mjs, .sql, .md, .json oder .yml. Er gilt als vorhanden, wenn irgendeine Datei im Repository (src, tests, e2e,
// scripts, docs, supabase, .github) so heißt oder auf ihn endet: `lib/pricing.ts` trifft `src/shared/lib/pricing.ts`,
// `server/consent.ts` trifft `src/server/consent.ts`. Gemeint ist der Weg "Pfad relativ zu `src/`" aus CLAUDE.md.
// Ein Dateiname ohne Verzeichnis (.ts, .tsx, .mjs) in den Konfigurations- und Betriebsdateien gilt als vorhanden, wenn
// irgendeine Datei so heißt; unter `src/` bleibt er ungeprüft (dort stehen viele Kurznamen wie `llm.ts` für ein Modul).

const ROOT = process.cwd();
const SCANNED = ["src", "tests", "e2e", "scripts", "docs", "supabase", ".github"];

// Dateien im Wurzelverzeichnis und Verzeichnisse außerhalb von `src/`, deren Kommentare mitgeprüft werden.
const CHECKED_ROOT = /^(next|vitest|playwright)\.config\.ts$|^eslint\.config\.mjs$|^Dockerfile$|^docker-compose[\w.-]*\.yml$/;
const CHECKED_DIRS = ["scripts/", ".github/"];

// Beispiele, die bewusst keine Dateien des Repos sind (ein Monorepo-Pfad als Beispiel, Testdaten).
const ILLUSTRATIVE = new Set(["apps/web/package.json", "src/a.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = SCANNED.flatMap((dir) => {
  try {
    return statSync(join(ROOT, dir)).isDirectory() ? walk(join(ROOT, dir)) : [];
  } catch {
    return [];
  }
}).map((file) => relative(ROOT, file).replace(/\\/g, "/"));

const rootFiles = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const everything = [...files, ...rootFiles];
const known = new Set(everything);
const exists = (token: string) => known.has(token) || files.some((file) => file.endsWith(`/${token}`));
const basenames = new Set(everything.map((file) => file.slice(file.lastIndexOf("/") + 1)));

// `(?<![\w@/.(-])` hält Teile von URLs und Paketnamen (`@scope/pkg`) heraus, die Zeichenklasse erlaubt
// Routengruppen wie `(app)` und dynamische Segmente wie `[id]` im Pfad.
const TOKEN = /(?<![\w@/.-])((?:[\w.[\]()-]+\/)+[\w.[\]-]+\.(?:tsx?|mjs|sql|md|json|ya?ml))(?![\w/])/g;
// Ein Dateiname ohne Verzeichnis, nur mit Code-Endungen: `.json` und `.md` nennen im Fließtext oft Werkzeugdateien.
const BARE = /(?<![\w@/.-])([\w-]+\.(?:tsx?|mjs))(?![\w/.-])/g;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;
// YAML und Dockerfile kommentieren mit `#`, die Shebang-Zeile ist kein Kommentar.
const HASH_COMMENT_LINE = /^\s*#(?!!)/;

function checkedFiles(): string[] {
  const source = (f: string) => f.startsWith("src/") && /\.(tsx?|mjs)$/.test(f);
  const config = (f: string) => CHECKED_DIRS.some((dir) => f.startsWith(dir)) && /\.(tsx?|mjs|ya?ml)$/.test(f);
  const root = (f: string) => !f.includes("/") && CHECKED_ROOT.test(f);
  return everything.filter((f) => source(f) || config(f) || root(f));
}

function stale(): string[] {
  const out: string[] = [];
  for (const file of checkedFiles()) {
    const commentLine = /\.ya?ml$|^Dockerfile$/.test(file) ? HASH_COMMENT_LINE : COMMENT_LINE;
    readFileSync(join(ROOT, file), "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!commentLine.test(line)) return;
        for (const match of file.startsWith("src/") ? [] : line.matchAll(BARE)) {
          if (!basenames.has(match[1]) && !ILLUSTRATIVE.has(match[1])) out.push(`${file}:${index + 1}: ${match[1]}`);
        }
        for (const match of line.matchAll(TOKEN)) {
          let token = match[1];
          // Eine Klammer vorn gehört zum Satz ("(server/consent.ts)"), nicht zu einer Routengruppe.
          const first = token.split("/")[0];
          if (first.startsWith("(") && !first.includes(")")) token = token.slice(1);
          // Relative Angaben wie "../(workspace)/layout.tsx" zählen ab dem ersten Verzeichnisnamen.
          token = token.replace(/^(\.\.?\/)+/, "");
          if (ILLUSTRATIVE.has(token) || exists(token)) continue;
          out.push(`${file}:${index + 1}: ${token}`);
        }
      });
  }
  return out;
}

describe("Pfade in Kommentaren", () => {
  it("findet den Quellbaum", () => {
    expect(files.filter((f) => f.startsWith("src/")).length).toBeGreaterThan(300);
  });

  it("liest die Konfigurations- und Betriebsdateien mit", () => {
    const checked = checkedFiles();
    for (const name of ["next.config.ts", "Dockerfile", "docker-compose.yml", "scripts/check-env.mjs", ".github/workflows/ci.yml"]) {
      expect(checked, name).toContain(name);
    }
  });

  it("verweisen auf Dateien, die es gibt", () => {
    const missing = stale();
    expect(
      missing,
      `Diese Kommentare nennen Dateien, die es nicht (mehr) gibt. Pfad nachziehen, relativ zu src/ (CLAUDE.md):\n${missing.join("\n")}`
    ).toEqual([]);
  });
});
