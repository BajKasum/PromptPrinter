import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards QA finding U-1 against drifting back.
//
// The failing pattern was an alpha ramp on `foreground` for secondary text.
// It was calibrated in dark mode, where it works, and silently fell below WCAG
// AA in light mode because contrast does not scale linearly with alpha: the
// same `text-foreground/55` is 5.4:1 on the dark background and 4.1:1 on the
// light one. It reached ~110 call sites before anyone measured it, and a
// previous fix only corrected three of them — which is exactly why this is a
// test rather than a note in a style guide.
//
// Use `text-secondary` / `text-tertiary` (both calibrated per theme in
// globals.css) for anything quieter than `foreground`.

const SOURCE_ROOT = join(process.cwd(), "src");

// Anything below /70 is the problem: /70 is ~7:1 in both themes, /65 and down
// is where light mode starts failing.
const FORBIDDEN = /text-foreground\/([0-6]?\d)\b/g;
const MIN_SAFE_ALPHA = 70;

function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectTsx(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("text contrast tokens (QA finding U-1)", () => {
  it("no component dips below the safe alpha on foreground", () => {
    const offenders: string[] = [];

    for (const file of collectTsx(SOURCE_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(FORBIDDEN)) {
        if (Number(match[1]) < MIN_SAFE_ALPHA) {
          offenders.push(`${file.replace(process.cwd(), "")}: ${match[0]}`);
        }
      }
    }

    expect(
      offenders,
      "Unter WCAG AA im Light Mode. Nutze text-secondary oder text-tertiary " +
        "(globals.css, pro Theme kalibriert) statt einer Alpha-Stufe auf foreground."
    ).toEqual([]);
  });

  it("both calibrated steps are defined for both themes", () => {
    const css = readFileSync(join(SOURCE_ROOT, "app", "globals.css"), "utf8");
    // Match the selectors' opening braces, not a bare `.dark` that also occurs
    // in prose comments above the block.
    const light = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
    const dark = css.slice(css.indexOf(".dark {"));

    for (const token of ["--text-secondary", "--text-tertiary"]) {
      expect(light, `${token} fehlt im Light-Theme`).toContain(token);
      expect(dark, `${token} fehlt im Dark-Theme`).toContain(token);
    }
  });
});
