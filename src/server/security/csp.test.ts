import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp, buildStaticCsp, thirdPartiesFor, type ThirdParties } from "@/server/security/csp";

afterEach(() => {
  vi.unstubAllEnvs();
});

const TURNSTILE: ThirdParties = { turnstile: true, lemonSqueezy: false };
const LEMON: ThirdParties = { turnstile: false, lemonSqueezy: true };
const BOTH: ThirdParties = { turnstile: true, lemonSqueezy: true };

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d === name || d.startsWith(`${name} `)) ?? "";

describe("buildCsp", () => {
  it("includes the nonce in script-src and nowhere it could be reused for style", () => {
    const csp = buildCsp("test-nonce-123");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce-123'");
    expect(csp).not.toMatch(/style-src[^;]*nonce/);
  });

  it("allows Turnstile's script and iframe where the page loads it, blocks framing of the app itself", () => {
    const csp = buildCsp("n", TURNSTILE);
    expect(csp).toContain("script-src 'self' 'nonce-n' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds the Supabase project origin to connect-src when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcxyz.supabase.co");
    expect(buildCsp("n")).toContain("connect-src 'self' https://abcxyz.supabase.co");
    expect(buildCsp("n", TURNSTILE)).toContain(
      "connect-src 'self' https://challenges.cloudflare.com https://abcxyz.supabase.co"
    );
  });

  it("omits the Supabase origin from connect-src when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(buildCsp("n")).toContain("connect-src 'self';");
    expect(buildCsp("n", TURNSTILE)).toContain("connect-src 'self' https://challenges.cloudflare.com;");
  });

  // M-1 (Audit 06.09.2026): img-src kannte die Supabase-Origin nicht, obwohl
  // connect-src sie zwei Zeilen darueber schon berechnet. Jeder hochgeladene
  // Avatar liegt im "avatars"-Bucket auf genau dieser Origin — live bestaetigt
  // blockierte der Browser das eigene Profilbild jedes Nutzers, der eins
  // hochlaedt (nur OAuth-Avatare von Google/GitHub blieben verschont, die
  // kommen von anderen, bereits erlaubten Hosts).
  it("adds the Supabase project origin to img-src as well, for uploaded avatars", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcxyz.supabase.co");
    const csp = buildCsp("n");
    const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src")) ?? "";
    expect(imgSrc).toContain("https://abcxyz.supabase.co");
  });

  it("omits the Supabase origin from img-src when unset, instead of a broken empty entry", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = buildCsp("n");
    const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src")) ?? "";
    expect(imgSrc).toBe(
      "img-src 'self' data: https://lh3.googleusercontent.com https://avatars.githubusercontent.com"
    );
  });

  it("allows 'unsafe-eval' outside production only (Next dev/Fast Refresh needs eval)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(buildCsp("n")).toContain("'unsafe-eval'");

    vi.stubEnv("NODE_ENV", "production");
    expect(buildCsp("n")).not.toContain("'unsafe-eval'");
  });

  it("allows both Lemon Squeezy script hosts, not just the advertised one", () => {
    const csp = buildCsp("n", LEMON);
    // Der beworbene Host leitet auf den Asset-Host weiter, und eine CSP prüft
    // das Weiterleitungsziel mit. Fehlt der zweite Eintrag, ist der Checkout
    // tot — deshalb steht hier beides einzeln, nicht als ein Teilstring.
    expect(csp).toContain("https://app.lemonsqueezy.com");
    expect(csp).toContain("https://assets.lemonsqueezy.com");
  });

  it("allows the checkout overlay to be framed", () => {
    expect(buildCsp("n", LEMON)).toContain("frame-src https://*.lemonsqueezy.com");
    expect(buildCsp("n", BOTH)).toContain("frame-src https://challenges.cloudflare.com https://*.lemonsqueezy.com");
  });

  it("keeps Lemon Squeezy out of connect-src and img-src (the script needs neither)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = buildCsp("n", BOTH);
    expect(directive(csp, "connect-src")).not.toContain("lemonsqueezy");
    expect(directive(csp, "img-src")).not.toContain("lemonsqueezy");
  });

  it("blocks plugins and restricts base/form targets to same-origin", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});

