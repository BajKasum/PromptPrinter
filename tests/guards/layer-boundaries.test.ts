import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Erzwingt die Schichtgrenzen aus RESTRUCTURE-2026-08-02.md §4.4:
//
//   app/  ──►  features/  ──►  shared/
//     │           │              ▲
//     │        shell/ ───────────┘
//     └──────►  server/ ─────────┘
//
// Warum ein Test und nicht ESLint: `no-restricted-imports` mit `patterns`
// laeuft ueber minimatch, und in diesem Repo ist das kaputt. eslint@9 bringt
// minimatch@3 mit, das brace-expansion als Funktion erwartet; der
// Security-Override in package.json (Audit-Befund H-2) erzwingt aber
// brace-expansion@5, das stattdessen ein Objekt exportiert. Die Regel stirbt
// mit "expand is not a function". Den Override zu lockern, um eine Lint-Regel
// zu retten, waere der falsche Tausch — also traegt der Test die Grenze.
//
// Das passt ohnehin zum Haus: text-contrast.test.ts ist aus demselben Grund
// ein Test und keine Notiz im Styleguide.

const SRC = join(process.cwd(), "src");

const FEATURES = ["auth", "chat", "marketing", "projects", "prompts", "settings"];

/** Welcher Schicht gehoert ein Pfad an? Pfade sind repo-relativ, mit "/". */
function layerOf(file: string): string {
  if (file.startsWith("src/app/")) return "app";
  if (file.startsWith("src/features/")) return `features/${file.split("/")[2]}`;
  if (file.startsWith("src/shell/")) return "shell";
  if (file.startsWith("src/server/")) return "server";
  if (file.startsWith("src/shared/")) return "shared";
  return "root";
}

/** Verbotene Kanten. Gibt den Grund zurueck, oder null wenn erlaubt. */
function violation(from: string, to: string): string | null {
  if (to === "app") return "niemand importiert aus app/ — Routen sind die Spitze, nicht die Basis";
  if (from === "shared" && to !== "shared" && to !== "root")
    return "shared/ ist die unterste Schicht und kennt niemanden ueber sich";
  if (from === "server" && (to.startsWith("features/") || to === "shell"))
    return "server/ kennt weder Features noch den App-Rahmen";
  if (from.startsWith("features/") && to === "shell")
    return "Features kennen den App-Rahmen nicht — die Abhaengigkeit laeuft andersherum";
  if (from.startsWith("features/") && to.startsWith("features/") && from !== to)
    return "kein Feature importiert ein anderes — was zwei brauchen, gehoert nach shared/";
  return null;
}

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? tsFilesIn(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("Schichtgrenzen", () => {
  it("kein Modul importiert entgegen der erlaubten Richtung", () => {
    const files = tsFilesIn(SRC);
    expect(files.length).toBeGreaterThan(0);

    const problems: string[] = [];
    for (const absolute of files) {
      const file = relative(process.cwd(), absolute).replace(/\\/g, "/");
      const from = layerOf(file);
      const source = readFileSync(absolute, "utf8");

      for (const match of source.matchAll(/["']@\/([^"']+)["']/g)) {
        const to = layerOf(`src/${match[1]}`);
        const reason = violation(from, to);
        if (reason) problems.push(`${file}\n    → @/${match[1]}\n    ${from} → ${to}: ${reason}`);
      }
    }

    expect(problems, `Verletzte Schichtgrenzen:\n\n${problems.join("\n\n")}`).toEqual([]);
  });

  it("kennt jedes tatsaechlich vorhandene Feature", () => {
    // Faellt auf, wenn ein neues Feature dazukommt und niemand die Liste oben
    // nachzieht: sonst pruefte der Test es stillschweigend nicht mit.
    const onDisk = readdirSync(join(SRC, "features"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(onDisk).toEqual([...FEATURES].sort());
  });
});
