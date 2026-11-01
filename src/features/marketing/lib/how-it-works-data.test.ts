import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { intro, steps, title } from "./how-it-works-data";

// #247: Die Startseite sagte in keinem sichtbaren Satz, was PromptPrinter ist. Der Absatz nennt Namen und Kategorie
// im selben Satz und hält die Markenregeln ein (CLAUDE.md): Finns Ich-Form, kein Jargon, keine Bau-Tools.
describe("Startseite: Absatz zu dem, was PromptPrinter ist", () => {
  it("beginnt mit dem Namen und sagt in diesem Satz, was es ist", () => {
    const first = intro.split(". ")[0];
    expect(first).toMatch(/^PromptPrinter ist ein Prompt-Generator/);
  });

  it("nennt die KI, für die der Prompt gedacht ist, ohne sich auf eine festzulegen", () => {
    expect(intro).toMatch(/ChatGPT, Claude, Gemini oder jede andere KI/);
  });

  it("spricht in Finns Ich-Form und duzt", () => {
    expect(intro).toMatch(/\bIch bin Finn\b/);
    expect(intro).toMatch(/\b(dir|du|dein|deine)\b/);
    expect(intro).not.toMatch(/\b(Sie|Ihr|Ihre)\b/);
  });

  it("nennt keine Bau-Tools, keine Zielgruppe Vibe-Coder und keinen Fachjargon", () => {
    expect(intro).not.toMatch(/Lovable|Cursor|\bv0\b|Bolt|Vibe|Blueprint|\bPRD\b|Long-Context|Artefakt|\bRLS\b|Schema/i);
  });

  it("sagt nichts über Preise, Messwerte oder Versprechen, die der Code nicht hält", () => {
    expect(intro).not.toMatch(/€|\d+\s?%|\bgratis\b|\bkostenlos\b|\bgarantiert\b/i);
  });

  // Entscheid zu #247: die Schlüsselwörter im Root-Layout bleiben (Google ignoriert sie, bei sechs Einträgen schaden sie
  // nicht), und der Begriff steht jetzt zusätzlich im sichtbaren Text. Fällt er dort aus den Schlüsselwörtern, stimmt
  // der Kommentar in how-it-works-data.ts nicht mehr.
  it("der Begriff steht auch in den Schlüsselwörtern des Root-Layouts", () => {
    const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('"Prompt-Generator"');
  });

  it("bleibt bei den drei Schritten der Ablaufbeschreibung", () => {
    expect(title).toBe("In drei Schritten von der Idee zum fertigen Prompt.");
    expect(steps).toHaveLength(3);
  });
});
