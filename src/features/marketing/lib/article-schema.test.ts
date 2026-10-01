import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGAL } from "@/shared/lib/legal";
import { articleJsonLd, formatLongDate } from "./article-schema";

describe("formatLongDate", () => {
  it("schreibt ein ISO-Datum deutsch aus", () => {
    expect(formatLongDate("2026-10-01")).toBe("1. Oktober 2026");
    expect(formatLongDate("2026-07-25")).toBe("25. Juli 2026");
  });

  // new Date("2026-10-01") ist Mitternacht UTC. In einer Zeitzone westlich
  // davon wäre das ohne `timeZone: "UTC"` der 30. September.
  it("kippt am Monatsersten nicht auf den Vortag", () => {
    expect(formatLongDate("2026-01-01")).toBe("1. Januar 2026");
  });
});

describe("articleJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function build() {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    return articleJsonLd({
      type: "TechArticle",
      headline: "Erste Schritte",
      description: "Vom Konto zum ersten Prompt.",
      path: "/docs/erste-schritte",
      published: "2026-07-25",
      updated: "2026-10-01",
    });
  }

  it("nennt Titel, Beschreibung und beide Daten", () => {
    expect(build()).toMatchObject({
      "@type": "TechArticle",
      headline: "Erste Schritte",
      description: "Vom Konto zum ersten Prompt.",
      datePublished: "2026-07-25",
      dateModified: "2026-10-01",
      inLanguage: "de",
    });
  });

  it("baut jede Adresse aus der konfigurierten Origin", () => {
    const schema = build();
    expect(schema.mainEntityOfPage).toBe("https://staging.example.com/docs/erste-schritte");
    expect(schema.author).toMatchObject({ url: "https://staging.example.com/ueber" });
    expect(JSON.stringify(schema)).not.toContain("promptprinter.app");
  });

  // Derselbe Name wie im Impressum, keine zweite Angabe von Hand.
  it("nennt als Autor den Betreiber aus den Rechtsangaben", () => {
    expect(build().author).toMatchObject({ "@type": "Person", name: LEGAL.operator });
  });

  it("ist ohne Angabe ein gewöhnlicher Article", () => {
    const schema = articleJsonLd({
      headline: "x",
      description: "y",
      path: "/vergleich/x",
      published: "2026-10-01",
      updated: "2026-10-01",
    });
    expect(schema["@type"]).toBe("Article");
  });
});
