import { afterEach, describe, expect, it, vi } from "vitest";
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
      expect.arrayContaining(["/", "/pricing", "/docs", "/datenschutz", "/impressum"])
    );
  });

  // /features redirects to /#funktionen (next.config.ts) since its content
  // moved back onto the landing page. arrayContaining above can't catch a
  // stale entry, so this asserts the absence directly.
  it("does not list the retired /features redirect", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(sitemap().some((e) => e.url.endsWith("/features"))).toBe(false);
  });
});
