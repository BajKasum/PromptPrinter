import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { Linter, type Rule } from "eslint";
import typescriptConfig from "eslint-config-next/typescript";

// Misst Funktionslänge, Komplexität und Verschachtelung mit den Kernregeln von ESLint und ordnet jeden Fund einer
// Funktion zu. Benannt wird sie nach sich und den umschließenden Funktionen, nie nach der Zeile, damit ein Fund
// beim Verschieben derselbe bleibt. Die Schranke dazu: tests/guards/function-limits.test.ts.

export const LIMITS = { lines: 100, complexity: 15, depth: 4 } as const;
export type Metric = keyof typeof LIMITS;

/** Funktion → Maß → Werte über der Grenze, absteigend: gleich benannte Funktionen einer Datei teilen sich die Liste. */
export type FileFindings = Record<string, Partial<Record<Metric, number[]>>>;
/** Datei (Pfad relativ zum Repo, mit "/") → Funde. */
export type Findings = Record<string, FileFindings>;

const EXCLUDED = [
  /\.test\.(tsx?|mjs)$/,
  // Wörterbücher sind Daten, Rechtstexte Fließtext: beides lässt sich nicht sinnvoll zerlegen.
  /^src\/shared\/i18n\/messages\//,
  /^src\/app\/\(marketing\)\/\(legal\)\//,
  // Geprüfte Kopie des Skill-Skripts, sie wird nicht von Hand geändert.
  /^cli\/src\/context\.mjs$/,
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function measuredFiles(root = process.cwd()): string[] {
  return ["src", "cli/src"]
    .flatMap((dir) => walk(join(root, dir)))
    .map((file) => relative(root, file).replace(/\\/g, "/"))
    .filter((file) => /\.(tsx?|mjs)$/.test(file) && !EXCLUDED.some((pattern) => pattern.test(file)))
    .sort();
}

type Position = { line: number; column: number };
type Node = {
  type: string;
  parent?: Node | null;
  loc: { start: Position; end: Position };
  id?: Node | null;
  key?: Node;
  value?: unknown;
  kind?: string;
  callee?: Node;
  object?: Node;
  property?: Node;
  left?: Node;
  name?: string | Node;
};
type Found = { node: Node; start: Position; end: Position };

const FUNCTION_TYPES = ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"];
const MEMBER_TYPES = ["Property", "MethodDefinition", "PropertyDefinition"];

/** `a`, aus `x.b` das `b`, aus einem Schlüssel `"c"` das `c`. */
function shortName(node: Node | string | null | undefined): string {
  if (typeof node === "string") return node;
  if (!node) return "anonym";
  if (node.type === "Identifier" || node.type === "JSXIdentifier") return String(node.name);
  if (node.type === "PrivateIdentifier") return `#${String(node.name)}`;
  if (node.type === "Literal") return String(node.value);
  if (node.type === "MemberExpression") return shortName(node.property);
  if (node.type === "JSXMemberExpression") return `${shortName(node.object)}.${shortName(node.property)}`;
  return "anonym";
}

/** Die Klasse oder das benannte Objekt, zu dem eine Methode gehört. */
function ownerName(container: Node | null | undefined): string | null {
  if (container?.type === "ClassBody") return container.parent?.id ? shortName(container.parent.id) : null;
  const holder = container?.parent;
  if (holder?.type === "VariableDeclarator") return shortName(holder.id);
  return holder?.type === "Property" ? shortName(holder.key) : null;
}

/** Der Name einer Funktion: ihr eigener, sonst der der Stelle, an der sie steht. */
function label(node: Node): string {
  if (node.id) return shortName(node.id);
  const parent = node.parent;
  if (!parent) return "anonym";
  if (MEMBER_TYPES.includes(parent.type) && parent.value === node) {
    const owner = ownerName(parent.parent);
    const accessor = parent.kind === "get" || parent.kind === "set" ? `${parent.kind} ` : "";
    return `${owner ? `${owner}.` : ""}${accessor}${shortName(parent.key)}`;
  }
  switch (parent.type) {
    case "VariableDeclarator":
      return shortName(parent.id);
    case "AssignmentExpression":
      return shortName(parent.left);
    case "CallExpression":
    case "NewExpression": {
      // `const save = useCallback(…)` heißt nach beidem, ein loser `useEffect(…)` nach dem Aufruf.
      const call = `${shortName(parent.callee)}()`;
      const declared = parent.parent?.type === "VariableDeclarator" ? parent.parent.id : null;
      return declared?.type === "Identifier" ? `${shortName(declared)} = ${call}` : call;
    }
    case "JSXExpressionContainer": {
      const attribute = parent.parent;
      if (attribute?.type !== "JSXAttribute") return "JSX";
      return `<${shortName(attribute.parent?.name)}> ${shortName(attribute.name)}`;
    }
    case "ExportDefaultDeclaration":
      return "default";
    case "ReturnStatement":
      return "return";
    default:
      return "anonym";
  }
}

function functionPath(fn: Node): string {
  const names: string[] = [];
  for (let node: Node | null | undefined = fn; node; node = node.parent) {
    if (FUNCTION_TYPES.includes(node.type)) names.unshift(label(node));
  }
  return names.join(" › ");
}

/** Sammelt jede Funktion samt der Spanne, in der ESLint einen Fund zu ihr melden kann (bei Methoden ab dem Namen). */
function collector(found: Found[]): Rule.RuleModule {
  const collect = (raw: unknown) => {
    const node = raw as Node;
    const parent = node.parent;
    const span = parent && MEMBER_TYPES.includes(parent.type) && parent.value === node ? parent : node;
    found.push({ node, ...span.loc });
  };
  return { create: () => Object.fromEntries(FUNCTION_TYPES.map((type) => [type, collect])) };
}

const before = (a: Position, b: Position) => a.line < b.line || (a.line === b.line && a.column <= b.column);

/** Die innerste Funktion an einer Stelle. `found` steht in der Reihenfolge des Baums, innen also später. */
function innermost(found: Found[], at: Position): Node | null {
  let best: Found | null = null;
  for (const entry of found) {
    // `end` zeigt hinter das letzte Zeichen.
    const inside = before(entry.start, at) && !before(entry.end, at);
    if (inside && (!best || before(best.start, entry.start))) best = entry;
  }
  return best?.node ?? null;
}

const RULES: Record<string, { metric: Metric; value: RegExp }> = {
  "max-lines-per-function": { metric: "lines", value: /too many lines \((\d+)\)/ },
  complexity: { metric: "complexity", value: /complexity of (\d+)/ },
  "max-depth": { metric: "depth", value: /nested too deeply \((\d+)\)/ },
};

const parser = typescriptConfig.find((entry) => entry.languageOptions?.parser)?.languageOptions?.parser;

/** Die Funde einer Datei. Wirft, wenn ESLint sie nicht lesen kann: eine ungemessene Datei sähe sonst sauber aus. */
export function measureText(file: string, text: string): FileFindings {
  if (!parser) throw new Error("eslint-config-next/typescript liefert keinen Parser mehr.");
  const found: Found[] = [];
  const messages = new Linter().verify(
    text,
    [
      {
        files: ["**/*.{ts,tsx,mjs}"],
        plugins: { guard: { rules: { functions: collector(found) } } },
        languageOptions: { parser },
        // `eslint-disable` in einer Datei darf die Messung nicht abschalten.
        linterOptions: { noInlineConfig: true },
        rules: {
          "guard/functions": "error",
          "max-lines-per-function": [
            "error",
            { max: LIMITS.lines, skipBlankLines: true, skipComments: true, IIFEs: true },
          ],
          complexity: ["error", LIMITS.complexity],
          "max-depth": ["error", LIMITS.depth],
        },
      },
    ],
    { filename: file }
  );

  // Je Funktion der höchste Wert: `max-depth` meldet jeden zu tiefen Block einzeln.
  const worst = new Map<Node | null, Partial<Record<Metric, number>>>();
  for (const message of messages) {
    // Der Hinweis, dass ein `eslint-disable` wirkungslos ist.
    if (!message.ruleId && message.message.includes("noInlineConfig")) continue;
    const rule = message.ruleId ? RULES[message.ruleId] : undefined;
    const value = Number(rule?.value.exec(message.message)?.[1]);
    if (!rule || !Number.isInteger(value)) throw new Error(`${file}:${message.line}: ${message.message}`);
    const fn = innermost(found, { line: message.line, column: message.column - 1 });
    const values = worst.get(fn) ?? {};
    values[rule.metric] = Math.max(value, values[rule.metric] ?? 0);
    worst.set(fn, values);
  }

  const out: FileFindings = {};
  const entries = [...worst].map(([fn, values]) => [fn ? functionPath(fn) : "(Modulebene)", values] as const);
  for (const [name, values] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const target = (out[name] ??= {});
    for (const metric of Object.keys(LIMITS) as Metric[]) {
      const value = values[metric];
      if (value !== undefined) target[metric] = [...(target[metric] ?? []), value].sort((a, b) => b - a);
    }
  }
  return out;
}

export type Excess = { file: string; name: string; metric: Metric; value: number; allowed: number | undefined };

/**
 * Alle Werte aus `findings`, die über dem Wert gleichen Rangs in `reference` liegen oder dort fehlen. Mit dem
 * Basiswert als `reference` sind das neue und gewachsene Funde, andersherum die Einträge, die niemand mehr braucht.
 */
export function above(findings: Findings, reference: Findings): Excess[] {
  return Object.entries(findings).flatMap(([file, functions]) =>
    Object.entries(functions).flatMap(([name, metrics]) =>
      (Object.entries(metrics) as [Metric, number[]][]).flatMap(([metric, values]) =>
        values.flatMap((value, rank) => {
          const allowed = reference[file]?.[name]?.[metric]?.[rank];
          return allowed !== undefined && value <= allowed ? [] : [{ file, name, metric, value, allowed }];
        })
      )
    )
  );
}
