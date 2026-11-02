import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Ein Sicherheitsprotokoll, in dem eine Absage fehlt, sieht vollständig aus und ist es nicht. Der Guard liest die Routen,
// die Konten, Keys und fremde Kennungen berühren: jede 401, 403 und 404 läuft durch denied() (server/security/security-log.ts).
// Ausserdem: jedes Ereignis, das bleiben soll, hat eine Stelle, die es schreibt.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const ROUTES = [
  "src/app/api/account/route.ts",
  "src/app/api/account/export/route.ts",
  "src/app/api/settings/api-key/route.ts",
  "src/app/api/consent/zai/route.ts",
  "src/app/api/projects/route.ts",
  "src/app/api/projects/[id]/brain/route.ts",
  "src/app/api/projects/[id]/brain/status/route.ts",
  "src/app/api/chat/gate.ts",
  "src/app/api/cli/approve/route.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Absagen im Sicherheitsprotokoll", () => {
  it.each(ROUTES)("%s: jede 401, 403 und 404 läuft durch denied()", (path) => {
    const bare = read(path)
      .split("\n")
      .filter((line) => /\bproblem\((401|403|404)\b/.test(line) && !/\bdenied\(/.test(line));
    expect(bare, "Diese Absagen fehlen im Protokoll").toEqual([]);
  });

  it("die Liste der Routen ist nicht veraltet", () => {
    for (const path of ROUTES) expect(read(path), path).toMatch(/\bdenied\(/);
  });
});

describe("Ereignisse, die bleiben müssen", () => {
  const declared = [...read("src/server/security/security-events.ts").matchAll(/^\s*\| "([a-z_]+\.[a-z_]+)";?$/gm)].map(
    (m) => m[1]
  );
  const callers = sourceFiles("src")
    .filter((file) => !file.replaceAll("\\", "/").endsWith("security/security-events.ts"))
    .map((file) => readFileSync(join(ROOT, file), "utf8"))
    .join("\n");

  it("nennt mindestens die Vorgänge aus dem Audit", () => {
    expect(declared).toEqual(
      expect.arrayContaining(["api_key.saved", "api_key.removed", "consent.zai_withdrawn", "account.deleted"])
    );
  });

  it.each(["api_key.saved", "api_key.activated", "api_key.removed", "consent.zai_granted", "consent.zai_withdrawn", "account.deleted"])(
    "%s wird irgendwo geschrieben",
    (event) => {
      expect(callers).toContain(`"${event}"`);
    }
  );

  it("jedes erklärte Ereignis hat eine Stelle, die es schreibt", () => {
    const unused = declared.filter((event) => !callers.includes(`"${event}"`));
    expect(unused).toEqual([]);
  });
});
