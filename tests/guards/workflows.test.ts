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

/** Die Jobs eines Workflows mit ihrem Text, ohne Kommentare. */
function jobsOf(text: string): { name: string; body: string }[] {
  const lines = (codeOf(text).split(/^jobs:\n/m)[1] ?? "").split("\n");
  const jobs: { name: string; lines: string[] }[] = [];
  for (const line of lines) {
    const head = line.match(/^ {2}([\w-]+):\s*$/);
    if (head) jobs.push({ name: head[1], lines: [] });
    else jobs.at(-1)?.lines.push(line);
  }
  return jobs.map((job) => ({ name: job.name, body: job.lines.join("\n") }));
}

/** Die Zweige hinter `push: branches:`, inline oder als Liste; null, wenn der Filter fehlt. */
function pushBranches(text: string): string[] | null {
  const push = codeOf(text).match(/^ {2}push:\n((?: {4,}.*\n)+)/m)?.[1];
  const branches = push?.match(/^ {4}branches:(.*)\n((?: {6,}- .*\n)*)/m);
  if (!branches) return null;
  const entries = branches[1].trim()
    ? branches[1].replace(/[[\]]/g, "").split(",")
    : branches[2].split("\n").map((line) => line.replace(/^\s*-\s*/, ""));
  return entries.map((entry) => entry.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

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

  // #222: push auf jeden Branch UND pull_request starteten jeden Commit eines PR-Branches zweimal (die Gruppen
  // der Concurrency unterscheiden sich, der zweite Lauf bricht den ersten nicht ab). Ein Workflow, der auf
  // pull_request läuft, hört bei push nur auf main.
  it("startet jeden Commit einmal: läuft ein Workflow auf pull_request, hört push nur auf main", () => {
    let geprueft = 0;
    for (const { file, text } of workflows) {
      const code = codeOf(text);
      if (!/^ {2}pull_request\b/m.test(code) || !/^ {2}push:/m.test(code)) continue;
      geprueft++;
      expect(pushBranches(text), `${file}: push ohne Zweigfilter oder auf mehr als main, dazu pull_request`).toEqual([
        "main",
      ]);
    }
    expect(geprueft, "kein Workflow mit push und pull_request gefunden: prüft der Test noch etwas?").toBeGreaterThan(0);
  });

  it("setzt für jeden Job eine Zeitgrenze, damit ein hängender Lauf nicht bis zur Standardgrenze von 360 Minuten läuft", () => {
    for (const { file, text } of workflows) {
      const jobs = jobsOf(text);
      expect(jobs.length, `${file}: kein Job gefunden`).toBeGreaterThan(0);
      for (const { name, body } of jobs) {
        const minutes = Number(body.match(/^ {4}timeout-minutes:\s*(\d+)\s*$/m)?.[1]);
        expect(minutes, `${file}, Job ${name}: timeout-minutes fehlt`).toBeGreaterThan(0);
        expect(minutes, `${file}, Job ${name}: timeout-minutes über einer Stunde`).toBeLessThanOrEqual(60);
      }
    }
  });
});
