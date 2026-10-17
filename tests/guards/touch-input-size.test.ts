import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Handy-Audit 2026-10-17: Eingabefelder mit 12,5 bis 14 px lassen iOS-Safari beim Fokus hineinzoomen.
// Die Regel in globals.css muss (1) für Touch gelten, (2) 16 px setzen und (3) ausserhalb jeder
// `@layer` stehen, sonst gewinnen die Tailwind-Grössen (text-sm ...) aus `@layer utilities`.

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
    expect(block).toMatch(/font-size:\s*16px/);
  });

  it("steht ausserhalb jeder @layer (sonst gewinnen die Tailwind-Grössen)", () => {
    expect(depthAt(css, START)).toBe(0);
  });
});
