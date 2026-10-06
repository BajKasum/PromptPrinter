import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Versionen, die Dependabot NICHT sieht (Betriebs-Audit 04.10.2026, M10), und
// die Zusagen rund um Dependabot selbst.
//
// Dependabot kennt Pakete aus package.json und Actions aus .github/workflows.
// Die Version der Supabase-CLI steht aber als Text an drei Stellen: als Eingabe
// der Action in e2e.yml, in der Anleitung (docs/SETUP.md) und in der
// Fehlermeldung von e2e/support/env.ts. Wer sie an einer Stelle anhebt und die
// anderen vergisst, bekommt lokal eine andere Datenbank als in der CI, also
// genau die Abweichung, die der lokale Stack ausschließen soll.

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Alle Stellen, an denen die Supabase-CLI-Version steht, mit Fundort. */
function supabaseCliVersions() {
  const found: { where: string; version: string }[] = [];

  const e2e = read(".github/workflows/e2e.yml");
  // `uses: supabase/setup-cli@…` gefolgt von `with:` und `version: X`.
  const action = e2e.match(/uses:\s*supabase\/setup-cli@[^\n]*\n\s*with:\s*\n\s*version:\s*([0-9][0-9.]*)/);
  if (action) found.push({ where: ".github/workflows/e2e.yml", version: action[1] });

  const setup = read("docs/SETUP.md");
  for (const m of setup.matchAll(/supabase@([0-9][0-9.]*)/g)) {
    found.push({ where: "docs/SETUP.md (supabase@…)", version: m[1] });
  }
  const derzeit = setup.match(/derzeit\s+([0-9]+\.[0-9]+\.[0-9]+)/);
  if (derzeit) found.push({ where: 'docs/SETUP.md ("derzeit …")', version: derzeit[1] });

  const env = read("e2e/support/env.ts");
  for (const m of env.matchAll(/supabase@([0-9][0-9.]*)/g)) {
    found.push({ where: "e2e/support/env.ts", version: m[1] });
  }

  return found;
}

describe("Supabase-CLI-Version", () => {
  const found = supabaseCliVersions();

  it("steht an allen vier Stellen, an denen wir sie nennen (nichts wurde stillschweigend entfernt)", () => {
    const where = new Set(found.map((f) => f.where.split(" ")[0]));
    expect(where).toEqual(new Set([".github/workflows/e2e.yml", "docs/SETUP.md", "e2e/support/env.ts"]));
    // SETUP.md nennt sie dreimal (Fließtext + zwei Befehle), die Action und die
    // Fehlermeldung je einmal.
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  it("ist überall dieselbe", () => {
    const versions = new Set(found.map((f) => f.version));
    expect(
      [...versions],
      "Supabase-CLI-Version weicht ab:\n" + found.map((f) => `  ${f.where}: ${f.version}`).join("\n")
    ).toHaveLength(1);
  });
});

describe("Dependabot", () => {
  const config = read(".github/dependabot.yml");

  it("deckt npm und github-actions ab, beide wöchentlich", () => {
    expect(config).toMatch(/package-ecosystem:\s*npm\b/);
    expect(config).toMatch(/package-ecosystem:\s*github-actions\b/);
    // Zwei Einträge, zwei Zeitpläne: keiner täglich, keiner fehlt.
    expect(config.match(/interval:\s*weekly/g)).toHaveLength(2);
    expect(config).not.toMatch(/interval:\s*daily/);
  });

  it("gruppiert nur Minor und Patch, Majors kommen einzeln", () => {
    expect(config.match(/update-types:/g)).toHaveLength(2);
    // Ein "major" in einer Gruppe würde Sprünge mit Breaking Change in einen
    // Sammel-PR legen, der sich nicht teilweise zurücknehmen lässt.
    expect(config).not.toMatch(/-\s*major\b/);
  });

  it("begrenzt die offenen PRs", () => {
    const limits = [...config.matchAll(/open-pull-requests-limit:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(limits).toHaveLength(2);
    for (const limit of limits) {
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(5);
    }
  });

  it("hat keinen Auto-Merge: kein Workflow dafür, jeder Merge ist Kasums Entscheidung", () => {
    const dir = join(ROOT, ".github", "workflows");
    for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
      const text = readFileSync(join(dir, file), "utf8");
      // Kommentare dürfen das Wort nennen (diese Datei erklärt es selbst), der
      // ausführbare Teil nicht.
      const code = text
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("#"))
        .join("\n");
      expect(code, `${file}: Auto-Merge verdrahtet`).not.toMatch(
        /--auto\b|enable-auto-merge|dependabot\/fetch-metadata|gh pr merge/
      );
    }
  });
});
