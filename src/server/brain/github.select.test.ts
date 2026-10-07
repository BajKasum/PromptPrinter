import { describe, expect, it } from "vitest";
import { selectSignalFiles, summarizeTree } from "./github";

// Die Auswahl der Signaldateien und die Verdichtung des Baums: Kanten, die github.test.ts nicht festhält.
// Festgenagelt vor der Zerlegung von github.ts (Betriebs-Audit, Folgesitzung 2026-10-07, Dateigröße). Beide
// Funktionen sind rein (kein Netz, keine Datenbank), die Tests bleiben nach dem Schnitt unverändert.

// Die Reihenfolge der Signaldateien, wörtlich: das Budget wird von oben nach unten vergeben.
const SIGNAL_ORDER = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "pubspec.yaml",
  "Package.swift",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "nuxt.config.ts",
  "svelte.config.js",
  "astro.config.mjs",
  "angular.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "eslint.config.mjs",
  "eslint.config.js",
  ".eslintrc.json",
  "biome.json",
  "prisma/schema.prisma",
  "drizzle.config.ts",
  "supabase/config.toml",
  "docker-compose.yml",
  "Dockerfile",
  "README.md",
  "readme.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "AGENTS.md",
];

describe("selectSignalFiles: Rangfolge und Gleichstand", () => {
  it("vergibt das Budget in genau der Reihenfolge der Signaldateien (ohne Kürzung durch die Obergrenze)", () => {
    const shuffled = [...SIGNAL_ORDER].reverse();
    expect(selectSignalFiles(shuffled, 100)).toEqual(SIGNAL_ORDER);
  });

  it("nimmt standardmäßig höchstens 14 Dateien, und zwar die ersten der Rangfolge", () => {
    const chosen = selectSignalFiles([...SIGNAL_ORDER].reverse());
    expect(chosen).toEqual(SIGNAL_ORDER.slice(0, 14));
  });

  it("stellt einen Treffer im Unterordner hinter alle Dateien der Wurzel, auch hinter die README", () => {
    const chosen = selectSignalFiles(["apps/web/package.json", "AGENTS.md", "README.md", "package.json"]);
    expect(chosen).toEqual(["package.json", "README.md", "AGENTS.md", "apps/web/package.json"]);
  });

  it("ordnet Treffer im Unterordner untereinander nach dem Rang ihres Dateinamens", () => {
    const chosen = selectSignalFiles(["apps/web/tsconfig.json", "apps/api/package.json"]);
    expect(chosen).toEqual(["apps/api/package.json", "apps/web/tsconfig.json"]);
  });

  it("bei gleichem Rang gewinnt der flachere Pfad, bei gleicher Tiefe der Pfad in alphabetischer Reihenfolge", () => {
    expect(selectSignalFiles(["a/b/package.json", "a/package.json"])).toEqual([
      "a/package.json",
      "a/b/package.json",
    ]);
    expect(selectSignalFiles(["b/package.json", "a/package.json"])).toEqual([
      "a/package.json",
      "b/package.json",
    ]);
  });

  it("zählt die Obergrenze je Dateiname ohne Rücksicht auf Groß- und Kleinschreibung", () => {
    // README.md (Rang 32) und readme.md (Rang 33) teilen sich den Namen "readme.md": zwei Plätze, der dritte
    // Treffer (im Unterordner, also noch weiter hinten) fällt weg.
    const chosen = selectSignalFiles(["README.md", "readme.md", "docs/README.md"]);
    expect(chosen).toEqual(["README.md", "readme.md"]);
  });

  it("erkennt nur die genauen Namen, keine ähnlichen", () => {
    expect(selectSignalFiles(["package.json.bak", "my-package.json", "Readme.md", "TSCONFIG.JSON"])).toEqual([]);
  });

  it("kommt mit einer leeren Liste und mit Limit 0 zurecht", () => {
    expect(selectSignalFiles([])).toEqual([]);
    expect(selectSignalFiles(["package.json"], 0)).toEqual([]);
  });
});

