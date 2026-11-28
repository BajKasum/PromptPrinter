import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Page from "./page";

// Jede Grenze bekommt hier einen Wert, den es sonst nirgends gibt: steht eine Zahl im Artikel von Hand oder stammt sie
// aus der falschen Konstante, passt die Liste unten nicht mehr.
vi.mock("@/features/projects/lib/context-budgets", () => ({
  FILES_TOTAL_BUDGET: 41_100,
  FILES_PER_FILE_CAP: 3_100,
  FILES_TOTAL_BUDGET_WITH_BRAIN: 6_200,
  FILES_PER_FILE_CAP_WITH_BRAIN: 2_300,
  ANALYSIS_TEXT_TOTAL_BUDGET: 61_400,
  ANALYSIS_TEXT_PER_FILE_BUDGET: 12_500,
  MAX_ANALYSIS_IMAGES: 5,
}));
vi.mock("@/shared/lib/project-brain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/project-brain")>()),
  BRAIN_PROMPT_BUDGET: 2_600,
}));

const chars = (n: number) => n.toLocaleString("de-CH");

describe("Hilfe /docs/dateien", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const text = () => render(<Page />).container.textContent!.replace(/\s+/g, " ");

  it("nennt jedes Zeichenbudget aus dem Modul, das es durchsetzt", () => {
    const article = text();
    expect(article).toContain(`Ohne Gedächtnis: rund ${chars(41_100)} Zeichen insgesamt, pro Datei höchstens etwa ${chars(3_100)}.`);
    expect(article).toContain(
      `Mit Gedächtnis: rund ${chars(6_200)} Zeichen insgesamt, pro Datei höchstens etwa ${chars(2_300)}. ` +
        `Dazu kommt der Gedächtnis-Block selbst, höchstens ${chars(2_600)} Zeichen.`
    );
    expect(article).toContain(`Zusammen sind es höchstens ${chars(8_800)} statt ${chars(41_100)} Zeichen.`);
    expect(article).toContain(
      `zusammen bis zu ${chars(61_400)} Zeichen Text, pro Datei bis zu ${chars(12_500)}.`
    );
  });

  it("schreibt keine grosse Zahl von Hand", () => {
    // Alle Zahlen mit Tausendertrennung, in Lesereihenfolge: ein Trennzeichen ist ein Leerzeichen oder ein Apostroph.
    const numbers = text().match(/\d{1,3}(?:[’'\s]\d{3})+/g) ?? [];
    expect(numbers).toEqual([41_100, 3_100, 6_200, 2_300, 2_600, 8_800, 41_100, 61_400, 12_500].map(chars));
  });

  it("nennt die Zahl der analysierten Bilder aus derselben Quelle", () => {
    const article = text();
    expect(article).toContain("schaut sich PromptPrinter bis zu fünf davon an");
    expect(article).toContain("Es sind die fünf, die du zuerst hochgeladen hast");
  });
});
