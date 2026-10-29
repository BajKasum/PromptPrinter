import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Haelt die Konventionen fest, nach denen die Migrationen in diesem Projekt
// geschrieben sind (Planpunkt A-5).
//
// ─── Warum es diesen Guard gibt ────────────────────────────────────────────
// Der Anlass war ein Verdacht, der sich beim Nachmessen als FALSCH erwies, und
// das ist der eigentliche Punkt. Die Produktion fuehrt drei Migrationen, zu
// denen es keine gleichnamige Datei gibt:
//   project_files_storage_limits_fix_scoping · byok_active_provider_select_grant
//   · storage_rls_initplan_revert
// Das sieht nach Drift aus. Es ist aber keine: 0029 traegt den Scoping-Fix
// bereits im Dateitext, 0030 den Grant, 0036 den Revert — die Produktion hat
// nur mehr Zwischenschritte gesehen als das Repo Dateien hat, und spaetere
// Migrationen ueberschreiben ohnehin frueheres. Der Endzustand ist aus
// 0001 → n reproduzierbar.
//
// Festgestellt wurde das von Hand, in einem halben Dutzend Abfragen. Genau
// DAS ist die Luecke: es gab nichts, was diese Gleichwertigkeit haelt. Ein
// Schema-Abzug waere die naheliegende Antwort und die falsche — er braucht
// eine DB-Verbindung, die weder die CI noch ein frisch geklontes Repo hat,
// und waere damit genau die Sorte Artefakt, die behauptet statt zu pruefen
// (dieselbe Lehre wie beim Turnstile-Kommentar).
//
// Also stattdessen: die Eigenschaften pruefen, die eine Migration ueberhaupt
// erst reproduzierbar machen — Idempotenz und die Sicherheitsvorkehrungen,
// die dieses Projekt an jede neue Tabelle knuepft. Laeuft ohne Datenbank,
// laeuft in der CI, faellt beim Schreiben der naechsten Migration auf.
//
// Eine Eigenheit, die dabei auffiel und hier festgehalten gehoert: 0001_init
// steht NICHT in der Migrationshistorie der Produktion (die faengt bei 0002
// an). Es wurde dort vor der Verfolgung eingespielt. Fuer den Endzustand
// folgenlos, aber wer je die Supabase-CLI auf dieses Projekt ansetzt, sollte
// wissen, dass sie 0001 fuer unangewendet haelt.

const DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Bewusste Ausnahmen, je mit Begruendung.
 *
 * Beide betreffen dieselbe Datei aus demselben Grund: 0001 ist die Urfassung,
 * die die Konventionen noch nicht kannte, und die beiden direkt folgenden
 * Migrationen holen genau das nach — 0002 die Rechte, 0003 die Haertung. Die
 * Ausnahmen beschreiben also Historie, keinen offenen Mangel. Sie stehen hier
 * namentlich statt als "erste Datei ueberspringen", damit eine zweite Datei
 * mit demselben Problem auffaellt.
 */
const EXEMPT_SEARCH_PATH: Record<string, string> = {
  "0001_init.sql": "0003_harden_functions.sql haertet diese Funktionen nach",
};

const EXEMPT_GRANT: Record<string, string> = {
  "0001_init.sql": "0002_grant_table_privileges.sql vergibt die Rechte nach",
};

function migrationFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function read(file: string): string {
  return readFileSync(join(DIR, file), "utf8");
}

