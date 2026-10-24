import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rechte und Herkunft der Workflows (Repository-Schutz #133, Code-Scanning
// "actions/missing-workflow-permissions").
//
// Der Token eines Laufs ist ohne Angabe so breit, wie die Repository-Einstellung
// es erlaubt, und ein Tag wie `@v7` kann jemand verschieben. Darum trägt jeder
// Workflow oben `permissions:` (nur lesen, wer mehr braucht, nennt es) und jede
// Action hängt an einer Commit-SHA. Dependabot (`github-actions`) hebt die SHA
// zusammen mit dem Versionskommentar an.

const DIR = join(__dirname, "..", "..", ".github", "workflows");
const workflows = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8").replaceAll("\r\n", "\n") }));

/** Zeilen ohne Kommentare, damit eine Erklärung im Text nichts auslöst. */
const codeOf = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

describe("Workflows", () => {
  it("gibt es", () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  it("begrenzen den Token oben mit `permissions:`, ohne Schreibrecht auf alles", () => {
    for (const { file, text } of workflows) {
      const block = codeOf(text).match(/^permissions:\n((?: {2}\S.*\n)+)/m);
      expect(block, `${file}: kein permissions-Block auf oberster Ebene`).not.toBeNull();
      expect(block![1], `${file}: contents: read fehlt`).toMatch(/^ {2}contents: read$/m);
      expect(block![1], `${file}: write-all`).not.toMatch(/write-all/);
    }
  });

  it("binden jede Action an eine Commit-SHA, nicht an einen Tag", () => {
    for (const { file, text } of workflows) {
      const uses = [...codeOf(text).matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1]);
      expect(uses.length, `${file}: keine Action gefunden`).toBeGreaterThan(0);
      for (const ref of uses) {
        expect(ref, `${file}: ${ref}`).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
      }
    }
  });

  it("nennt neben der SHA die Version als Kommentar, damit Dependabot sie lesen kann", () => {
    for (const { file, text } of workflows) {
      for (const line of text.split("\n")) {
        if (!/^\s*(?:-\s+)?uses:\s*\S+@[0-9a-f]{40}/.test(line)) continue;
        expect(line, `${file}: ${line.trim()}`).toMatch(/@[0-9a-f]{40} # v\d/);
      }
    }
  });
});
