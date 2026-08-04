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