/** Kommentare raus, damit ein erklaerender Text keine Regel ausloest. */
function withoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("Migrations-Konventionen", () => {
  it("nummeriert luecken- und dublettenfrei ab 0001", () => {
    const numbers = migrationFiles().map((f) => Number(f.slice(0, 4)));
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  // Eine Migration muss ein zweites Mal laufen duerfen, ohne zu scheitern:
  // genau das erlaubt es, einen in der Produktion schon vorhandenen Zustand
  // aus den Dateien nachzuvollziehen, statt ihn zu umgehen.
  it("legt keine Policy an, ohne sie vorher wegzuraeumen", () => {
    const offenders = migrationFiles().filter((file) => {
      const sql = withoutComments(read(file));
      const creates = (sql.match(/^create policy/gim) ?? []).length;
      const drops = (sql.match(/^drop policy if exists/gim) ?? []).length;
      return creates > drops;
    });

    expect(
      offenders,
      "Diese Migrationen legen eine Policy an, ohne davor `drop policy if " +
        "exists` zu schreiben. Beim zweiten Lauf scheitern sie:\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });

  it("legt Indizes und Tabellen nur mit `if not exists` an", () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      const sql = withoutComments(read(file));
      for (const match of sql.matchAll(/^create (index|table)(?! if not exists)/gim)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders, `Nicht wiederholbar:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  // CLAUDE.mds eigene Regel: "neue Tabellen mit Policy + Grant versehen".
  // Eine Tabelle ohne RLS ist im Supabase-Modell fuer jeden lesbar, der den
  // anon-Key hat — und der steht im Client-Bundle.
  it("schaltet fuer jede neue Tabelle RLS ein und vergibt Rechte", () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      const sql = withoutComments(read(file));
      if (!/^create table/im.test(sql)) continue;
      if (!/enable row level security/i.test(sql)) offenders.push(`${file}: kein RLS`);
      if (!EXEMPT_GRANT[file] && !/^grant /im.test(sql)) offenders.push(`${file}: kein Grant`);
    }
    expect(offenders, `\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  // Security-Haertung aus 0003: ohne festes search_path kann eine Funktion
  // ueber einen untergeschobenen Schema-Pfad fremden Code ausfuehren.
  it("bindet jede Funktion an ein festes search_path", () => {
    const offenders = migrationFiles().filter((file) => {
      if (EXEMPT_SEARCH_PATH[file]) return false;
      const sql = withoutComments(read(file));
      return /create or replace function/i.test(sql) && !/set search_path/i.test(sql);
    });

    expect(
      offenders,
      `Funktion ohne festes search_path:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  // Postgres gibt CREATE FUNCTION das Recht EXECUTE an PUBLIC, und jede Rolle
  // (anon eingeschlossen) gehoert implizit dazu. Ein blosses `grant execute ...
  // to authenticated` macht die Funktion also trotzdem fuer anon aufrufbar.
  // Zweimal erst beim Nachmessen bemerkt: project_summaries() (0032) und
  // set_active_byok_provider() (0046). Hier fest: wer eine Funktion an
  // authenticated vergibt, muss sie irgendwo von PUBLIC entziehen.
  it("entzieht jeder an authenticated vergebenen Funktion das Recht von PUBLIC", () => {
    const granted = new Set<string>();
    const revokedFromPublic = new Set<string>();

    for (const file of migrationFiles()) {
      const sql = withoutComments(read(file));
      for (const m of sql.matchAll(
        /^grant\s+execute\s+on\s+function\s+([\w.]+)\s*\([^)]*\)\s+to\s+[^;]*\bauthenticated\b/gim
      )) {
        granted.add(m[1]);
      }
      for (const m of sql.matchAll(
        /^revoke\s+execute\s+on\s+function\s+([\w.]+)\s*\([^)]*\)\s+from\s+[^;]*\bpublic\b/gim
      )) {
        revokedFromPublic.add(m[1]);
      }
    }

    const offenders = [...granted].filter((fn) => !revokedFromPublic.has(fn));
    expect(
      offenders,
      "An authenticated vergeben, aber nie von PUBLIC entzogen (dann ist die " +
        "Funktion auch fuer anon aufrufbar):\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });

  // #158: der Profilbild-Upload ist entfernt, seine Rechte sollen es auch sein. Der Guard haelt den
  // Endzustand fest, nicht nur diese Datei: keine spaetere Migration legt die Schreibrechte neu an.
  it("raeumt die Rechte des entfernten Profilbild-Uploads ab und legt sie nie wieder an", () => {
    const sql = withoutComments(read("0048_drop_avatar_upload_remnants.sql"));
    expect(sql).toMatch(/drop policy if exists avatars_owner_insert on storage\.objects/i);
    expect(sql).toMatch(/drop policy if exists avatars_owner_update on storage\.objects/i);
    expect(sql).toMatch(/set public = false\s+where id = 'avatars'/i);
    expect(sql).toMatch(/revoke update \(avatar_url\) on public\.profiles from authenticated/i);

    const later = migrationFiles().filter((f) => f > "0048");
    const regranted = later.filter((file) => {
      const text = withoutComments(read(file));
      return (
        /create policy avatars_owner_(insert|update)/i.test(text) ||
        /grant update \([^)]*avatar_url/i.test(text)
      );
    });
    expect(
      regranted,
      "Diese Migrationen vergeben die Schreibrechte am Avatar neu:\n  " + regranted.join("\n  ")
    ).toEqual([]);
  });

  // #136: ein Fremdschluessel ohne Index macht jedes Loeschen des Kontos (set null) zum Vollscan.
  it("indiziert billing_events.user_id, den Fremdschluessel auf auth.users", () => {
    const sql = withoutComments(read("0047_billing_events_user_index.sql"));
    expect(sql).toMatch(
      /create index if not exists billing_events_user_idx\s+on public\.billing_events \(user_id\)/i
    );
  });

  // #140: `generations` ist `saved_prompts`, und die Reste der Generierungs-Pipeline sind weg. Der
  // Guard haelt den Endzustand fest: keine spaetere Migration legt die alten Namen oder Spalten an.
  it("benennt generations in saved_prompts um und raeumt die Pipeline-Reste ab", () => {
    const sql = withoutComments(read("0049_saved_prompts.sql"));
    expect(sql).toMatch(/alter table public\.generations rename to saved_prompts/i);
    for (const column of ["model", "latency_ms", "tokens_in", "tokens_out"]) {
      expect(sql, column).toMatch(new RegExp(`drop column if exists ${column}\\b`, "i"));
    }
    expect(sql).toMatch(/alter table public\.projects drop column if exists status/i);
    expect(sql).toMatch(/profiles_plan_check check \(plan in \('free', 'pro'\)\)/i);
    // project_summaries() liest die neue Tabelle und behaelt ihre Rechte.
    expect(sql).toMatch(/from public\.saved_prompts/i);
    expect(sql).not.toMatch(/from public\.generations/i);
    expect(sql).toMatch(/revoke execute on function public\.project_summaries\(\) from public/i);

    const later = migrationFiles().filter((f) => f.slice(0, 4) > "0049");
    const revived = later.filter((file) =>
      /(create|alter) table (if not exists )?public\.generations\b|add column (if not exists )?(model|latency_ms|tokens_in|tokens_out)\b/i.test(
        withoutComments(read(file))
      )
    );
    expect(revived, "Diese Migrationen holen Altes zurueck:\n  " + revived.join("\n  ")).toEqual([]);
  });

  // Anmeldung der Kommandozeile per Geraete-Code: die Tabelle gehoert allein dem Server. Ein Recht fuer
  // anon oder authenticated machte aus dem Geraete-Code (nur als Hash gespeichert) und der Freigabe etwas,
  // das ein Nutzer aus der Browser-Konsole selbst setzen koennte.
  it("haelt cli_device_requests fuer den Browser zu: RLS, keine Rechte, Hash, kurze Frist", () => {
    const sql = withoutComments(read("0050_cli_device_requests.sql"));
    expect(sql).toMatch(/alter table public\.cli_device_requests enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.cli_device_requests from anon, authenticated/i);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.cli_device_requests to service_role/i);
    // Kein Grant an anon, authenticated oder public, in keiner Zeile.
    expect(sql).not.toMatch(/^grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/gim);
    // Die Policy erlaubt dem Browser nichts.
    expect(sql).toMatch(/for all to anon, authenticated\s+using \(false\)\s+with check \(false\)/i);
    // Der Geraete-Code liegt nur als SHA-256 vor, die Frist ist zehn Minuten.
    expect(sql).toMatch(/device_code_hash text not null unique/i);
    expect(sql).toMatch(/device_code_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
    expect(sql).toMatch(/expires_at timestamptz not null default now\(\) \+ interval '10 minutes'/i);
    // pending hat keinen Nutzer, jede Entscheidung hat einen.
    expect(sql).toMatch(/\(status = 'pending'\) = \(user_id is null\)/i);
  });

  it("fuehrt keine Ausnahme, die es nicht mehr braucht", () => {
    const stale = [
      ...Object.keys(EXEMPT_SEARCH_PATH).filter((file) => {
        const sql = withoutComments(read(file));
        return !/create or replace function/i.test(sql) || /set search_path/i.test(sql);
      }),
      ...Object.keys(EXEMPT_GRANT).filter((file) => {
        const sql = withoutComments(read(file));
        return !/^create table/im.test(sql) || /^grant /im.test(sql);
      }),
    ];
    expect(stale, `Ueberfluessige Ausnahmen: ${stale.join(", ")}`).toEqual([]);
  });
});
