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

  it("blocks plugins and restricts base/form targets to same-origin", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
