import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { lineOf, parse, walk } from "./parse-source";

// Ein Sicherheitsprotokoll, in dem eine Absage fehlt, sieht vollständig aus und ist es nicht. Der Guard liest die Routen,
// die Konten, Keys und fremde Kennungen berühren: jede 401, 403 und 404 läuft durch denied() (server/security/security-log.ts).
// Ausserdem: jedes Ereignis, das bleiben soll, hat eine Stelle, die es schreibt.
//
// Die Aufrufe liest der Parser (parse-source.ts): ein `problem(` über mehrere Zeilen zählt wie eines auf einer, ein
// Status hinter einer Bedingung mit beiden Werten, ein Kommentar nicht. Ein Status, der sich nicht ablesen lässt,
// zählt als Absage.

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
  "src/app/api/cli/sessions/route.ts",
  "src/app/api/auth/mfa/route.ts",
  "src/app/api/cli/me/route.ts",
  "src/app/api/cli/prompts/route.ts",
  "src/app/api/cli/prompts/[id]/route.ts",
  "src/app/api/cli/refresh/route.ts",
  "src/app/api/cli/logout/route.ts",
];

const DENIALS = new Set([401, 403, 404]);

const calls = (node: ts.Node, name: string) =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;

/** Die Werte, die ein Status annehmen kann; `null`, wenn er sich nicht ablesen lässt. */
function statusesOf(expression: ts.Expression | undefined): number[] | null {
  if (!expression) return null;
  if (ts.isParenthesizedExpression(expression)) return statusesOf(expression.expression);
  if (ts.isNumericLiteral(expression)) return [Number(expression.text)];
  if (ts.isConditionalExpression(expression)) {
    const [whenTrue, whenFalse] = [statusesOf(expression.whenTrue), statusesOf(expression.whenFalse)];
    return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : null;
  }
  return null;
}

function insideDenied(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) if (calls(parent, "denied")) return true;
  return false;
}

/** Die Absagen einer Datei, die nicht durch denied() laufen, mit Zeile. */
function bareDenials(file: string, text?: string): string[] {
  const found: string[] = [];
  walk(parse(file, text), (node) => {
    if (!ts.isCallExpression(node) || !calls(node, "problem")) return;
    const statuses = statusesOf(node.arguments[0]);
    if (statuses && !statuses.some((status) => DENIALS.has(status))) return;
    if (!insideDenied(node)) found.push(`Zeile ${lineOf(node)}: ${node.getText().replace(/\s+/g, " ").slice(0, 100)}`);
  });
  return found;
}

function callsDenied(file: string): boolean {
  let found = false;
  walk(parse(file), (node) => {
    if (calls(node, "denied")) found = true;
  });
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Absagen im Sicherheitsprotokoll", () => {
  it.each(ROUTES)("%s: jede 401, 403 und 404 läuft durch denied()", (path) => {
    expect(bareDenials(path), "Diese Absagen fehlen im Protokoll").toEqual([]);
  });

  it("die Liste der Routen ist nicht veraltet", () => {
    for (const path of ROUTES) expect(callsDenied(path), path).toBe(true);
  });

  it("der Scanner sieht eine Absage über mehrere Zeilen, hinter einer Bedingung und mit unbekanntem Status", () => {
    expect(bareDenials("route.ts", "return problem(\n  403,\n  m.limit\n);")).toHaveLength(1);
    expect(bareDenials("route.ts", "return problem(missing ? 404 : 400, m.x);")).toHaveLength(1);
    expect(bareDenials("route.ts", "return problem(status, m.x);")).toHaveLength(1);
  });

  it("der Scanner lässt Absagen in denied(), andere Statuscodes und Kommentare durch", () => {
    expect(bareDenials("route.ts", `return denied("x", problem(\n  401,\n  m.x\n));`)).toEqual([]);
    expect(bareDenials("route.ts", "return problem(400, m.x);")).toEqual([]);
    expect(bareDenials("route.ts", "return problem(tooLarge ? 413 : 400, m.x);")).toEqual([]);
    expect(bareDenials("route.ts", "// return problem(401, m.x);")).toEqual([]);
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
