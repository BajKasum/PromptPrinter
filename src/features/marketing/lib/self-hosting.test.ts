import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_URL, SELF_HOSTING_GUIDE_URL } from "./open-source";
import {
  SELF_HOSTING_APP_URL,
  SELF_HOSTING_ENV_COPY,
  SELF_HOSTING_ENV_LINES,
  SELF_HOSTING_MODEL_COMMAND,
  SELF_HOSTING_SETUP_COMMANDS,
  SELF_HOSTING_START_COMMAND,
} from "./self-hosting";

// Der Hilfe-Artikel "Selbst betreiben" ist die Kurzfassung von docs/SETUP.md. Jeder Befehl, den er zeigt, muss dort
// in einem Codeblock des Abschnitts "Selbst betreiben" stehen, jeder Schlüssel auch in der Vorlage .env.example.

const ROOT = join(__dirname, "..", "..", "..", "..");
const setup = readFileSync(join(ROOT, "docs/SETUP.md"), "utf8");
const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");

/** Der Abschnitt "Selbst betreiben" bis zur nächsten Überschrift zweiter Ebene. */
function selfHostingSection(): string {
  const start = setup.indexOf("\n## Selbst betreiben\n");
  expect(start, "docs/SETUP.md hat keinen Abschnitt \"Selbst betreiben\"").toBeGreaterThan(-1);
  const end = setup.indexOf("\n## ", start + 1);
  return setup.slice(start, end === -1 ? undefined : end);
}

/** Alle Zeilen aus den Codeblöcken des Abschnitts. */
function codeLines(section: string): string[] {
  return [...section.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap((m) => m[1].split("\n").map((l) => l.trim()));
}

describe("Selbst betreiben: Artikel gegen docs/SETUP.md", () => {
  const lines = codeLines(selfHostingSection());

  it("liest überhaupt Codeblöcke (sonst prüfte der Test nichts)", () => {
    expect(lines.length).toBeGreaterThan(10);
  });

  it("jeder Befehl des Artikels steht wörtlich in der Anleitung", () => {
    for (const command of [
      SELF_HOSTING_MODEL_COMMAND,
      ...SELF_HOSTING_SETUP_COMMANDS,
      SELF_HOSTING_ENV_COPY,
      SELF_HOSTING_START_COMMAND,
    ]) {
      expect(lines, command).toContain(command);
    }
  });

  it("jede Zeile für .env.local steht wörtlich in der Anleitung", () => {
    for (const line of SELF_HOSTING_ENV_LINES) expect(lines, line).toContain(line);
  });

  it("jeder Schlüssel steht auch in .env.example", () => {
    for (const line of SELF_HOSTING_ENV_LINES) {
      const key = line.split("=")[0];
      expect(envExample, key).toMatch(new RegExp(`^#?\\s*${key}=`, "m"));
    }
  });

  it("die Adresse der App ist die aus NEXT_PUBLIC_APP_URL", () => {
    expect(SELF_HOSTING_ENV_LINES).toContain(`NEXT_PUBLIC_APP_URL=${SELF_HOSTING_APP_URL}`);
  });

  it("klont das Repo, auf das die Seiten verlinken, und verlinkt den Abschnitt, den es gibt", () => {
    expect(SELF_HOSTING_SETUP_COMMANDS[0]).toBe(`git clone ${REPO_URL}.git`);
    expect(SELF_HOSTING_GUIDE_URL).toBe(`${REPO_URL}/blob/main/docs/SETUP.md#selbst-betreiben`);
  });
});
