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
});
