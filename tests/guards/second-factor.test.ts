import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    ["src/app/api/settings/api-key/route.ts", 3],
    ["src/app/api/cli/approve/route.ts", 1],
  ])("%s prüft %i-mal", (path, times) => {
    expect(read(path).match(/await lacksSecondFactor\(supabase, user\)/g)).toHaveLength(times);
    expect(read(path).match(/code: "aal2_required"/g)).toHaveLength(times);
  });

  it("die Schlüssel-Route prüft, bevor sie den Key liest", () => {
    const source = read("src/app/api/settings/api-key/route.ts");
    expect(source.indexOf("lacksSecondFactor(supabase, user)")).toBeLessThan(source.indexOf("readSaveRequest(req, m)"));
  });

  it("das Konto wird erst nach der Prüfung angefasst", () => {
    const source = read("src/app/api/account/route.ts");
    expect(source.indexOf("await lacksSecondFactor(supabase, user)")).toBeLessThan(
      source.indexOf("await cancelRunningSubscription(")
    );
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
