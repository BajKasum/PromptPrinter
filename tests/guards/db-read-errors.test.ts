import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// #202: supabase-js wirft bei einem Fehler nicht, es liefert `{ data: null, error }`. Wer nur `data` (oder `count`)
// aus einer Abfrage nimmt, liest einen Datenbankaussetzer als "es gibt nichts": falscher Plan, kein eigener Key, eine
// neue Konversation, ein Projekt ohne Kontext, ein Abo, das nach dem Löschen des Kontos weiter läuft. Dieser Guard
// meldet jede Abfrage der Form `const { data } = await supabase…`, die `error` nicht mitliest.
//
// Wer eine neue Abfrage schreibt, liest den Fehler mit (`const { data, error }`) oder nimmt `orThrow` aus
// server/supabase/query.ts. Eine Ausnahme braucht einen Eintrag unten, mit Grund. Die Liste "NOCH OFFEN" ist der
// Rest von #202: sie darf nur kürzer werden (der Test verlangt, einen Eintrag zu löschen, sobald seine Stelle
// gelesen wird).

const ROOT = process.cwd();

/** Absichtlich best effort: ein Fehler gilt dort als "nichts", und das ist hier die richtige Entscheidung. */
const BEST_EFFORT: Record<string, string> = {
  "src/features/chat/lib/attachment-store.ts:data": "Signierte Bildadressen: ohne sie fehlt nur die Vorschau, die Chat-Seite bleibt",
  "src/server/activation-funnel.ts:data": "Auswertung für die Statistik, keine Entscheidung hängt daran",
  "src/shared/i18n/use-change-locale.ts:data": "Browser: das Speichern der Sprache ist ein Nebeneffekt, der Cookie gilt so oder so",
  "src/features/auth/components/sign-up-experience.tsx:profile": "Browser: Hinweis nach der Anmeldung, nur Anzeige",
};

/** Noch nicht umgestellt (Rest von #202). Eintrag löschen, sobald die Stelle den Fehler liest. */
const STILL_OPEN: Record<string, string> = {
  "src/features/chat/components/move-to-project.tsx:data": "Browser: Auswahlliste, liegt in dieser Runde bei einer anderen Sitzung",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

/** Der Teil ab `open` bis zur passenden schließenden Klammer, samt Klammern. */
function balanced(text: string, open: number): string {
  const pairs: Record<string, string> = { "{": "}", "[": "]" };
  const stack: string[] = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c in pairs) stack.push(pairs[c]);
    else if (c === "}" || c === "]") {
      stack.pop();
      if (stack.length === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open);
}

/** Die Namen der Schlüssel und ihre Umbenennung auf der obersten Ebene eines `{ a, b: c, d: { … } }`. */
function topLevelKeys(objectPattern: string): { key: string; local: string }[] {
  const inner = objectPattern.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const c of inner) {
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") depth--;
    if (c === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += c;
  }
  parts.push(current);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [key, rest] = p.split(":");
      const local = rest ? rest.trim().replace(/^\{.*$/s, "") || key.trim() : key.trim();
      return { key: key.trim(), local: local.trim() };
    });
}

/** Jede Abfrage `const … = await <Supabase>` in der Datei, deren Ergebnis `data` oder `count` nimmt, aber `error` nicht. */
function unreadErrors(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bconst\s+(?=[{[])/g)) {
    const start = match.index! + match[0].length;
    const pattern = balanced(text, start);
    const after = text.slice(start + pattern.length, start + pattern.length + 600);
    if (!/^\s*=\s*await\b/.test(after)) continue;
    const expression = after.slice(0, after.indexOf(";") === -1 ? 600 : after.indexOf(";"));
    // auth.getUser() und getClaims() sind absichtlich nicht dabei: ein Fehler heißt dort "nicht angemeldet", die sichere Seite.
    if (!/\.from\(|\.rpc\(|\.storage/.test(expression)) continue;
    const objects = pattern.startsWith("[")
      ? pattern.slice(1, -1).split(/,\s*(?=\{)/).map((p) => p.trim()).filter((p) => p.startsWith("{"))
      : [pattern];
    for (const object of objects) {
      const keys = topLevelKeys(balanced(object, 0));
      const reads = keys.find((k) => k.key === "data" || k.key === "count");
      if (reads && !keys.some((k) => k.key === "error")) found.push(reads.local);
    }
  }
  return found;
}

const files = sourceFiles("src").map((file) => ({
  path: relative(ROOT, file).replaceAll("\\", "/"),
  text: readFileSync(join(ROOT, file), "utf8"),
}));

const unread = files.flatMap((f) => unreadErrors(f.text).map((name) => `${f.path}:${name}`));
const known = new Set([...Object.keys(BEST_EFFORT), ...Object.keys(STILL_OPEN)]);
const isKnown = (key: string) => known.has(key);

describe("Datenbankfehler werden nicht als 'kein Treffer' gelesen", () => {
  it("jede Abfrage liest den Fehler mit, außer den benannten Ausnahmen", () => {
    const fresh = unread.filter((key) => !isKnown(key));
    expect(fresh, "neue Abfrage ohne `error`: Fehler mitlesen oder orThrow nehmen").toEqual([]);
  });

  it("die Ausnahmelisten enthalten nur Stellen, die es noch gibt (gelesene Stellen gehören gelöscht)", () => {
    const stale = [...known].filter((key) => !unread.includes(key));
    expect(stale).toEqual([]);
  });

  it("der Scanner erkennt eine ungelesene und lässt eine gelesene Abfrage durch", () => {
    expect(unreadErrors("const { data } = await supabase.from('x').select();")).toEqual(["data"]);
    expect(unreadErrors("const { data: profile } = await supabase\n  .from('x')\n  .select();")).toEqual(["profile"]);
    expect(unreadErrors("const { count } = await supabase.from('x').select();")).toEqual(["count"]);
    expect(unreadErrors("const [{ data: a }, { count }] = await Promise.all([supabase.from('x')]);")).toEqual([
      "a",
      "count",
    ]);
    expect(unreadErrors("const { data, error } = await supabase.from('x').select();")).toEqual([]);
    expect(unreadErrors("const { data: a, error: b } = await supabase.from('x').select();")).toEqual([]);
    expect(unreadErrors("const { data: { user } } = await supabase.auth.getUser();")).toEqual([]);
    expect(unreadErrors("const { data: { x } } = await supabase.from('a').select();")).toEqual(["data"]);
    expect(unreadErrors("const { data } = await somethingElse();")).toEqual([]);
  });
});
