import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse } from "./parse-source";

// Hält die Server/Client-Grenze aus RESTRUCTURE-2026-08-02.md §3.1 fest.
//
// Der Ordnername src/server/ ist eine Absichtserklärung, `import "server-only"` ist die Durchsetzung: erst der Marker
// macht einen Fehlgriff zum Build-Fehler, und zwar transitiv über die ganze Import-Kette. Eine neue Datei, die im
// Ordner liegt, aber den Marker vergisst, sieht im Review korrekt aus und ist trotzdem ungeschützt; genau dafür ist
// dieser Test da.
//
// Gezählt wird nur die Anweisung selbst, gelesen mit dem Parser (parse-source.ts): `import "server-only";` ohne Namen.
// Ein auskommentierter Import oder einer in einer Zeichenkette schützt nichts, und einen Import mit Namen, den niemand
// benutzt, nimmt der Compiler heraus.
//
// Bewusst NICHT geprüft: dass Code, den der Browser erreicht, den Marker meidet. Das erledigt der Build selbst, laut
// und sofort.
const ROOT = process.cwd();
const SERVER_ROOT = join(ROOT, "src/server");

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesIn(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Steht `import "server-only";` als Anweisung in der Datei (Pfad relativ zum Repo)? */
function hasMarker(file: string, text?: string): boolean {
  return parse(file, text).statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "server-only"
  );
}

describe("src/server/ Grenze", () => {
  it('jedes Modul trägt import "server-only"', () => {
    const files = tsFilesIn(SERVER_ROOT).map((file) => relative(ROOT, file).replace(/\\/g, "/"));
    expect(files.length).toBeGreaterThan(0);

    const unguarded = files.filter((file) => !hasMarker(file));

    expect(
      unguarded,
      `Diese Module liegen in src/server/, tragen aber keinen server-only-Marker. ` +
        `Ohne ihn hält sie nichts davon ab, in ein Client-Bundle zu wandern:\n  ` +
        unguarded.join("\n  ")
    ).toEqual([]);
  });

  it("zählt nur die Anweisung, keinen Kommentar, keine Zeichenkette und keinen Import mit Namen", () => {
    expect(hasMarker("src/server/a.ts", `import "server-only";\n\nexport const a = 1;`)).toBe(true);
    expect(hasMarker("src/server/a.ts", `import 'server-only'`)).toBe(true);
    for (const text of [
      `// import "server-only";`,
      `/* import "server-only"; */`,
      `const marker = 'import "server-only"';`,
      `import marker from "server-only";`,
      `export const a = 1;`,
    ]) {
      expect(hasMarker("src/server/a.ts", text), text).toBe(false);
    }
  });
});
