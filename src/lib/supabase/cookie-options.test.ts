import { describe, it, expect, afterEach, vi } from "vitest";
import { secureCookieOptions } from "@/lib/supabase/cookie-options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("secureCookieOptions", () => {
  it("adds Secure when the app is served over https", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
    expect(secureCookieOptions({ path: "/", sameSite: "lax" })).toEqual({
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("leaves options untouched over http, so a local production build still logs in", () => {
    // NODE_ENV would say "production" for `npm run build && npm start` on
    // localhost, where a Secure cookie is silently dropped by the browser.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const options = { path: "/", sameSite: "lax" as const };
    expect(secureCookieOptions(options)).toEqual(options);
    expect(secureCookieOptions(options)).not.toHaveProperty("secure");
  });

  it("preserves every option the library set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
    const result = secureCookieOptions({
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 34560000,
    });
    // httpOnly stays false on purpose — createBrowserClient reads the session
    // from document.cookie, so flipping it would break every client component.
    expect(result).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 34560000,
      secure: true,
    });
  });

  it("does not mutate the caller's object", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
    const options = { path: "/" };
    secureCookieOptions(options);
    expect(options).not.toHaveProperty("secure");
  });
});
