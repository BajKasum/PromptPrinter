import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Handy-Audit 2026-10-17: Menü-, Anhang-, Mikrofon-, Senden-Knopf (36 px), "Prompt kopieren" (20 px hoch),
// "Neu erzeugen" (27 px hoch) und viele Symbolknöpfe lagen unter 44 px. `touch-hit` / `touch-hit-y`
// (globals.css) erweitern auf Touch die Trefferfläche per ::after, ohne das Bild zu ändern. Zwei Dinge
// brechen das still: die Regel verschwindet oder rutscht in eine @layer, oder der Knopf ist nicht
// positioniert (das ::after sässe dann am falschen Vorfahren).

const css = readFileSync("src/app/globals.css", "utf8").replace(/\r\n/g, "\n");

function depthAt(text: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
  }
  return depth;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe("Trefferfläche von 44 px auf Touch", () => {
  const start = css.indexOf(".touch-hit::after");
  const mediaStart = css.lastIndexOf("@media (pointer: coarse)", start);

  it("hat die Regeln, nur für Touch, mit 44 px", () => {
    expect(start).toBeGreaterThan(-1);
    expect(mediaStart).toBeGreaterThan(-1);
    const block = css.slice(mediaStart, css.indexOf("\n}\n", start) + 3);
    expect(block).toMatch(/\.touch-hit-y::after/);
    expect(block).toMatch(/max\(100%,\s*44px\)/);
  });

  it("steht ausserhalb jeder @layer", () => {
    expect(depthAt(css, mediaStart)).toBe(0);
  });

  it("jeder Knopf mit touch-hit ist positioniert (relative, absolute, fixed oder sticky)", () => {
    const offenders: string[] = [];
    let used = 0;
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/"([^"]*\btouch-hit(?:-y)?\b[^"]*)"/g)) {
        used++;
        if (!/\b(relative|absolute|fixed|sticky)\b/.test(m[1])) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(used).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});

// #152: sechs kleine Bedienelemente (14 x 14 bis 256 x 18 px) trugen die Klasse nicht, darunter das Auge
// "Key anzeigen" im Key-Feld, das kleinste Ziel im wichtigsten Schritt der Einrichtung. Der Test oben
// prueft nur, dass ein Knopf MIT Klasse positioniert ist, nicht, dass ein kleiner Knopf sie ueberhaupt
// bekommt. Jede Zeile hier nennt die Datei und ein Stück der className des Elements.
describe("Kleine Bedienelemente tragen touch-hit (#152)", () => {
  const SMALL_TARGETS: [file: string, label: string, classFragment: string][] = [
    ["src/shared/ui/api-key-field.tsx", "Key anzeigen im Key-Feld", "text-tertiary transition-colors hover:text-foreground/70"],
    ["src/features/settings/components/api-keys.tsx", "Key anzeigen im Endpoint-Formular", "text-tertiary transition-colors hover:text-foreground/70"],
    ["src/features/settings/components/api-keys.tsx", "Anderer Anbieter? Eigenen Endpoint verbinden", "text-[12px] text-tertiary underline-offset-2"],
    ["src/features/settings/components/settings-workspace.tsx", "Plan verwalten", "text-accent-text transition-colors hover:text-accent-text/80"],
    ["src/features/projects/components/project-brain.tsx", "Details im Gedächtnis", "rounded text-[12px] text-secondary transition-colors"],
    ["src/app/(app)/usage/page.tsx", "Plan und Abo", "text-[12.5px] text-tertiary underline underline-offset-2"],
  ];

  it.each(SMALL_TARGETS)("%s: %s", (file, _label, fragment) => {
    const text = readFileSync(file, "utf8");
    const classNames = Array.from(text.matchAll(/"([^"\n]+)"/g))
      .map((m) => m[1])
      .filter((c) => c.includes(fragment));
    expect(classNames.length).toBeGreaterThan(0);
    for (const c of classNames) expect(c).toMatch(/\btouch-hit(?:-y)?\b/);
  });
});
