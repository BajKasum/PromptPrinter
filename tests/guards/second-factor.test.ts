import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse, walk } from "./parse-source";

// Die Aktionen, die bei eingerichtetem Faktor AAL2 verlangen, stehen in drei Dateien. Fällt die Prüfung aus einer heraus, sieht
// alles normal aus, solange man nicht gerade auf AAL1 arbeitet. Die Tests der Routen prüfen das Verhalten, dieser Guard hält
// fest, dass die Prüfung vor der Arbeit steht und die Tabelle der Codes dem Server gehört.

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const DIR = join(process.cwd(), "supabase", "migrations");
const migration = readdirSync(DIR).find((name) => name.endsWith("_mfa_recovery_codes.sql"));

function sql(): string {
  expect(migration, "Migration der Wiederherstellungscodes fehlt").toBeTruthy();
  return readFileSync(join(DIR, migration!), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("AAL2 vor den heiklen Aktionen", () => {
  it.each([
    ["src/app/api/account/route.ts", 1],
    ["src/app/api/settings/api-key/route.ts", 1],
    ["src/app/api/cli/approve/route.ts", 1],
  ])("%s prüft %i-mal", (path, times) => {
    expect(read(path).match(/await lacksSecondFactor\(supabase, user\)/g)).toHaveLength(times);
    expect(read(path).match(/code: "aal2_required"/g)).toHaveLength(times);
  });

  it("das Konto wird erst nach der Prüfung angefasst", () => {
    const source = read("src/app/api/account/route.ts");
    const check = source.indexOf("await lacksSecondFactor(supabase, user)");
    const deleteUser = source.indexOf("admin.auth.admin.deleteUser(");
    const removeObjects = source.indexOf("await removeAccountObjects(");
    expect(check).toBeGreaterThan(-1);
    // Jeder Schritt steht genau einmal da, sonst sagt seine Stelle nichts.
    expect(source.split("admin.auth.admin.deleteUser(")).toHaveLength(2);
    expect(source.split("await removeAccountObjects(")).toHaveLength(2);
    // Der erste unumkehrbare Schritt ist das Löschen des Kontos; die Dateien gehen erst, wenn es gelungen ist (#380).
    expect(deleteUser).toBeGreaterThan(check);
    expect(removeObjects).toBeGreaterThan(deleteUser);
  });
});

// Die Schlüssel-Route prüft an einer Stelle, requireKeyOwner. Das trägt nur, wenn jede ihrer Methoden dort anfängt,
// die Absage sofort zurückgibt und vorher weder den Rumpf liest noch Datenbank oder Admin-Client anfasst. Gelesen wird
// mit dem Parser: die Stellung der Aufrufe im Text der Datei sagt bei einer Hilfsfunktion nichts.
const KEY_ROUTE = "src/app/api/settings/api-key/route.ts";
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/** Mehr ruft eine Methode vor der Prüfung nicht auf: Sprache, Anbieter aus der Adresse und dessen Absage. */
const CALLS_BEFORE_OWNER = new Set(["requestT", "URL", "new URL(req.url).searchParams.get", "PROVIDERS.includes", "problem"]);

type Handler = { name: string; body: ts.Block | null };

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

/** Jede exportierte HTTP-Methode. `body` ist null, wo kein Rumpf zu lesen ist (Wrapper, Re-Export). */
function handlers(source: ts.SourceFile): Handler[] {
  const found: Handler[] = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (!clause || !ts.isNamedExports(clause)) found.push({ name: statement.getText(), body: null });
      else {
        for (const { name } of clause.elements) {
          if (HTTP_METHODS.has(name.text)) found.push({ name: name.text, body: null });
        }
      }
    }
    if (!isExported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && HTTP_METHODS.has(statement.name?.text ?? "")) {
      found.push({ name: statement.name!.text, body: statement.body ?? null });
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const { name, initializer } of statement.declarationList.declarations) {
      if (!HTTP_METHODS.has(name.getText())) continue;
      const isFunction = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
      found.push({ name: name.getText(), body: isFunction && ts.isBlock(initializer.body) ? initializer.body : null });
    }
  }
  return found;
}

const isCallOf = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && node.expression.getText() === name;

/** Der Name aus `const name = await requireKeyOwner(…)`, sonst null. */
function ownerBinding(statement: ts.Statement): string | null {
  if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) return null;
  const [{ name, initializer }] = statement.declarationList.declarations;
  if (!initializer || !ts.isAwaitExpression(initializer)) return null;
  return isCallOf(initializer.expression, "requireKeyOwner") && ts.isIdentifier(name) ? name.text : null;
}

