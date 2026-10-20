import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit 2026-10-18, #126: auf Free gibt es ohne eigenen KI-Key keinen einzigen Chat, und die
// Startseite sagte das erst im letzten Abschnitt. Wer auf "Leg mit Finn los" klickt, soll vorher
// wissen, was er für den ersten Prompt braucht. Dieser Guard hält die Stellen fest, an denen der
// Hinweis stehen muss: unter den drei Schritten, im Abschluss und in der Anmeldung. **Nicht im Hero**:
// die Zeile unter den Knöpfen ("Du brauchst dafür einen KI-Key ...") hat Kasum am 2026-10-20 wieder
// entfernt, sie passt nicht auf die Startseite. Der Guard sorgt dafür, dass sie nicht zurückkommt.

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const KEY_GUIDE = "/docs/eigene-api-keys";

describe("Startseite nennt die Key-Voraussetzung vor der Registrierung", () => {
  it("der Ablauf (HowItWorks) nennt den KI-Key und verlinkt die Anleitung", () => {
    const src = read("src/features/marketing/components/how-it-works.tsx");
    expect(src).toMatch(/KI-Key/);
    expect(src).toContain(`href="${KEY_GUIDE}"`);
  });

  it("der Hero trägt keine Key-Zeile (von Kasum entfernt, 2026-10-20)", () => {
    const src = read("src/features/marketing/components/hero.tsx");
    expect(src).not.toMatch(/KI-Key/);
    expect(src).not.toContain(KEY_GUIDE);
  });

  it("die verlinkte Anleitung existiert", () => {
    expect(existsSync(join(ROOT, "src/app/(marketing)/docs/eigene-api-keys/page.tsx"))).toBe(true);
  });

  it("die Registrierung und der Abschluss der Startseite nennen den Key ebenfalls", () => {
    expect(read("src/features/auth/components/sign-up-experience.tsx")).toMatch(/Zum Chatten brauchst du einen eigenen KI-Key/);
    expect(read("src/features/marketing/components/final-cta.tsx")).toMatch(/KI-Key/);
  });
});
