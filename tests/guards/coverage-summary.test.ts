import { describe, expect, it } from "vitest";
import { GROUPS, percent, relativePath, summarize, toMarkdown } from "../../scripts/coverage-summary.mjs";

// Die Tabelle der Testabdeckung (scripts/coverage-summary.mjs, #221). Sie ist eine Messung und keine Schranke, aber
// ein Basiswert, der falsch rechnet (eine Datei in der falschen Gruppe, ein Mittelwert von Prozenten statt
// Treffer durch Gesamtzahl), wäre schlimmer als keiner: er sähe belastbar aus.

type Cell = { total: number; covered: number; skipped: number; pct: number };
const cell = (covered: number, total: number): Cell => ({ total, covered, skipped: 0, pct: 0 });
const file = (lines: [number, number], branches: [number, number] = [0, 0]) => ({
  lines: cell(...lines),
  statements: cell(...lines),
  branches: cell(...branches),
  functions: cell(...lines),
});

describe("relativePath", () => {
  it("schneidet bis src/, unter Windows und unter Linux gleich", () => {
    expect(relativePath("C:\\Users\\kasum\\repo\\src\\server\\env.ts")).toBe("src/server/env.ts");
    expect(relativePath("/home/runner/work/PromptPrinter/PromptPrinter/src/app/api/chat/route.ts")).toBe(
      "src/app/api/chat/route.ts"
    );
  });

  it("nimmt das letzte src/, wenn der Pfad davor selbst eines enthält", () => {
    expect(relativePath("/work/src/PromptPrinter/src/shared/ui/button.tsx")).toBe("src/shared/ui/button.tsx");
  });
});

describe("summarize", () => {
  const summary = {
    total: file([75, 100], [10, 20]),
    "C:\\repo\\src\\server\\env.ts": file([40, 50], [6, 10]),
    "C:/repo/src/server/security/csp.ts": file([10, 10]),
    "C:/repo/src/app/api/chat/route.ts": file([20, 30], [2, 6]),
    "C:/repo/src/app/page.tsx": file([5, 10]),
    "C:/repo/src/features/chat/lib/a.ts": file([0, 0]),
    "C:/repo/src/middleware.ts": file([0, 0]),
  };
  const rows = summarize(summary);
  const row = (label: string) => rows.find((r) => r.label === label);

  it("rechnet Treffer und Gesamtzahlen je Verzeichnis zusammen, nicht Prozente", () => {
    expect(row("src/server/")).toMatchObject({ files: 2, lines: { covered: 50, total: 60 }, branches: { covered: 6, total: 10 } });
    expect(percent(row("src/server/")!.lines)).toBe("83,3 %");
  });

  it("zählt eine Datei in api nicht noch einmal bei den Seiten", () => {
    expect(row("src/app/api/")).toMatchObject({ files: 1, lines: { covered: 20, total: 30 } });
    expect(row("src/app/ (Seiten, ohne api)")).toMatchObject({ files: 1, lines: { covered: 5, total: 10 } });
  });

  it("fängt Dateien ohne eigene Gruppe in 'Rest' auf und lässt leere Gruppen weg", () => {
    expect(row("Rest")).toMatchObject({ files: 1 });
    expect(row("src/shell/")).toBeUndefined();
    expect(row("src/shared/")).toBeUndefined();
  });

  it("nimmt die Gesamtzeile aus 'total' und zählt dort alle Dateien", () => {
    const all = rows.at(-1)!;
    expect(all.label).toBe("Gesamt");
    expect(all.files).toBe(6);
    expect(all.lines).toEqual({ covered: 75, total: 100 });
  });

  it("jede Gruppe hat einen eindeutigen Namen, 'Rest' steht zuletzt", () => {
    const labels = GROUPS.map((group) => group.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.at(-1)).toBe("Rest");
  });
});

describe("percent und toMarkdown", () => {
  it("zeigt '-' statt NaN, wenn es nichts zu zählen gibt", () => {
    expect(percent({ covered: 0, total: 0 })).toBe("-");
    expect(percent({ covered: 1, total: 3 })).toBe("33,3 %");
    expect(percent({ covered: 5, total: 5 })).toBe("100,0 %");
  });

  it("schreibt eine Tabelle mit Kopf, Trennzeile und einer Zeile je Verzeichnis", () => {
    const table = toMarkdown(summarize({ total: file([1, 2]), "C:/r/src/server/a.ts": file([1, 2]) }));
    const lines = table.split("\n");
    expect(lines[0]).toContain("| Verzeichnis |");
    expect(lines[1]).toMatch(/^\|---\|/);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe("| src/server/ | 1 | 50,0 % | 50,0 % | - | 50,0 % |");
  });
});
