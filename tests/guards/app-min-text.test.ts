import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Handy-Audit 2026-10-17: in der eingeloggten App standen 51 Stellen mit 10 bis 11,5 px (Hinweise,
// Datumszeilen, Abzeichen, "Finn ist eine KI ..."). Auf dem Handy ist das kaum lesbar. Untergrenze 12 px.
// Die öffentlichen Seiten (Landing, Hilfe, Vergleiche, Rechtstexte) und die Auth-Seiten sind bewusst nicht
// erfasst: Kasum findet die Startseite auf dem Handy gut, und das Hero steht auf der Nicht-anfassen-Liste.

const APP_DIRS = [
  "src/app/(app)",
  "src/shell",
  "src/shared/ui",
  "src/features/chat",
  "src/features/projects",
  "src/features/settings",
  "src/features/prompts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe("Mindestschrift in der eingeloggten App", () => {
  it("kein text-[Npx] unter 12 px", () => {
    const offenders: string[] = [];
    for (const dir of APP_DIRS) {
      for (const file of sourceFiles(dir)) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
          if (parseFloat(m[1]) < 12) offenders.push(`${file}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
