import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { bindingNames, parse, walk } from "./parse-source";

// #202: supabase-js wirft bei einem Fehler nicht, es liefert `{ data: null, error }`. Wer nur `data` (oder `count`)
// aus einer Abfrage nimmt, liest einen Datenbankaussetzer als "es gibt nichts": falscher Plan, kein eigener Key, eine
// neue Konversation, ein Projekt ohne Kontext, ein Abo, das nach dem Löschen des Kontos weiter läuft. Dieser Guard
// meldet jede Abfrage `await supabase…`, deren Ergebnis `data` oder `count` hergibt, ohne dass `error` gelesen wird:
// zerlegt (`const { data } = await supabase…`, auch mit `let` und als Zuweisung ohne Deklaration), direkt
// (`(await supabase…).data`) oder unter einem Namen (`const x = await supabase…`, auch `const [x, y] = await
// Promise.all(…)`), wenn danach in derselben Funktion `x.data` oder `x.count` gelesen oder `x` zerlegt wird, ohne
// `x.error` oder `orThrow(x`. Den Quelltext liest der Parser (parse-source.ts): ein Kommentar zählt nicht, und eine
// Prüfung in einer anderen Funktion gilt nicht für diese.
//
// Wer eine neue Abfrage schreibt, liest den Fehler mit (`const { data, error }`) oder nimmt `orThrow` aus
// server/supabase/query.ts. Eine Ausnahme braucht einen Eintrag unten, mit Grund. Die Liste "NOCH OFFEN" ist der
// Rest von #202: sie darf nur kürzer werden (der Test verlangt, einen Eintrag zu löschen, sobald seine Stelle
// gelesen wird).

const ROOT = process.cwd();

/**
 * Absichtlich best effort: ein Fehler gilt dort als "nichts", und das ist hier die richtige Entscheidung. Der Schlüssel
 * ist Datei und lokaler Name; jede Stelle hat einen eigenen Namen, damit eine Ausnahme nicht für jede `data`-Abfrage
 * derselben Datei gilt.
 */
const BEST_EFFORT: Record<string, string> = {
  "src/features/chat/lib/attachment-store.ts:signed": "Signierte Bildadressen: ohne sie fehlt nur die Vorschau, die Chat-Seite bleibt",
  "src/server/activation-funnel.ts:recentProfiles": "Auswertung für die Statistik, keine Entscheidung hängt daran",
  "src/shared/i18n/use-change-locale.ts:profile": "Browser: das Speichern der Sprache ist ein Nebeneffekt, der Cookie gilt so oder so",
};

/** Noch nicht umgestellt (Rest von #202). Eintrag löschen, sobald die Stelle den Fehler liest. */
const STILL_OPEN: Record<string, string> = {
};

// auth.getUser() und getClaims() sind absichtlich nicht dabei: ein Fehler heißt dort "nicht angemeldet", die sichere Seite.
const QUERY = /\.from\(|\.rpc\(|\.storage/;
const READS = new Set(["data", "count"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

type Key = { key: string; local: string };

const propertyText = (name: ts.PropertyName) =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) ? name.text : name.getText();

/** Die Schlüssel eines Musters `{ a, b: c, ...d }` (Deklaration oder Zuweisung) und ihr lokaler Name. */
function patternKeys(pattern: ts.Node): Key[] {
  if (ts.isObjectBindingPattern(pattern)) {
    return pattern.elements.map((element) => {
      const key = element.dotDotDotToken
        ? "..."
        : element.propertyName
          ? propertyText(element.propertyName)
          : bindingNames(element.name)[0];
      return { key, local: ts.isIdentifier(element.name) ? element.name.text : key };
    });
  }
  if (ts.isObjectLiteralExpression(pattern)) {
    return pattern.properties.map((property) => {
      if (ts.isShorthandPropertyAssignment(property)) return { key: property.name.text, local: property.name.text };
      if (ts.isPropertyAssignment(property)) {
        const key = propertyText(property.name);
        return { key, local: ts.isIdentifier(property.initializer) ? property.initializer.text : key };
      }
      return { key: "...", local: "..." };
    });
  }
  return [];
}

const isPattern = (node: ts.Node) =>
  ts.isObjectBindingPattern(node) || ts.isObjectLiteralExpression(node) || ts.isArrayBindingPattern(node) || ts.isArrayLiteralExpression(node);
const isAssignment = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;

/** Der Ausdruck samt Klammern, `as`, `satisfies` und `!` um ihn herum. */
function outermost(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent) ||
    ts.isNonNullExpression(current.parent) ||
    ts.isTypeAssertionExpression(current.parent)
  ) {
    current = current.parent;
  }
  return current;
}

/** Die Funktion, in der ein Knoten steht, oder die Datei. */
function scopeOf(node: ts.Node): ts.Node {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return parent;
  }
  return node.getSourceFile();
}

