import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Hält fest, dass die Überschrift einer öffentlichen Seite ohne JavaScript
// sichtbar ist.
//
// ─── Warum ein Guard ───────────────────────────────────────────────────────
// framer-motion liefert für `initial={{ opacity: 0 }}` (direkt oder über
// `FadeIn`) ein `style="opacity:0"` im HTML aus. Die h1 jeder öffentlichen
// Seite stand so bis 2026-10-01 unsichtbar im ersten Bild und erschien erst
// nach dem Hydrieren. Lighthouse mass dafür mobil LCP 3,0 bis 3,4 s bei
// FCP 1,0 s, davon rund 1,7 s reine "element render delay".
//
// Der Fehler sieht auf einem schnellen Rechner aus wie eine hübsche
// Einblendung. Niemand bemerkt, wenn er zurückkommt.

const ROOTS = [
  join(process.cwd(), "src", "app", "(marketing)"),
  join(process.cwd(), "src", "features", "marketing", "components"),
];

function tsxFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

const files = ROOTS.flatMap(tsxFilesIn).map((file) => ({
  name: relative(process.cwd(), file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

describe("Sichtbare Überschriften", () => {
  it("findet die öffentlichen Seiten und ihre Komponenten", () => {
    expect(files.length).toBeGreaterThan(25);
  });

  it("animiert keine h1 über framer-motion", () => {
    const offenders = files.filter((f) => /<motion\.h1\b/.test(f.source)).map((f) => f.name);
    expect(
      offenders,
      `motion.h1 liefert opacity:0 im HTML aus. Nimm die Klasse "enter-rise":\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("stellt keine h1 in ein FadeIn", () => {
    // Vom öffnenden <FadeIn …> bis zur ersten h1, ohne dass dazwischen ein
    // </FadeIn> schliesst.
    const wrapped = /<FadeIn\b[^>]*>(?:(?!<\/FadeIn>)[\s\S])*?<h1\b/;
    const offenders = files.filter((f) => wrapped.test(f.source)).map((f) => f.name);
    expect(
      offenders,
      `FadeIn blendet erst nach dem Hydrieren ein. Für den Seitenkopf gibt es <Rise>:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
