import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHAT_SYSTEM_PROMPT } from "@/server/system-prompt";
import { FINN_SYSTEM_PROMPT } from "../../cli/src/finn-prompt.mjs";
import { parse, walk } from "./parse-source";

// Das Programm in cli/ geht ohne den Web-Teil auf npm und importiert ihn deshalb nie. Es hält eine wörtliche Kopie
// von Finns Regeln und Prüfsummen der Dateien, auf denen es aufbaut (cli/contract/pins.json, dazu die Quelle seiner
// Kopie von skill/pp/scripts/context.mjs). Beides prüft jeder Lauf von npm run test: wer eine dieser Dateien ändert,
// liest im selben Pull Request nach, ob cli/ nachziehen muss, und erneuert dann die Prüfsummen
// (node cli/scripts/check-contract.mjs --update).
//
// Die Absagen des Servers unterscheidet das Programm an ihrer Art (`kind`). Jede Art, die es nennt, muss der Server
// in den Routen senden, mit denen es spricht: eine umbenannte oder entfernte Art zeigt sonst nur noch den Rohtext.

const ROOT = join(__dirname, "..", "..");

/** Wo die Absagen entstehen, die beim Programm ankommen: der Chat, seine eigenen Routen und die Kostenkette. */
const SERVER_SOURCES = ["src/app/api/chat", "src/app/api/cli", "src/server/model-call.ts"];

/** Hier stehen Helfer, die selbst eine Art setzen. Sie zählt nur, wenn eine der Quellen oben den Helfer ruft. */
const HELPERS = "src/server/http/api-problem.ts";

function sources(path: string, pattern: RegExp): string[] {
  if (pattern.test(path)) return [path];
  return readdirSync(join(ROOT, path), { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return sources(child, pattern);
    return pattern.test(child) && !/\.test\.[a-z]+$/.test(child) ? [child] : [];
  });
}

/** Die Arten, nach denen das Programm fragt: jeder Vergleich `err.kind === "…"` oder `!==` in cli/src. */
function kindsOfProgram(): string[] {
  const found: string[] = [];
  for (const file of sources("cli/src", /\.mjs$/)) {
    walk(parse(file), (node) => {
      if (!ts.isBinaryExpression(node) || !ts.isStringLiteral(node.right)) return;
      const { kind } = node.operatorToken;
      if (kind !== ts.SyntaxKind.EqualsEqualsEqualsToken && kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return;
      if (ts.isPropertyAccessExpression(node.left) && node.left.getText() === "err.kind") found.push(node.right.text);
    });
  }
  return [...new Set(found)].sort();
}

/** `kind` im dritten Argument jedes `problem(…)` unterhalb von `root`. */
function kindsWritten(root: ts.Node): string[] {
  const found: string[] = [];
  walk(root, (node) => {
    if (!ts.isCallExpression(node) || node.expression.getText() !== "problem") return;
    const extra = node.arguments[2];
    if (!extra || !ts.isObjectLiteralExpression(extra)) return;
    for (const property of extra.properties) {
      if (ts.isPropertyAssignment(property) && property.name.getText() === "kind" && ts.isStringLiteral(property.initializer)) {
        found.push(property.initializer.text);
      }
    }
  });
  return found;
}

/** Je Funktion in HELPERS die Arten, die sie selbst sendet, gelesen aus ihrem Quelltext. */
function kindsOfHelpers(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  walk(parse(HELPERS), (node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name) return;
    const kinds = kindsWritten(node);
    if (kinds.length > 0) found.set(node.name.text, kinds);
  });
  return found;
}

/** Die Arten, die der Server in diesen Dateien sendet: selbst geschrieben oder durch den Aufruf eines Helfers. */
function kindsOfServer(files = SERVER_SOURCES.flatMap((path) => sources(path, /\.ts$/))): Set<string> {
  const helpers = kindsOfHelpers();
  const found = new Set<string>();
  for (const file of files) {
    const root = parse(file);
    for (const kind of kindsWritten(root)) found.add(kind);
    walk(root, (node) => {
      if (!ts.isCallExpression(node)) return;
      for (const kind of helpers.get(node.expression.getText()) ?? []) found.add(kind);
    });
  }
  return found;
}

describe("Vertrag mit cli/", () => {
  it("jede Fehlerart, die das Programm unterscheidet, sendet der Server", () => {
    const program = kindsOfProgram();
    // Die Suche selbst: sähe sie nichts mehr, wäre die Schranke still grün.
    expect(program).toEqual(expect.arrayContaining(["byokRequired", "consentRequired", "slow_down"]));
    const server = kindsOfServer();
    expect(
      program.filter((kind) => !server.has(kind)),
      "Diese Fehlerarten fragt cli/ ab, aber keine Route, mit der es spricht, sendet sie. Entfernt oder umbenannt: " +
        "Zweig und Text in cli/ nachziehen."
    ).toEqual([]);
  });


  it("zählt die Art eines Helfers nur dort, wo er gerufen wird", () => {
    const kinds = kindsOfHelpers().get("rateLimitedProblem") ?? [];
    expect(kinds, `rateLimitedProblem in ${HELPERS} setzt keine Art mehr, die sich ablesen lässt.`).not.toEqual([]);

    expect([...kindsOfServer(["src/server/model-call.ts"])]).toEqual(expect.arrayContaining(kinds));
    const elsewhere = kindsOfServer(["src/app/api/chat/turn.ts"]);
    expect(kinds.filter((kind) => elsewhere.has(kind))).toEqual([]);
  });

  it("Finns Regeln ohne Konto sind Zeichen für Zeichen die des Servers", () => {
    expect(FINN_SYSTEM_PROMPT).toBe(CHAT_SYSTEM_PROMPT);
  });

  it("die Dateien, auf denen das Programm aufbaut, stimmen mit den Prüfsummen überein", () => {
    const run = spawnSync(process.execPath, [join(ROOT, "cli", "scripts", "check-contract.mjs")], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
  });
});
