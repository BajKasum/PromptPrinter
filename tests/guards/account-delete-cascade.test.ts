import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse } from "./parse-source";

// "Konto löschen" (src/app/api/account/route.ts) entfernt nur die Zeile in auth.users. Alles andere hängt an
// ON DELETE CASCADE, und die Datenschutzerklärung sagt diese Vollständigkeit zu. Deshalb liest dieser Test die
// Migrationen der Reihe nach und verlangt für jede Tabelle mit `user_id` einen Fremdschlüssel auf das Konto, der
// kaskadiert. Ob er alle Tabellen sieht, prüft der Abgleich mit database.types.ts.

const DIR = join(process.cwd(), "supabase", "migrations");
const ACCOUNT = /^(?:public\.)?profiles$|^auth\.users$/;

/** Tabellen mit `user_id`, deren Zeilen das Konto mit Absicht überleben, je mit Grund. */
const SURVIVES_ACCOUNT: Record<string, string> = {
  billing_events:
    "Protokoll des Zahlungsanbieters (Migration 0039): beim Löschen wird user_id geleert, die Zeile mit dessen Kennungen bleibt.",
  security_events:
    "Sicherheitsprotokoll (Datenschutz, Ziffer 8): „Konto gelöscht“ muss das Konto überleben, ohne Fremdschlüssel, 180 Tage.",
};

type ForeignKey = { name: string; target: string; onDelete: string };
type Table = { columns: Set<string>; keys: ForeignKey[] };

/** Teilt an den Zeichen `separator`, die weder in Klammern noch in Anführungszeichen stehen. */
function topLevel(sql: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === "'") quoted = !quoted;
    if (quoted) continue;
    if (sql[i] === "(") depth++;
    if (sql[i] === ")") depth--;
    if (sql[i] === separator && depth === 0) {
      parts.push(sql.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(sql.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Der Inhalt der Klammer, die an `open` beginnt. */
function inParentheses(sql: string, open: number): string {
  let depth = 0;
  let quoted = false;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === "'") quoted = !quoted;
    if (quoted) continue;
    if (sql[i] === "(") depth++;
    if (sql[i] === ")" && --depth === 0) return sql.slice(open + 1, i);
  }
  throw new Error(`Klammer ohne Ende: ${sql.slice(open, open + 80)}`);
}

/** Ein Eintrag aus `create table (…)` oder eine Spalte, die `alter table … add` nachreicht. */
function addDefinition(name: string, table: Table, definition: string): void {
  const reference = /\breferences\s+([\w.]+)/i.exec(definition);
  const onDelete = /\bon delete\s+(cascade|set null|set default|restrict|no action)/i.exec(definition)?.[1];
  const key = (constraint: string): ForeignKey => ({
    name: constraint,
    target: reference![1].toLowerCase(),
    onDelete: (onDelete ?? "no action").toLowerCase(),
  });
  const constraint = /^(?:constraint\s+(\w+)\s+)?foreign key\s*\(\s*user_id\s*\)/i.exec(definition);
  if (constraint) {
    table.keys.push(key(constraint[1] ?? `${name}_user_id_fkey`));
    return;
  }
  if (/^(constraint|primary key|foreign key|unique|check|exclude)\b/i.test(definition)) return;
  const column = /^"?(\w+)"?\s/.exec(definition)?.[1];
  if (!column) return;
  table.columns.add(column.toLowerCase());
  if (column.toLowerCase() === "user_id" && reference) table.keys.push(key(`${name}_user_id_fkey`));
}

function alterTable(name: string, table: Table, action: string): void {
  const dropColumn = /^drop column\s+(?:if exists\s+)?(\w+)/i.exec(action);
  if (dropColumn) {
    table.columns.delete(dropColumn[1]);
    if (dropColumn[1] === "user_id") table.keys = [];
    return;
  }
  const dropConstraint = /^drop constraint\s+(?:if exists\s+)?(\w+)/i.exec(action);
  if (dropConstraint) {
    const dropped = dropConstraint[1];
    table.keys = table.keys.filter((key) => key.name !== dropped && !dropped.endsWith("_user_id_fkey"));
    return;
  }
  const added = /^add\s+(?:column\s+(?:if not exists\s+)?)?([\s\S]*)$/i.exec(action);
  if (added) addDefinition(name, table, added[1]);
}

const STATEMENT =
  /\b(create table|drop table|alter table)\s+(?:if (?:not )?exists\s+)?(?:only\s+)?(?:(\w+)\.)?(\w+)/gi;

/** Die Tabellen in `public` nach allen Anweisungen, in der Reihenfolge der Texte. */
function schema(migrations: string[]): Map<string, Table> {
  const tables = new Map<string, Table>();
  for (const raw of migrations) {
    const sql = raw.replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g, "");
    for (const match of sql.matchAll(STATEMENT)) {
      const [text, verb, namespace = "public", name] = match;
      if (namespace.toLowerCase() !== "public") continue;
      const rest = sql.slice(match.index + text.length);
      if (verb.toLowerCase() === "create table") {
        if (tables.has(name)) continue;
        const table: Table = { columns: new Set(), keys: [] };
        for (const definition of topLevel(inParentheses(rest, rest.indexOf("(")), ",")) addDefinition(name, table, definition);
        tables.set(name, table);
      } else if (verb.toLowerCase() === "drop table") {
        tables.delete(name);
      } else {
        const table = tables.get(name);
        if (!table) continue;
        // Bis zum ersten Semikolon: in dynamischem SQL (`execute format('alter table …')`) stünden die Anführungszeichen schief.
        const body = rest.split(";")[0].trim();
        const renamed = /^rename to\s+(\w+)/i.exec(body);
        if (renamed) {
          tables.delete(name);
          tables.set(renamed[1], table);
        } else {
          for (const action of topLevel(body, ",")) alterTable(name, table, action);
        }
      }
    }
  }
  return tables;
}

