import { describe, expect, it } from "vitest";
import { markdownToPdf } from "@/features/prompts/lib/pdf-export";

describe("markdownToPdf", () => {
  it("produces a non-empty PDF for a typical artifact", () => {
    const md = `# Streak Coach, Produktanforderungen

## Vision
Ein durchdachter Habit-Tracker.

## Im Scope
- Habit-CRUD mit täglichem Check-in
- **Wichtig**: KI-generierte Belohnungsvorschläge
- \`inline code\` sollte auch nicht crashen
`;
    const doc = markdownToPdf("Produktplan", md);
    const blob = doc.output("arraybuffer");
    expect(blob.byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("paginates long content across multiple pages", () => {
    const longMd = Array.from({ length: 400 }, (_, i) => `Zeile ${i} mit etwas Text zum Umbrechen.`).join(
      "\n"
    );
    const doc = markdownToPdf("Langes Dokument", longMd);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("does not throw on empty content", () => {
    expect(() => markdownToPdf("Leer", "")).not.toThrow();
  });
});
