import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// QA finding C-6. This is the gate that decides who sees the app at all, and it
// had no test — including after /admin was added to the protected list, where a
// forgotten entry means an operations page reachable while signed out.

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function request(pathname: string) {
  return new NextRequest(new URL(`https://promptprinter.app${pathname}`));
}

function locationOf(res: Response): string | null {
  return res.headers.get("location");
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: null } });
  });

  describe("signed out", () => {
    it.each([
      "/chats",
      "/chats/new",
      "/projects",
      "/settings",
      "/billing",
      "/admin",
      // Security-Audit finding M-7: /prompts existed for a full release without
      // being on the old protected-prefix list. The (app) layout still caught
      // it, so nothing leaked — but the list had demonstrably drifted from the
      // route tree, which is why the default is now inverted.
      "/prompts",
    ])("sends %s to the login page", async (path) => {
      const res = await updateSession(request(path), new Headers());
      expect(locationOf(res)).toContain("/login");
    });

    // The point of the inversion: a page nobody remembered to classify is
    // guarded, not exposed. This path does not exist today — that is the test.
    it("guards an unknown path by default rather than letting it through", async () => {
      const res = await updateSession(request("/some-future-page"), new Headers());
      expect(locationOf(res)).toContain("/login");
    });

    it("remembers where the user was headed", async () => {
      const res = await updateSession(request("/projects"), new Headers());
      expect(locationOf(res)).toContain("next=%2Fprojects");
    });

    it.each([
      "/",
      "/pricing",
      "/docs",
      "/docs/erste-schritte",
      "/login",
      "/signup",
      "/reset-password/update",
      "/impressum",
      "/agb",
      "/datenschutz",
      "/kontakt",
      "/rueckerstattung",
      "/ueber",
      "/robots.txt",
      "/sitemap.xml",
      "/auth/callback",
    ])("leaves the public page %s alone", async (path) => {
      const res = await updateSession(request(path), new Headers());
      expect(locationOf(res)).toBeNull();
    });

    // API routes must answer for themselves: each already returns a 401 JSON
    // problem response. A 302 to an HTML login page would be mis-parsed by
    // every caller, and /api/health has to stay reachable for uptime checks,
    // which never carry a session.
    it.each([
      "/api/health",
      "/api/chat",
      "/api/projects",
      "/api/account",
      "/api/settings/api-key",
    ])("never redirects %s", async (path) => {
      const res = await updateSession(request(path), new Headers());
      expect(locationOf(res)).toBeNull();
    });

    // A public PREFIX must not accidentally cover a longer, unrelated path.
    it("does not treat /docsomething as being under /docs", async () => {
      const res = await updateSession(request("/docsomething"), new Headers());
      expect(locationOf(res)).toContain("/login");
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    });

    it.each(["/chats", "/projects", "/settings", "/billing", "/admin", "/prompts"])(
      "lets %s through",
      async (path) => {
        const res = await updateSession(request(path), new Headers());
        expect(locationOf(res)).toBeNull();
      }
    );

    it.each(["/login", "/signup"])("redirects %s into the app", async (path) => {
      const res = await updateSession(request(path), new Headers());
      expect(locationOf(res)).toContain("/chats/new");
    });

    it("does not redirect a password reset, which is not the login page", async () => {
      const res = await updateSession(request("/reset-password"), new Headers());
      expect(locationOf(res)).toBeNull();
    });
  });

  // Without Supabase configured there is no session to check and nothing the
  // guard could meaningfully decide; the request passes and the routes' own
  // server-side checks (every (app) page redirects on a missing user) take over.
  it("passes through when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const res = await updateSession(request("/chats"), new Headers());
    expect(locationOf(res)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
