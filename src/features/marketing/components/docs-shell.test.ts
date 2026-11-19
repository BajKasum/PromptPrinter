import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Ein Codeblock in einem Hilfe-Artikel (`<pre>`, etwa der Befehl für Claude Code in "Terminal und MCP" oder die
// Zeilen für .env.local in "Selbst betreiben") ist breiter als ein Handy. Ohne eigenes Scrollen verbreitert er die
// ganze Seite (bei 375 px gemessen: 357 und 574 px). Die Prosa der Hilfe muss ihn deshalb in sich scrollen lassen.

const source = readFileSync(join(__dirname, "docs-shell.tsx"), "utf8");

describe("DocsShell: Codeblöcke", () => {
  it("lassen lange Zeilen im Block scrollen statt die Seite zu verbreitern", () => {
    expect(source).toContain("[&_pre]:overflow-x-auto");
  });

  it("geben dem Code im Block keinen zweiten Rahmen", () => {
    expect(source).toContain("[&_pre_code]:border-0");
  });
});
