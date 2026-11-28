import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { above, LIMITS, measuredFiles, measureText, type Findings, type Metric } from "../support/function-limits";

// Funktionslänge, Komplexität und Verschachtelung. Die Grenze je Datei (file-size.test.ts) sagt nichts darüber, was
// in ihr steht, und eine Funktion über 100 Zeilen (ohne Leer- und Kommentarzeilen), mit einer Komplexität über 15
// oder mehr als 4 ineinander liegenden Blöcken ist schwer zu prüfen. Der Bestand steht je Datei und Funktion in
// function-limits.baseline.json, deshalb wie in comment-history.test.ts eine Ratsche statt eines Verbots: neue
// Funde und gewachsene Werte schlagen fehl. Wer eine Funktion verkleinert, senkt den Basiswert mit
// `FUNCTION_BASELINE_WRITE=1 npx vitest run tests/guards/function-limits.test.ts`.

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "tests/guards/function-limits.baseline.json");
const WRITE = "FUNCTION_BASELINE_WRITE=1 npx vitest run tests/guards/function-limits.test.ts";
const LABELS: Record<Metric, string> = { lines: "Zeilen", complexity: "Komplexität", depth: "Verschachtelung" };

function measure(): Findings {
  const out: Findings = {};
  for (const file of measuredFiles()) {
    const findings = measureText(file, readFileSync(join(ROOT, file), "utf8"));
    if (Object.keys(findings).length > 0) out[file] = findings;
  }
  return out;
}

/** Eine Zeile je Funktion, damit der Diff des Basiswerts zeigt, was sich geändert hat. */
function serialize(findings: Findings): string {
  const files = Object.entries(findings).map(([file, functions]) => {
    const rows = Object.entries(functions).map(([name, metrics]) => `    ${JSON.stringify(name)}: ${JSON.stringify(metrics)}`);
    return `  ${JSON.stringify(file)}: {\n${rows.join(",\n")}\n  }`;
  });
  return `{\n${files.join(",\n")}\n}\n`;
}

const tooMuch = (current: Findings, baseline: Findings) =>
  above(current, baseline).map(
    ({ file, name, metric, value, allowed }) =>
      `${file}, ${name}: ${LABELS[metric]} ${value}, Grenze ${LIMITS[metric]} (${allowed === undefined ? "neu" : `Basiswert ${allowed}`})`
  );

const outdated = (current: Findings, baseline: Findings) =>
  above(baseline, current).map(({ file, name, metric, value, allowed }) => {
    const now = allowed === undefined ? "kein Fund mehr" : `gemessen ${allowed}`;
    return `${file}, ${name}: ${LABELS[metric]} Basiswert ${value}, ${now}`;
  });

/** Eine Funktion, die mit Kopf und Schlusszeile `lines` Zeilen lang ist. */
const long = (name: string, lines: number) => `function ${name}() {\n${"  work();\n".repeat(lines - 2)}}\n`;
/** Eine Funktion mit `depth` ineinander liegenden Blöcken. */
const deep = (name: string, depth: number) => `function ${name}(a) {\n${"if (a) {\n".repeat(depth)}${"}\n".repeat(depth)}}\n`;
const branches = (name: string, count: number) => `function ${name}(a) {\n${"  if (a) work();\n".repeat(count)}}\n`;

