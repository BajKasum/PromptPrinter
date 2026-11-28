import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// scripts/take-screenshots.mjs meldet sich über das echte Anmeldeformular an. Es läuft nur von Hand gegen einen
// laufenden Server, ein umbenanntes Feld fiele also erst dort auf: dieser Test hält die Selektoren am Formular fest.

const script = readFileSync("scripts/take-screenshots.mjs", "utf8");
const form = readFileSync("src/features/auth/components/sign-in-experience.tsx", "utf8");

describe("Screenshot-Skript", () => {
  const typed = [...script.matchAll(/loginPage\.type\("#([\w-]+)",\s*(EMAIL|PASSWORD)\b/g)].map((m) => [m[2], m[1]]);

  it("füllt Adresse und Passwort", () => {
    expect(typed.map(([value]) => value)).toEqual(["EMAIL", "PASSWORD"]);
  });

  it.each(typed)("das Feld für %s (#%s) gibt es im Anmeldeformular", (_value, id) => {
    expect(form).toContain(`id="${id}"`);
  });

  it("schickt das Formular über seinen Absende-Knopf ab", () => {
    expect(script).toContain(`loginPage.click('button[type="submit"]')`);
    expect(form).toContain('type="submit"');
  });
});
