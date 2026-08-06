import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Hält CLAUDE.mds Defense-in-depth-Regel fest:
//
//   "User-scoped Queries: RLS scope + zusätzlich explizit .eq("user_id", …)"
//
// RLS ist und bleibt die eigentliche Schranke — nichts hier ist ausnutzbar,
// solange die Policies stimmen. Genau das ist der Punkt: das explizite Filter-
// glied ist die zweite Linie für den Tag, an dem eine Policy beim Bearbeiten
// zu weit gerät. Es war bis zum Vollaudit an 9 von 14 Schreibstellen
// vergessen, jeweils unauffällig, weil RLS die Lücke zudeckte.
//
// Geprüft wird auf Dateiebene, nicht pro Query: ein Regex, der Query-Ketten
// zuverlässig parst, wäre spröder als der Nutzen rechtfertigt. Eine Datei, die
// über den Browser-Client schreibt und `user_id` nirgends erwähnt, ist das
// Signal — der Rest ist Review.

const SRC = join(process.cwd(), "src");

/**
 * Schreibende Dateien, die kein `user_id` brauchen, mit Begründung.
 * Jeder Eintrag ist eine bewusste Entscheidung, kein Rückstand.
 */
const EXEMPT: Record<string, string> = {
  // profiles.id IST die User-ID (FK auf auth.users). `.eq("id", userId)` ist
  // damit bereits die Eigentümer-Eingrenzung, ein zusätzliches user_id-Feld
  // existiert auf der Tabelle gar nicht.
  "src/features/auth/components/sign-up-experience.tsx": "profiles.id ist die User-ID",
  "src/features/settings/components/settings-workspace.tsx": "profiles.id ist die User-ID",
  "src/features/settings/components/avatar-upload.tsx": "profiles.id ist die User-ID",
};

function tsxFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("Eigentümer-Eingrenzung bei Client-Schreibzugriffen", () => {
  it("jede Datei, die über den Browser-Client schreibt, grenzt auf user_id ein", () => {
    const offenders: string[] = [];

    for (const absolute of tsxFilesIn(SRC)) {
      const file = relative(process.cwd(), absolute).replace(/\\/g, "/");
      const source = readFileSync(absolute, "utf8");

      // Nur der Browser-Client ist gemeint. Server-Code läuft ohnehin hinter
      // eigenen Prüfungen und nutzt teils den Admin-Client absichtlich ohne RLS.
      if (!source.includes("@/shared/supabase/client")) continue;
      if (!/\.(update|delete)\(/.test(source)) continue;
      if (EXEMPT[file]) continue;
      if (source.includes("user_id")) continue;

      offenders.push(file);
    }

    expect(
      offenders,
      "Diese Dateien schreiben über den Browser-Client, ohne irgendwo auf " +
        "user_id einzugrenzen. Entweder .eq(\"user_id\", …) ergänzen oder — wenn " +
        "die Tabelle die User-ID als Primärschlüssel führt — oben in EXEMPT " +
        "aufnehmen, mit Begründung:\n  " + offenders.join("\n  ")
    ).toEqual([]);
  });

  it("die Ausnahmeliste enthält keine Karteileichen", () => {
    // Eine Ausnahme für eine Datei, die es nicht mehr gibt oder die gar nicht
    // mehr schreibt, verschleiert nur, wie streng die Regel wirklich ist.
    const stale = Object.keys(EXEMPT).filter((file) => {
      let source: string;
      try {
        source = readFileSync(join(process.cwd(), file), "utf8");
      } catch {
        return true;
      }
      return !source.includes("@/shared/supabase/client") || !/\.(update|delete)\(/.test(source);
    });

    expect(stale, `Überflüssige EXEMPT-Einträge: ${stale.join(", ")}`).toEqual([]);
  });
});
