import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { moduleReferences, parse } from "./parse-source";

// Den Upstash-Client baut nur server/security/redis-client.ts. Ein zweiter Bau entscheidet für sich, ab wann es Redis
// gibt und wie Antworten gelesen werden, und geht an den Attrappen vorbei, die den gemeinsamen ersetzen. Wer das Paket
// als Wert holt, baut oder kann bauen; `import type` bleibt frei.
//
// Gelesen wird mit dem Parser (parse-source.ts): jede Schreibweise eines Imports zählt, ein Kommentar nicht.
const ROOT = process.cwd();
const CLIENT = "src/server/security/redis-client.ts";

/** Die Zeilen, an denen die Datei etwas aus "@upstash/redis" als Wert holt. */
function upstashValueImports(file: string, text?: string): number[] {
  return moduleReferences(parse(file, text))
    .filter((ref) => !ref.typeOnly && ref.values.length > 0 && /^@upstash\/redis(?:\/|$)/.test(ref.specifier ?? ""))
    .map((ref) => ref.line);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|mts|js|jsx|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(join(ROOT, "src")).map((file) => relative(ROOT, file).replace(/\\/g, "/"));

describe("ein Upstash-Client", () => {
  it("nur redis-client.ts holt den Client aus dem Paket", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(upstashValueImports(CLIENT)).not.toEqual([]);

    const offenders = files.filter((file) => file !== CLIENT && upstashValueImports(file).length > 0);

    expect(
      offenders,
      `Diese Dateien bauen ihren eigenen Upstash-Client. Nimm redis oder rawRedis aus ${CLIENT}:\n  ` +
        offenders.join("\n  ")
    ).toEqual([]);
  });

  it("sieht jede Schreibweise, die den Wert holt", () => {
    for (const text of [
      `import { Redis } from "@upstash/redis";`,
      `import { Redis as Client } from "@upstash/redis";`,
      `import * as upstash from "@upstash/redis";`,
      `export { Redis } from "@upstash/redis";`,
      `const { Redis } = await import("@upstash/redis");`,
      `const { Redis } = require("@upstash/redis");`,
      `import { Redis } from "@upstash/redis/cloudflare";`,
    ]) {
      expect(upstashValueImports("src/server/a.ts", text), text).toHaveLength(1);
    }
  });

  it("lässt Typen, Kommentare und andere Pakete durch", () => {
    for (const text of [
      `import type { Redis } from "@upstash/redis";`,
      `import { type Redis } from "@upstash/redis";`,
      `type Client = import("@upstash/redis").Redis;`,
      `// import { Redis } from "@upstash/redis";`,
      `import { Ratelimit } from "@upstash/ratelimit";`,
    ]) {
      expect(upstashValueImports("src/server/a.ts", text), text).toEqual([]);
    }
  });
});
