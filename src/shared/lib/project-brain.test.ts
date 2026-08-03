import { describe, expect, it } from "vitest";
import {
  BRAIN_ANALYZING_TIMEOUT_MS,
  BRAIN_PROMPT_BUDGET,
  EMPTY_BRAIN_FACTS,
  formatBrainForPrompt,
  hasBrainContent,
  isAnalysisRunning,
  isBrainStale,
  projectBrainFactsSchema,
  sourceDigest,
  type ProjectBrain,
} from "@/shared/lib/project-brain";

const READY: ProjectBrain = {
  status: "ready",
  facts: EMPTY_BRAIN_FACTS,
  repoUrl: null,
  sources: [],
  sourceDigest: "abc123",
  model: "glm-4.5-air",
  errorCode: null,
  analyzedAt: "2026-08-03T10:00:00.000Z",
  updatedAt: "2026-08-03T10:00:00.000Z",
};

describe("projectBrainFactsSchema", () => {
  it("fills every field so a partial model reply is still a usable brain", () => {
    const parsed = projectBrainFactsSchema.parse({ framework: "Next.js 15" });
    expect(parsed.framework).toBe("Next.js 15");
    expect(parsed.language).toBe("");
    expect(parsed.conventions).toEqual([]);
    expect(parsed.confidence).toBe("low");
  });

  it("trims whitespace the model likes to add", () => {
    expect(projectBrainFactsSchema.parse({ language: "  TypeScript  " }).language).toBe(
      "TypeScript"
    );
  });

  it("rejects a field that is not a string at all", () => {
    expect(projectBrainFactsSchema.safeParse({ framework: 42 }).success).toBe(false);
  });

  it("rejects an over-long list rather than silently keeping the head", () => {
    const tooMany = Array.from({ length: 30 }, (_, i) => `Regel ${i}`);
    expect(projectBrainFactsSchema.safeParse({ conventions: tooMany }).success).toBe(false);
  });

  it("rejects an unknown confidence value", () => {
    expect(projectBrainFactsSchema.safeParse({ confidence: "absolute" }).success).toBe(false);
  });
});

describe("formatBrainForPrompt", () => {
  it("returns nothing at all when nothing was detected", () => {
    expect(formatBrainForPrompt(EMPTY_BRAIN_FACTS)).toBe("");
    expect(hasBrainContent(EMPTY_BRAIN_FACTS)).toBe(false);
  });

  it("lists only the fields that carry a value", () => {
    const block = formatBrainForPrompt({
      ...EMPTY_BRAIN_FACTS,
      framework: "Next.js 15 (App Router)",
      language: "TypeScript (strict)",
    });
    expect(block).toContain("- Framework: Next.js 15 (App Router)");
    expect(block).toContain("- Sprache: TypeScript (strict)");
    expect(block).not.toContain("Datenbank");
    expect(block).not.toContain("Design-System");
  });

  it("carries the confidence into the prompt", () => {
    expect(formatBrainForPrompt({ ...EMPTY_BRAIN_FACTS, framework: "Rails", confidence: "high" })).toContain(
      "belegt"
    );
    expect(formatBrainForPrompt({ ...EMPTY_BRAIN_FACTS, framework: "Rails", confidence: "low" })).toContain(
      "unsicher"
    );
  });

  it("renders stack and conventions as lists", () => {
    const block = formatBrainForPrompt({
      ...EMPTY_BRAIN_FACTS,
      stack: ["Supabase", "Tailwind"],
      conventions: ["Keine rohen Hex-Farben", "Tests neben der Datei"],
    });
    expect(block).toContain("- Stack: Supabase, Tailwind");
    expect(block).toContain("  - Keine rohen Hex-Farben");
    expect(block).toContain("  - Tests neben der Datei");
  });

  // Der Block reist bei JEDEM Zug mit, das Budget ist deshalb eine
  // Kostengrenze, keine Kosmetik.
  it("never exceeds the per-turn budget", () => {
    const block = formatBrainForPrompt({
      ...EMPTY_BRAIN_FACTS,
      summary: "x".repeat(600),
      framework: "y".repeat(400),
      architecture: "z".repeat(400),
      database: "d".repeat(400),
      designSystem: "s".repeat(400),
      codingStyle: "c".repeat(400),
      language: "l".repeat(400),
      conventions: Array.from({ length: 10 }, () => "k".repeat(300)),
      stack: Array.from({ length: 16 }, () => "t".repeat(80)),
    });
    expect(block.length).toBeLessThanOrEqual(BRAIN_PROMPT_BUDGET);
  });
});

describe("sourceDigest", () => {
  it("is stable for the same sources", () => {
    expect(sourceDigest(["a:1", "b:2"])).toBe(sourceDigest(["a:1", "b:2"]));
  });

  it("ignores the order sources arrive in", () => {
    expect(sourceDigest(["a:1", "b:2"])).toBe(sourceDigest(["b:2", "a:1"]));
  });

  it("changes when a source changes, is added or removed", () => {
    const base = sourceDigest(["readme.md:120", "package.json:800"]);
    expect(sourceDigest(["readme.md:121", "package.json:800"])).not.toBe(base);
    expect(sourceDigest(["readme.md:120"])).not.toBe(base);
    expect(sourceDigest(["readme.md:120", "package.json:800", "tsconfig.json:90"])).not.toBe(base);
  });

  it("produces a short, storable hex string", () => {
    expect(sourceDigest(["x"])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("isAnalysisRunning", () => {
  const startedAt = new Date("2026-08-03T10:00:00.000Z").getTime();
  const analyzing: ProjectBrain = {
    ...READY,
    status: "analyzing",
    updatedAt: "2026-08-03T10:00:00.000Z",
  };

  it("is true while a fresh run is in flight", () => {
    expect(isAnalysisRunning(analyzing, startedAt + 30_000)).toBe(true);
  });

  // Die Analyse laeuft synchron in der Route; ein abgerissener Request laesst
  // den Status stehen, und der Prozess, der ihn aufraeumen sollte, ist genau
  // der, der weg ist.
  it("is false once the run is older than the timeout, so the UI offers a retry", () => {
    expect(isAnalysisRunning(analyzing, startedAt + BRAIN_ANALYZING_TIMEOUT_MS + 1)).toBe(false);
  });

  it("is false for every other status", () => {
    expect(isAnalysisRunning(READY, startedAt)).toBe(false);
    expect(isAnalysisRunning({ ...READY, status: "failed" }, startedAt)).toBe(false);
  });
});

describe("isBrainStale", () => {
  it("flags a ready brain whose sources have changed since", () => {
    expect(isBrainStale(READY, "def456")).toBe(true);
    expect(isBrainStale(READY, "abc123")).toBe(false);
  });

  it("never flags a brain that was never analyzed or that failed", () => {
    expect(isBrainStale({ ...READY, status: "idle", sourceDigest: null }, "def456")).toBe(false);
    expect(isBrainStale({ ...READY, status: "failed" }, "def456")).toBe(false);
  });
});
