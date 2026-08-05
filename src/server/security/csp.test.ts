import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp, buildStaticCsp } from "@/server/security/csp";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildCsp", () => {
  it("includes the nonce in script-src and nowhere it could be reused for style", () => {
    const csp = buildCsp("test-nonce-123");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce-123'");
    expect(csp).not.toMatch(/style-src[^;]*nonce/);
  });

  it("allows Turnstile's script and iframe, blocks framing of the app itself", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("script-src 'self' 'nonce-n' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds the Supabase project origin to connect-src when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcxyz.supabase.co");
    const csp = buildCsp("n");
    expect(csp).toContain("connect-src 'self' https://challenges.cloudflare.com https://abcxyz.supabase.co");
  });

  it("omits the Supabase origin from connect-src when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = buildCsp("n");
    expect(csp).toContain("connect-src 'self' https://challenges.cloudflare.com;");
  });

  it("allows 'unsafe-eval' outside production only (Next dev/Fast Refresh needs eval)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(buildCsp("n")).toContain("'unsafe-eval'");

    vi.stubEnv("NODE_ENV", "production");
    expect(buildCsp("n")).not.toContain("'unsafe-eval'");
  });

  it("allows both Lemon Squeezy script hosts, not just the advertised one", () => {
    const csp = buildCsp("n");
    // Der beworbene Host leitet auf den Asset-Host weiter, und eine CSP prüft
    // das Weiterleitungsziel mit. Fehlt der zweite Eintrag, ist der Checkout
    // tot — deshalb steht hier beides einzeln, nicht als ein Teilstring.
    expect(csp).toContain("https://app.lemonsqueezy.com");
    expect(csp).toContain("https://assets.lemonsqueezy.com");
  });

  it("allows the checkout overlay to be framed", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com https://*.lemonsqueezy.com");
  });

  it("keeps Lemon Squeezy out of connect-src and img-src (the script needs neither)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = buildCsp("n");
    const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src")) ?? "";
    const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src")) ?? "";
    expect(connectSrc).not.toContain("lemonsqueezy");
    expect(imgSrc).not.toContain("lemonsqueezy");
  });

  it("blocks plugins and restricts base/form targets to same-origin", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
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
  });

  it("allows inline execution via 'unsafe-inline' instead, so Next's own scripts run", () => {
    const csp = buildStaticCsp();
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("never combines a nonce with unsafe-inline in the same directive", () => {
    // Browser-Regel (CSP3): 'unsafe-inline' wird ignoriert, sobald ein
    // Nonce/Hash in DERSELBEN Direktive steht. Träfe das hier zu, würde
    // buildStaticCsp() in der Praxis genauso blockieren wie buildCsp() es
    // ohne passenden Nonce tut — der Test hält fest, dass die beiden
    // Varianten sich nie überschneiden können.
    const scriptSrc = buildStaticCsp()
      .split("; ")
      .find((d) => d.startsWith("script-src"));
    expect(scriptSrc).not.toMatch(/'nonce-/);
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("still allows Turnstile and Lemon Squeezy, both used on public routes", () => {
    // Turnstile: /login, /signup, /reset-password. Lemon Squeezy: /pricing
    // (ProCheckoutCta zeigt den Checkout auch einem eingeloggten Besucher).
    const csp = buildStaticCsp();
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://app.lemonsqueezy.com");
    expect(csp).toContain("https://assets.lemonsqueezy.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com https://*.lemonsqueezy.com");
  });

  it("still reaches Supabase directly from the browser (login/signup forms, ProCheckoutCta)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcxyz.supabase.co");
    expect(buildStaticCsp()).toContain("connect-src 'self' https://challenges.cloudflare.com https://abcxyz.supabase.co");
  });

  it("shares every other directive verbatim with buildCsp, only script-src differs", () => {
    const strict = buildCsp("irrelevant-for-this-comparison");
    const staticCsp = buildStaticCsp();
    const directivesOf = (csp: string) =>
      new Map(csp.split("; ").map((d) => [d.split(" ")[0], d]));

    const strictDirectives = directivesOf(strict);
    const staticDirectives = directivesOf(staticCsp);

    expect([...staticDirectives.keys()].sort()).toEqual([...strictDirectives.keys()].sort());
    for (const [name, directive] of staticDirectives) {
      if (name === "script-src") continue;
      expect(directive).toBe(strictDirectives.get(name));
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
