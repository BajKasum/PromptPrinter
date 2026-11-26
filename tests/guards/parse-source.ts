import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";

// Der gemeinsame Teil der Schranken, die Quelltext lesen: der Parser von TypeScript statt regulärer Ausdrücke. Er sieht
// jede Schreibweise eines Imports (statisch, Re-Export, `import()`, `require`, `typeof import(…)` und die Modul-Aufrufe
// von Vitest), löst relative Pfade auf und zählt nichts, was in einem Kommentar oder einer Zeichenkette steht.

const ROOT = process.cwd();

/** Liest eine Datei (Pfad relativ zum Repo, mit "/") oder nimmt den übergebenen Text, und parst sie. */
export function parse(file: string, text = readFileSync(join(ROOT, file), "utf8")): ts.SourceFile {
  const kind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : /\.[cm]?ts$/.test(file)
      ? ts.ScriptKind.TS
      : file.endsWith(".jsx")
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

/** Jeder Knoten des Baums, in Reihenfolge des Quelltexts. */
export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

export function lineOf(node: ts.Node): number {
  const source = node.getSourceFile();
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** Die Namen, die eine Deklaration bindet, auch aus `{ a, b: [c] }`. */
export function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) => (ts.isBindingElement(element) ? bindingNames(element.name) : []));
}

export type ModuleReference = {
  /** Der Pfad, wie er dasteht; `null`, wenn er berechnet wird (`import(name)`, ein Template mit Platzhalter). */
  specifier: string | null;
  kind: "import" | "export" | "import()" | "require" | "type" | "vi";
  /** Fällt beim Übersetzen weg: `import type`, `export type`, `typeof import(…)`. */
  typeOnly: boolean;
  /** Was der Import als Wert holt: der Name in der Quelle (`a` bei `{ a as b }`), "default" oder "*". */
  values: string[];
  line: number;
};

/** Die Aufrufe von Vitest, die ein Modul beim Pfad nennen. */
const VITEST_MODULE_CALLS = new Set(["mock", "doMock", "unmock", "doUnmock", "importActual", "importMock"]);

const pathOf = (node: ts.Node | undefined) => (node && ts.isStringLiteralLike(node) ? node.text : null);
const isImportCall = (node: ts.Node) => ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
const nameOf = (spec: ts.ImportSpecifier | ts.ExportSpecifier) => (spec.propertyName ?? spec.name).text;

function importValues(clause: ts.ImportClause | undefined): string[] {
  if (!clause || clause.isTypeOnly) return [];
  const values = clause.name ? ["default"] : [];
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) values.push("*");
  if (bindings && ts.isNamedImports(bindings)) values.push(...bindings.elements.filter((e) => !e.isTypeOnly).map(nameOf));
  return values;
}

function exportValues(node: ts.ExportDeclaration): string[] {
  if (node.isTypeOnly) return [];
  const clause = node.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return ["*"];
  return clause.elements.filter((e) => !e.isTypeOnly).map(nameOf);
}

/** Alle Stellen einer Datei, die ein Modul beim Pfad nennen. */
export function moduleReferences(source: ts.SourceFile): ModuleReference[] {
  const refs: ModuleReference[] = [];
  const add = (node: ts.Node, path: ts.Node | undefined, kind: ModuleReference["kind"], typeOnly: boolean, values: string[]) =>
    refs.push({ specifier: pathOf(path), kind, typeOnly, values, line: lineOf(node) });

  walk(source, (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node, node.moduleSpecifier, "import", node.importClause?.isTypeOnly ?? false, importValues(node.importClause));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node, node.moduleSpecifier, "export", node.isTypeOnly, exportValues(node));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, node.moduleReference.expression, "require", node.isTypeOnly, node.isTypeOnly ? [] : ["*"]);
    } else if (ts.isImportTypeNode(node)) {
      add(node, ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument, "type", true, []);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const [first] = node.arguments;
      if (isImportCall(node)) add(node, first, "import()", false, ["*"]);
      else if (ts.isIdentifier(callee) && callee.text === "require" && node.arguments.length === 1) {
        add(node, first, "require", false, ["*"]);
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "vi" &&
        VITEST_MODULE_CALLS.has(callee.name.text) &&
        first &&
        // `vi.mock(import("…"))`: der innere Aufruf zählt schon als `import()`.
        !isImportCall(first)
      ) {
        add(node, first, "vi", false, []);
      }
    }
  });
  return refs;
}

/**
 * Wohin ein Pfad zeigt: relativ zum Repo, mit "/", ohne Endung und ohne `/index`. Die Aliase sind die aus
 * tsconfig.json (`@/` und `@tests/`); `null` heißt ein Paket.
 */
export function resolveModule(fromFile: string, specifier: string): string | null {
  let target: string;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("@tests/")) target = `tests/${specifier.slice("@tests/".length)}`;
  else if (/^\.\.?(?:\/|$)/.test(specifier)) target = posix.join(posix.dirname(fromFile), specifier);
  else return null;
  return posix.normalize(target).replace(/\.(?:d\.)?[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
}
