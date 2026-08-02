import { describe, expect, it, vi } from "vitest";
import {
  assertEnv,
  hasInsecureAppUrl,
  hasNoModelProvider,
  missingProductionEnv,
} from "@/lib/env";

// QA finding S-2: the deploy trap was that these variables read as optional
// (commented out in .env.example, described as "recommended") while the app is
// unusable without them. These tests pin down that the check knows all seven
// and that it only hard-fails where hard-failing is the right answer.

const complete: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "https://promptprinter.app",
  API_KEY_ENCRYPTION_SECRET: "secret",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  ZAI_API_KEY: "zai",
};

describe("missingProductionEnv", () => {
  it("reports nothing when everything is set", () => {
    expect(missingProductionEnv(complete)).toEqual([]);
  });

  it("reports every required variable when the environment is empty", () => {
    expect(missingProductionEnv({}).map((m) => m.name)).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_APP_URL",
      "API_KEY_ENCRYPTION_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
  });

  it("treats a blank value as missing, not as configured", () => {
    expect(missingProductionEnv({ ...complete, API_KEY_ENCRYPTION_SECRET: "   " })).toHaveLength(1);
  });

  // The state this catches shipped unnoticed until 2026-08-02: the Turnstile
  // widget was visible to every visitor while nothing verified what it
  // produced. Requiring the secret only alongside the site key keeps a
  // deliberately captcha-free deployment valid while making the decorative
  // combination impossible to boot in production.
  describe("Turnstile, required only once the widget is switched on", () => {
    it("stays silent when no site key is configured", () => {
      expect(missingProductionEnv(complete)).toEqual([]);
    });

    it("demands the secret as soon as a site key is present", () => {
      const missing = missingProductionEnv({
        ...complete,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAD12iLTpFGNphiju",
      });
      expect(missing.map((m) => m.name)).toEqual(["TURNSTILE_SECRET"]);
    });

    it("is satisfied by both halves together", () => {
      expect(
        missingProductionEnv({
          ...complete,
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAD12iLTpFGNphiju",
          TURNSTILE_SECRET: "0x-secret",
        })
      ).toEqual([]);
    });
  });

  it("catches the Upstash pair, the one that silently 429s every route", () => {
    const missing = missingProductionEnv({
      ...complete,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(missing.map((m) => m.name)).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
  });
});

describe("hasNoModelProvider", () => {
  it("is false when Z.ai is configured", () => {
    expect(hasNoModelProvider(complete)).toBe(false);
  });

  it("is false when only Gemini is configured", () => {
    expect(hasNoModelProvider({ GEMINI_API_KEY: "g" })).toBe(false);
  });

  it("is true when neither is configured", () => {
    expect(hasNoModelProvider({})).toBe(true);
  });
});

describe("assertEnv", () => {
  it("throws in production, naming every missing variable", () => {
    expect(() => assertEnv({ NODE_ENV: "production" })).toThrowError(
      /UPSTASH_REDIS_REST_URL/
    );
  });

  it("does not throw in production once everything is set", () => {
    expect(() => assertEnv({ ...complete, NODE_ENV: "production" })).not.toThrow();
  });

  it("only warns outside production, where a missing Upstash is normal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...complete, NODE_ENV: "development", UPSTASH_REDIS_REST_URL: "" }))
      .not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns about stub mode without failing, since it is a deliberate feature", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertEnv({ ...complete, NODE_ENV: "production", ZAI_API_KEY: "", GEMINI_API_KEY: "" })
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Stub-Modus"));
    warn.mockRestore();
  });
});

// A *present* NEXT_PUBLIC_APP_URL is not the same as a *correct* one, and the
// presence check above cannot tell them apart. This value decides whether
// production session cookies carry the Secure flag and where confirmation
// mails point — a leftover http://localhost:3000 boots cleanly and breaks both
// without a single error.
describe("hasInsecureAppUrl", () => {
  const prod = (url: string | undefined) => ({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: url,
  });

  it("flags a plain-http production URL", () => {
    expect(hasInsecureAppUrl(prod("http://promptprinter.vercel.app"))).toBe(true);
  });

  it("flags a leftover localhost URL, the realistic mistake", () => {
    expect(hasInsecureAppUrl(prod("http://localhost:3000"))).toBe(true);
  });

  it("accepts a proper https URL", () => {
    expect(hasInsecureAppUrl(prod("https://promptprinter.vercel.app"))).toBe(false);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(hasInsecureAppUrl(prod("  HTTPS://promptprinter.vercel.app  "))).toBe(false);
  });

  it("stays quiet outside production, where http is the normal case", () => {
    expect(
      hasInsecureAppUrl({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" })
    ).toBe(false);
  });

  it("leaves an absent value to the missing-variable check instead of double-reporting", () => {
    expect(hasInsecureAppUrl(prod(undefined))).toBe(false);
    expect(hasInsecureAppUrl(prod("   "))).toBe(false);
  });
});