describe("summarizeTree: Format, Grenzen, Sortierung", () => {
  it("liefert genau das Format 'Verzeichnisse: …' und 'Dateitypen: …' in zwei Zeilen", () => {
    // Gruppiert wird nach den ersten ZWEI Segmenten: eine Datei direkt in src/ hat nur zwei (src und ihren Namen) und
    // zählt deshalb unter "src/a.ts", nicht unter "src".
    expect(summarizeTree(["src/a.ts", "src/b.ts", "package.json"])).toBe(
      "Verzeichnisse: (root) (1), src/a.ts (1), src/b.ts (1)\nDateitypen: .ts 2, .json 1"
    );
  });

  it("gruppiert nach den ersten zwei Segmenten und zählt eine Datei in der Wurzel als '(root)'", () => {
    const summary = summarizeTree(["src/app/a.tsx", "src/app/deep/b.tsx", "src/lib/c.ts", "README.md"]);
    expect(summary.split("\n")[0]).toBe("Verzeichnisse: src/app (2), (root) (1), src/lib (1)");
  });

  it("sortiert nach Anzahl absteigend, bei Gleichstand nach Name", () => {
    const summary = summarizeTree(["b/x/1.ts", "a/x/1.ts", "c/x/1.ts", "c/x/2.ts"]);
    expect(summary.split("\n")[0]).toBe("Verzeichnisse: c/x (2), a/x (1), b/x (1)");
  });

  it("zeigt höchstens 40 Verzeichnisse", () => {
    const paths = Array.from({ length: 55 }, (_, i) => `d${String(i).padStart(2, "0")}/s/file.ts`);
    const line = summarizeTree(paths, 100000).split("\n")[0];
    expect(line.replace("Verzeichnisse: ", "").split(", ")).toHaveLength(40);
    expect(line).toContain("d00/s (1)");
    expect(line).toContain("d39/s (1)");
    expect(line).not.toContain("d40/s");
  });

  it("zeigt höchstens 12 Dateitypen, die häufigsten zuerst, und zählt Endungen ohne Rücksicht auf die Schreibweise", () => {
    const paths = [
      ...Array.from({ length: 5 }, (_, i) => `a/b/f${i}.TS`),
      ...Array.from({ length: 3 }, (_, i) => `a/b/g${i}.ts`),
      ...Array.from({ length: 14 }, (_, i) => `a/b/h${i}.ext${String(i).padStart(2, "0")}`),
    ];
    const line = summarizeTree(paths, 100000).split("\n")[1];
    const items = line.replace("Dateitypen: ", "").split(", ");
    expect(items).toHaveLength(12);
    expect(items[0]).toBe(".ts 8");
  });

  it("zählt eine Datei ohne Endung und eine Punktdatei nicht als Dateityp", () => {
    const summary = summarizeTree(["Dockerfile", ".gitignore", "src/x/y.ts"]);
    expect(summary.split("\n")[1]).toBe("Dateitypen: .ts 1");
  });

  it("kürzt auf die Obergrenze und hängt ein Auslassungszeichen an", () => {
    const paths = Array.from({ length: 200 }, (_, i) => `dir${i}/sub/file.ts`);
    const cut = summarizeTree(paths, 100);
    expect(cut).toHaveLength(100);
    expect(cut.endsWith("…")).toBe(true);
    const full = summarizeTree(paths, 100000);
    expect(cut).toBe(`${full.slice(0, 99)}…`);
  });

  it("lässt einen Text genau an der Obergrenze unverändert", () => {
    const full = summarizeTree(["src/a/b.ts"], 100000);
    expect(summarizeTree(["src/a/b.ts"], full.length)).toBe(full);
    expect(summarizeTree(["src/a/b.ts"], full.length - 1).endsWith("…")).toBe(true);
  });
});
