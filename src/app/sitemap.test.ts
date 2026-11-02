import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPARISONS, COMPARISONS_UPDATED, comparisonHref } from "@/features/marketing/lib/comparisons";
import { TASK_GUIDES, TASK_GUIDES_UPDATED, taskGuideHref } from "@/features/marketing/lib/task-guides";
import { DOCS_ORDER, docHref } from "@/shared/lib/docs-nav";
import sitemap from "./sitemap";

// Security-Audit finding L-6: BASE used to be the literal string
// "https://promptprinter.app" — a domain that isn't actually assigned to this
// deployment yet (see robots.test.ts for the same fix on that file). Every
// entry now derives from siteUrl(), so the sitemap always matches wherever
// the app is actually configured to run.
describe("sitemap", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds every entry from the configured app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const entries = sitemap();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url.startsWith("https://staging.example.com/")).toBe(true);
    }
  });

  it("never hardcodes a domain the deployment doesn't own", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const entries = sitemap();
    expect(entries.some((e) => e.url.includes("promptprinter.app"))).toBe(false);
  });

  it("includes the marketing, docs and legal pages", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const paths = sitemap().map((e) => e.url.replace("https://staging.example.com", ""));

    expect(paths).toEqual(
      expect.arrayContaining(["/", "/pricing", "/skill", "/docs", "/datenschutz", "/impressum"])
    );
  });

  // /features redirects to /#funktionen (next.config.ts) since its content
  // moved back onto the landing page. arrayContaining above can't catch a
  // stale entry, so this asserts the absence directly.
  it("does not list the retired /features redirect", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(sitemap().some((e) => e.url.endsWith("/features"))).toBe(false);
  });

  // #251: lastmod zählt nur, wenn es stimmt. Die Buildzeit ist keine Änderung.
  describe("lastModified", () => {
    const byPath = () =>
      new Map(sitemap().map((e) => [new URL(e.url).pathname, e.lastModified]));

    it("nimmt für Hilfe-Artikel das Datum aus docs-nav", () => {
      const entries = byPath();
      for (const article of DOCS_ORDER) {
        expect(entries.get(docHref(article.slug)), article.slug).toBe(article.updated);
      }
    });

    it("nimmt für Vergleiche und die Übersicht COMPARISONS_UPDATED", () => {
      const entries = byPath();
      expect(entries.get("/vergleich")).toBe(COMPARISONS_UPDATED);
      for (const comparison of COMPARISONS) {
        expect(entries.get(comparisonHref(comparison.slug)), comparison.slug).toBe(COMPARISONS_UPDATED);
      }
    });

    it("nimmt für Aufgabenseiten und die Übersicht TASK_GUIDES_UPDATED", () => {
      const entries = byPath();
      expect(entries.get("/aufgaben")).toBe(TASK_GUIDES_UPDATED);
      for (const guide of TASK_GUIDES) {
        expect(entries.get(taskGuideHref(guide.slug)), guide.slug).toBe(TASK_GUIDES_UPDATED);
      }
    });

    it("nimmt für Rechtstexte das Datum aus legal.ts als ISO-Datum", () => {
      const entries = byPath();
      for (const path of ["/datenschutz", "/cookies", "/agb", "/nutzungsrichtlinie", "/rueckerstattung", "/impressum"]) {
        expect(entries.get(path), path).toBe("2026-11-02");
      }
    });

    it("lässt lastModified weg, wo es kein gepflegtes Datum gibt", () => {
      const entries = byPath();
      for (const path of ["/", "/pricing", "/skill", "/ueber", "/kontakt"]) {
        expect(entries.get(path), path).toBeUndefined();
      }
    });

    it("nutzt nirgends die Buildzeit: zwei Läufe zu verschiedenen Zeiten sind gleich", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
        const first = JSON.stringify(sitemap());
        vi.setSystemTime(new Date("2027-05-05T10:00:00Z"));
        expect(JSON.stringify(sitemap())).toBe(first);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
