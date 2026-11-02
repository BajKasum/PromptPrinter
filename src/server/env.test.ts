import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  assertEnv,
  encryptionSecretProblem,
  hasCheckoutWithoutWebhook,
  hasInsecureAppUrl,
  hasInvalidCheckoutUrl,
  hasNoModelProvider,
  hasNoTrustedClientIp,
  hasOpenEncryptionRotation,
  missingProductionEnv,
} from "@/server/env";

// QA finding S-2: the deploy trap was that these variables read as optional
// (commented out in .env.example, described as "recommended") while the app is
// unusable without them. These tests pin down that the check knows all seven
// and that it only hard-fails where hard-failing is the right answer.

const complete: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "https://promptprinter.app",
  API_KEY_ENCRYPTION_SECRET: randomBytes(32).toString("base64"),
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  ZAI_API_KEY: "zai",
};

describe("API_KEY_ENCRYPTION_SECRET beim Start", () => {
  const production = (secret: string | undefined) => ({
    ...complete,
    NODE_ENV: "production",
    API_KEY_ENCRYPTION_SECRET: secret,
  });

  it("startet in Produktion mit langem Zufall, in Hex wie in Base64", () => {
    expect(() => assertEnv(production(randomBytes(16).toString("hex")))).not.toThrow();
    expect(() => assertEnv(production(randomBytes(32).toString("base64")))).not.toThrow();
    expect(() => assertEnv(production(randomBytes(32).toString("base64url")))).not.toThrow();
  });

  it("bricht in Produktion ab, wenn er fehlt oder leer ist", () => {
    expect(() => assertEnv(production(undefined))).toThrow(/API_KEY_ENCRYPTION_SECRET/);
    expect(() => assertEnv(production("   "))).toThrow(/API_KEY_ENCRYPTION_SECRET/);
  });

  it("bricht in Produktion ab, wenn er zu kurz ist, und nennt den Wert nicht", () => {
    const short = randomBytes(15).toString("hex"); // 30 Zeichen
    expect(() => assertEnv(production(short))).toThrow(/kürzer als 32 Zeichen/);
    let message = "";
    try {
      assertEnv(production(short));
    } catch (err) {
      message = String(err);
    }
    expect(message).not.toContain(short);
  });

  it.each([
    ["Vorlage", "placeholder-secret-for-ci-only-0123456789"],
    ["Aufforderung", "please-change-me-before-you-deploy-this"],
    ["alter Rückfallwert", "promptprinter-dev-only-insecure-fallback-do-not-use-in-production"],
    ["Beispiel", "this-is-an-example-value-of-some-length"],
    ["ein Zeichen wiederholt", "a".repeat(40)],
    ["kurzes Muster wiederholt", "abcabc".repeat(8)],
  ])("bricht in Produktion ab bei einem Platzhalter: %s", (_label, value) => {
    expect(encryptionSecretProblem(value)).toBe("placeholder");
    expect(() => assertEnv(production(value))).toThrow(/Platzhalter/);
  });

  it("warnt ausserhalb der Produktion nur, und schweigt dort, wenn er fehlt (BYOK ist dann aus)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...complete, NODE_ENV: "development", API_KEY_ENCRYPTION_SECRET: "kurz" })).not.toThrow();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/kürzer als 32 Zeichen/);
    warn.mockRestore();
  });

  it("prüft das alte Secret einer Rotation nicht: von einem schwachen Wert soll man weg können", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertEnv({ ...production(randomBytes(32).toString("base64")), API_KEY_ENCRYPTION_SECRET_PREVIOUS: "kurz" })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("ein Zufallswert löst die Platzhalter-Prüfung nicht aus", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(encryptionSecretProblem(randomBytes(16).toString("hex"))).toBeNull();
      expect(encryptionSecretProblem(randomBytes(24).toString("base64"))).toBeNull();
    }
  });
});

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

  it("warns about an unusable checkout address without blocking the boot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertEnv({
        ...complete,
        NODE_ENV: "production",
        NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "https://example.com/checkout",
      })
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LEMONSQUEEZY"));
    warn.mockRestore();
  });
});

