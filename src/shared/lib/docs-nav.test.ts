import { describe, expect, it } from "vitest";
import { DOCS_ORDER, DOCS_PUBLISHED, docBySlug, docNeighbours, docStep } from "./docs-nav";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("docs-nav", () => {
  it("vergibt jeden Slug nur einmal", () => {
    const slugs = DOCS_ORDER.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("zählt die Schritte ab 1 in Lesereihenfolge", () => {
    expect(docStep(DOCS_ORDER[0].slug)).toBe(1);
    expect(docStep(DOCS_ORDER[DOCS_ORDER.length - 1].slug)).toBe(DOCS_ORDER.length);
  });

  it("kennt an den Enden nur einen Nachbarn", () => {
    expect(docNeighbours(DOCS_ORDER[0].slug).prev).toBeNull();
    expect(docNeighbours(DOCS_ORDER[DOCS_ORDER.length - 1].slug).next).toBeNull();
    expect(docNeighbours("gibt-es-nicht")).toEqual({ prev: null, next: null });
  });

  it("findet einen Artikel über seinen Slug", () => {
    expect(docBySlug(DOCS_ORDER[0].slug)).toBe(DOCS_ORDER[0]);
    expect(docBySlug("gibt-es-nicht")).toBeUndefined();
  });

  // Das Datum steht in der Autorenzeile und als dateModified im JSON-LD. Ein
  // Tippfehler ergäbe "Invalid Date" auf einer öffentlichen Seite, ein Datum
  // in der Zukunft eine Angabe, die nicht stimmen kann.
  it("datiert jeden Artikel gültig, nach der Veröffentlichung und nicht in der Zukunft", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(DOCS_PUBLISHED).toMatch(ISO_DATE);

    for (const article of DOCS_ORDER) {
      expect(article.updated, article.slug).toMatch(ISO_DATE);
      expect(Number.isNaN(Date.parse(article.updated)), article.slug).toBe(false);
      expect(article.updated >= DOCS_PUBLISHED, article.slug).toBe(true);
      expect(article.updated <= today, article.slug).toBe(true);
    }
  });
});
