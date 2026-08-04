import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp } from "@/server/security/csp";

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
