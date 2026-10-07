import { describe, expect, it } from "vitest";
import { selectSignalFiles as viaGithub, summarizeTree as summaryViaGithub } from "./github";
import { selectSignalFiles, summarizeTree } from "./github-select";

// Die Auswahl liegt seit der Zerlegung von github.ts (Betriebs-Audit, Folgesitzung 2026-10-07, Dateigröße) in
// github-select.ts. Die Kanten prüft github.select.test.ts über github.ts; hier steht, dass github.ts denselben
// Satz weiterreicht (keine zweite Kopie) und dass die Datei auch allein trägt.

describe("github-select.ts", () => {
  it("github.ts reicht dieselben Funktionen weiter, keine Kopie", () => {
    expect(viaGithub).toBe(selectSignalFiles);
    expect(summaryViaGithub).toBe(summarizeTree);
  });

  it("wählt aus Pfaden die Signaldateien, Manifest vor README", () => {
    expect(selectSignalFiles(["README.md", "src/a.ts", "package.json"])).toEqual(["package.json", "README.md"]);
  });

  it("verdichtet Pfade zu Verzeichnissen und Dateitypen", () => {
    expect(summarizeTree(["src/app/a.ts", "README.md"])).toBe(
      "Verzeichnisse: (root) (1), src/app (1)\nDateitypen: .ts 1, .md 1"
    );
  });
});
