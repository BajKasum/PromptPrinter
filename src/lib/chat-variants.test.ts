import { describe, expect, it } from "vitest";
import { resolveVariant, resolveEmptyState } from "@/lib/chat-variants";

describe("resolveVariant", () => {
  it("is 'refine' whenever a projectId is present, regardless of mode", () => {
    expect(resolveVariant("general", "proj-1")).toBe("refine");
    expect(resolveVariant("software", "proj-1")).toBe("refine");
  });

  it("falls back to the raw mode for a standalone chat", () => {
    expect(resolveVariant("general", undefined)).toBe("general");
    expect(resolveVariant("software", undefined)).toBe("software");
  });
});

describe("resolveEmptyState", () => {
  it("uses the same unified copy for general and software outside a project", () => {
    const general = resolveEmptyState("general", "general", false);
    const software = resolveEmptyState("software", "software", false);
    expect(general.heading).toBe(software.heading);
    expect(general.starters).toEqual(software.starters);
    expect(general.starters.length).toBeGreaterThan(0);
  });

  it("shows the project-fresh copy for a project chat with no saved results yet", () => {
    const state = resolveEmptyState("refine", "software", false);
    expect(state.heading).toBe("Woran arbeiten wir hier?");
    expect(state.placeholder).toBe("Beschreib, woran wir arbeiten…");
  });

  it("shows refine copy + mode-specific starters once a project has results", () => {
    const software = resolveEmptyState("refine", "software", true);
    expect(software.heading).toBe("Pass deine Prompts an");
    expect(software.placeholder).toBe("Sag mir, was ich ändern soll…");
    expect(software.starters.some((s) => s.includes("Master-Prompt"))).toBe(true);

    const general = resolveEmptyState("refine", "general", true);
    expect(general.starters).not.toEqual(software.starters);
    expect(general.starters.some((s) => s.includes("Haupt-Prompt"))).toBe(true);
  });
});
