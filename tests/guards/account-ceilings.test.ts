import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_CEILINGS, PLAN_LIMITS } from "@/shared/lib/plans";

// Die Grenzen je Konto stehen zweimal: in der Migration, die sie durchsetzt, und in plans.ts, von wo sie Doku und
// Browser-Tests lesen. SQL kann TypeScript nicht importieren, deshalb hält dieser Test beide zusammen. Eine spätere
// Migration, die eine Zahl ändert, muss auch hier genannt werden.
//
// Ob die Datenbank die Zahlen wirklich durchsetzt, prüft e2e/account-limits.spec.ts gegen den lokalen Stack.

const DIR = join(process.cwd(), "supabase", "migrations");

function migrationSql(suffix = "_account_ceilings.sql"): string {
  const file = readdirSync(DIR).find((f) => f.endsWith(suffix));
  expect(file, `Migration *${suffix} fehlt`).toBeDefined();
  return readFileSync(join(DIR, file!), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const sql = migrationSql();
// Dieselbe Byte-Grenze nach einem UPDATE: outputs darf authenticated ändern (0026).
const onUpdate = migrationSql("_saved_prompts_ceiling_on_update.sql");
// Die Versionen gespeicherter Prompts zählen mit derselben Funktion, in eigener Migration.
const versions = migrationSql("_saved_prompt_versions.sql");
const ACCOUNT_LOCK = "pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || account::text, 0))";

/** Die Argumente, mit denen der Trigger der Tabelle enforce_account_ceiling aufruft. */
function triggerArgs(table: string, source = sql): string[] {
  const match = source.match(
    new RegExp(
      `create trigger ${table}_account_ceiling after insert on public\\.${table}\\s+` +
        `referencing new table as new_rows\\s+` +
        `for each statement execute function public\\.enforce_account_ceiling\\(([^)]*)\\)`
    )
  );
  expect(match, `Trigger für ${table} fehlt`).not.toBeNull();
  return match![1].split(",").map((arg) => arg.trim().replace(/'/g, ""));
}

describe("Grenzen je Konto", () => {
  it("setzt in der Datenbank dieselben Zeilen und Bytes wie plans.ts", () => {
    expect(triggerArgs("conversations")).toEqual([String(ACCOUNT_CEILINGS.conversations.rows)]);
    expect(triggerArgs("messages")).toEqual([
      String(ACCOUNT_CEILINGS.messages.rows),
      "content",
      String(ACCOUNT_CEILINGS.messages.bytes),
    ]);
    expect(triggerArgs("saved_prompts")).toEqual([
      String(ACCOUNT_CEILINGS.savedPrompts.rows),
      "outputs",
      String(ACCOUNT_CEILINGS.savedPrompts.bytes),
    ]);
    expect(triggerArgs("project_files")).toEqual([String(ACCOUNT_CEILINGS.projectFiles.rows)]);
    expect(triggerArgs("saved_prompt_versions", versions)).toEqual([
      String(ACCOUNT_CEILINGS.savedPromptVersions.rows),
      "content",
      String(ACCOUNT_CEILINGS.savedPromptVersions.bytes),
    ]);
  });

  it("setzt die Projekt-Grenze von Free aus PLAN_LIMITS durch, Admins ausgenommen", () => {
    expect(sql).toContain(`from public.projects where user_id = account) > ${PLAN_LIMITS.free.projects}`);
    expect(sql).toContain("not coalesce(account_is_admin, false)");
  });

  it("begrenzt den Bucket project-files je Konto nach Objekten und Bytes", () => {
    const { objects, bytes } = ACCOUNT_CEILINGS.projectFileStorage;
    expect(sql).toContain(
      `select count(*) < ${objects} and coalesce(sum((o.metadata->>'size')::bigint), 0) < ${bytes}`
    );
  });

  it("nimmt die Sperre vor dem Zählen, sonst kämen parallele Einfügungen gemeinsam durch", () => {
    for (const fn of ["enforce_project_cap", "enforce_account_ceiling"]) {
      const body = sql.slice(sql.indexOf(`function public.${fn}()`));
      const lock = body.indexOf("pg_advisory_xact_lock");
      const count = body.indexOf("count(*)");
      expect(lock, fn).toBeGreaterThan(-1);
      expect(lock, fn).toBeLessThan(count);
    }
  });

  it("prüft die Bytes der gespeicherten Prompts auch nach einem UPDATE, mit derselben Zahl", () => {
    expect(onUpdate).toMatch(
      new RegExp(
        "create trigger saved_prompts_account_ceiling_update after update on public\\.saved_prompts\\s+" +
          "referencing old table as old_rows new table as new_rows\\s+" +
          `for each statement execute function public\\.enforce_saved_prompts_bytes_on_update\\('${ACCOUNT_CEILINGS.savedPrompts.bytes}'\\)`
      )
    );
  });

  it("nimmt beim Ändern dieselbe Sperre wie beim Einfügen, vor dem Zählen", () => {
    expect(sql).toContain(ACCOUNT_LOCK);
    const lock = onUpdate.indexOf(ACCOUNT_LOCK);
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(onUpdate.indexOf("sum(pg_column_size(outputs))"));
  });

  it("prüft bei allen drei Tabellen den Eigentümer der Elternzeile", () => {
    expect(sql).toMatch(/p\.id = conversations\.project_id and p\.user_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/c\.id = messages\.conversation_id and c\.user_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/p\.id = project_files\.project_id and p\.user_id = \(select auth\.uid\(\)\)/);
  });

  // 0061 legt conversations_owner und die Policies von saved_prompts neu an: die Projekt-Prüfung muss mitkommen.
  it("prüft auch Chat am Prompt und Ursprung am Chat, ohne die Projekt-Prüfung zu verlieren", () => {
    const policy = (name: string): string => {
      const start = versions.indexOf(`create policy ${name} `);
      expect(start, name).toBeGreaterThan(-1);
      return versions.slice(start, versions.indexOf(");\n", start) + 2);
    };
    const owner = (column: string, alias: string, parent: string): RegExp =>
      new RegExp(
        `${column.replace(".", "\\.")} is null\\s+or exists \\(\\s+select 1 from public\\.${parent} ${alias}\\s+` +
          `where ${alias}\\.id = ${column.replace(".", "\\.")} and ${alias}\\.user_id = \\(select auth\\.uid\\(\\)\\)`
      );

    expect(policy("saved_prompts_owner_insert")).toMatch(owner("saved_prompts.project_id", "p", "projects"));
    expect(policy("saved_prompts_owner_insert")).toMatch(owner("saved_prompts.conversation_id", "c", "conversations"));
    expect(policy("saved_prompts_owner_update")).toMatch(owner("saved_prompts.conversation_id", "c", "conversations"));
    expect(policy("conversations_owner")).toMatch(owner("conversations.project_id", "p", "projects"));
    expect(policy("conversations_owner")).toMatch(owner("conversations.source_prompt_id", "sp", "saved_prompts"));
  });
});
