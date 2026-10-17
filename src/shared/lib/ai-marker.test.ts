import { describe, expect, it } from "vitest";
import {
  AI_GENERATED_FOOTER,
  AI_GENERATED_KEYWORD,
  AI_GENERATED_MARKER,
  AI_GENERATED_SUBJECT,
  markAiMarkdown,
} from "./ai-marker";

describe("markAiMarkdown", () => {
  it("setzt die Markierung vor das Dokument und lässt den Text darunter unverändert", () => {
    const md = "# Titel\n\nDu bist ein Tutor.\n\n```\ncode\n```\n";
    const marked = markAiMarkdown(md);

    expect(marked.startsWith(`${AI_GENERATED_MARKER}\n\n`)).toBe(true);
    expect(marked.endsWith(md)).toBe(true);
  });

  it("markiert ein schon markiertes Dokument nicht noch einmal", () => {
    const once = markAiMarkdown("Text");
    expect(markAiMarkdown(once)).toBe(once);
  });

  it("ist ein HTML-Kommentar, damit die Markdown-Ansicht nichts davon zeigt", () => {
    expect(AI_GENERATED_MARKER).toMatch(/^<!--.*-->$/);
  });

  it("trägt maschinenlesbar 'ai-generated' und den Erzeuger", () => {
    expect(AI_GENERATED_MARKER).toContain("ai-generated: true");
    expect(AI_GENERATED_MARKER).toContain("PromptPrinter");
    expect(AI_GENERATED_KEYWORD).toBe("ai-generated");
    expect(AI_GENERATED_SUBJECT).toContain("KI");
    expect(AI_GENERATED_FOOTER).toContain("mit KI erzeugt");
  });
});
