import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Haelt die Server/Client-Grenze aus RESTRUCTURE-2026-08-02.md §3.1 fest.
//
// Der Ordnername src/server/ ist eine Absichtserklaerung, `import "server-only"`
// ist die Durchsetzung: erst der Marker macht einen Fehlgriff zum Build-Fehler,
// und zwar transitiv ueber die ganze Import-Kette. Eine neue Datei, die im
// Ordner liegt aber den Marker vergisst, sieht im Review korrekt aus und ist
// trotzdem ungeschuetzt — genau dafuer ist dieser Test da.
//
// Bewusst NICHT geprueft: dass client-erreichbarer Code den Marker meidet. Das
// erledigt der Build selbst, laut und sofort.
const SERVER_ROOT = join(process.cwd(), "src/server");

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesIn(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("src/server/ Grenze", () => {
  it("jedes Modul traegt import \"server-only\"", () => {
    const files = tsFilesIn(SERVER_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const unguarded = files
      .filter((file) => !/import\s+["']server-only["']/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file).replace(/\\/g, "/"));

    expect(
      unguarded,
      `Diese Module liegen in src/server/, tragen aber keinen server-only-Marker. ` +
        `Ohne ihn haelt sie nichts davon ab, in ein Client-Bundle zu wandern:\n  ` +
        unguarded.join("\n  ")
    ).toEqual([]);
  });
});
