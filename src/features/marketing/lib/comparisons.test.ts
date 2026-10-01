import { describe, expect, it } from "vitest";
import { PRO_PRICE_LABEL } from "@/shared/lib/pricing";
import {
  COMPARISONS,
  COMPARISONS_UPDATED,
  comparisonBySlug,
  comparisonHref,
} from "./comparisons";

describe("Vergleiche", () => {
  it("vergibt jeden Slug nur einmal, in einer Form, die als Adresse taugt", () => {
    const slugs = COMPARISONS.map((comparison) => comparison.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("findet einen Vergleich über seinen Slug und baut seine Adresse", () => {
    const first = COMPARISONS[0];

    expect(comparisonBySlug(first.slug)).toBe(first);
    expect(comparisonBySlug("gibt-es-nicht")).toBeUndefined();
    expect(comparisonHref(first.slug)).toBe(`/vergleich/${first.slug}`);
  });

  // Die Seite ist als Frage gebaut: die h1 ist eine, und jede h2 darunter
  // auch. Eine Überschrift ohne Fragezeichen wäre ein Rückfall in Stichworte.
  it("stellt die Seite und jeden Abschnitt als Frage", () => {
    for (const comparison of COMPARISONS) {
      expect(comparison.question, comparison.slug).toMatch(/\?$/);
      for (const section of comparison.sections) {
        expect(section.question, comparison.slug).toMatch(/\?$/);
        expect(section.paragraphs.length, section.question).toBeGreaterThan(0);
      }
    }
  });

  // Regel 2 aus comparisons.ts: jede Seite sagt, wann der andere Weg reicht.
  it("nennt auf jeder Seite, wann der andere Weg der bessere ist", () => {
    for (const comparison of COMPARISONS) {
      const questions = comparison.sections.map((section) => section.question).join(" ");
      expect(questions, comparison.slug).toMatch(/Wann (reicht|tippe ich besser)/);
    }
  });

  it("füllt jede Tabellenzeile auf beiden Seiten", () => {
    for (const comparison of COMPARISONS) {
      expect(comparison.rows.length, comparison.slug).toBeGreaterThanOrEqual(4);
      for (const row of comparison.rows) {
        expect(row.promptprinter.trim(), row.topic).not.toBe("");
        expect(row.other.trim(), row.topic).not.toBe("");
      }
    }
  });

  // Regel 3: der Preis kommt aus pricing.ts. Steht irgendwo ein Euro-Betrag,
  // muss es genau dieser sein, keine zweite Zahl von Hand.
  it("nennt keinen anderen Preis als den der Preisseite", () => {
    const text = JSON.stringify(COMPARISONS);
    const amounts = text.match(/\d+(?:,\d+)?\s?€/g) ?? [];

    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(amount).toBe(PRO_PRICE_LABEL);
  });

  it("verlinkt nur auf interne Seiten", () => {
    for (const comparison of COMPARISONS) {
      expect(comparison.related.length, comparison.slug).toBeGreaterThan(0);
      for (const link of comparison.related) expect(link.href).toMatch(/^\/[a-z]/);
    }
  });

  it("trägt ein gültiges Datum, das nicht in der Zukunft liegt", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(COMPARISONS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(COMPARISONS_UPDATED))).toBe(false);
    expect(COMPARISONS_UPDATED <= today).toBe(true);
  });
});
