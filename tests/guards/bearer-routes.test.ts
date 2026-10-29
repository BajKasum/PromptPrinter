import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Welche Routen eine Anfrage mit `Authorization: Bearer` annehmen dürfen (Anmeldung der Kommandozeile).
//
// Der Bearer-Weg ist eine zweite Tür neben dem Cookie: wer ihn benutzt, hat kein Sitzungs-Cookie, keinen
// SameSite-Schutz und keine Origin-Prüfung. Er gehört deshalb nur dorthin, wo eine Kommandozeile etwas
// tun muss, und jede weitere Route ist eine Entscheidung, keine Gewohnheit. Der Guard liest den Quellbaum
// nach den beiden Wegen, den Kopf zu lesen (createClientForRequest, bearerToken), und verlangt für jede
// Fundstelle einen Eintrag mit Begründung. Der Chat ist die erste, die Abmeldung die zweite (sie braucht
// das Token selbst, um genau diese Sitzung zu beenden); sie kommt mit den Routen unter api/cli.

const ROOT = process.cwd();

/** Dateien, die den Bearer-Weg nutzen dürfen, je mit Grund. */
const ALLOWED: Record<string, string> = {
  "src/app/api/chat/gate.ts": "der Chat ist das Ziel der Kommandozeile (createClientForRequest)",
};

/** Hier sind die beiden Wege definiert. */
const DEFINITIONS = new Set(["src/server/supabase/server.ts", "src/server/supabase/bearer.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const files = sourceFiles("src").map((file) => ({
  path: relative(ROOT, file).replaceAll("\\", "/"),
  text: readFileSync(file, "utf8"),
}));

const USES_BEARER = /\b(createClientForRequest|bearerToken)\b|headers\.get\(\s*["']authorization["']\s*\)/i;

describe("Bearer-Routen", () => {
  it("nur die eingetragenen Dateien lesen den Authorization-Kopf", () => {
    const offenders = files
      .filter((file) => !DEFINITIONS.has(file.path) && USES_BEARER.test(file.text))
      .map((file) => file.path)
      .filter((path) => !ALLOWED[path]);
    expect(
      offenders,
      "Diese Dateien nutzen den Bearer-Weg, ohne in ALLOWED zu stehen. Eine Route, die ihn annimmt, " +
        "ist eine Entscheidung (kein Cookie, keine Origin-Prüfung): eintragen, mit Grund, oder " +
        "createClient() nehmen:\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });

  it("jeder Eintrag der Liste nutzt den Bearer-Weg wirklich noch", () => {
    const stale = Object.keys(ALLOWED).filter((path) => {
      const file = files.find((f) => f.path === path);
      return !file || !USES_BEARER.test(file.text);
    });
    expect(stale, `Überflüssige Einträge: ${stale.join(", ")}`).toEqual([]);
  });

  it("der Authorization-Kopf wird nur in den beiden Definitionen direkt gelesen", () => {
    const direct = files
      .filter((file) => /headers\.get\(\s*["']authorization["']\s*\)/i.test(file.text))
      .map((file) => file.path)
      .filter((path) => !DEFINITIONS.has(path));
    expect(direct, "den Kopf liest bearerToken(), nicht jede Route für sich").toEqual([]);
  });
});