describe("Messung von Funktionslänge, Komplexität und Verschachtelung", () => {
  it("meldet erst jenseits jeder Grenze", () => {
    expect(measureText("a.ts", long("f", 100) + branches("g", 14) + deep("h", 4))).toEqual({});
    expect(measureText("a.ts", long("f", 101) + branches("g", 15) + deep("h", 5))).toEqual({
      f: { lines: [101] },
      g: { complexity: [16] },
      h: { depth: [5] },
    });
  });

  it("zählt Leer- und Kommentarzeilen nicht mit", () => {
    const text = long("f", 100).replace("{\n", `{\n${"\n  // Warum.\n  /* Noch eine. */\n".repeat(20)}`);
    expect(measureText("a.ts", text)).toEqual({});
  });

  it("nimmt je Funktion den tiefsten Block und zählt eine else-if-Kette als eine Ebene", () => {
    const blocks = (depth: number) => `${"if (a) {\n".repeat(depth)}${"}\n".repeat(depth)}`;
    expect(measureText("a.ts", `function f(a) {\n${blocks(7)}${blocks(5)}}\n`)).toEqual({ f: { depth: [7] } });
    expect(measureText("a.ts", `function g(a) {\n${"if (a) {} else ".repeat(8)}{}\n}\n`)).toEqual({});
    // Hinter einer Funktion gehört ein Block nicht mehr zu ihr.
    expect(measureText("a.ts", `function h() {}\n${blocks(5)}`)).toEqual({ "(Modulebene)": { depth: [5] } });
  });

  it("misst auch eine sofort aufgerufene Funktion", () => {
    expect(measureText("a.ts", `(${long("f", 101).trim()})();\n`)).toEqual({ f: { lines: [101] } });
  });

  it("lässt sich nicht mit eslint-disable abschalten", () => {
    const text = `/* eslint-disable */\n// eslint-disable-next-line max-lines-per-function, complexity\n${long("f", 101)}`;
    expect(measureText("a.ts", text)).toEqual({ f: { lines: [101] } });
  });

  it("nimmt eine Datei, die es nicht lesen kann, nicht als sauber hin", () => {
    expect(() => measureText("a.ts", "function (")).toThrow("a.ts");
  });

  it("liest TypeScript, JSX und Module der Terminal-App", () => {
    expect(measureText("a.tsx", `export const A = <T,>(x: T) => {\n${"  work(<b />);\n".repeat(99)}};\n`)).toEqual({
      A: { lines: [101] },
    });
    expect(measureText("cli/src/a.mjs", `export async ${long("f", 101)}`)).toEqual({ f: { lines: [101] } });
  });

  it("erkennt eine Funktion an ihrem Namen, nicht an der Zeile", () => {
    const text = `function Form() {\n${deep("inner", 5)}}\n`;
    const shifted = `import x from "x";\n\nconst y = x;\n\n${text}`;
    expect(Object.keys(measureText("a.ts", text))).toEqual(["Form › inner"]);
    expect(measureText("a.ts", shifted)).toEqual(measureText("a.ts", text));
  });

  it("benennt Funktionen ohne eigenen Namen nach der Stelle, an der sie stehen", () => {
    const body = `{ ${"if (a) { ".repeat(5)}${"} ".repeat(5)}}`;
    const text = `
      export const Form = () => {
        useEffect(() => ${body}, []);
        const save = useCallback(async () => ${body}, []);
        return <form onSubmit={() => ${body}} />;
      };
      class Store { get all() ${body} load = () => ${body}; }
      const api = { send() ${body}, nested: { "get-it": function () ${body} } };
      window.onload = () => ${body};
      export default () => ${body};
    `;
    expect(Object.keys(measureText("a.tsx", text)).sort()).toEqual([
      "Form › <form> onSubmit",
      "Form › save = useCallback()",
      "Form › useEffect()",
      "Store.get all",
      "Store.load",
      "api.send",
      "default",
      "nested.get-it",
      "onload",
    ]);
  });

  it("ordnet Länge und Komplexität auch Methoden und Pfeilfunktionen zu", () => {
    const lines = "  work();\n".repeat(99);
    const ifs = "  if (a) work();\n".repeat(15);
    expect(measureText("a.ts", `class A {\n  run(a) {\n${ifs}  }\n}\nexport const B = (a) => {\n${ifs}${lines}};\n`)).toEqual({
      "A.run": { complexity: [16] },
      B: { lines: [116], complexity: [16] },
    });
  });

  it("führt gleich benannte Funktionen als absteigende Liste", () => {
    const text = `function F() {\n  useEffect(() => {\n${"if (a) {\n".repeat(5)}${"}\n".repeat(5)}  });\n  useEffect(() => {\n${"if (a) {\n".repeat(6)}${"}\n".repeat(6)}  });\n}\n`;
    expect(measureText("a.ts", text)).toEqual({ "F › useEffect()": { depth: [6, 5] } });
  });
});

