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

function migrationSql(): string {
  const file = readdirSync(DIR).find((f) => f.endsWith("_account_ceilings.sql"));
  expect(file, "Migration *_account_ceilings.sql fehlt").toBeDefined();
  return readFileSync(join(DIR, file!), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const sql = migrationSql();

/** Die Argumente, mit denen der Trigger der Tabelle enforce_account_ceiling aufruft. */
function triggerArgs(table: string): string[] {
  const match = sql.match(
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
  });

  it("setzt die Projekt-Grenze von Free aus PLAN_LIMITS durch", () => {
    expect(sql).toContain(`from public.projects where user_id = account) > ${PLAN_LIMITS.free.projects}`);
    expect(PLAN_LIMITS.pro.projects).toBe(Infinity);
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

  it("prüft bei allen drei Tabellen den Eigentümer der Elternzeile", () => {
    expect(sql).toMatch(/p\.id = conversations\.project_id and p\.user_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/c\.id = messages\.conversation_id and c\.user_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/p\.id = project_files\.project_id and p\.user_id = \(select auth\.uid\(\)\)/);
  });
});