// Zahlungen sind optional konfigurierbar, aber eine falsch konfigurierte
// Adresse ist schlimmer als gar keine: die Seite sieht normal aus, nur kauft
// niemand mehr. Deshalb dieselbe Sorte Prüfung wie bei NEXT_PUBLIC_APP_URL.
describe("hasNoTrustedClientIp", () => {
  it("meldet eine eigene Installation in Produktion ohne TRUSTED_PROXY_HOPS", () => {
    expect(hasNoTrustedClientIp({ NODE_ENV: "production" })).toBe(true);
  });

  it("schweigt auf Vercel, mit TRUSTED_PROXY_HOPS und in der Entwicklung", () => {
    expect(hasNoTrustedClientIp({ NODE_ENV: "production", VERCEL: "1" })).toBe(false);
    expect(hasNoTrustedClientIp({ NODE_ENV: "production", TRUSTED_PROXY_HOPS: "1" })).toBe(false);
    expect(hasNoTrustedClientIp({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("hasInvalidCheckoutUrl", () => {
  it("stays quiet when payments are deliberately not configured", () => {
    expect(hasInvalidCheckoutUrl({})).toBe(false);
    expect(hasInvalidCheckoutUrl({ NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "  " })).toBe(false);
  });

  it("accepts the store's checkout address", () => {
    expect(
      hasInvalidCheckoutUrl({
        NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL:
          "https://promptprinter.lemonsqueezy.com/checkout/buy/abc?embed=1",
      })
    ).toBe(false);
  });

  it("flags a foreign host, which the CSP would block anyway", () => {
    expect(
      hasInvalidCheckoutUrl({ NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "https://example.com/buy" })
    ).toBe(true);
  });

  it("flags the realistic mistakes: http, and a value that is not a URL at all", () => {
    expect(
      hasInvalidCheckoutUrl({
        NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "http://promptprinter.lemonsqueezy.com/checkout",
      })
    ).toBe(true);
    expect(hasInvalidCheckoutUrl({ NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "7a06a455" })).toBe(true);
  });
});

// Die Turnstile-Lehre auf Geld angewandt: dort sah ein Widget, dessen Token
// niemand einloeste, wie ein funktionierendes Captcha aus. Hier sieht ein
// Checkout, dessen Webhook niemand empfaengt, wie ein funktionierendes Upgrade
// aus — der Kunde zahlt, der Plan bleibt free, und das einzige Signal ist eine
// Supportmail.
describe("hasCheckoutWithoutWebhook", () => {
  const checkout = "https://promptprinter.lemonsqueezy.com/checkout/buy/abc";

  it("warnt, wenn man kaufen kann, aber niemand die Zahlung entgegennimmt", () => {
    expect(hasCheckoutWithoutWebhook({ NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: checkout })).toBe(
      true
    );
  });

  it("schweigt, sobald beide Haelften da sind", () => {
    expect(
      hasCheckoutWithoutWebhook({
        NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: checkout,
        LEMON_SQUEEZY_WEBHOOK_SECRET: "secret",
      })
    ).toBe(false);
  });

  it("schweigt, wenn es gar keinen Checkout gibt — dann fehlt auch nichts", () => {
    expect(hasCheckoutWithoutWebhook({})).toBe(false);
    expect(
      hasCheckoutWithoutWebhook({ NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "kaputt" })
    ).toBe(false);
  });
});

// Eine offene Rotation des BYOK-Secrets ist waehrend der Umstellung gewollt und
// danach ein Fehler: das alte Secret bleibt fuer jede nicht umgeschluesselte
// Zeile gueltig, solange die Variable steht. Der Hinweis beim Start sorgt dafuer,
// dass "vorlaeufig" nicht stillschweigend "dauerhaft" wird.
describe("hasOpenEncryptionRotation", () => {
  it("meldet eine offene Rotation, wenn ein anderes altes Secret gesetzt ist", () => {
    expect(
      hasOpenEncryptionRotation({
        API_KEY_ENCRYPTION_SECRET: "new",
        API_KEY_ENCRYPTION_SECRET_PREVIOUS: "old",
      })
    ).toBe(true);
  });

  it("schweigt ohne altes Secret und bei leerem Wert", () => {
    expect(hasOpenEncryptionRotation({ API_KEY_ENCRYPTION_SECRET: "new" })).toBe(false);
    expect(
      hasOpenEncryptionRotation({
        API_KEY_ENCRYPTION_SECRET: "new",
        API_KEY_ENCRYPTION_SECRET_PREVIOUS: "  ",
      })
    ).toBe(false);
  });

  it("schweigt, wenn das alte Secret dem aktuellen gleicht (nichts offen)", () => {
    expect(
      hasOpenEncryptionRotation({
        API_KEY_ENCRYPTION_SECRET: "same",
        API_KEY_ENCRYPTION_SECRET_PREVIOUS: "same",
      })
    ).toBe(false);
  });

  it("assertEnv warnt beim Start, ohne den Start zu verhindern, und nennt kein Secret", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [fresh, old] = [randomBytes(32).toString("base64"), randomBytes(32).toString("base64")];
    expect(() =>
      assertEnv({
        ...complete,
        NODE_ENV: "production",
        API_KEY_ENCRYPTION_SECRET: fresh,
        API_KEY_ENCRYPTION_SECRET_PREVIOUS: old,
      })
    ).not.toThrow();
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("API_KEY_ENCRYPTION_SECRET_PREVIOUS"))).toBe(true);
    expect(lines.join(" | ")).not.toContain(fresh);
    expect(lines.join(" | ")).not.toContain(old);
    warn.mockRestore();
  });
});

// A *present* NEXT_PUBLIC_APP_URL is not the same as a *correct* one, and the
// presence check above cannot tell them apart. This value decides whether
// production session cookies carry the Secure flag and where confirmation
// mails point — a leftover http://localhost:3000 boots cleanly and breaks both
// without a single error.
describe("assertEnv mit einer http-Adresse in Produktion", () => {
  const complete = Object.fromEntries(
    missingProductionEnv({ NODE_ENV: "production" }).map((m) => [m.name, "x"])
  );
  const env = {
    ...complete,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://localhost:3001",
    API_KEY_ENCRYPTION_SECRET: randomBytes(32).toString("base64"),
  };

  it("bricht den Start ab", () => {
    expect(() => assertEnv(env)).toThrow(/ALLOW_INSECURE_APP_URL/);
  });

  it("startet nur mit der ausdrücklichen Erlaubnis, und warnt dann", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...env, ALLOW_INSECURE_APP_URL: "1" })).not.toThrow();
    expect(warn.mock.calls.flat().join(" ")).toContain("ALLOW_INSECURE_APP_URL=1");
    warn.mockRestore();
  });

  it.each(["0", "true", ""])("ALLOW_INSECURE_APP_URL=%j erlaubt nichts", (value) => {
    expect(() => assertEnv({ ...env, ALLOW_INSECURE_APP_URL: value })).toThrow();
  });

  it("startet mit https ohne Erlaubnis", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...env, NEXT_PUBLIC_APP_URL: "https://example.test" })).not.toThrow();
    warn.mockRestore();
  });
});

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
