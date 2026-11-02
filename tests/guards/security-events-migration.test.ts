import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Das Sicherheitsprotokoll gehört allein dem Server und lässt sich nur anhängen. Ein Recht für anon oder authenticated
// machte es für jeden Nutzer lesbar, ein Recht zum Ändern für service_role nähme ihm den Wert als Beleg. Die Frist ist
// ein Versprechen in der Dokumentation: der Test hält sie an der Stelle fest, die sie durchsetzt.

const DIR = join(process.cwd(), "supabase", "migrations");
const file = readdirSync(DIR).find((name) => name.endsWith("_security_events.sql"));

function sql(): string {
  expect(file, "Migration des Sicherheitsprotokolls fehlt").toBeTruthy();
  return readFileSync(join(DIR, file!), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("Migration des Sicherheitsprotokolls", () => {
  it("hält die Tabelle für den Browser zu", () => {
    const text = sql();
    expect(text).toMatch(/alter table public\.security_events enable row level security/i);
    expect(text).toMatch(/revoke all on public\.security_events from anon, authenticated/i);
    expect(text).toMatch(/for all to anon, authenticated\s+using \(false\)\s+with check \(false\)/i);
    expect(text).not.toMatch(/^grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/gim);
  });

  it("erlaubt dem Server nur Lesen und Anhängen", () => {
    const text = sql();
    expect(text).toMatch(/revoke all on public\.security_events from service_role/i);
    expect(text).toMatch(/grant select, insert on public\.security_events to service_role/i);
    expect(text).not.toMatch(/grant[^;]*\b(update|delete|truncate)\b[^;]*on public\.security_events/i);
  });

  it("legt keinen Fremdschlüssel auf das Konto: das Ereignis muss das Löschen überleben", () => {
    const table = /create table if not exists public\.security_events \(([\s\S]*?)\n\);/i.exec(sql())?.[1] ?? "";
    expect(table).toMatch(/user_id uuid,/i);
    expect(table).not.toMatch(/references/i);
  });

  it("löscht nach 180 Tagen und nur dann, per Job in der Datenbank", () => {
    const text = sql();
    expect(text).toMatch(/delete from public\.security_events where created_at < now\(\) - interval '180 days'/i);
    expect(text).toMatch(/cron\.schedule\('prune-security-events', '17 3 \* \* \*', 'select public\.prune_security_events\(\)'\)/i);
    expect(text).toMatch(/create extension if not exists pg_cron with schema pg_catalog/i);
  });

  it("lässt die Aufräumfunktion nur den Server aufrufen", () => {
    const text = sql();
    expect(text).toMatch(/revoke execute on function public\.prune_security_events\(\) from public, anon, authenticated/i);
    expect(text).toMatch(/grant execute on function public\.prune_security_events\(\) to service_role/i);
  });
});
