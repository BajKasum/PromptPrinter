import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPARISONS } from "@/features/marketing/lib/comparisons";
import { PRO_AVAILABLE } from "@/shared/lib/pro-availability";
import { buildLlmsTxt } from "./build-llms-txt";

// Same drift guard as robots.test.ts / sitemap.test.ts: every URL in here
// must come from the configured app origin, never a hardcoded domain this
// deployment doesn't own.
describe("llms.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds every link from the configured app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    const links = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith("https://staging.example.com/")).toBe(true);
    }
  });

  it("never hardcodes a domain the deployment doesn't own", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(buildLlmsTxt()).not.toContain("promptprinter.app");
  });

  it("lists every docs article and every plan by name", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    expect(text).toContain("Free");
    expect(text).toContain("Pro");
    expect(text).toContain("/docs/erste-schritte");
  });

  // #125: Antwortmaschinen lesen diese Datei, nicht die Entschuldigungsseite.
  it("nennt keinen Preis für Pro, solange Pro nicht buchbar ist", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const proLine = buildLlmsTxt()
      .split("\n")
      .find((line) => line.startsWith("- Pro"));

    expect(proLine).toBeDefined();
    if (PRO_AVAILABLE) {
      expect(proLine).toMatch(/€\/Monat/);
    } else {
      expect(proLine).toContain("derzeit nicht buchbar");
      expect(proLine).not.toMatch(/\d/);
    }
  });

  // #252: Antwortmaschinen sollen die Sprachen der App kennen, ohne dass die Seiten übersetzt sind.
  it("nennt die fünf Sprachen der App auf Deutsch und in einer englischen Zusammenfassung", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();

    expect(text).toContain("Deutsch, Englisch, Französisch, Italienisch und Spanisch");
    const english = text.split("## English")[1];
    expect(english).toBeDefined();
    expect(english).toContain("German, English, French, Italian and Spanish");
    expect(english).toContain("public website is in German only");
  });

  it("lists the comparison pages with their question", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();

    expect(text).toContain("## Vergleiche");
    for (const comparison of COMPARISONS) {
      expect(text).toContain(
        `[${comparison.question}](https://staging.example.com/vergleich/${comparison.slug})`
      );
    }
  });
});
