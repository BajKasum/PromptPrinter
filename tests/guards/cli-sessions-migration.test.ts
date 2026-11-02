import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Die Tabelle der Terminal-Sitzungen gehört allein dem Server, und die beiden Funktionen löschen Zeilen in auth.sessions:
// aufrufbar für einen Nutzer wären sie ein Weg, fremde Terminals abzumelden. end_cli_session darf nur eingetragene
// Sitzungen des genannten Kontos treffen, sonst könnte sie auch einen Browser abmelden.

const DIR = join(process.cwd(), "supabase", "migrations");
const file = readdirSync(DIR).find((name) => name.endsWith("_cli_sessions.sql"));

function sql(): string {
  expect(file, "Migration der Terminal-Sitzungen fehlt").toBeTruthy();
  return readFileSync(join(DIR, file!), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("Migration der Terminal-Sitzungen", () => {
  it("hält die Tabelle für den Browser zu", () => {
    const text = sql();
    expect(text).toMatch(/alter table public\.cli_sessions enable row level security/i);
    expect(text).toMatch(/revoke all on public\.cli_sessions from anon, authenticated/i);
    expect(text).toMatch(/for all to anon, authenticated\s+using \(false\)\s+with check \(false\)/i);
    expect(text).not.toMatch(/^grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/gim);
  });

  it("räumt den Eintrag mit der Sitzung und dem Konto weg", () => {
    const text = sql();
    expect(text).toMatch(/session_id uuid primary key references auth\.sessions\(id\) on delete cascade/i);
    expect(text).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  });

  it("lässt beide Funktionen nur den Server aufrufen", () => {
    const text = sql();
    for (const signature of ["public\\.end_cli_session\\(uuid, uuid\\)", "public\\.prune_cli_login\\(\\)"]) {
      expect(text).toMatch(new RegExp(`revoke execute on function ${signature} from public, anon, authenticated`, "i"));
      expect(text).toMatch(new RegExp(`grant execute on function ${signature} to service_role`, "i"));
    }
  });

  it("beendet nur eingetragene Sitzungen des genannten Kontos", () => {
    const body = /function public\.end_cli_session[\s\S]*?\$\$([\s\S]*?)\$\$/i.exec(sql())?.[1] ?? "";
    expect(body).toMatch(/delete from auth\.sessions s\s+using public\.cli_sessions c/i);
    expect(body).toMatch(/s\.id = target_session/i);
    expect(body).toMatch(/c\.session_id = s\.id/i);
    expect(body).toMatch(/c\.user_id = target_user/i);
  });

  it("der Job beendet abgelaufene Sitzungen und löscht alte Anfragen, stündlich", () => {
    const text = sql();
    const body = /function public\.prune_cli_login[\s\S]*?\$\$([\s\S]*?)\$\$/i.exec(text)?.[1] ?? "";
    expect(body).toMatch(/c\.expires_at < now\(\)/i);
    expect(body).toMatch(/delete from public\.cli_device_requests where expires_at < now\(\) - interval '1 day'/i);
    expect(text).toMatch(/cron\.schedule\('prune-cli-login', '7 \* \* \* \*', 'select public\.prune_cli_login\(\)'\)/i);
  });

  it("legt für die Anfrage-Details eine Grenze fest", () => {
    expect(sql()).toMatch(/coalesce\(char_length\(request_user_agent\), 0\) <= 120/i);
  });
});
