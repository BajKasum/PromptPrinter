import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { lineOf, parse, resolveModule, walk } from "./parse-source";

// Hält CLAUDE.mds Regel für die Seiten der eingeloggten App fest:
//
//   "User-scoped Queries: RLS scope + zusätzlich explizit .eq("user_id", …)"
//
// RLS bleibt die eigentliche Schranke. Der Filter ist die zweite Linie für den Tag, an dem eine Policy zu weit gerät,
// etwa für geteilte Projekte: ohne ihn zeigte die Seitenleiste dann fremde Titel (#398). owner-scoped-writes.test.ts
// prüft die Schreibzugriffe aus dem Browser je Datei; dieser Guard prüft die Abfragen unter src/app/(app)/ je Abfrage,
// ein `user_id` in einer anderen Abfrage derselben Datei zählt also nicht.
//
// Geprüft wird jede Kette `<client>.from(<tabelle>)…` auf einem Client mit RLS, also aus `createClient` von
// server/supabase/server.ts oder shared/supabase/client.ts. Sie braucht `.eq("user_id", …)`, bei `profiles`
// `.eq("id", …)`, denn dort ist die Zeilenkennung die des Kontos. Der Admin-Client bleibt draussen: er umgeht RLS, und
// /usage liest mit ihm absichtlich über alle Konten. Welchen Wert der Filter bekommt, sieht der Guard nicht; dass es
// die Kennung aus der geprüften Sitzung ist, halten die Tests der Seiten fest (layout.test.tsx, chats/[id]/page.test.tsx).
// Den Quelltext liest der Parser (parse-source.ts): ein `user_id` im Kommentar zählt nicht.

const ROOT = process.cwd();
const APP = "src/app/(app)";
const RLS_CLIENTS = new Set(["src/server/supabase/server", "src/shared/supabase/client"]);
const FACTORY = "createClient";

/** Tabellen, deren Zeilenkennung die Kennung des Kontos ist. */
const OWNER_COLUMN: Record<string, string> = { profiles: "id" };

type Query = { file: string; line: number; table: string; scoped: boolean };

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/** Die Aufrufe, die an `.from(…)` hängen, in Reihenfolge: aus `.select("id").eq("user_id", x)` werden select und eq. */
function chainAfter(from: ts.CallExpression): { method: string; args: readonly ts.Expression[] }[] {
  const calls: { method: string; args: readonly ts.Expression[] }[] = [];
  let current: ts.Expression = from;
  for (;;) {
    const access = current.parent;
    if (!ts.isPropertyAccessExpression(access) || access.expression !== current) break;
    const call = access.parent;
    if (!ts.isCallExpression(call) || call.expression !== access) break;
    calls.push({ method: access.name.text, args: call.arguments });
    current = call;
  }
  return calls;
}

/** Jede Abfrage einer Datei auf einem Client mit RLS, und ob sie auf das Konto eingrenzt. */
function queriesIn(file: string, text?: string): Query[] {
  const source = parse(file, text);
  const factories = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!RLS_CLIENTS.has(resolveModule(file, statement.moduleSpecifier.text) ?? "")) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === FACTORY) factories.add(element.name.text);
      }
    }
  }
  const isFactoryCall = (node: ts.Expression) => {
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    if (ts.isIdentifier(callee)) return factories.has(callee.text);
    return (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      namespaces.has(callee.expression.text) &&
      callee.name.text === FACTORY
    );
  };

  const clients = new Set<string>();
  walk(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isFactoryCall(unwrap(node.initializer))) {
      clients.add(node.name.text);
    }
  });

  const queries: Query[] = [];
  walk(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== "from" || node.arguments.length === 0) return;
    const receiver = unwrap(node.expression.expression);
    if (!((ts.isIdentifier(receiver) && clients.has(receiver.text)) || isFactoryCall(receiver))) return;
    const [table] = node.arguments;
    // Eine berechnete Tabelle kann jede sein, auch eine mit user_id: sie braucht den Filter wie jede andere.
    const name = ts.isStringLiteralLike(table) ? table.text : null;
    const owner = (name && OWNER_COLUMN[name]) || "user_id";
    const scoped = chainAfter(node).some(
      ({ method, args }) => method === "eq" && args.length > 0 && ts.isStringLiteralLike(args[0]) && args[0].text === owner
    );
    queries.push({ file, line: lineOf(node), table: name ?? table.getText(), scoped });
  });
  return queries;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const full = join(ROOT, dir, entry.name);
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Eigentümer-Eingrenzung bei Abfragen der eingeloggten Seiten", () => {
  const queries = sourceFiles(APP).flatMap((file) => queriesIn(file));

  it("findet die Abfragen der Seiten, auch die der Seitenleiste", () => {
    // Ein Guard, der nichts findet, sähe grün aus, egal was die Seiten tun.
    expect(queries.length).toBeGreaterThan(10);
    const sidebar = queries.filter((q) => q.file === `${APP}/layout.tsx`).map((q) => q.table);
    expect(sidebar.sort()).toEqual(["conversations", "projects"]);
  });

  it("jede Abfrage auf einem Client mit RLS grenzt auf das Konto ein", () => {
    const offenders = queries.filter((q) => !q.scoped).map((q) => `${q.file}:${q.line} (${q.table})`);
    expect(
      offenders,
      'Diese Abfragen verlassen sich allein auf RLS. .eq("user_id", user.id) mit der Kennung aus der geprüften Sitzung ' +
        'ergänzen (bei profiles .eq("id", …)):\n  ' +
        offenders.join("\n  ")
    ).toEqual([]);
  });
});