const cascades = (table: Table) =>
  table.keys.length > 0 && table.keys.every((key) => ACCOUNT.test(key.target) && key.onDelete === "cascade");

const withUserId = (tables: Map<string, Table>) =>
  [...tables].filter(([, table]) => table.columns.has("user_id")).map(([name]) => name).sort();

const withoutCascade = (tables: Map<string, Table>) =>
  withUserId(tables).filter((name) => !cascades(tables.get(name)!));

const migrationTexts = () =>
  readdirSync(DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(DIR, file), "utf8"));

const migrated = () => schema(migrationTexts());

/** Die Tabellen aus Database["public"]["Tables"], deren Zeile eine Spalte `user_id` hat. */
function typedUserTables(): string[] {
  // Die erzeugte Datei schreibt die Schlüssel mit und ohne Anführungszeichen, `text` ist in beiden Fällen der Name.
  const nameOf = (name: ts.PropertyName) => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : "");
  const members = (node: ts.Node | undefined) =>
    node && ts.isTypeLiteralNode(node) ? node.members.filter(ts.isPropertySignature) : [];
  const member = (node: ts.Node | undefined, name: string) => members(node).find((m) => nameOf(m.name) === name)?.type;
  const source = parse("src/shared/supabase/database.types.ts");
  const database = source.statements.filter(ts.isTypeAliasDeclaration).find((s) => s.name.text === "Database");
  const tables = members(member(member(database?.type, "public"), "Tables"));
  if (tables.length === 0) throw new Error('Database["public"]["Tables"] fehlt in database.types.ts');
  return tables
    .filter((table) => member(member(table.type, "Row"), "user_id"))
    .map((table) => nameOf(table.name))
    .sort();
}

describe("Konto löschen: jede Tabelle mit user_id kaskadiert", () => {
  const base = `create table public.t (
    id uuid primary key,
    user_id uuid not null references public.profiles(id) on delete cascade, -- Kommentar
    note text check (note in ('a', 'b'))
  );`;

  it.each([
    ["mit Kaskade auf profiles", [base], []],
    ["mit Kaskade auf auth.users", [base.replace("public.profiles", "auth.users")], []],
    ["ohne ON DELETE", [base.replace(" on delete cascade", "")], ["t"]],
    ["mit SET NULL", [base.replace("on delete cascade", "on delete set null")], ["t"]],
    ["ohne Fremdschlüssel", [base.replace(" references public.profiles(id) on delete cascade", "")], ["t"]],
    ["mit Kaskade auf eine andere Tabelle", [base.replace("public.profiles", "public.projects")], ["t"]],
    ["mit Fremdschlüssel als eigener Zeile", [
      "create table if not exists t (user_id uuid not null, foreign key (user_id) references auth.users (id) on delete cascade);",
    ], []],
    ["nachgereichte Spalte ohne Kaskade", [
      "create table public.t (id uuid);",
      "alter table public.t add column if not exists user_id uuid references public.profiles(id);",
    ], ["t"]],
    ["Fremdschlüssel entfernt", [base, "alter table public.t drop constraint if exists t_user_id_fkey;"], ["t"]],
    ["Fremdschlüssel ersetzt", [
      base,
      `alter table public.t drop constraint t_user_id_fkey,
         add constraint t_user_id_fkey foreign key (user_id) references public.profiles(id) on delete restrict;`,
    ], ["t"]],
    ["umbenannt", [base.replace(" on delete cascade", ""), "do $$ begin alter table public.t rename to u; end $$;"], ["u"]],
    ["gelöscht", [base.replace(" on delete cascade", ""), "drop table if exists public.t;"], []],
    ["nur auskommentiert", [base, "-- create table public.v (user_id uuid);"], []],
  ])("liest eine Tabelle %s richtig", (_name, migrations, expected) => {
    expect(withoutCascade(schema(migrations))).toEqual(expected);
  });

  it("sieht dieselben Tabellen mit user_id wie database.types.ts", () => {
    expect(withUserId(migrated())).toEqual(typedUserTables());
  });

  // Die meisten Tabellen kaskadieren über profiles: ohne dieses erste Glied wäre jede Kaskade darauf wirkungslos.
  it("hängt das Profil selbst an das Konto", () => {
    const sql = migrationTexts().join("\n");
    expect(sql).toMatch(/create table if not exists public\.profiles \(\s*id uuid primary key references auth\.users\(id\) on delete cascade/);
    expect(sql).not.toMatch(/drop constraint\s+(?:if exists\s+)?profiles_id_fkey/i);
  });

  it("lässt nur die begründeten Ausnahmen stehen", () => {
    expect(
      withoutCascade(migrated()),
      "Neue Tabelle mit Nutzerdaten: user_id mit `references public.profiles(id) on delete cascade`. " +
        "Soll eine Zeile das Konto überleben, gehört sie mit Grund in SURVIVES_ACCOUNT und in die Datenschutzerklärung."
    ).toEqual(Object.keys(SURVIVES_ACCOUNT).sort());
  });

  it("nennt für jede Ausnahme einen Grund", () => {
    for (const [table, reason] of Object.entries(SURVIVES_ACCOUNT)) {
      expect(reason.trim().length, table).toBeGreaterThan(40);
    }
  });
});
