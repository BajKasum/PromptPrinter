import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EXPORT_EXCLUDED_TABLES, EXPORT_SECTIONS, TERMINAL_SESSIONS_SECTION } from "@/server/account-export";
import { parse } from "./parse-source";

// #388: Der Datenexport (src/server/account-export.ts) soll alles enthalten, was zu einem Nutzer gehört. Jede Tabelle
// aus database.types.ts mit einer Spalte user_id ist deshalb entweder ein Abschnitt des Exports oder steht mit Grund in
// EXPORT_EXCLUDED_TABLES. Kommt eine Tabelle dazu (nach einer Migration schreibt man die Typen neu, docs/SETUP.md,
// "Datenbank-Typen"), schlägt dieser Test an, bis sie an einer der beiden Stellen steht. Den Abgleich der Typen mit dem
// Schema der Migrationen macht die CI in e2e.yml.

const TYPES = "src/shared/supabase/database.types.ts";

const nameOf = (name: ts.PropertyName) =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : name.getText();

/** Der Typ einer Eigenschaft eines Typ-Literals, `undefined`, wenn es sie nicht gibt. */
function property(node: ts.TypeNode | undefined, name: string): ts.TypeNode | undefined {
  if (!node || !ts.isTypeLiteralNode(node)) return undefined;
  const member = node.members.find((m) => ts.isPropertySignature(m) && nameOf(m.name) === name);
  return member && ts.isPropertySignature(member) ? member.type : undefined;
}

/** Jede Tabelle in Database["public"]["Tables"], mit den Spalten ihrer Zeile. */
function tables(): { table: string; columns: string[] }[] {
  const source = parse(TYPES);
  const database = source.statements.find(
    (s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === "Database"
  );
  const all = property(property(database?.type, "public"), "Tables");
  if (!all || !ts.isTypeLiteralNode(all)) throw new Error(`Database["public"]["Tables"] fehlt in ${TYPES}`);
  return all.members.filter(ts.isPropertySignature).map((member) => {
    const row = property(member.type, "Row");
    const columns = row && ts.isTypeLiteralNode(row) ? row.members.filter(ts.isPropertySignature).map((c) => nameOf(c.name)) : [];
    return { table: nameOf(member.name), columns };
  });
}

const userTables = () => tables().filter((t) => t.columns.includes("user_id")).map((t) => t.table);
const exported = () => [...EXPORT_SECTIONS.map((s) => s.table as string), TERMINAL_SESSIONS_SECTION.table];
const excluded = () => Object.keys(EXPORT_EXCLUDED_TABLES);

describe("Datenexport: jede Tabelle eines Nutzers", () => {
  it("liest die Tabellen und ihre Spalten wirklich aus database.types.ts", () => {
    expect(userTables()).toEqual(expect.arrayContaining(["messages", "prompt_shares", "cli_sessions", "saved_prompts"]));
    // Das Konto selbst hängt an profiles.id, nicht an user_id; es ist der Abschnitt "account". Jede andere Tabelle
    // ohne user_id soll hier auffallen: gehört sie doch einem Nutzer (etwa über owner_id), gehört sie in den Export.
    expect(tables().filter((t) => !t.columns.includes("user_id")).map((t) => t.table)).toEqual(["profiles"]);
  });

  it("ist ein Abschnitt des Exports oder mit Grund ausgenommen", () => {
    const missing = userTables().filter((table) => !exported().includes(table) && !excluded().includes(table));
    expect(
      missing,
      "In EXPORT_SECTIONS aufnehmen oder in EXPORT_EXCLUDED_TABLES mit Grund ausnehmen (src/server/account-export.ts)"
    ).toEqual([]);
  });

  it("nimmt nur Tabellen aus, die es gibt und die der Export nicht doch liest", () => {
    for (const table of excluded()) {
      expect(userTables(), table).toContain(table);
      expect(exported(), table).not.toContain(table);
    }
  });

  it("nennt für jede Ausnahme einen Grund", () => {
    for (const [table, reason] of Object.entries(EXPORT_EXCLUDED_TABLES)) {
      expect(reason?.trim().length ?? 0, table).toBeGreaterThan(20);
    }
  });
});
