import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Die Spaltennamen der Abfragen prüft der Typprüfer gegen src/shared/supabase/database.types.ts. Das hält nur, solange
// jede Fabrik den Typ `Database` trägt und niemand das Ergebnis behauptet: `.maybeSingle<T>()` ersetzt den erkannten
// Zeilentyp, ein falscher Spaltenname fiele dann wieder erst zur Laufzeit auf.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Typisierte Supabase-Zugriffe", () => {
  it("jede Fabrik trägt den Typ Database", () => {
    const server = read("src/server/supabase/server.ts");
    expect(server).toContain("createServerClient<Database>(");
    expect(server).toContain("createTokenClient<Database>(");
    expect(read("src/server/supabase/admin.ts")).toContain("createClient<Database>(");
    expect(read("src/shared/supabase/client.ts")).toContain("createBrowserClient<Database>(");
  });

  it("kein Aufruf behauptet seinen Zeilentyp", () => {
    const claims = sourceFiles("src").flatMap((file) => {
      const path = relative(ROOT, join(ROOT, file)).replace(/\\/g, "/");
      return /\.(maybeSingle|single|returns)<|\.overrideTypes</.test(read(path)) ? [path] : [];
    });
    expect(claims, "Den Typparameter entfernen, der Zeilentyp ergibt sich aus select()").toEqual([]);
  });
});
