import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Kommentare sagen, was gilt und warum; der Verlauf steht im Changelog (CLAUDE.md). Der Bestand wird beim Anfassen
// bereinigt, deshalb eine Ratsche statt eines Verbots: je Datei darf die Zahl der Funde den Basiswert in
// comment-history.baseline.json nicht übersteigen, eine Datei ohne Eintrag beginnt bei 0. Wer bereinigt, senkt den
// Basiswert mit `COMMENT_BASELINE_WRITE=1 npx vitest run tests/guards/comment-history.test.ts`.

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "tests/guards/comment-history.baseline.json");

const ROOT_FILES = /^(next|vitest|playwright)\.config\.ts$|^eslint\.config\.mjs$|^Dockerfile$|^docker-compose[\w.-]*\.yml$/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;
const HASH_COMMENT_LINE = /^\s*#(?!!)/;
const TRAILING_COMMENT = /\s\/\/\s(.*)$/;

// Datumsangaben, Auditkennungen ("K-2", "F-4/U-6"), Bezüge auf Berichte und Fehlersuche als Erzählung.
const HISTORY_MARKER =
  /\b20\d\d-\d\d-\d\d\b|\b\d{1,2}\.\d{1,2}\.20\d\d\b|\b[A-Z]{1,2}-\d{1,3}\b|\bPlanpunkt\b|\bAudit\b|\bfound the hard way\b/g;
const SPELLED_UMLAUT =
  /\b(?:fuer|ueber|koennen|koennte|muessen|muesste|waere|wuerde|duerfen|naechste[nmrs]?|aendern|aenderung|zurueck|pruefen|prueft|gehoert|spaeter|laeuft|haengt|fuehrt|moeglich|loeschen)\b/gi;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function checkedFiles(): string[] {
  const source = walk(join(ROOT, "src")).filter((f) => /\.(tsx?|mjs)$/.test(f) && !/\.test\.tsx?$/.test(f));
  const github = walk(join(ROOT, ".github")).filter((f) => /\.ya?ml$/.test(f));
  const root = readdirSync(ROOT)
    .filter((name) => ROOT_FILES.test(name))
    .map((name) => join(ROOT, name));
  return [...source, ...github, ...root].map((f) => relative(ROOT, f).replace(/\\/g, "/"));
}

function countFindings(file: string, text: string): number {
  const hashComments = /\.ya?ml$|(^|\/)Dockerfile$/.test(file);
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    let comment: string | undefined;
    if (hashComments) comment = HASH_COMMENT_LINE.test(line) ? line : undefined;
    else comment = COMMENT_LINE.test(line) ? line : TRAILING_COMMENT.exec(line)?.[1];
    if (!comment) continue;
    count += (comment.match(HISTORY_MARKER) ?? []).length + (comment.match(SPELLED_UMLAUT) ?? []).length;
  }
  return count;
}

function measure(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const file of checkedFiles().sort()) {
    const count = countFindings(file, readFileSync(join(ROOT, file), "utf8"));
    if (count > 0) out[file] = count;
  }
  return out;
}

describe("Verlauf und umschriebene Umlaute in Kommentaren", () => {
  it("erkennt die Muster und lässt Code in Ruhe", () => {
    expect(countFindings("a.ts", "// Audit K-2 vom 2026-10-04")).toBe(3);
    expect(countFindings("a.ts", "// gilt fuer alle")).toBe(1);
    expect(countFindings("a.ts", 'const d = "2026-10-04";')).toBe(0);
    expect(countFindings("a.ts", "const x = 1; // Stand 04.10.2026")).toBe(1);
    expect(countFindings("Dockerfile", "# found the hard way\nRUN echo 2026-10-04")).toBe(1);
  });

  it("liest die Konfigurations- und Build-Dateien mit", () => {
    const checked = checkedFiles();
    for (const name of ["next.config.ts", "Dockerfile", "docker-compose.yml", ".github/workflows/ci.yml", ".github/dependabot.yml"]) {
      expect(checked, name).toContain(name);
    }
  });

  it("wächst über den Basiswert hinaus in keiner Datei", () => {
    const current = measure();
    if (process.env.COMMENT_BASELINE_WRITE === "1") {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    }
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const over = Object.entries(current)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (Basiswert ${baseline[file] ?? 0})`);
    expect(
      over,
      `Neue Verlaufskommentare oder umschriebene Umlaute. Kommentare sagen, was gilt und warum; der Verlauf gehört in den Changelog:\n${over.join("\n")}`
    ).toEqual([]);
  });
});