/** Die Anweisung, die nur zurückgibt, auch in geschweiften Klammern. */
function onlyReturn(statement: ts.Statement): ts.ReturnStatement | null {
  const inner = ts.isBlock(statement) && statement.statements.length === 1 ? statement.statements[0] : statement;
  return ts.isReturnStatement(inner) ? inner : null;
}

const returnsRefusal = (statement: ts.Statement | undefined, owner: string) =>
  statement !== undefined &&
  ts.isIfStatement(statement) &&
  !statement.elseStatement &&
  statement.expression.getText() === `${owner} instanceof Response` &&
  onlyReturn(statement.thenStatement)?.expression?.getText() === owner;

/** Was eine Anweisung vor der Prüfung nicht darf: warten, anderes aufrufen, mehr von der Anfrage lesen als die Adresse. */
function forbiddenBeforeOwner(statement: ts.Statement): string[] {
  const found: string[] = [];
  walk(statement, (node) => {
    if (ts.isAwaitExpression(node) && !isCallOf(node.expression, "requireKeyOwner")) found.push(node.getText());
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && !isCallOf(node, "requireKeyOwner")) {
      if (!CALLS_BEFORE_OWNER.has(node.expression.getText())) found.push(node.getText());
    }
    if (ts.isIdentifier(node) && node.text === "req") {
      const { parent } = node;
      const language = isCallOf(parent, "requestT");
      const address = ts.isPropertyAccessExpression(parent) && parent.name.text === "url";
      if (!language && !address) found.push(parent.getText());
    }
  });
  return found;
}

/** Je Methode, die nicht mit der Prüfung beginnt, der Grund. */
function ownerCheckFaults(text?: string): string[] {
  return handlers(parse(KEY_ROUTE, text)).flatMap(({ name, body }) => {
    if (!body) return [`${name}: kein Funktionsrumpf zum Prüfen`];
    const statements = [...body.statements];
    const at = statements.findIndex((statement) => ownerBinding(statement) !== null);
    if (at < 0) return [`${name}: wartet nicht auf requireKeyOwner()`];
    if (!returnsRefusal(statements[at + 1], ownerBinding(statements[at])!)) {
      return [`${name}: gibt die Absage von requireKeyOwner() nicht sofort zurück`];
    }
    const early = statements.slice(0, at + 1).flatMap(forbiddenBeforeOwner);
    return early.length > 0 ? [`${name}: vor der Prüfung ${early.join(", ")}`] : [];
  });
}

/** Ob die Anweisung mit `problem(status, …)` zurückgibt, bei `code` auch mit diesem Feld. */
function refusesWith(statement: ts.Statement, status: string, code?: string): boolean {
  let found = false;
  const returned = onlyReturn(statement);
  if (returned) {
    walk(returned, (node) => {
      if (!isCallOf(node, "problem") || node.arguments[0]?.getText() !== status) return;
      if (!code || node.arguments[2]?.getText().includes(`code: "${code}"`)) found = true;
    });
  }
  return found;
}

/** Was requireKeyOwner schuldig bleibt: erst die Sitzung (401), dann genau eine AAL2-Prüfung mit 403. */
function aal2Faults(text?: string): string[] {
  const source = parse(KEY_ROUTE, text);
  const helper = source.statements
    .filter(ts.isFunctionDeclaration)
    .find((fn) => fn.name?.text === "requireKeyOwner");
  if (!helper?.body) return ["requireKeyOwner fehlt"];

  let calls = 0;
  walk(source, (node) => {
    if (isCallOf(node, "lacksSecondFactor")) calls++;
  });
  const statements = [...helper.body.statements];
  const session = statements.findIndex(
    (s) => ts.isIfStatement(s) && s.expression.getText() === "!user" && refusesWith(s.thenStatement, "401")
  );
  const factor = statements.findIndex(
    (s) =>
      ts.isIfStatement(s) &&
      ts.isAwaitExpression(s.expression) &&
      isCallOf(s.expression.expression, "lacksSecondFactor") &&
      refusesWith(s.thenStatement, "403", "aal2_required")
  );

  const faults: string[] = [];
  if (calls !== 1) faults.push(`lacksSecondFactor steht ${calls}-mal in der Datei`);
  if (session < 0) faults.push("keine Absage 401 ohne Sitzung");
  if (factor < 0) faults.push("keine Absage 403 aal2_required auf await lacksSecondFactor()");
  else if (factor < session) faults.push("der zweite Faktor wird vor der Sitzung geprüft");
  // Vor der AAL2-Prüfung verlässt nur die Absage ohne Sitzung die Funktion.
  statements.slice(0, Math.max(factor, 0)).forEach((statement, index) => {
    if (index === session) return;
    walk(statement, (node) => {
      if (ts.isReturnStatement(node)) faults.push(`Ausgang vor der Prüfung: ${node.getText()}`);
    });
  });
  return faults;
}

