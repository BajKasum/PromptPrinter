import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// #139: Kommentare verwiesen auf Dateien, die es nicht mehr gibt (`lib/llm.ts` liegt seit dem 06.10.2026 in
// `src/server/llm/`, `src/lib/` gibt es nicht). Ein Verweis auf eine fehlende Datei schickt Leser und KI-Sitzungen
// in die falsche Richtung, und er veraltet still, sobald jemand eine Datei verschiebt.
//
// Geprüft werden Pfade in Kommentarzeilen unter `src/`: ein Pfad mit mindestens einem Schrägstrich und einer
// Endung wie .ts, .tsx, .mjs, .sql, .md, .json oder .yml. Er gilt als vorhanden, wenn irgendeine Datei im
// Repository (src, tests, e2e, scripts, docs, supabase, .github) so heißt oder auf ihn endet: `lib/pricing.ts`
// trifft `src/shared/lib/pricing.ts`, `server/consent.ts` trifft `src/server/consent.ts`. Gemeint ist der Weg
// "Pfad relativ zu `src/`" aus CLAUDE.md.

const ROOT = process.cwd();
const SCANNED = ["src", "tests", "e2e", "scripts", "docs", "supabase", ".github"];

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

const known = new Set(files);
const exists = (token: string) => known.has(token) || files.some((file) => file.endsWith(`/${token}`));

// `(?<![\w@/.(-])` hält Teile von URLs und Paketnamen (`@scope/pkg`) heraus, die Zeichenklasse erlaubt
// Routengruppen wie `(app)` und dynamische Segmente wie `[id]` im Pfad.
const TOKEN = /(?<![\w@/.-])((?:[\w.[\]()-]+\/)+[\w.[\]-]+\.(?:tsx?|mjs|sql|md|json|ya?ml))(?![\w/])/g;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;

function stale(): string[] {
  const out: string[] = [];
  for (const file of files.filter((f) => f.startsWith("src/") && /\.(tsx?|mjs)$/.test(f))) {
    readFileSync(join(ROOT, file), "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!COMMENT_LINE.test(line)) return;
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

  it("verweisen auf Dateien, die es gibt", () => {
    const missing = stale();
    expect(
      missing,
      `Diese Kommentare nennen Dateien, die es nicht (mehr) gibt. Pfad nachziehen, relativ zu src/ (CLAUDE.md):\n${missing.join("\n")}`
    ).toEqual([]);
  });
});
