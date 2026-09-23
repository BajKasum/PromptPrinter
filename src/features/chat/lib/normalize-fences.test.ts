import { describe, expect, it } from "vitest";
import { normalizeFences } from "@/features/chat/lib/normalize-fences";

describe("normalizeFences", () => {
  // Genau die Form aus dem Audit-Test vom 23.09.2026.
  it("moves a closing fence on the content line onto its own line", () => {
    const input = "```text\nErstelle eine App.\n\nFuer Buchungsanfragen.```";
    expect(normalizeFences(input)).toBe(
      "```text\nErstelle eine App.\n\nFuer Buchungsanfragen.\n```"
    );
  });

  it("keeps trailing text after the repaired block intact", () => {
    const input = "```text\nPrompt.```\n\nViel Erfolg!";
    expect(normalizeFences(input)).toBe("```text\nPrompt.\n```\n\nViel Erfolg!");
  });

  it("leaves a correctly closed block untouched", () => {
    const input = "Hier:\n\n```text\nPrompt.\n```\n\nFertig.";
    expect(normalizeFences(input)).toBe(input);
  });

  it("leaves backticks in normal prose untouched", () => {
    const input = "Nutze ``` fuer Codebloecke, das ist Markdown```";
    expect(normalizeFences(input)).toBe(input);
  });

  it("only closes with at least as many backticks as the block opened with", () => {
    const input = "````text\nZeile mit ``` darin\n````";
    expect(normalizeFences(input)).toBe(input);
  });

  it("repairs each block of a reply with several", () => {
    const input = "```text\nEins.```\n\n```text\nZwei.```";
    expect(normalizeFences(input)).toBe("```text\nEins.\n```\n\n```text\nZwei.\n```");
  });

  it("leaves an unclosed block (still streaming) as it is", () => {
    const input = "```text\nNoch nicht fertig";
    expect(normalizeFences(input)).toBe(input);
  });
});