describe("Vergleich mit dem Basiswert", () => {
  const baseline: Findings = { "a.ts": { f: { lines: [120], depth: [5] }, "g › map()": { complexity: [30, 20] } } };
  const current = (change: Findings["a.ts"]): Findings => ({ "a.ts": { ...baseline["a.ts"], ...change } });

  it("lässt den Stand selbst durch", () => {
    expect(tooMuch(baseline, baseline)).toEqual([]);
    expect(outdated(baseline, baseline)).toEqual([]);
  });

  it("erkennt eine neue lange Funktion, auch in einer neuen Datei", () => {
    expect(tooMuch(current({ h: { lines: [101] } }), baseline)).toEqual(["a.ts, h: Zeilen 101, Grenze 100 (neu)"]);
    expect(tooMuch({ ...baseline, "b.ts": { f: { lines: [120] } } }, baseline)).toEqual([
      "b.ts, f: Zeilen 120, Grenze 100 (neu)",
    ]);
  });

  it("erkennt einen gewachsenen Wert und eine tiefere Verschachtelung", () => {
    expect(tooMuch(current({ f: { lines: [121], depth: [6] } }), baseline)).toEqual([
      "a.ts, f: Zeilen 121, Grenze 100 (Basiswert 120)",
      "a.ts, f: Verschachtelung 6, Grenze 4 (Basiswert 5)",
    ]);
  });

  it("erkennt ein neues Maß an einer bekannten Funktion", () => {
    expect(tooMuch(current({ f: { lines: [120], depth: [5], complexity: [16] } }), baseline)).toEqual([
      "a.ts, f: Komplexität 16, Grenze 15 (neu)",
    ]);
  });

  it("vergleicht gleich benannte Funktionen Rang für Rang", () => {
    expect(tooMuch(current({ "g › map()": { complexity: [25, 25] } }), baseline)).toEqual([
      "a.ts, g › map(): Komplexität 25, Grenze 15 (Basiswert 20)",
    ]);
    expect(tooMuch(current({ "g › map()": { complexity: [30, 20, 16] } }), baseline)).toEqual([
      "a.ts, g › map(): Komplexität 16, Grenze 15 (neu)",
    ]);
  });

  it("lässt kleinere Werte zu und verlangt dafür den neuen Basiswert", () => {
    const smaller: Findings = { "a.ts": { f: { lines: [110] }, "g › map()": { complexity: [30] } } };
    expect(tooMuch(smaller, baseline)).toEqual([]);
    expect(outdated(smaller, baseline)).toEqual([
      "a.ts, f: Zeilen Basiswert 120, gemessen 110",
      "a.ts, f: Verschachtelung Basiswert 5, kein Fund mehr",
      "a.ts, g › map(): Komplexität Basiswert 20, kein Fund mehr",
    ]);
    expect(outdated({}, baseline)).toHaveLength(4);
  });
});

describe("Funktionslänge, Komplexität und Verschachtelung im Quellbaum", () => {
  let current: Findings;
  let baseline: Findings;

  beforeAll(() => {
    current = measure();
    if (process.env.FUNCTION_BASELINE_WRITE === "1") writeFileSync(BASELINE_PATH, serialize(current));
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Findings;
    // Das Parsen aller Dateien dauert unter Last länger als die Standardfrist eines Schritts.
  }, 60_000);

  it("misst src/ und die Terminal-App, ohne Tests, Wörterbücher, Rechtstexte und die geprüfte Kopie", () => {
    const files = measuredFiles();
    expect(files.length).toBeGreaterThan(300);
    for (const name of ["src/proxy.ts", "src/shell/components/mobile-nav.tsx", "cli/src/repl.mjs"]) {
      expect(files, name).toContain(name);
    }
    for (const skipped of [/\.test\./, /i18n\/messages/, /\(legal\)/, /^cli\/src\/context\.mjs$/, /^(?!src\/|cli\/src\/)/]) {
      expect(files.filter((f) => skipped.test(f)), String(skipped)).toEqual([]);
    }
  });

  it("wächst über den Basiswert hinaus in keiner Funktion", () => {
    const over = tooMuch(current, baseline);
    expect(
      over,
      `Neue oder gewachsene Funktionen über der Grenze. Zerlegen (docs/SETUP.md, "Qualität"). Nur wenn eine Funktion bloß umbenannt oder verschoben wurde, ohne zu wachsen, den Basiswert neu schreiben: ${WRITE}\n${over.join("\n")}`
    ).toEqual([]);
  });

  it("liegt nirgends über dem Stand: wer verkleinert, senkt den Basiswert mit", () => {
    const stale = outdated(current, baseline);
    expect(stale, `Basiswert neu schreiben: ${WRITE}\n${stale.join("\n")}`).toEqual([]);
  });
});
