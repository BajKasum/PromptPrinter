import { describe, expect, it } from "vitest";
import { extractPrompt, derivePromptTitle } from "@/lib/saved-prompts";

describe("extractPrompt", () => {
  it("returns the body of a single fenced block, trimmed", () => {
    const md = "Hier ist dein Prompt:\n\n```text\nDu bist ein Tutor.\n```";
    expect(extractPrompt(md)).toBe("Du bist ein Tutor.");
  });

  it("joins multiple fenced blocks with a blank line", () => {
    const md = "```text\nErster Prompt.\n```\nund\n```text\nZweiter Prompt.\n```";
    expect(extractPrompt(md)).toBe("Erster Prompt.\n\nZweiter Prompt.");
  });

  it("handles a language tag on the fence", () => {
    const md = "```sql\nselect 1;\n```";
    expect(extractPrompt(md)).toBe("select 1;");
  });

  it("returns null when there is no fenced block (e.g. a clarifying question)", () => {
    expect(extractPrompt("Welche Ziel-KI meinst du, Claude oder ChatGPT?")).toBeNull();
  });

  it("returns null for an empty fenced block", () => {
    expect(extractPrompt("```text\n\n```")).toBeNull();
  });

  it("preserves internal blank lines within a block", () => {
    const md = "```text\nRolle.\n\nAufgabe.\n```";
    expect(extractPrompt(md)).toBe("Rolle.\n\nAufgabe.");
  });
});

describe("derivePromptTitle", () => {
  it("uses the first non-empty line", () => {
    expect(derivePromptTitle("Du bist ein Reise-Planer.\nMehr Text.")).toBe(
      "Du bist ein Reise-Planer."
    );
  });

  it("strips a leading markdown heading marker", () => {
    expect(derivePromptTitle("## Ziel\nDetails")).toBe("Ziel");
  });

  it("strips a leading list bullet", () => {
    expect(derivePromptTitle("- Schreibe eine E-Mail")).toBe("Schreibe eine E-Mail");
  });

  it("truncates an overly long first line with an ellipsis", () => {
    const long = "A".repeat(100);
    const title = derivePromptTitle(long);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(72);
  });

  it("falls back to a generic label when there is no usable line", () => {
    expect(derivePromptTitle("   \n  \n")).toBe("Gespeicherter Prompt");
  });
});
