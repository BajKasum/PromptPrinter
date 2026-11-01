import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md wird zu Beginn jeder Sitzung geladen und gilt als Stand der Technik. Was sich aus dem
// Repo nachzählen lässt, darf dort nicht veralten. Ob eine Migration auf Produktion liegt, sieht
// dieser Test nicht, das braucht die Datenbank.
const root = process.cwd();

describe("CLAUDE.md, IST-Zustand", () => {
  const text = readFileSync(join(root, "CLAUDE.md"), "utf8");

  it("nennt die höchste Migration, die im Repo liegt", () => {
    const numbers = readdirSync(join(root, "supabase/migrations"))
      .map((f) => f.match(/^(\d{4})_/)?.[1])
      .filter((n): n is string => Boolean(n))
      .sort();
    const highest = numbers[numbers.length - 1];
    expect(text).toContain(`Migrationen 0001 bis ${highest} in`);
  });

  it("zählt keine Testdateien im Text", () => {
    expect(text).not.toMatch(/\d+ Testdateien/);
  });
});