/** Bindet eine innere Funktion den Namen selbst (Parameter oder eigene Deklaration)? Dann meint sie einen anderen. */
function rebinds(fn: ts.SignatureDeclaration, name: string): boolean {
  if (fn.parameters.some((parameter) => bindingNames(parameter.name).includes(name))) return true;
  let found = false;
  const visit = (node: ts.Node) => {
    if (found || ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node) && bindingNames(node.name).includes(name)) found = true;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn, visit);
  return found;
}

/** Wie ein Ergebnis unter `name` nach `after` in seiner Funktion benutzt wird: liest es `data`/`count`, prüft es `error`? */
function usesOf(scope: ts.Node, name: string, after: number): { reads: boolean; checks: boolean } {
  let reads = false;
  let checks = false;
  const readProperty = (property: string) => {
    if (READS.has(property)) reads = true;
    if (property === "error") checks = true;
  };
  const visit = (node: ts.Node): void => {
    if (node !== scope && ts.isFunctionLike(node) && rebinds(node, name)) return;
    if (ts.isIdentifier(node) && node.text === name && node.getStart() >= after) {
      const parent = node.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) readProperty(parent.name.text);
      else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
        if (ts.isStringLiteralLike(parent.argumentExpression)) readProperty(parent.argumentExpression.text);
      } else if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === "orThrow") {
        if (parent.arguments[0] === node) checks = true;
      } else if ((ts.isVariableDeclaration(parent) && parent.initializer === node) || (isAssignment(parent) && parent.right === node)) {
        // Zerlegt (`const { data } = x`) oder weitergereicht (`const y = x`): ohne `error` im Muster ein Lesen.
        const target = ts.isVariableDeclaration(parent) ? parent.name : parent.left;
        const keys = isPattern(target) ? patternKeys(target) : [];
        if (keys.some((k) => k.key === "error")) checks = true;
        else reads = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return { reads, checks };
}

/** Jede Abfrage der Datei, deren Ergebnis `data` oder `count` hergibt, aber `error` nicht: ihre lokalen Namen. */
function unreadErrors(text: string, file = "snippet.ts"): string[] {
  const found: string[] = [];
  const source = parse(file, text);

  const checkName = (name: string, query: ts.AwaitExpression) => {
    const { reads, checks } = usesOf(scopeOf(query), name, query.end);
    if (reads && !checks) found.push(name);
  };
  const checkKeys = (pattern: ts.Node) => {
    const keys = patternKeys(pattern);
    const read = keys.find((k) => READS.has(k.key));
    if (read && !keys.some((k) => k.key === "error")) found.push(read.local);
  };
  const checkTarget = (target: ts.Node, query: ts.AwaitExpression) => {
    if (ts.isIdentifier(target)) return checkName(target.text, query);
    if (ts.isObjectBindingPattern(target) || ts.isObjectLiteralExpression(target)) return checkKeys(target);
    if (ts.isArrayBindingPattern(target) || ts.isArrayLiteralExpression(target)) {
      for (const element of target.elements) {
        const inner = ts.isBindingElement(element) ? element.name : element;
        if (ts.isIdentifier(inner)) checkName(inner.text, query);
        else if (ts.isObjectBindingPattern(inner) || ts.isObjectLiteralExpression(inner)) checkKeys(inner);
      }
    }
  };

  walk(source, (node) => {
    if (!ts.isAwaitExpression(node) || !QUERY.test(node.expression.getText(source))) return;
    const whole = outermost(node);
    const parent = whole.parent;
    if (ts.isVariableDeclaration(parent) && parent.initializer === whole) checkTarget(parent.name, node);
    else if (isAssignment(parent) && parent.right === whole) checkTarget(parent.left, node);
    else if (ts.isPropertyAccessExpression(parent) && parent.expression === whole && READS.has(parent.name.text)) {
      found.push(parent.name.text);
    }
  });
  return found;
}

