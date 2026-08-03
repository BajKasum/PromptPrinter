import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted, weil vi.mock an den Dateianfang gehoben wird: eine gewoehnliche
// const waere zum Zeitpunkt der Factory noch nicht initialisiert.
const { analyzeComplete } = vi.hoisted(() => ({ analyzeComplete: vi.fn() }));
vi.mock("@/server/llm", () => ({ analyzeComplete }));

import {
  BrainAnalysisError,
  analyzeProjectBrain,
  buildAnalysisText,
  extractJsonObject,
  parseBrainFacts,
  type BrainAnalysisInput,
} from "@/server/brain/analyze";

const VALID = JSON.stringify({
  summary: "Eine Next.js-App mit Supabase.",
  language: "TypeScript (strict)",
  framework: "Next.js 15 (App Router)",
  architecture: "Feature-Slices",
  database: "Postgres über Supabase (RLS)",
  designSystem: "Tailwind mit HSL-Tokens",
  codingStyle: "Zod für Validierung, Pfad-Aliase",
  conventions: ["Keine rohen Hex-Farben"],
  stack: ["Next.js", "Supabase"],
  confidence: "high",
});

function input(overrides: Partial<BrainAnalysisInput> = {}): BrainAnalysisInput {
  return {
    projectName: "Demo",
    documents: [{ label: "package.json", text: '{"name":"demo"}' }],
    images: [],
    repo: null,
    ...overrides,
  };
}

describe("extractJsonObject", () => {
  it("reads a bare JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  // Modelle halten sich an "nur JSON" meistens, aber nicht immer. Das ist
  // kein Fehler des Nutzers und darf eine bezahlte Analyse nicht verwerfen.
  it("survives a markdown fence", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("survives prose around the object", () => {
    expect(extractJsonObject('Hier ist die Analyse:\n{"a":1}\nViel Erfolg!')).toEqual({ a: 1 });
  });

  it("returns null for anything that is not an object", () => {
    expect(extractJsonObject("[1,2,3]")).toBeNull();
    expect(extractJsonObject("völlig ohne JSON")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject('{"a": unquoted}')).toBeNull();
  });
});

describe("parseBrainFacts", () => {
  it("parses a complete reply", () => {
    const facts = parseBrainFacts(VALID);
    expect(facts.framework).toBe("Next.js 15 (App Router)");
    expect(facts.stack).toEqual(["Next.js", "Supabase"]);
    expect(facts.confidence).toBe("high");
  });

  it("accepts a partial reply as a weaker brain, not a failure", () => {
    const facts = parseBrainFacts('{"framework":"Rails 8"}');
    expect(facts.framework).toBe("Rails 8");
    expect(facts.database).toBe("");
    expect(facts.confidence).toBe("low");
  });

  // Eine einzelne zu lange Konvention darf nicht die ganze Analyse verwerfen,
  // fuer die gerade ein Modellaufruf bezahlt wurde.
  it("salvages the valid fields when strict validation fails", () => {
    const facts = parseBrainFacts(
      JSON.stringify({
        framework: "Django 5",
        database: "Postgres",
        conventions: ["ok", "x".repeat(900)],
        confidence: "medium",
      })
    );
    expect(facts.framework).toBe("Django 5");
    expect(facts.database).toBe("Postgres");
    expect(facts.conventions[0]).toBe("ok");
    expect(facts.conventions[1].length).toBeLessThanOrEqual(300);
    expect(facts.confidence).toBe("medium");
  });

  it("throws when there is nothing usable at all", () => {
    expect(() => parseBrainFacts("kein JSON hier")).toThrow(BrainAnalysisError);
    expect(() => parseBrainFacts('{"unbekannt": 1}')).toThrow(BrainAnalysisError);
  });

  it("ignores fields of the wrong type instead of failing", () => {
    const facts = parseBrainFacts('{"framework":"Astro","stack":"nicht-array","conventions":[42]}');
    expect(facts.framework).toBe("Astro");
    expect(facts.stack).toEqual([]);
    expect(facts.conventions).toEqual([]);
  });
});

describe("buildAnalysisText", () => {
  it("labels every source so evidence can be weighed", () => {
    const text = buildAnalysisText(
      input({
        documents: [
          { label: "package.json", text: "{}" },
          { label: "README.md", text: "Hallo" },
        ],
      })
    );
    expect(text).toContain("--- QUELLE: package.json ---");
    expect(text).toContain("--- QUELLE: README.md ---");
  });

  it("includes the repository block when there is one", () => {
    const text = buildAnalysisText(
      input({
        repo: {
          slug: "acme/app",
          description: "Eine App",
          primaryLanguage: "Go",
          topics: ["cli"],
          treeSummary: "Verzeichnisse: cmd (3)",
          fileCount: 42,
        },
      })
    );
    expect(text).toContain("Repository: acme/app");
    expect(text).toContain("Dateien im Repo: 42");
    expect(text).toContain("GitHub-Spracherkennung: Go");
    expect(text).toContain("Verzeichnisse: cmd (3)");
  });

  it("tells the model what screenshots may and may not be used for", () => {
    const text = buildAnalysisText(
      input({ images: [{ name: "shot.png", mediaType: "image/png", base64: "x" }] })
    );
    expect(text).toContain("shot.png");
    expect(text).toContain("designSystem");
    // Die Base64-Daten selbst gehoeren in den Bildteil, nicht in den Text.
    expect(text).not.toContain("base64");
  });
});

describe("analyzeProjectBrain", () => {
  beforeEach(() => {
    analyzeComplete.mockReset();
    analyzeComplete.mockResolvedValue({ text: VALID, usage: null, model: "glm-4.5-air" });
  });

  it("returns parsed facts and the model that produced them", async () => {
    const result = await analyzeProjectBrain(input());
    expect(result.facts.framework).toBe("Next.js 15 (App Router)");
    expect(result.model).toBe("glm-4.5-air");
  });

  it("refuses to spend a model call when there is nothing to analyse", async () => {
    await expect(
      analyzeProjectBrain(input({ documents: [], images: [], repo: null }))
    ).rejects.toMatchObject({ code: "analysis_no_sources" });
    expect(analyzeComplete).not.toHaveBeenCalled();
  });

  it("passes images through to the multimodal call", async () => {
    await analyzeProjectBrain(
      input({ images: [{ name: "a.png", mediaType: "image/png", base64: "AAA" }] })
    );
    expect(analyzeComplete).toHaveBeenCalledWith(
      expect.objectContaining({ images: [{ mediaType: "image/png", base64: "AAA" }] })
    );
  });

  it("forwards the caller's own key", async () => {
    const override = { provider: "anthropic" as const, apiKey: "sk-test" };
    await analyzeProjectBrain(input(), { override });
    expect(analyzeComplete).toHaveBeenCalledWith(expect.objectContaining({ override }));
  });

  // Security-Audit M-1: weder Modellname noch Anbieter-Wortlaut duerfen in
  // der Datenbank oder beim Client landen.
  it("turns a provider failure into a stable code", async () => {
    analyzeComplete.mockRejectedValue(new Error("Z.ai 429: rate limit for glm-4.5-air"));
    const error = await analyzeProjectBrain(input()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BrainAnalysisError);
    expect((error as BrainAnalysisError).code).toBe("analysis_failed");
  });

  it("reports an unusable reply distinctly from a failed call", async () => {
    analyzeComplete.mockResolvedValue({ text: "Tut mir leid.", usage: null, model: "m" });
    await expect(analyzeProjectBrain(input())).rejects.toMatchObject({
      code: "analysis_unparsable",
    });
  });
});
