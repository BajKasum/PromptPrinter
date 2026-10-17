import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Handy-Audit 2026-10-17: /plans war bei 375 px seitlich scrollbar. Die Tabelle steckt in einem
// `overflow-x-auto`-Div, ihre `sr-only`-Beschriftungen sind aber `position: absolute`. Ohne
// positionierten Vorfahren gehören sie zum Dokument und nicht zum scrollenden Div: der Div schneidet
// sie nicht ab, die Seite wird breiter als das Handy. Ein `relative` am Div genügt.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe("scrollende Tabellenrahmen", () => {
  it("sind positioniert, wenn die Datei sr-only-Text in einer Tabelle hat", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("<table") || !text.includes("sr-only")) continue;
      for (const m of text.matchAll(/className="([^"]*\boverflow-x-auto\b[^"]*)"/g)) {
        if (!/\b(relative|absolute|fixed|sticky)\b/.test(m[1])) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
