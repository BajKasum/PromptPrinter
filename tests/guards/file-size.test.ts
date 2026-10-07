import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Dateigrößen (Betriebs-Audit M7, 06.10.2026).
//
// chat.tsx war am 16.07.2026 von 667 auf 260 Zeilen gebracht worden und stand am 05.10. wieder bei 865: ohne
// eine Grenze, an der etwas scheitert, wächst jede Datei zurück. Vereinbart: Code-Dateien höchstens 400
// Zeilen, CLAUDE.md höchstens 450 (Anleitung, kein Tagebuch).
//
// Die Dateien, die heute darüber liegen, sind NICHT Teil von M7 und stehen mit einer Obergrenze in der Liste
// unten: sie dürfen nicht weiter wachsen, und sobald eine unter 400 fällt, verlangt der Test, ihren Eintrag
// zu löschen. Der Weg nach unten ist der Weg, die Liste leer zu bekommen. Wörterbücher sind Daten, keine
// Logik, und haben eine eigene, großzügigere Grenze.

const ROOT = process.cwd();
const MAX_CODE_LINES = 400;
const MAX_CLAUDE_MD_LINES = 450;

/** Heute über 400 Zeilen, mit Obergrenze (etwas über dem heutigen Stand). Eintrag löschen, sobald die Datei kleiner wird. */
const OVER_LIMIT: Record<string, number> = {
  "src/features/chat/components/voice-bar.tsx": 420,
  "src/features/chat/lib/attachment-store.ts": 440,
  "src/shell/components/sidebar.tsx": 460,
  "src/features/settings/components/api-keys.tsx": 510,
  "src/server/brain/github.ts": 520,
  "src/server/security/rate-limit.ts": 520,
  "src/features/marketing/components/hero.tsx": 610,
};

/** Wörterbücher: Daten, nicht Logik. */
const DICTIONARY_DIR = "src/shared/i18n/messages/";
const MAX_DICTIONARY_LINES = 800;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const lines = (path: string) => {
  // Wie `wc -l`: nach dem letzten Zeilenumbruch beginnt keine weitere Zeile.
  const text = readFileSync(path, "utf8");
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
};
const rel = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

describe("Dateigrößen", () => {
  const files = sourceFiles(join(ROOT, "src")).map((p) => ({ path: rel(p), lines: lines(p) }));

  it("jede Code-Datei hat höchstens 400 Zeilen, oder steht mit einer Obergrenze in der Liste", () => {
    const tooBig = files
      .filter((f) => !f.path.startsWith(DICTIONARY_DIR))
      .filter((f) => f.lines > (OVER_LIMIT[f.path] ?? MAX_CODE_LINES))
      .map((f) => `${f.path}: ${f.lines} Zeilen (erlaubt: ${OVER_LIMIT[f.path] ?? MAX_CODE_LINES})`);
    expect(
      tooBig,
      `Zu große Dateien. Zerlegen (siehe CLAUDE.md, "Struktur") statt die Grenze anzuheben:\n  ${tooBig.join("\n  ")}`
    ).toEqual([]);
  });

  it("jeder Eintrag der Liste ist noch nötig (die Datei liegt über 400 Zeilen)", () => {
    const sizes = new Map(files.map((f) => [f.path, f.lines]));
    const stale = Object.keys(OVER_LIMIT).filter((path) => (sizes.get(path) ?? 0) <= MAX_CODE_LINES);
    expect(
      stale,
      `Diese Dateien sind klein genug (oder verschwunden): Eintrag in tests/guards/file-size.test.ts löschen:\n  ${stale.join("\n  ")}`
    ).toEqual([]);
  });

  it("die Wörterbücher bleiben unter ihrer Grenze (sie wachsen mit den Texten, nicht mit der Logik)", () => {
    const big = files
      .filter((f) => f.path.startsWith(DICTIONARY_DIR) && f.lines > MAX_DICTIONARY_LINES)
      .map((f) => `${f.path}: ${f.lines}`);
    expect(big).toEqual([]);
  });

  it("CLAUDE.md bleibt eine Anleitung: höchstens 450 Zeilen", () => {
    expect(lines(join(ROOT, "CLAUDE.md"))).toBeLessThanOrEqual(MAX_CLAUDE_MD_LINES);
  });
});
