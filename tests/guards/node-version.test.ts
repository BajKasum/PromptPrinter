import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Eine Node-Hauptversion für alles, was wir testen und ausliefern
// (Betriebs-Audit 04.10.2026, M8).
//
// Bis zum 06.10.2026 lief Produktion auf Node 24 (Vercel), während CI, E2E,
// Docker und .nvmrc auf 22 standen: getestet war nie das, was ausgeliefert wurde.
// Dieser Test liest alle Stellen, an denen die Version steht, und scheitert, wenn
// sie auseinanderlaufen. Die Quelle der Wahrheit ist `.nvmrc`.
//
// WAS DIESER TEST NICHT SEHEN KANN: die Projekt-Einstellung "Node.js Version" in
// Vercel liegt außerhalb des Repositories. Sie stand am 06.10.2026 auf 24.x. Da
// `engines.node` in package.json die Projekt-Einstellung übersteuert (Vercel-
// Dokumentation, "Node.js versions"), entscheidet in Wahrheit die engines-Zeile,
// und die prüft dieser Test. Wer die Hauptversion wechselt, stellt zusätzlich die
// Vercel-Einstellung auf dieselbe Version (docs/SETUP.md, "Node-Version").

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");

const nvmrc = read(".nvmrc").trim();
const major = Number(nvmrc);
const pkg = JSON.parse(read("package.json")) as {
  engines?: { node?: string };
  devDependencies?: Record<string, string>;
};

const workflowFiles = readdirSync(join(ROOT, ".github", "workflows")).filter((f) => /\.ya?ml$/.test(f));

describe(".nvmrc", () => {
  it("nennt genau eine ganze Hauptversion", () => {
    expect(nvmrc).toMatch(/^\d+$/);
    expect(major).toBeGreaterThanOrEqual(20);
  });
});

describe(`Node ${major} an allen Stellen`, () => {
  it("package.json: engines.node ist genau diese Hauptversion (Vercel liest es und es übersteuert die Projekt-Einstellung)", () => {
    expect(pkg.engines?.node).toBe(`${major}.x`);
  });

  it("Dockerfile: jede Stufe baut auf node:<Hauptversion>-alpine", () => {
    const froms = [...read("Dockerfile").matchAll(/^FROM\s+(node:\S+)/gm)].map((m) => m[1]);
    // deps, builder, runner. Weniger hieße, dass eine Stufe entfernt wurde und
    // dieser Test stillschweigend weniger prüft.
    expect(froms.length).toBeGreaterThanOrEqual(3);
    for (const image of froms) expect(image).toBe(`node:${major}-alpine`);
  });

  it("jeder setup-node-Schritt der Workflows nimmt die Version aus .nvmrc (oder nennt dieselbe)", () => {
    let steps = 0;
    for (const file of workflowFiles) {
      const text = read(join(".github", "workflows", file));
      for (const m of text.matchAll(/uses:\s*actions\/setup-node@[^\n]*\n\s*with:\n((?:\s{10,}.*\n?)+)/g)) {
        steps++;
        const withBlock = m[1];
        const fromFile = /^\s*node-version-file:\s*\.nvmrc\s*$/m.test(withBlock);
        const literal = withBlock.match(/^\s*node-version:\s*["']?(\d+)/m);
        expect(
          fromFile || (literal !== null && Number(literal[1]) === major),
          `${file}: setup-node ohne node-version-file: .nvmrc und ohne Version ${major}`
        ).toBe(true);
      }
    }
    // ci.yml, e2e.yml, audit.yml.
    expect(steps).toBeGreaterThanOrEqual(3);
  });

  it("Workflows und Doku nennen kein anderes Basis-Image mehr", () => {
    for (const file of workflowFiles) {
      const text = read(join(".github", "workflows", file));
      for (const m of text.matchAll(/node:(\d+)-alpine/g)) {
        expect(Number(m[1]), `${file}: node:${m[1]}-alpine`).toBe(major);
      }
    }
    const docker = read("docs/DOCKER.md");
    expect(docker).toContain(`node:${major}-alpine`);
    for (const m of docker.matchAll(/node:(\d+)-alpine/g)) expect(Number(m[1]), "docs/DOCKER.md").toBe(major);
  });

  it("@types/node hat dieselbe Hauptversion (Typen für ein neueres Node ließen APIs zu, die in Produktion fehlen)", () => {
    const range = pkg.devDependencies?.["@types/node"] ?? "";
    expect(range, "@types/node fehlt in devDependencies").not.toBe("");
    expect(Number(range.replace(/^[^\d]*/, "").split(".")[0])).toBe(major);
  });

  it("Dependabot schlägt keinen @types/node-Major vor (den setzt, wer die Node-Version wechselt)", () => {
    const config = read(".github/dependabot.yml");
    expect(config).toMatch(
      /dependency-name:\s*["']@types\/node["']\s*\n\s*update-types:\s*\n\s*-\s*["']version-update:semver-major["']/
    );
  });

  it("docs/SETUP.md beschreibt die Version unter 'Node-Version'", () => {
    const setup = read("docs/SETUP.md");
    const section = setup.split(/^### Node-Version\s*$/m)[1]?.split(/^#{2,3} /m)[0] ?? "";
    expect(section, "Abschnitt '### Node-Version' fehlt").not.toBe("");
    // Die fett gesetzte Festlegung, nicht irgendeine Erwähnung: der Abschnitt
    // nennt zur Einordnung auch Node 22, 20 und 26.
    expect(section).toContain(`**Node ${major}**`);
    // Der Hinweis auf die Einstellung außerhalb des Repositories ist der Grund,
    // warum es den Abschnitt gibt.
    expect(section).toMatch(/Vercel/);
  });

  // In der CI setzt setup-node die Version aus .nvmrc. Stimmt die Laufzeit hier
  // nicht, ist der setup-node-Schritt wirkungslos geworden, und alle Tests der
  // CI liefen wieder auf der falschen Version. Lokal bewusst nicht erzwungen:
  // wer mit einer anderen Version entwickelt, soll nicht an diesem Test scheitern.
  it.runIf(process.env.CI === "true")("die CI läuft tatsächlich auf der Version aus .nvmrc", () => {
    expect(Number(process.versions.node.split(".")[0])).toBe(major);
  });
});
