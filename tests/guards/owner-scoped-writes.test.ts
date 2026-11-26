import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { moduleReferences, parse, resolveModule, walk } from "./parse-source";

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
// Geprüft wird auf Dateiebene, nicht pro Query: eine Datei, die den Browser-Client
// importiert (auch über einen relativen Pfad), mit `.update(`, `.delete(` oder
// `.upsert(` schreibt und `user_id` nirgends im Code nennt, ist das Signal — der
// Rest ist Review. Gelesen wird mit dem Parser (parse-source.ts), ein `user_id`
// im Kommentar zählt also nicht.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const BROWSER_CLIENT = "src/shared/supabase/client";
const WRITES = new Set(["update", "delete", "upsert"]);

/**
 * Schreibende Dateien, die kein `user_id` brauchen, mit Begründung.
 * Jeder Eintrag ist eine bewusste Entscheidung, kein Rückstand.
 */
const EXEMPT: Record<string, string> = {
  // profiles.id IST die User-ID (FK auf auth.users). `.eq("id", userId)` ist
  // damit bereits die Eigentümer-Eingrenzung, ein zusätzliches user_id-Feld
  // existiert auf der Tabelle gar nicht.
  "src/features/settings/components/settings-workspace.tsx": "profiles.id ist die User-ID",
  "src/features/settings/components/about-me.tsx": "profiles.id ist die User-ID",
  "src/shared/i18n/use-change-locale.ts": "profiles.id ist die User-ID",
};

/** Schreibt die Datei über den Browser-Client, und nennt sie `user_id` im Code (Name oder Zeichenkette)? */
function clientWrites(file: string, text?: string): { writes: boolean; scoped: boolean } {
  const source = parse(file, text);
  const usesClient = moduleReferences(source).some(
    (ref) => ref.specifier !== null && resolveModule(file, ref.specifier) === BROWSER_CLIENT
  );
  let writes = false;
  let scoped = false;
  walk(source, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && WRITES.has(node.expression.name.text)) {
      writes = true;
    }
    const named = ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node);
    if (named && node.text.includes("user_id")) scoped = true;
  });
  return { writes: usesClient && writes, scoped };
}

function tsxFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("Eigentümer-Eingrenzung bei Client-Schreibzugriffen", () => {
  it("jede Datei, die über den Browser-Client schreibt, grenzt auf user_id ein", () => {
    // Nur der Browser-Client ist gemeint. Server-Code läuft ohnehin hinter
    // eigenen Prüfungen und nutzt teils den Admin-Client absichtlich ohne RLS.
    const offenders = tsxFilesIn(SRC)
      .map((absolute) => relative(ROOT, absolute).replace(/\\/g, "/"))
      .filter((file) => {
        const { writes, scoped } = clientWrites(file);
        return writes && !scoped && !EXEMPT[file];
      });

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
    const stale = Object.keys(EXEMPT).filter((file) => !existsSync(join(ROOT, file)) || !clientWrites(file).writes);

    expect(stale, `Überflüssige EXEMPT-Einträge: ${stale.join(", ")}`).toEqual([]);
  });
});

describe("Eigentümer-Eingrenzung: der Scanner", () => {
  const client = `import { createClient } from "@/shared/supabase/client";\nconst supabase = createClient();\n`;
  const offends = (file: string, text: string) => {
    const { writes, scoped } = clientWrites(file, text);
    return writes && !scoped;
  };

  it("sieht auch upsert, einen relativen Import des Clients und ein user_id, das nur im Kommentar steht", () => {
    expect(offends("src/features/x/a.ts", client + `await supabase.from("t").upsert({ id });`)).toBe(true);
    expect(
      offends(
        "src/shared/i18n/a.ts",
        `import { createClient } from "../supabase/client";\nawait createClient().from("t").update({ a }).eq("id", id);`
      )
    ).toBe(true);
    expect(offends("src/features/x/a.ts", client + `// user_id grenzt RLS ein\nawait supabase.from("t").delete().eq("id", id);`)).toBe(true);
  });

  it("lässt eingegrenzte Schreibstellen, Lesezugriffe und Code ohne Browser-Client durch", () => {
    expect(offends("src/features/x/a.ts", client + `await supabase.from("t").update({ a }).eq("user_id", userId);`)).toBe(false);
    expect(offends("src/features/x/a.ts", client + `await supabase.from("t").upsert({ id, user_id: userId });`)).toBe(false);
    expect(offends("src/features/x/a.ts", client + `await supabase.from("t").select("id");`)).toBe(false);
    expect(offends("src/features/x/a.ts", `const params = new URLSearchParams();\nparams.delete("x");`)).toBe(false);
  });
});
