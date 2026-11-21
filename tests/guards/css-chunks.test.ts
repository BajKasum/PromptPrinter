import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateCssChunks } from "../../scripts/check-css-chunks.mjs";

// Ein zweites Stylesheet blockiert das erste Bild (scripts/check-css-chunks.mjs). Die Prüfung läuft in der CI
// nach dem Build; hier wird festgehalten, dass sie anschlägt und dass sie dort auch aufgerufen wird.

describe("Ein Stylesheet je Build", () => {
  it("lässt genau eine Datei durch", () => {
    expect(evaluateCssChunks([{ name: "0_aljhkqyb9e3.css", bytes: 99842 }]).ok).toBe(true);
  });

  it("schlägt bei zwei Dateien an und nennt beide", () => {
    const result = evaluateCssChunks([
      { name: "2rro7k2-b44zn.css", bytes: 98772 },
      { name: "0iowk77qien2f.css", bytes: 3607 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("2rro7k2-b44zn.css");
    expect(result.message).toContain("0iowk77qien2f.css");
  });

  it("schlägt an, wenn der Build gar kein CSS hat", () => {
    expect(evaluateCssChunks([]).ok).toBe(false);
  });

  it("läuft in der CI direkt nach dem Build", () => {
    const ci = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    const build = ci.indexOf("run: npm run build");
    const check = ci.indexOf("run: node scripts/check-css-chunks.mjs");
    expect(build).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(build);
  });
});