// Betriebs-Audit 04.10.2026: Turnstile und Lemon Squeezy standen in JEDER
// Policy, auch auf Seiten, die keines von beiden laden. Jetzt bekommt eine
// Route nur, was sie einbindet.
describe("Drittanbieter pro Route", () => {
  it("gibt ohne Angabe keinem Drittanbieter etwas frei, in keiner Direktive", () => {
    for (const csp of [buildCsp("n"), buildStaticCsp()]) {
      expect(csp).not.toContain("cloudflare");
      expect(csp).not.toContain("lemonsqueezy");
    }
  });

  it("sperrt Frames ausdrücklich, wenn die Seite keinen einbettet", () => {
    // Fehlt frame-src, fällt der Browser auf default-src zurück ('self').
    expect(directive(buildCsp("n"), "frame-src")).toBe("frame-src 'none'");
    expect(directive(buildStaticCsp(), "frame-src")).toBe("frame-src 'none'");
  });

  it("gibt Turnstile nur dort frei, wo es gebraucht wird, nicht Lemon Squeezy dazu", () => {
    for (const csp of [buildCsp("n", TURNSTILE), buildStaticCsp(TURNSTILE)]) {
      expect(csp).toContain("challenges.cloudflare.com");
      expect(csp).not.toContain("lemonsqueezy");
    }
  });

  it("gibt Lemon Squeezy nur dort frei, wo es gebraucht wird, nicht Turnstile dazu", () => {
    for (const csp of [buildCsp("n", LEMON), buildStaticCsp(LEMON)]) {
      expect(csp).toContain("lemonsqueezy.com");
      expect(csp).not.toContain("cloudflare");
    }
  });

  it("sperrt Inline-Event-Handler in beiden Policies", () => {
    expect(directive(buildCsp("n", BOTH), "script-src-attr")).toBe("script-src-attr 'none'");
    expect(directive(buildStaticCsp(BOTH), "script-src-attr")).toBe("script-src-attr 'none'");
  });
});

describe("thirdPartiesFor", () => {
  const none = { turnstile: false, lemonSqueezy: false };

  it.each([
    ["/login", { turnstile: true, lemonSqueezy: false }],
    ["/signup", { turnstile: true, lemonSqueezy: false }],
    ["/reset-password", { turnstile: true, lemonSqueezy: false }],
    ["/pricing", { turnstile: false, lemonSqueezy: true }],
    ["/billing", { turnstile: false, lemonSqueezy: true }],
    ["/plans", { turnstile: false, lemonSqueezy: true }],
  ])("%s -> %j", (path, expected) => {
    expect(thirdPartiesFor(path)).toEqual(expected);
  });

  it.each(["/", "/docs", "/docs/chat-mit-finn", "/agb", "/datenschutz", "/chats/new", "/settings", "/usage"])(
    "%s bekommt nichts",
    (path) => {
      expect(thirdPartiesFor(path)).toEqual(none);
    }
  );

  it("gibt Turnstile NICHT für /reset-password/update frei, das Formular bindet es nicht ein", () => {
    expect(thirdPartiesFor("/reset-password/update")).toEqual(none);
  });

  it("nimmt einen angehängten Schrägstrich nicht als andere Seite", () => {
    expect(thirdPartiesFor("/pricing/")).toEqual({ turnstile: false, lemonSqueezy: true });
    expect(thirdPartiesFor("/")).toEqual(none);
  });

  it("schliesst Pfade mit gleichem Anfang nicht versehentlich ein", () => {
    expect(thirdPartiesFor("/pricing-extra")).toEqual(none);
    expect(thirdPartiesFor("/login/x")).toEqual(none);
  });
});

