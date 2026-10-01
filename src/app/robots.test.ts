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
      expect.arrayContaining([
        "/api/",
        "/chats",
        "/projects",
        "/settings",
        "/billing",
        "/usage",
        "/prompts",
        "/admin",
      ])
    );
  });

  // "Stop blocking AI crawlers": GPTBot, ClaudeBot, PerplexityBot und Co.
  // lesen dieselbe `*`-Gruppe wie Google. Eine eigene Gruppe für einen Bot
  // oder ein `Disallow: /` würde sie aussperren, und zwar unbemerkt.
  it("sperrt keinen Crawler aus dem öffentlichen Teil aus", () => {
    const { rules } = robots();
    const groups = Array.isArray(rules) ? rules : [rules];

    expect(groups).toHaveLength(1);
    expect(groups[0].userAgent).toBe("*");
    expect(groups[0].allow).toBe("/");
    expect(groups[0].disallow).not.toContain("/");
  });
});
