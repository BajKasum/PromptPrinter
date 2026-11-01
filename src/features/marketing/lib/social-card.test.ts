import { describe, expect, it } from "vitest";
import { DOCS_ORDER } from "@/shared/lib/docs-nav";
import { COMPARISONS } from "./comparisons";
import { slugFromSegment, socialCardFor, socialImageUrl } from "./social-card";

describe("socialImageUrl", () => {
  // Der Matcher der Middleware lässt Pfade mit Bild-Endung aus (src/middleware.ts). Ohne .png bekäme ein
  // abgemeldeter Crawler eine Weiterleitung statt der Karte.
  it("endet auf .png, damit die Middleware die Karte durchlässt", () => {
    expect(socialImageUrl("docs", "erste-schritte")).toBe("/og/docs/erste-schritte.png");
    expect(socialImageUrl("vergleich", "prompt-vorlagen")).toBe("/og/vergleich/prompt-vorlagen.png");
  });

  it("lässt sich mit slugFromSegment umkehren", () => {
    expect(slugFromSegment("erste-schritte.png")).toBe("erste-schritte");
    expect(slugFromSegment("erste-schritte")).toBe("erste-schritte");
  });
});

describe("socialCardFor", () => {
  it("hat für jeden Hilfe-Artikel eine Karte mit dessen Titel", () => {
    for (const doc of DOCS_ORDER) {
      expect(socialCardFor("docs", doc.slug), doc.slug).toEqual({ label: "Hilfe", title: doc.title });
    }
  });

  it("hat für jeden Vergleich eine Karte mit dessen Frage", () => {
    for (const comparison of COMPARISONS) {
      expect(socialCardFor("vergleich", comparison.slug), comparison.slug).toEqual({
        label: "Vergleich",
        title: comparison.question,
      });
    }
  });

  it("kennt weder fremde Arten noch unbekannte Seiten", () => {
    expect(socialCardFor("docs", "gibt-es-nicht")).toBeNull();
    expect(socialCardFor("vergleich", "gibt-es-nicht")).toBeNull();
    expect(socialCardFor("pricing", "erste-schritte")).toBeNull();
  });
});