// Regression, gefunden 05.08.2026: Planpunkt B-2 entfernte den headers()-
// Aufruf aus dem Root-Layout, um Marketing/Auth/Legal/Docs statisch
// auszuliefern. Nichts threadet seither einen Nonce zu Next' eigenen
// Hydration-Scripts auf diesen Routen durch, middleware.ts setzte aber
// weiterhin die STRIKTE nonce-only-buildCsp()-Policy auf jede Antwort — Next'
// eigene <script>-Tags trugen keinen passenden Nonce, die CSP blockierte sie,
// React hydrierte nie. Sichtbar als leere Seite plus wiederholtem
// "Uncaught Error: Connection closed" von Turnstile, dessen Kanal nie
// zustande kam. buildStaticCsp() ist die Policy für genau diese Routen.
describe("buildStaticCsp", () => {
  it("carries no nonce token at all", () => {
    // Der eigentliche Bug in einem Satz: ein Nonce, den nichts auf der Seite
    // trägt, blockiert Next' eigene Scripts genauso sicher wie gar keine
    // Erlaubnis. Diese Policy darf deshalb niemals einen 'nonce-…'-Token
    // enthalten, gleich welcher Wert.
    expect(buildStaticCsp()).not.toMatch(/'nonce-/);
    expect(buildStaticCsp(BOTH)).not.toMatch(/'nonce-/);
  });

  it("allows inline execution via 'unsafe-inline' instead, so Next's own scripts run", () => {
    for (const parties of [undefined, TURNSTILE, LEMON, BOTH]) {
      expect(directive(buildStaticCsp(parties), "script-src")).toContain("'unsafe-inline'");
    }
  });

  it("never combines a nonce with unsafe-inline in the same directive", () => {
    // Browser-Regel (CSP3): 'unsafe-inline' wird ignoriert, sobald ein
    // Nonce/Hash in DERSELBEN Direktive steht. Träfe das hier zu, würde
    // buildStaticCsp() in der Praxis genauso blockieren wie buildCsp() es
    // ohne passenden Nonce tut — der Test hält fest, dass die beiden
    // Varianten sich nie überschneiden können.
    const scriptSrc = directive(buildStaticCsp(BOTH), "script-src");
    expect(scriptSrc).not.toMatch(/'nonce-/);
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("allows Turnstile and Lemon Squeezy where a public route loads them", () => {
    // Turnstile: /login, /signup, /reset-password. Lemon Squeezy: /pricing
    // (ProCheckoutCta zeigt den Checkout auch einem eingeloggten Besucher).
    const csp = buildStaticCsp(BOTH);
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://app.lemonsqueezy.com");
    expect(csp).toContain("https://assets.lemonsqueezy.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com https://*.lemonsqueezy.com");
  });

  it("still reaches Supabase directly from the browser (login/signup forms, ProCheckoutCta)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcxyz.supabase.co");
    expect(buildStaticCsp(TURNSTILE)).toContain(
      "connect-src 'self' https://challenges.cloudflare.com https://abcxyz.supabase.co"
    );
    expect(buildStaticCsp()).toContain("connect-src 'self' https://abcxyz.supabase.co");
  });

  it("shares every other directive verbatim with buildCsp, only script-src differs", () => {
    for (const parties of [undefined, TURNSTILE, LEMON, BOTH]) {
      const strict = buildCsp("irrelevant-for-this-comparison", parties);
      const staticCsp = buildStaticCsp(parties);
      const directivesOf = (csp: string) =>
        new Map(csp.split("; ").map((d) => [d.split(" ")[0], d]));

      const strictDirectives = directivesOf(strict);
      const staticDirectives = directivesOf(staticCsp);

      expect([...staticDirectives.keys()].sort()).toEqual([...strictDirectives.keys()].sort());
      for (const [name, value] of staticDirectives) {
        if (name === "script-src") continue;
        expect(value).toBe(strictDirectives.get(name));
      }
    }
  });

  it("still blocks plugins and restricts base/form targets to same-origin", () => {
    const csp = buildStaticCsp();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
