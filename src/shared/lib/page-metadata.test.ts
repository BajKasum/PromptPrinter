import { describe, expect, it } from "vitest";
import { pageMetadata } from "./page-metadata";

describe("pageMetadata", () => {
  const meta = pageMetadata({
    title: "Preise",
    description: "Free mit eigenem Key, Pro ohne.",
    path: "/pricing",
  });

  it("setzt das Canonical auf den Pfad der Seite", () => {
    expect(meta.alternates?.canonical).toBe("/pricing");
  });

  // Der Seitentitel bleibt kurz, weil das Root-Layout " · PromptPrinter"
  // anhängt. Für openGraph und twitter gilt diese Vorlage nicht, dort muss
  // der Markenname selbst im Titel stehen.
  it("lässt den Seitentitel kurz und schreibt die Marke in die Vorschau", () => {
    expect(meta.title).toBe("Preise");
    expect(meta.openGraph?.title).toBe("Preise · PromptPrinter");
    expect(meta.twitter?.title).toBe("Preise · PromptPrinter");
  });

  it("gibt der Vorschau dieselbe Beschreibung und Adresse wie der Seite", () => {
    expect(meta.description).toBe("Free mit eigenem Key, Pro ohne.");
    expect(meta.openGraph?.description).toBe(meta.description);
    expect(meta.openGraph?.url).toBe("/pricing");
    expect(meta.twitter?.description).toBe(meta.description);
  });

  it("hängt die Marke nicht an einen Titel, der sie schon nennt", () => {
    const own = pageMetadata({
      title: "PromptPrinter oder Prompt-Vorlagen?",
      description: "Wo eine Vorlage reicht und wo eine Rückfrage mehr bringt.",
      path: "/vergleich/prompt-vorlagen",
      titleStandsAlone: true,
    });

    expect(own.title).toEqual({ absolute: "PromptPrinter oder Prompt-Vorlagen?" });
    expect(own.openGraph?.title).toBe("PromptPrinter oder Prompt-Vorlagen?");
    expect(own.twitter?.title).toBe("PromptPrinter oder Prompt-Vorlagen?");
  });

  // Eine Seite mit eigenem openGraph erbt das Bild des Root-Layouts nicht
  // mehr. Ohne diese Angabe hätte jede geteilte Unterseite keine Vorschau.
  it("nennt das Vorschaubild selbst", () => {
    const image = { url: "/opengraph-image", width: 1200, height: 630 };
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(image)]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining(image)]);
  });

  it("bleibt ohne article bei og:type website und ohne Artikeldaten", () => {
    expect(meta.openGraph).toMatchObject({ type: "website" });
    expect(meta.openGraph).not.toHaveProperty("publishedTime");
  });

  // #253: ein Hilfe-Artikel zeigt beim Teilen sein eigenes Thema und ist für Aggregatoren ein Artikel.
  describe("mit eigenem Bild und Artikeldaten", () => {
    const article = pageMetadata({
      title: "Erste Schritte",
      description: "Vom Konto zum ersten Prompt.",
      path: "/docs/erste-schritte",
      image: { url: "/og/docs/erste-schritte.png", alt: "Erste Schritte, Hilfe von PromptPrinter" },
      article: {
        publishedTime: "2026-07-25",
        modifiedTime: "2026-10-11",
        authors: ["https://staging.example.com/ueber"],
      },
    });

    it("nennt statt der Karte der Startseite das eigene Bild, mit Grösse und Beschreibung", () => {
      const image = {
        url: "/og/docs/erste-schritte.png",
        width: 1200,
        height: 630,
        alt: "Erste Schritte, Hilfe von PromptPrinter",
      };
      expect(article.openGraph?.images).toEqual([image]);
      expect(article.twitter?.images).toEqual([image]);
    });

    it("macht aus der Seite einen Artikel mit Veröffentlichung, Änderung und Autor", () => {
      expect(article.openGraph).toMatchObject({
        type: "article",
        publishedTime: "2026-07-25",
        modifiedTime: "2026-10-11",
        authors: ["https://staging.example.com/ueber"],
      });
    });
  });
});
