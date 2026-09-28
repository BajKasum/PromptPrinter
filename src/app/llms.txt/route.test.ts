import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLlmsTxt } from "./route";

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
});
