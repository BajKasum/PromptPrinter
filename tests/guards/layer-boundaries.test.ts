import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { moduleReferences, parse, resolveModule } from "./parse-source";

// Erzwingt die Schichtgrenzen aus RESTRUCTURE-2026-08-02.md §4.4:
//
//   app/  ──►  features/  ──►  shared/
//     │           │              ▲
//     │        shell/ ───────────┘
//     └──────►  server/ ─────────┘
//
// Warum ein Test und nicht ESLint: `no-restricted-imports` mit `patterns` läuft über minimatch, und in diesem Repo
// ist das kaputt. eslint@9 bringt minimatch@3 mit, das brace-expansion als Funktion erwartet; der Security-Override in
// package.json (Audit-Befund H-2) erzwingt aber brace-expansion@5, das stattdessen ein Objekt exportiert. Die Regel
// stirbt mit "expand is not a function". Den Override zu lockern, um eine Lint-Regel zu retten, wäre der falsche
// Tausch, also trägt der Test die Grenze. Das passt ohnehin zum Haus: text-contrast.test.ts ist aus demselben Grund
// ein Test und keine Notiz im Styleguide.
//
// Gezählt wird jede Stelle, die ein Modul beim Pfad nennt (parse-source.ts): Importe und Re-Exporte, `import()`,
// `require`, `typeof import(…)` und die Modul-Aufrufe von Vitest, über `@/…` wie über einen relativen Pfad. Ein
// berechneter Pfad lässt sich nicht prüfen und schlägt deshalb selbst an. Innerhalb von app/ importieren die Dateien
// einander relativ; `@/app/…` bleibt überall gesperrt.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const FEATURES = ["auth", "chat", "marketing", "projects", "prompts", "settings"];

/** Welcher Schicht gehört ein Pfad an? Pfade sind relativ zum Repo, mit "/". */
function layerOf(file: string): string {
  if (file.startsWith("src/app/")) return "app";
  if (file.startsWith("src/features/")) return `features/${file.split("/")[2]}`;
  if (file.startsWith("src/shell/")) return "shell";
  if (file.startsWith("src/server/")) return "server";
  if (file.startsWith("src/shared/")) return "shared";
  return "root";
}

/** Verbotene Kanten. Gibt den Grund zurück, oder null, wenn erlaubt. */
function violation(from: string, to: string, viaAlias: boolean): string | null {
  if (to === "app" && from !== "app") return "niemand importiert aus app/ — Routen sind die Spitze, nicht die Basis";
  if (to === "app" && viaAlias) return "innerhalb von app/ relativ importieren, nie über @/app/…";
  if (from === "shared" && to !== "shared" && to !== "root")
    return "shared/ ist die unterste Schicht und kennt niemanden über sich";
  if (from === "server" && (to.startsWith("features/") || to === "shell"))
    return "server/ kennt weder Features noch den App-Rahmen";
  if (from.startsWith("features/") && to === "shell")
    return "Features kennen den App-Rahmen nicht — die Abhängigkeit läuft andersherum";
  if (from.startsWith("features/") && to.startsWith("features/") && from !== to)
    return "kein Feature importiert ein anderes — was zwei brauchen, gehört nach shared/";
  return null;
}

/** Die Verstöße einer Datei (Pfad relativ zum Repo, mit "/"); ohne `text` wird sie gelesen. */
function layerProblems(file: string, text?: string): string[] {
  const from = layerOf(file);
  return moduleReferences(parse(file, text)).flatMap((ref) => {
    const at = `${file}:${ref.line}`;
    if (ref.specifier === null) return [`${at}\n    → berechneter Pfad (${ref.kind}): lässt sich nicht prüfen, Pfad ausschreiben`];
    const target = resolveModule(file, ref.specifier);
    if (target === null) return [];
    const to = layerOf(`${target}/`);
    const reason = violation(from, to, ref.specifier.startsWith("@/"));
    return reason ? [`${at}\n    → ${ref.specifier}\n    ${from} → ${to}: ${reason}`] : [];
  });
}

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? sourceFilesIn(full) : /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name) ? [full] : [];
  });
}

describe("Schichtgrenzen", () => {
  it("kein Modul importiert entgegen der erlaubten Richtung", () => {
    const files = sourceFilesIn(SRC).map((file) => relative(ROOT, file).replace(/\\/g, "/"));
    expect(files.length).toBeGreaterThan(0);

    const problems = files.flatMap((file) => layerProblems(file));
    expect(problems, `Verletzte Schichtgrenzen:\n\n${problems.join("\n\n")}`).toEqual([]);
  });

  it("kennt jedes tatsächlich vorhandene Feature", () => {
    // Fällt auf, wenn ein neues Feature dazukommt und niemand die Liste oben nachzieht: sonst prüfte der Test es
    // stillschweigend nicht mit.
    const onDisk = readdirSync(join(SRC, "features"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(onDisk).toEqual([...FEATURES].sort());
  });
});

describe("Schichtgrenzen: der Scanner", () => {
  const flagged = (file: string, text: string) => layerProblems(file, text).length;
  const project = "src/features/projects/lib/a.ts";

  it("sieht einen relativen Pfad über die Grenze, in jeder Schreibweise eines Imports", () => {
    for (const text of [
      `import { y } from "../../chat/lib/y";`,
      `import type { Y } from "../../chat/lib/y";`,
      `export { y } from "../../chat/lib/y";`,
      `export * from "../../chat/lib/y";`,
      `const m = await import("../../chat/lib/y");`,
      `const m = require("../../chat/lib/y");`,
      `type Y = typeof import("../../chat/lib/y");`,
      `vi.mock("../../chat/lib/y");`,
      "const m = await import(`@/features/chat/lib/y`);",
    ]) {
      expect(flagged(project, text), text).toBe(1);
    }
  });

  it("ein berechneter Pfad schlägt an, weil er sich nicht prüfen lässt", () => {
    expect(flagged(project, "const m = await import(`@/features/${name}/lib/y`);")).toBe(1);
    expect(flagged(project, "const m = await import(path);")).toBe(1);
  });

  it("app/ bleibt die Spitze: von aussen gesperrt, innen nur relativ", () => {
    expect(flagged("src/server/a.ts", `import { gate } from "../app/api/chat/gate";`)).toBe(1);
    expect(flagged("src/app/api/chat/route.ts", `import { gate } from "@/app/api/chat/gate";`)).toBe(1);
    expect(flagged("src/app/api/chat/route.ts", `import { gate } from "./gate";`)).toBe(0);
  });

  it("lässt erlaubte Richtungen, Pakete, Kommentare und Zeichenketten durch", () => {
    for (const text of [
      `import { y } from "./y";`,
      `import { cn } from "@/shared/lib/cn";`,
      `import { useState } from "react";`,
      `import { helper } from "@tests/support/helper";`,
      `// import { y } from "@/features/chat/lib/y";`,
      `const hint = "@/features/chat/lib/y";`,
    ]) {
      expect(flagged(project, text), text).toBe(0);
    }
  });
});
