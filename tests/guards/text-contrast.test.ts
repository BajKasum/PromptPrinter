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

// M-15 (Audit 06.09.2026): the same trap, one token quieter. `muted-foreground`
// is already the app's dimmest general-purpose text token — at full opacity
// it's only 5.4:1 on background / 4.9:1 on the least favorable surface in
// light mode (barely over AA's 4.5:1 floor, exactly on par with the calibrated
// `text-tertiary`). There is no alpha level below 100 that stays over AA: /90
// already dips to 4.3:1 on background, /70 (the value 14 call sites actually
// used) lands at 2.9:1. Unlike `text-foreground`, where /70 is the safe floor,
// here ANY suffixed alpha is the violation — hence no MIN_SAFE_ALPHA constant.
const FORBIDDEN_MUTED = /text-muted-foreground\/\d+\b/g;

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

  // M-15 (Audit 06.09.2026): dieser Guard prüfte nur `text-foreground/NN`, ein
  // baugleiches Alpha-Muster auf `muted-foreground` (14 Fundstellen, u.a.
  // sidebar.tsx) fiel durch, obwohl es dort noch schlechter aussieht — siehe
  // FORBIDDEN_MUTED's eigener Kommentar.
  it("no component dilutes muted-foreground with an alpha modifier", () => {
    const offenders: string[] = [];

    for (const file of collectTsx(SOURCE_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(FORBIDDEN_MUTED)) {
        offenders.push(`${file.replace(process.cwd(), "")}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      "muted-foreground ist schon bei voller Deckkraft der dunkelste sichere Ton " +
        "im Light Mode — jede Alpha-Stufe darunter fällt unter WCAG AA. Nutze " +
        "text-secondary oder text-tertiary (globals.css, pro Theme kalibriert), " +
        "oder das unverdünnte text-muted-foreground für Icons/UI-Chrome."
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
