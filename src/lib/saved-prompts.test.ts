import { describe, expect, it } from "vitest";
import { extractPrompt, derivePromptTitle } from "@/lib/saved-prompts";

describe("extractPrompt", () => {
  it("returns the body of a single fenced block, trimmed", () => {
    const md = "Hier ist dein Prompt:\n\n```text\nDu bist ein Tutor.\n```";
    expect(extractPrompt(md)).toBe("Du bist ein Tutor.");
  });

  it("handles a language tag on the fence", () => {
    const md = "```sql\nselect 1;\n```";
    expect(extractPrompt(md)).toBe("select 1;");
  });

  // QA finding F-5: multiple fenced blocks used to get joined into one saved
  // "prompt", so an incidental second block (an example payload, a schema
  // sketch) silently became part of what got saved. These pin the selection
  // rule that replaced the join.
  describe("multiple fenced blocks (QA finding F-5)", () => {
    it("prefers the last ```text block over an earlier one, not joining them", () => {
      const md = "```text\nErste Fassung.\n```\nkuerzer bitte\n```text\nZweite, kuerzere Fassung.\n```";
      expect(extractPrompt(md)).toBe("Zweite, kuerzere Fassung.");
    });

    it("prefers a ```text block over an untagged incidental block, regardless of order", () => {
      const md = '```json\n{ "example": true }\n```\n\n```text\nDu bist ein hilfreicher Assistent.\n```';
      expect(extractPrompt(md)).toBe("Du bist ein hilfreicher Assistent.");
    });

    it("falls back to the longest block when nothing is tagged text", () => {
      const md = "```json\n{ \"a\": 1 }\n```\n\n```\nDies ist der eigentliche, deutlich laengere Prompt-Text.\n```";
      expect(extractPrompt(md)).toBe("Dies ist der eigentliche, deutlich laengere Prompt-Text.");
    });
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
