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
    it.each(["/chats", "/chats/new", "/projects", "/settings", "/billing", "/admin"])(
      "sends %s to the login page",
      async (path) => {
        const res = await updateSession(request(path), new Headers());
        expect(locationOf(res)).toContain("/login");
      }
    );

    it("remembers where the user was headed", async () => {
      const res = await updateSession(request("/projects"), new Headers());
      expect(locationOf(res)).toContain("next=%2Fprojects");
    });

    it.each(["/", "/pricing", "/features", "/docs", "/login", "/signup", "/impressum"])(
      "leaves the public page %s alone",
      async (path) => {
        const res = await updateSession(request(path), new Headers());
        expect(locationOf(res)).toBeNull();
      }
    );
  });

  describe("signed in", () => {
    beforeEach(() => {
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    });

    it.each(["/chats", "/projects", "/settings", "/billing", "/admin"])(
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
