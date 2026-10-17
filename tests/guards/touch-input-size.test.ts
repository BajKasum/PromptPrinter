import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Handy-Audit 2026-10-17: Eingabefelder mit 12,5 bis 14 px lassen iOS-Safari beim Fokus hineinzoomen.
// Die Regel in globals.css muss (1) für Touch gelten, (2) 16 px setzen, (3) `!important` tragen und
// (4) ausserhalb jeder `@layer` stehen. Tailwind 3 hat keine echten CSS-Ebenen: `.text-sm` (0,1,0) schlägt
// ein blosses `textarea` oder `select` (0,0,1). Die erste Fassung ohne `!important` wirkte live nicht
// (Textfeld blieb bei 14 px), der Test prüfte nur den Quelltext.

const css = readFileSync("src/app/globals.css", "utf8").replace(/\r\n/g, "\n");
const START = css.indexOf("@media (pointer: coarse)");

/** Schachtelungstiefe der geschweiften Klammern an einer Stelle (Kommentare enthalten keine). */
function depthAt(text: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
  }
  return depth;
}

describe("Eingabefelder auf Touch-Geräten", () => {
  it("hat eine Touch-Regel", () => {
    expect(START).toBeGreaterThan(-1);
  });

  it("setzt Felder, Textfelder und Auswahllisten auf mindestens 16 px", () => {
    const block = css.slice(START, css.indexOf("\n}\n", START) + 3);
    expect(block).toMatch(/\btextarea\b/);
    expect(block).toMatch(/\bselect\b/);
    expect(block).toMatch(/\binput:not\(/);
    expect(block).toMatch(/font-size:\s*16px\s*!important/);
  });

  it("steht ausserhalb jeder @layer (sonst gewinnen die Tailwind-Grössen)", () => {
    expect(depthAt(css, START)).toBe(0);
  });
});
