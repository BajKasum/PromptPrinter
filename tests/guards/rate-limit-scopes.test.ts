import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// #147: Upstash bildet den Redis-Schlüssel aus Präfix, Kennung und Zeitfenster, die Obergrenze gehört
// nicht dazu. Zwei Routen mit demselben Schlüssel zählen in denselben Zähler und vergleichen ihn nur
// mit ihrer eigenen Grenze: fünf Chat-Antworten sperrten so Datenexport und Konto löschen (Grenze 5).
// Dieser Guard hält fest, dass jede Aktion ihren eigenen Bereich hat und keiner zweimal vorkommt.

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const files = sourceFiles("src").map((file) => ({
  path: relative(ROOT, file).replaceAll("\\", "/"),
  text: readFileSync(file, "utf8"),
}));

const SCOPE_CALL = /rateLimitKey\(\s*[A-Za-z_.]+\s*,\s*"([a-z-]+)"/g;

describe("Ratenlimit-Bereiche", () => {
  it("jede Route ruft rateLimitKey mit einem Bereich auf, und kein Bereich kommt zweimal vor", () => {
    const uses = files
      .filter((file) => file.path !== "src/server/security/rate-limit.ts")
      .flatMap((file) => [...file.text.matchAll(SCOPE_CALL)].map((m) => ({ scope: m[1], path: file.path })));

    expect(uses.length).toBeGreaterThan(0);
    const byScope = new Map<string, string[]>();
    for (const { scope, path } of uses) byScope.set(scope, [...(byScope.get(scope) ?? []), path]);
    const doubled = [...byScope].filter(([, paths]) => paths.length > 1);
    expect(doubled, "ein Bereich je Aktion, sonst teilen sich zwei Routen einen Zähler").toEqual([]);
  });

  it("jeder Bereich im Typ wird auch benutzt, und jeder benutzte steht im Typ", () => {
    const rateLimit = files.find((file) => file.path === "src/server/security/rate-limit.ts")!.text;
    const type = rateLimit.slice(rateLimit.indexOf("export type RateLimitScope"));
    const declared = [...type.slice(0, type.indexOf(";")).matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    const used = files
      .filter((file) => file.path !== "src/server/security/rate-limit.ts")
      .flatMap((file) => [...file.text.matchAll(SCOPE_CALL)].map((m) => m[1]))
      .sort();
    expect(used).toEqual(declared);
  });

  it("rateLimit() bekommt nie einen blanken Schlüssel, nur rateLimitKey(...) oder den einen globalen", () => {
    const bad: string[] = [];
    for (const file of files) {
      if (file.path === "src/server/security/rate-limit.ts") continue;
      for (const match of file.text.matchAll(/\brateLimit\(\s*([^,]+),/g)) {
        const key = match[1].trim();
        if (!key.startsWith("rateLimitKey(") && key !== '"contact:all"') bad.push(`${file.path}: ${key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