describe("Eigentümer-Eingrenzung bei Abfragen: der Scanner", () => {
  const FILE = `${APP}/x/page.tsx`;
  const server = `import { createClient } from "@/server/supabase/server";\nconst supabase = await createClient();\n`;
  const scoped = (text: string) => queriesIn(FILE, text).map((q) => q.scoped);

  it("meldet eine Abfrage ohne user_id, auch wenn eine andere Abfrage derselben Datei es hat", () => {
    expect(scoped(server + `await supabase.from("conversations").select("id").order("updated_at").limit(5);`)).toEqual([false]);
    expect(
      scoped(
        server +
          `await supabase.from("saved_prompts").select("outputs").eq("user_id", user.id);\n` +
          `await supabase.from("conversations").select("id").eq("id", id).maybeSingle();`
      )
    ).toEqual([true, false]);
  });

  it("zählt ein user_id im Kommentar, als Wert oder in einem anderen Filter nicht", () => {
    expect(
      scoped(
        server +
          `// .eq("user_id", user.id)\n` +
          `await supabase.from("projects").select("user_id").eq("id", "user_id").neq("user_id", other).is("user_id", null);`
      )
    ).toEqual([false]);
  });

  it("erkennt den Client ohne Variable, unter anderem Namen, als Namensraum und aus dem Browser-Modul", () => {
    expect(scoped(`import { createClient } from "@/server/supabase/server";\nawait (await createClient()).from("projects").select("id");`)).toEqual([false]);
    expect(
      scoped(`import { createClient as client } from "@/server/supabase/server";\nconst db = await client();\nawait db.from("projects").select("id");`)
    ).toEqual([false]);
    expect(
      scoped(`import * as rls from "@/server/supabase/server";\nconst db = await rls.createClient();\nawait db.from("projects").select("id");`)
    ).toEqual([false]);
    expect(
      scoped(`import { createClient } from "../../../shared/supabase/client";\nconst db = createClient();\nawait db.from("projects").select("id");`)
    ).toEqual([false]);
  });

  it("verlangt den Filter auch bei einer berechneten Tabelle", () => {
    expect(scoped(server + `await supabase.from(table).select("id");`)).toEqual([false]);
    expect(scoped(server + `await supabase.from(table).select("id").eq("user_id", user.id);`)).toEqual([true]);
  });

  it("lässt eingegrenzte Abfragen und profiles mit .eq(\"id\", …) durch", () => {
    expect(scoped(server + `await supabase.from("projects").select("id").order("updated_at").eq("user_id", user.id);`)).toEqual([true]);
    expect(scoped(server + `await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();`)).toEqual([true]);
    expect(scoped(server + `await supabase.from("profiles").select("plan").eq("user_id", user.id).maybeSingle();`)).toEqual([false]);
  });

  it("lässt den Admin-Client, Storage und fremde Objekte mit einer Methode from aus", () => {
    const admin = `import { createAdminClient } from "@/server/supabase/admin";\nconst admin = createAdminClient();\n`;
    expect(queriesIn(FILE, admin + `await admin.from("messages").select("id", { count: "exact", head: true });`)).toEqual([]);
    expect(queriesIn(FILE, server + `await supabase.storage.from("attachments").createSignedUrl(path, 60);`)).toEqual([]);
    expect(queriesIn(FILE, server + `const list = Array.from(items);`)).toEqual([]);
  });
});
