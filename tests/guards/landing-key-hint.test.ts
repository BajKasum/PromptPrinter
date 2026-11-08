import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FREE_TRIAL } from "@/shared/lib/plans";

// #126: wer auf "Leg mit Finn los" klickt, soll vorher wissen, wie es auf Free läuft: drei Prompts gehen auf
// Finn (FREE_TRIAL in shared/lib/plans.ts), danach braucht es einen eigenen KI-Key. Dieser Guard hält die Stellen
// fest, an denen beides stehen muss: unter den drei Schritten, im Abschluss und in der Anmeldung. **Nicht im Hero**:
// die Zeile unter den Knöpfen ("Du brauchst dafür einen KI-Key ...") hat Kasum am 2026-10-20 wieder
// entfernt, sie passt nicht auf die Startseite. Der Guard sorgt dafür, dass sie nicht zurückkommt.

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const KEY_GUIDE = "/docs/eigene-api-keys";

describe("Startseite nennt Gratis-Prompts und Key vor der Registrierung", () => {
  it("die Texte sagen drei Gratis-Prompts, und so viele gibt der Server", () => {
    expect(FREE_TRIAL.prompts).toBe(3);
    for (const path of [
      "src/features/marketing/components/how-it-works.tsx",
      "src/features/marketing/components/final-cta.tsx",
      "src/features/auth/components/sign-up-experience.tsx",
      "src/shared/lib/pricing.ts",
    ]) {
      expect(read(path), path).toMatch(/drei (Gratis-)?Prompts|3 Prompts gratis|Drei Prompts/);
    }
  });

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
    expect(read("src/features/auth/components/sign-up-experience.tsx")).toMatch(/Drei Prompts gehen auf mich, danach chattest du mit einem eigenen KI-Key/);
    expect(read("src/features/marketing/components/final-cta.tsx")).toMatch(/KI-Key/);
  });
});
