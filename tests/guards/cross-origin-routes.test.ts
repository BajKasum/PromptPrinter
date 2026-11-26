import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { NextRequest } from "next/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { CROSS_ORIGIN_API_ROUTES } from "@/server/security/request-origin";
import { bindingNames, parse } from "./parse-source";

// Jede ändernde API-Route steht unter der Herkunftsprüfung der Middleware, ohne selbst etwas dafür zu tun.
// Der Guard liest die Routen aus dem Quellbaum und schickt jede Methode als fremde Anfrage durch die echte
// Middleware: eine neue Route ist von selbst geschützt, und eine Lücke (Pfadprüfung, Ausnahmeliste) schlägt
// hier an. Eine Ausnahme ist eine Entscheidung: der letzte Test nennt die Liste wörtlich.
//
// Welche Methoden eine Route ausgibt, liest der Parser (parse-source.ts): jede Schreibweise eines Exports zählt,
// ein Kommentar nicht. Bei `export * from` sieht der Guard nicht hinein und prüft alle vier.

const UNSAFE = ["POST", "PUT", "PATCH", "DELETE"];

const exported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Die ändernden Methoden, die eine Route ausgibt: als Funktion, Konstante (auch zerlegt), Liste oder Re-Export. */
function unsafeMethods(text: string): string[] {
  const names = new Set<string>();
  for (const statement of parse("route.ts", text).statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name && exported(statement)) {
      names.add(statement.name.text);
    } else if (ts.isVariableStatement(statement) && exported(statement)) {
      for (const declaration of statement.declarationList.declarations) bindingNames(declaration.name).forEach((n) => names.add(n));
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const clause = statement.exportClause;
      if (!clause) UNSAFE.forEach((method) => names.add(method));
      else if (ts.isNamespaceExport(clause)) names.add(clause.name.text);
      else clause.elements.filter((e) => !e.isTypeOnly).forEach((e) => names.add(e.name.text));
    }
  }
  return UNSAFE.filter((method) => names.has(method));
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

const API_ROOT = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

const unsafeRoutes = routeFiles(API_ROOT).flatMap((file) => {
  const methods = unsafeMethods(readFileSync(file, "utf8"));
  const segments = relative(API_ROOT, file).replaceAll("\\", "/").replace(/\/?route\.ts$/, "");
  return methods.map((method) => ({ method, path: `/api/${segments.replace(/\[[^\]]+\]/g, "x")}` }));
});

describe("Herkunftsprüfung der API-Routen", () => {
  it("findet die ändernden Routen", () => {
    expect(unsafeRoutes.length).toBeGreaterThan(10);
  });

  it("weist jede ändernde Route ausserhalb der Ausnahmen bei fremder Herkunft ab", async () => {
    const exempt = new Set<string>(CROSS_ORIGIN_API_ROUTES);
    for (const { method, path } of unsafeRoutes.filter((route) => !exempt.has(route.path))) {
      const res = await middleware(
        new NextRequest(new URL(`https://promptprinter.app${path}`), {
          method,
          headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
        })
      );
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("die Ausnahmen sind genau diese vier, und jede ist eine echte Route", () => {
    expect([...CROSS_ORIGIN_API_ROUTES].sort()).toEqual([
      "/api/cli/device",
      "/api/cli/logout",
      "/api/cli/refresh",
      "/api/cli/token",
    ]);
    const known = new Set(unsafeRoutes.map((route) => route.path));
    for (const path of CROSS_ORIGIN_API_ROUTES) expect(known.has(path), path).toBe(true);
  });
});

describe("Herkunftsprüfung: der Scanner", () => {
  it("findet jede Schreibweise einer ändernden Methode", () => {
    expect(unsafeMethods("export async function POST() {}")).toEqual(["POST"]);
    expect(unsafeMethods("export const PATCH = handler;")).toEqual(["PATCH"]);
    expect(unsafeMethods("export function PUT() {}")).toEqual(["PUT"]);
    expect(unsafeMethods(`export { POST } from "./handlers";`)).toEqual(["POST"]);
    expect(unsafeMethods("const handler = () => null;\nexport { handler as DELETE };")).toEqual(["DELETE"]);
    expect(unsafeMethods("export const { POST, DELETE } = handlers;")).toEqual(["POST", "DELETE"]);
    expect(unsafeMethods(`export * from "./handlers";`)).toEqual(UNSAFE);
  });

  it("lässt lesende Methoden, Typen, Kommentare und Funktionen ohne Export aus", () => {
    expect(unsafeMethods("export async function GET() {}")).toEqual([]);
    expect(unsafeMethods("// export async function POST() {}")).toEqual([]);
    expect(unsafeMethods(`export type { POST } from "./handlers";`)).toEqual([]);
    expect(unsafeMethods("async function POST() {}")).toEqual([]);
  });
});