const files = sourceFiles("src").map((file) => ({
  path: file.replaceAll("\\", "/"),
  text: readFileSync(join(ROOT, file), "utf8"),
}));

const unread = files.flatMap((f) => unreadErrors(f.text, f.path).map((name) => `${f.path}:${name}`));
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
    // Ergebnis unter einem Namen (Ö5 im Review vom 12.11.2026).
    expect(unreadErrors("const res = await supabase.from('x').select();\nreturn res.data;")).toEqual(["res"]);
    expect(unreadErrors("const res = await supabase.from('x').select();\nconst { data } = res;")).toEqual(["res"]);
    expect(unreadErrors("const res = await supabase.from('x').select();\nif (res.error) throw 1;\nreturn res.data;")).toEqual([]);
    expect(unreadErrors("const res = await supabase.from('x').select();\nreturn orThrow(res, 'x').data;")).toEqual([]);
    expect(
      unreadErrors("const [a, b] = await Promise.all([supabase.from('x'), supabase.from('y')]);\nf(a.data, b.count, b.error);")
    ).toEqual(["a"]);
    expect(unreadErrors("const res = await fetch('/x');\nreturn res.data;")).toEqual([]);
    expect(unreadErrors("// const { data } = await supabase.from('x').select();")).toEqual([]);
  });

  it("der Scanner sieht auch `let`, Zuweisungen ohne Deklaration und den Zugriff ohne Namen", () => {
    expect(unreadErrors("let { data } = await supabase.from('x').select();")).toEqual(["data"]);
    expect(unreadErrors("let res = await supabase.from('x').select();\nreturn res.data;")).toEqual(["res"]);
    expect(unreadErrors("let data;\n({ data } = await supabase.from('x').select());")).toEqual(["data"]);
    expect(unreadErrors("let res;\nres = await supabase.from('x').select();\nf(res.data);")).toEqual(["res"]);
    expect(unreadErrors("let a;\n[a] = await Promise.all([supabase.from('x')]);\nf(a.count);")).toEqual(["a"]);
    expect(unreadErrors("const rows = (await supabase.from('x').select()).data;")).toEqual(["data"]);
    expect(unreadErrors("const res = (await supabase.from('x').select()) as Result;\nreturn res.data;")).toEqual(["res"]);
    expect(unreadErrors("let res;\nres = await supabase.from('x').select();\nif (res.error) throw 1;\nf(res.data);")).toEqual([]);
  });

  it("der Scanner rechnet eine Fehlerprüfung nur der Funktion zu, in der sie steht", () => {
    const twoFunctions = [
      "async function a() {",
      "  const res = await supabase.from('x').select();",
      "  return res.data;",
      "}",
      "async function b() {",
      "  const res = await supabase.from('y').select();",
      "  if (res.error) throw new Error('y');",
      "  return res.data;",
      "}",
    ].join("\n");
    expect(unreadErrors(twoFunctions)).toEqual(["res"]);
    // Ein Rückruf in derselben Funktion meint dasselbe Ergebnis, einer mit eigenem `res` ein anderes.
    const callback = "async function a() {\n  const res = await supabase.from('x').select();\n  if (res.error) throw 1;\n  return list.map(() => res.data);\n}";
    expect(unreadErrors(callback)).toEqual([]);
    const shadowed = "async function a() {\n  const res = await supabase.from('x').select();\n  list.forEach((res) => res.error);\n  return res.data;\n}";
    expect(unreadErrors(shadowed)).toEqual(["res"]);
  });
});
