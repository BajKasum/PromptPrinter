import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

// Security-Audit finding L-6: the sitemap URL used to be a hardcoded
// "https://promptprinter.app" — a domain that isn't actually assigned to this
// deployment yet. It now derives from siteUrl(), the same canonical-origin
// helper the auth-redirect links already use.
describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("points the sitemap at the app's real configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(robots().sitemap).toBe("https://staging.example.com/sitemap.xml");
  });

  it("never hardcodes a domain the deployment doesn't own", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(robots().sitemap).not.toContain("promptprinter.app");
  });

  it("keeps the app's authenticated area out of the crawl", () => {
    const { rules } = robots();
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow;
    expect(disallow).toEqual(
      expect.arrayContaining(["/api/", "/chats", "/projects", "/settings", "/billing"])
    );
  });
});
