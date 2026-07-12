import { describe, expect, it } from "vitest";
import { buildPromptSet, buildOverview } from "@/lib/build-generate-content";
import type { GenerateRequest } from "@/lib/schemas";

const softwareInput: Extract<GenerateRequest, { type: "software" }> = {
  type: "software",
  name: "Streak Coach",
  idea: "Ein Habit-Tracker, der Streaks mit cleveren Mini-Belohnungen feiert.",
  audience: "Selbstoptimierungs-Enthusiasten",
  tools: { master: "Claude", frontend: "Lovable", backend: "Claude Code", database: "Supabase" },
};

const generalInput: Extract<GenerateRequest, { type: "general" }> = {
  type: "general",
  name: "Blog-Intro",
  idea: "Ein einladender Einstiegstext für einen Reise-Blog über Basel.",
  target: "ChatGPT",
};

describe("buildPromptSet", () => {
  it("builds the full software pack with all ten artifact keys", () => {
    const { prompts, systemInstruction } = buildPromptSet(softwareInput);
    expect(Object.keys(prompts).sort()).toEqual(
      [
        "brief",
        "prd",
        "master",
        "frontend",
        "backend",
        "schema",
        "security",
        "marketing",
        "seo",
        "deployment",
      ].sort()
    );
    expect(systemInstruction.length).toBeGreaterThan(0);
    expect(prompts.master).toContain(softwareInput.idea);
  });

  it("builds the general pack with the main prompt + variants", () => {
    const { prompts, systemInstruction } = buildPromptSet(generalInput);
    expect(prompts.prompt).toBeTruthy();
    expect(Object.keys(prompts)).toContain("variant_a");
    expect(systemInstruction.length).toBeGreaterThan(0);
  });
});

describe("buildOverview", () => {
  it("summarizes the software pack's stack and idea", () => {
    const overview = buildOverview(softwareInput);
    expect(overview).toContain(softwareInput.name);
    expect(overview).toContain(softwareInput.idea);
    expect(overview).toContain("Lovable");
  });

  it("summarizes the general pack's target assistant", () => {
    const overview = buildOverview(generalInput);
    expect(overview).toContain(generalInput.name);
    expect(overview).toContain(generalInput.target);
  });
});
