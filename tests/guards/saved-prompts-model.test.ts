import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Datenmodell der gespeicherten Prompts (#140, Migration 0049).
//
// Die Tabelle hieß `generations`, solange es eine Generierungs-Pipeline gab. Sie heißt
// `saved_prompts`, und die Reste der Pipeline (Spalten, `projects.status`, der Plan `team`)
// sind weg. Ohne diesen Guard schliche der alte Name über eine kopierte Abfrage zurück, und
// die Abfrage liefe dann in Produktion gegen eine Tabelle, die es nicht mehr gibt.

const SRC = join(__dirname, "..", "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  path: path.slice(SRC.length + 1).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

describe("Datenmodell der gespeicherten Prompts", () => {
  it("nennt die Tabelle nirgends mehr `generations`", () => {
    const offenders = files
      .filter(({ text }) => /["'`]generations["'`]/.test(text))
      .map(({ path }) => path);
    expect(offenders, "Diese Dateien fragen `generations` ab:\n  " + offenders.join("\n  ")).toEqual([]);
  });

  it("liest keine Spalte der alten Pipeline aus saved_prompts", () => {
    const offenders = files
      .filter(({ text }) => /saved_prompts[\s\S]{0,400}\b(tokens_in|tokens_out|latency_ms)\b/.test(text))
      .map(({ path }) => path);
    expect(offenders, offenders.join("\n  ")).toEqual([]);
  });

  // Eine Spaltenliste ist eine Zeichenkette, der Typprüfer sieht sie nicht: `getProject()` forderte
  // `status` noch an, als die Spalte schon weg war, und die Projektseite lud nicht mehr (der
  // Browser-Test in der CI fand es, kein Unit-Test mit gemocktem Supabase).
  it("fordert `projects.status` nirgends mehr an", () => {
    const offenders = files
      .filter(({ text }) => /from\(\s*["']projects["']\s*\)[\s\S]{0,300}?\.select\(\s*["'`][^"'`]*\bstatus\b/.test(text))
      .map(({ path }) => path);
    expect(offenders, "Diese Dateien lesen `projects.status`:\n  " + offenders.join("\n  ")).toEqual([]);

    const project = files.find(({ path }) => path === "server/project.ts")!.text;
    expect(project).not.toMatch(/\bstatus\b/);
  });

  it("kennt nur die Pläne free und pro", () => {
    const plans = files.find(({ path }) => path === "shared/lib/plans.ts")!.text;
    expect(plans).toMatch(/export type PlanKey = "free" \| "pro";/);
    expect(plans).not.toMatch(/\bteam\b/);
  });
});
