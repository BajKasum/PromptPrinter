import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { lineOf, moduleReferences, parse, resolveModule, walk } from "./parse-source";

// Testcode gehört nicht in den Produktivbaum: Test-Helfer liegen unter tests/ (Alias @tests, vitest.config.ts), und
// keine Datei unter src/ holt etwas von dort.
//
// Wo ein Modul einen Test seinen Zustand zurücksetzen, schreiben oder lesen lässt, heißt der Export `__…ForTests`.
// Dahinter hängen Kostenbremsen (Gratis-Rahmen, Leistungsschalter des Failovers). Der Name allein hindert niemanden am
// Aufruf, deshalb darf er außerhalb von Testdateien nur an seiner Deklaration stehen: kein Import, kein Re-Export,
// kein Zugriff über ein Modulobjekt, auch nicht im Modul selbst.
//
// Gelesen wird mit dem Parser (parse-source.ts): Kommentare zählen nicht.
const ROOT = process.cwd();
const TEST_ONLY_NAME = /^__\w+ForTests$/;
const TEST_FILE = /\.test\.tsx?$/;

/** Die Zeilen, an denen die Datei einen `__…ForTests`-Namen benutzt, statt ihn zu deklarieren. */
function testOnlyUses(file: string, text?: string): number[] {
  const lines: number[] = [];
  walk(parse(file, text), (node) => {
    if (!(ts.isIdentifier(node) || ts.isStringLiteralLike(node)) || !TEST_ONLY_NAME.test(node.text)) return;
    const { parent } = node;
    const declares = (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name === node;
    if (!declares) lines.push(lineOf(node));
  });
  return lines;
}

/** Die Zeilen, an denen die Datei ein Modul unter tests/ nennt. */
function testTreeImports(file: string, text?: string): number[] {
  return moduleReferences(parse(file, text))
    .filter((ref) => ref.specifier !== null && /^tests(?:\/|$)/.test(resolveModule(file, ref.specifier) ?? ""))
    .map((ref) => ref.line);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|mts|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const productionFiles = sourceFiles(join(ROOT, "src"))
  .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
  .filter((file) => !TEST_FILE.test(file));

const offenders = (find: (file: string) => number[]) =>
  productionFiles.flatMap((file) => find(file).map((line) => `${file}:${line}`));

describe("Testcode im Produktivbaum", () => {
  it("außerhalb von Testdateien benutzt niemand einen __…ForTests-Namen", () => {
    expect(productionFiles.length).toBeGreaterThan(300);

    const found = offenders(testOnlyUses);

    expect(
      found,
      `Diese Stellen benutzen einen Export, der nur für Tests da ist. Er setzt Zustand zurück oder liest ihn, ` +
        `am Ablauf vorbei; Produktivcode braucht einen eigenen Weg:\n  ${found.join("\n  ")}`
    ).toEqual([]);
  });

  it("keine Datei unter src/ holt etwas aus tests/", () => {
    const found = offenders(testTreeImports);

    expect(found, `Diese Stellen holen Testcode in den Produktivbaum:\n  ${found.join("\n  ")}`).toEqual([]);
  });

  it("sieht jede Schreibweise eines Zugriffs auf einen __…ForTests-Namen", () => {
    for (const text of [
      `import { __resetXForTests } from "./x";`,
      `import { __resetXForTests as reset } from "./x";`,
      `export { __resetXForTests } from "./x";`,
      `const { __resetXForTests } = await import("./x");`,
      `const reset = (await import("./x")).__resetXForTests;`,
      `import * as x from "./x";\nx.__resetXForTests();`,
      `import * as x from "./x";\nx["__resetXForTests"]();`,
      `export function __resetXForTests() {}\n__resetXForTests();`,
    ]) {
      expect(testOnlyUses("src/server/a.ts", text), text).toHaveLength(1);
    }
  });

  it("lässt die Deklaration, Kommentare und andere Namen durch", () => {
    for (const text of [
      `export function __resetXForTests(): void {}`,
      `export async function __resetXForTests() {}`,
      `export const __resetXForTests = () => {};`,
      `// __resetXForTests() setzt den Zustand zurück.`,
      `/** Siehe {@link __resetXForTests}. */\nexport const a = 1;`,
      `export function resetForTestsLater() {}\nresetForTestsLater();`,
    ]) {
      expect(testOnlyUses("src/server/a.ts", text), text).toEqual([]);
    }
  });

  it("sieht einen Import aus tests/, über den Alias wie über einen relativen Pfad", () => {
    for (const text of [
      `import { counterRedisDouble } from "@tests/support/redis-double";`,
      `import { counterRedisDouble } from "../../tests/support/redis-double";`,
      `const m = await import("@tests/support/redis-double");`,
      `import type { X } from "@tests/support/x";`,
    ]) {
      expect(testTreeImports("src/server/a.ts", text), text).toHaveLength(1);
    }
    for (const text of [`import { a } from "./tests";`, `import { b } from "@/shared/lib/tests/b";`]) {
      expect(testTreeImports("src/server/a.ts", text), text).toEqual([]);
    }
  });
});
