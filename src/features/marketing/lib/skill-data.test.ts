import { describe, expect, it } from "vitest";
import {
  SKILL_REPO_URL,
  SKILL_COMMIT,
  SKILL_VERSION,
  SKILL_ZIP_FILENAME,
  SKILL_ZIP_SHA256,
  SKILL_ZIP_URL,
} from "./skill-data";

// Der Download auf /skill führt zu Code, den Besucher auf ihrem Rechner ausführen (#240). Ein Tag lässt sich
// verschieben, ein Commit nicht; die Prüfsumme neben dem Knopf gilt nur für genau diese Datei. Version, Commit und
// Prüfsumme ändern sich deshalb nur zusammen.

describe("Skill-Download", () => {
  it("zeigt auf einen Commit mit voller SHA, nicht auf einen Tag oder einen Branch", () => {
    expect(SKILL_COMMIT).toMatch(/^[0-9a-f]{40}$/);
    expect(SKILL_ZIP_URL).toBe(`${SKILL_REPO_URL}/archive/${SKILL_COMMIT}.zip`);
    expect(SKILL_ZIP_URL).not.toMatch(/\/refs\/|\/tags\/|\/heads\/|main|master/);
  });

  it("nennt eine SHA-256 (64 Stellen) und den Dateinamen, unter dem GitHub das ZIP ausliefert", () => {
    expect(SKILL_ZIP_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(SKILL_ZIP_FILENAME).toBe(`promptprinter-pp-${SKILL_COMMIT}.zip`);
  });

  // Dieser Test hält das Tripel fest, damit nicht ein Wert allein wandert: ein neuer Commit mit der alten Prüfsumme
  // (oder umgekehrt) führte Besucher zu einer Datei, die nicht zu dem passt, was auf der Seite steht. Wer die Version
  // anhebt, ändert alle drei Werte in skill-data.ts UND hier, nachdem `node scripts/verify-skill-archive.mjs --print`
  // die Prüfsumme des neuen Commits ausgegeben hat. Ob die Prüfsumme zur Datei passt, rechnet
  // .github/workflows/skill-archive.yml nach, mit dem echten Download.
  it("ändert Version, Commit und Prüfsumme nur zusammen", () => {
    expect({ version: SKILL_VERSION, commit: SKILL_COMMIT, sha256: SKILL_ZIP_SHA256 }).toEqual({
      version: "0.3.0",
      commit: "4451250e7b3d5deadf922504ef4a5861ee68aeb4",
      sha256: "88bceb21837d06ac04eb3902ff83a38dd4015d188e041f78e4bb74e88ce75e37",
    });
  });
});