describe("Schlüssel-Route: jede Methode beginnt mit requireKeyOwner", () => {
  it("prüft in requireKeyOwner nach der Sitzung genau einmal den zweiten Faktor", () => {
    expect(aal2Faults()).toEqual([]);
  });

  it("gilt für jede exportierte Methode", () => {
    expect(handlers(parse(KEY_ROUTE)).map((handler) => handler.name).sort()).toEqual(["DELETE", "PATCH", "POST"]);
    expect(ownerCheckFaults()).toEqual([]);
  });

  const handler = (lines: string) => `export async function PUT(req: Request) {
  const m = requestT(req).t.api;
  ${lines}
}`;
  const checked = `const owner = await requireKeyOwner(m);
  if (owner instanceof Response) return owner;`;

  it("lässt eine Methode durch, die erst prüft und dann liest", () => {
    expect(ownerCheckFaults(handler(`${checked}\n  await readBody(req, m);`))).toEqual([]);
  });

  it.each([
    ["ohne Prüfung", handler("return NextResponse.json({});")],
    ["als Konstante ohne Prüfung", "export const GET = async () => { return NextResponse.json({}); };"],
    ["als Wrapper", "export const GET = withOwner(list);"],
    ["als Re-Export", 'export { list as GET } from "./list";'],
    ["als Sammel-Export", 'export * from "./handlers";'],
    ["ohne sofortige Rückgabe", handler("const owner = await requireKeyOwner(m);\n  await readBody(req, m);")],
    ["mit Rumpf vor der Prüfung", handler(`const read = await readBody(req, m);\n  ${checked}`)],
    ["mit req.json() vor der Prüfung", handler(`const body = req.json();\n  ${checked}`)],
    ["mit Datenbank vor der Prüfung", handler(`const rows = admin.from("user_api_keys");\n  ${checked}`)],
    ["mit der Anfrage als Argument der Prüfung", handler(`const owner = await requireKeyOwner(req);\n  if (owner instanceof Response) return owner;`)],
    ["mit Prüfung nur in einem Zweig", handler(`if (m) {\n  ${checked}\n  }`)],
  ])("meldet eine Methode %s", (_label, source) => {
    expect(ownerCheckFaults(source)).toHaveLength(1);
  });

  const helper = (lines: string) => `async function requireKeyOwner(m) {
  ${lines}
  return { supabase, user };
}`;
  const session = 'if (!user) return denied("api_key", problem(401, m.x));';
  const factor =
    'if (await lacksSecondFactor(supabase, user)) { return denied("api_key", problem(403, m.x, { code: "aal2_required" })); }';

  it("lässt den Helfer in der richtigen Reihenfolge durch", () => {
    expect(aal2Faults(helper(`${session}\n  ${factor}`))).toEqual([]);
  });

  it.each([
    ["ohne Faktor-Prüfung", helper(session)],
    ["mit verneinter Prüfung", helper(`${session}\n  ${factor.replace("(await ", "(!await ")}`)],
    ["mit der Prüfung vor der Sitzung", helper(`${factor}\n  ${session}`)],
    ["ohne Code aal2_required", helper(`${session}\n  ${factor.replace("aal2_required", "x")}`)],
    ["mit Ausgang vor der Prüfung", helper(`${session}\n  if (m.admin) return { supabase, user };\n  ${factor}`)],
  ])("meldet den Helfer %s", (_label, source) => {
    expect(aal2Faults(source)).not.toEqual([]);
  });
});

describe("Migration der Wiederherstellungscodes", () => {
  it("hält die Tabelle für den Browser zu", () => {
    const text = sql();
    expect(text).toMatch(/alter table public\.mfa_recovery_codes enable row level security/i);
    expect(text).toMatch(/revoke all on public\.mfa_recovery_codes from anon, authenticated/i);
    expect(text).toMatch(/for all to anon, authenticated\s+using \(false\)\s+with check \(false\)/i);
    expect(text).not.toMatch(/^grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/gim);
  });

  it("speichert nur einen Hash und räumt mit dem Konto auf", () => {
    const text = sql();
    expect(text).toMatch(/code_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
    expect(text).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(text).not.toMatch(/\bcode text\b/i);
  });
});

describe("lokaler Stack", () => {
  it("schaltet TOTP ausdrücklich ein", () => {
    const config = read("supabase/config.toml");
    expect(config).toMatch(/\[auth\.mfa\.totp\]\s+enroll_enabled = true\s+verify_enabled = true/);
  });
});
