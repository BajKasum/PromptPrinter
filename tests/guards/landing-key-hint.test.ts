import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit 2026-10-18, #126: auf Free gibt es ohne eigenen KI-Key keinen einzigen Chat, und die
// Startseite sagte das erst im letzten Abschnitt. Wer auf "Leg mit Finn los" klickt, soll vorher
// wissen, was er für den ersten Prompt braucht. Dieser Guard hält die Stellen fest, an denen der
// Hinweis stehen muss: unter dem Hero-Knopf, unter den drei Schritten und in der Anmeldung.

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const KEY_GUIDE = "/docs/eigene-api-keys";

describe("Startseite nennt die Key-Voraussetzung vor der Registrierung", () => {
  it.each([
    ["Hero", "src/features/marketing/components/hero.tsx"],
    ["Ablauf (HowItWorks)", "src/features/marketing/components/how-it-works.tsx"],
  ])("%s nennt den KI-Key und verlinkt die Anleitung", (_name, path) => {
    const src = read(path);
    expect(src).toMatch(/KI-Key/);
    expect(src).toContain(`href="${KEY_GUIDE}"`);
  });

  it("die verlinkte Anleitung existiert", () => {
    expect(existsSync(join(ROOT, "src/app/(marketing)/docs/eigene-api-keys/page.tsx"))).toBe(true);
  });

  it("die Registrierung und der Abschluss der Startseite nennen den Key ebenfalls", () => {
    expect(read("src/features/auth/components/sign-up-experience.tsx")).toMatch(/Zum Chatten brauchst du einen eigenen KI-Key/);
    expect(read("src/features/marketing/components/final-cta.tsx")).toMatch(/KI-Key/);
  });
});
