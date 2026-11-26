import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { lineOf, parse, walk } from "./parse-source";

// Die Seiten der eingeloggten App fragen den Auth-Server nicht selbst nach dem Nutzer. getSessionUser()
// (server/session.ts) tut das höchstens einmal je Anfrage, und Layout und Seite teilen sich die Antwort: ein eigener
// Aufruf von auth.getUser() wäre bei jedem Seitenaufbau ein Netzaufruf mehr. Gemeldet wird jeder Zugriff auf eine
// Eigenschaft getUser, auch über einen Alias, mit eckigen Klammern oder per Zerlegung. Den Quelltext liest der Parser
// (parse-source.ts): ein getUser im Kommentar oder in einer Zeichenkette zählt nicht.

const ROOT = process.cwd();
const APP = "src/app/(app)";

/** Der Name der Eigenschaft, auf die ein Knoten zugreift: `a.name`, `a["name"]` oder `const { name } = a`. */
function accessedProperty(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
  }
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const name = node.propertyName ?? node.name;
    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;
  }
  return null;
}

function authCallsIn(file: string, text?: string): string[] {
  const found: string[] = [];
  walk(parse(file, text), (node) => {
    if (accessedProperty(node) === "getUser") found.push(`${file}:${lineOf(node)}`);
  });
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = relative(ROOT, join(ROOT, dir, entry.name)).replace(/\\/g, "/");
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Nutzer der eingeloggten Seiten", () => {
  const files = sourceFiles(APP);

  it("liest die Seiten und das Layout", () => {
    // Ein Guard, der nichts findet, sähe grün aus, egal was die Seiten tun.
    expect(files.length).toBeGreaterThan(10);
    expect(files).toEqual(expect.arrayContaining([`${APP}/layout.tsx`, `${APP}/settings/page.tsx`, `${APP}/usage/page.tsx`]));
  });

  it("keine Datei fragt den Auth-Server selbst, alle nehmen getSessionUser()", () => {
    const offenders = files.flatMap((file) => authCallsIn(file));
    expect(
      offenders,
      "Diese Stellen rufen getUser() selbst auf, also einen Netzaufruf mehr je Seitenaufbau. getSessionUser() aus " +
        "@/server/session nehmen:\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });
});

describe("Nutzer der eingeloggten Seiten: der Scanner", () => {
  const FILE = `${APP}/x/page.tsx`;
  const hits = (text: string) => authCallsIn(FILE, text).length;

  it.each([
    ["direkt", "await supabase.auth.getUser();"],
    ["mit eigenem Client", "const { data } = await (await createClient()).auth.getUser();"],
    ["über einen Alias", "const auth = supabase.auth; await auth.getUser();"],
    ["mit Fragezeichen", "await supabase.auth?.getUser();"],
    ["mit eckigen Klammern", 'await supabase["auth"]["getUser"]();'],
    ["ohne Aufruf", "const read = supabase.auth.getUser;"],
    ["per Zerlegung", "const { getUser } = supabase.auth; await getUser();"],
    ["per Zerlegung unter anderem Namen", "const { auth: { getUser: read } } = supabase;"],
  ])("meldet den Aufruf %s", (_name, text) => {
    expect(hits(text)).toBe(1);
  });

  it("lässt getSessionUser, getUserById, Kommentare und Zeichenketten durch", () => {
    expect(
      hits(
        [
          `const user = await getSessionUser();`,
          `await admin.auth.admin.getUserById(user.id);`,
          `// await supabase.auth.getUser()`,
          `const hint = "supabase.auth.getUser()";`,
        ].join("\n")
      )
    ).toBe(0);
  });
});
