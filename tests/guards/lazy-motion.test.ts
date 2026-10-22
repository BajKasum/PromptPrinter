import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Hält fest, dass die Animations-Engine von framer-motion nicht wieder in den ersten Chunk wandert.
//
// ─── Warum ein Guard ───────────────────────────────────────────────────────
// `motion.div` bringt die ganze Engine mit (Layout, Ziehen, alle Gesten), `m.div` unter einem
// `LazyMotion` nur die Hülle und die Funktionen von `domAnimation`. Lighthouse mobil maß live
// 380 ms Total Blocking Time auf der Startseite, der größte Einzelposten war der framer-motion-Chunk
// mit 1,2 s Ausführung (#135). Ein einziges neues `motion.div` zieht die volle Engine zurück in den
// ersten Chunk, ohne dass es jemand bemerkt: die Seite sieht gleich aus, sie ist nur schwerer.
//
// `domAnimation` hat kein `layout` und kein `drag` (das wäre `domMax`). Ein solches Attribut an
// einem `m.*` täte nichts, ohne Fehlermeldung. Deshalb auch das verboten.

const ROOT = join(process.cwd(), "src");

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFilesIn(ROOT).map((file) => ({
  name: relative(process.cwd(), file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

describe("LazyMotion", () => {
  it("findet die Quelldateien", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("importiert `motion` aus framer-motion nirgends, nur `m`", () => {
    const importsMotion = /import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*"framer-motion"/;
    const offenders = files.filter((f) => importsMotion.test(f.source)).map((f) => f.name);
    expect(
      offenders,
      `\`motion\` zieht die volle Engine in den ersten Chunk. Nimm \`m\` (LazyMotion in MotionShell):\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("nutzt kein `motion.*` als JSX-Tag", () => {
    const offenders = files.filter((f) => /<\/?motion\./.test(f.source)).map((f) => f.name);
    expect(offenders, `Stattdessen <m.…>:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("stellt im MotionShell ein LazyMotion mit domAnimation um den Baum", () => {
    const shell = files.find((f) => f.name === "src/shared/providers/motion-shell.tsx");
    expect(shell, "motion-shell.tsx fehlt").toBeDefined();
    expect(shell!.source).toMatch(/<LazyMotion\s+features=\{domAnimation\}>/);
  });

  it("nutzt keine Attribute, die nur `domMax` kennt (layout, layoutId, drag)", () => {
    // Ein Attribut je Zeile am Zeilenanfang, so schreibt Prettier mehrzeiliges JSX.
    const domMaxOnly = /^\s+(?:layout|layoutId|layoutScroll|drag|dragConstraints)(?:=|\s*$|\s*\/?>)/m;
    const offenders = files
      .filter((f) => f.name.endsWith(".tsx") && domMaxOnly.test(f.source))
      .map((f) => f.name);
    expect(
      offenders,
      `domAnimation kennt kein layout und kein drag, das Attribut täte nichts:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
