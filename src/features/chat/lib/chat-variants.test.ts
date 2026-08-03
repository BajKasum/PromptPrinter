import { describe, expect, it } from "vitest";
import { resolveVariant, resolveEmptyState } from "@/features/chat/lib/chat-variants";

describe("resolveVariant", () => {
  it("is 'refine' whenever a projectId is present", () => {
    expect(resolveVariant("proj-1")).toBe("refine");
  });

  it("is 'general' for a standalone chat", () => {
    expect(resolveVariant(undefined)).toBe("general");
  });
});

describe("resolveEmptyState", () => {
  it("uses the unified heading outside a project", () => {
    const general = resolveEmptyState("general", false);
    expect(general.heading).toBe("Woran arbeiten wir?");
  });

  it("personalizes the unified heading with the user's name", () => {
    const state = resolveEmptyState("general", false, "Kasum");
    expect(state.heading).toBe("Woran arbeiten wir, Kasum?");
  });

  it("leaves the heading unpersonalized when no name is given", () => {
    const state = resolveEmptyState("general", false, null);
    expect(state.heading).toBe("Woran arbeiten wir?");
  });

  it("shows the project-fresh copy for a project chat with no saved results yet", () => {
    const state = resolveEmptyState("refine", false);
    expect(state.heading).toBe("Woran arbeiten wir hier?");
    expect(state.placeholder).toBe("Beschreib, woran wir arbeiten…");
  });

  it("never personalizes the refine/project-fresh headings, even with a name", () => {
    expect(resolveEmptyState("refine", false, "Kasum").heading).toBe("Woran arbeiten wir hier?");
    expect(resolveEmptyState("refine", true, "Kasum").heading).toBe("Pass deine Prompts an");
  });

  it("shows refine copy once a project has results", () => {
    const state = resolveEmptyState("refine", true);
    expect(state.heading).toBe("Pass deine Prompts an");
    expect(state.placeholder).toBe("Sag mir, was ich ändern soll…");
  });
});
