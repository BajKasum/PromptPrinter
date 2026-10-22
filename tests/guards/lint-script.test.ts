import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #138: `next lint` ist veraltet und fällt mit Next 16 weg, ein Gate-Schritt, der dann verschwindet, bricht
// die CI. `npm run lint` ruft deshalb die ESLint-CLI auf, und mit `--max-warnings 0`, damit eine neue Warnung
// das Gate stoppt statt unter alten zu verschwinden. Beides bricht still: jemand stellt den Aufruf zurück, oder
// nimmt die Grenze heraus, und niemand sieht es, bis die nächste Warnung durchrutscht.

const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;
const config = readFileSync("eslint.config.mjs", "utf8");

describe("Lint-Aufruf", () => {
  it("ruft die ESLint-CLI auf, nicht next lint", () => {
    expect(scripts.lint).toMatch(/^eslint\b/);
    expect(scripts.lint).not.toMatch(/next lint/);
  });

  it("lässt keine Warnung durch", () => {
    expect(scripts.lint).toMatch(/--max-warnings 0\b/);
  });

  it("ignoriert Build-Ausgaben und erzeugte Dateien (sonst über 40 000 Meldungen und fünf Minuten)", () => {
    for (const ignored of [".next/**", "test-results/**", "next-env.d.ts"]) {
      expect(config).toContain(`"${ignored}"`);
    }
  });

  it("lässt Parameter mit Unterstrich vorn unbenutzt", () => {
    expect(config).toMatch(/argsIgnorePattern:\s*"\^_"/);
  });
});
