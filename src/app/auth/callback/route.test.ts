import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  })),
}));

function req(query: string) {
  return new Request(`https://promptprinter.app/auth/callback${query}`);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
  });

  it("redirects to next on a successful token_hash verification", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(req("?token_hash=abc&type=recovery&next=/projects/42"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://promptprinter.app/projects/42");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to next on a successful PKCE code exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(req("?code=xyz&next=/chats/new"));
    expect(res.headers.get("location")).toBe("https://promptprinter.app/chats/new");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("defaults to /chats/new when no next param is given", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(req("?token_hash=abc&type=signup"));
    expect(res.headers.get("location")).toBe("https://promptprinter.app/chats/new");
  });

  it("falls back to /chats/new for a next value that isn't an in-app path", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(req("?token_hash=abc&type=signup&next=https://evil.example/steal"));
    expect(res.headers.get("location")).toBe("https://promptprinter.app/chats/new");
  });

  it("never redirects off-origin even for a protocol-relative next value", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(req("?token_hash=abc&type=signup&next=//evil.example"));
    const location = res.headers.get("location")!;
    expect(new URL(location).host).toBe("promptprinter.app");
  });

  it("redirects to the login error page when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(req("?token_hash=abc&type=recovery"));
    expect(res.headers.get("location")).toBe(
      "https://promptprinter.app/login?error=auth_callback_failed"
    );
  });

  it("redirects to the login error page when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    const res = await GET(req("?code=bad"));
    expect(res.headers.get("location")).toBe(
      "https://promptprinter.app/login?error=auth_callback_failed"
    );
  });

  it("redirects to the login error page when neither token_hash nor code is present", async () => {
    const res = await GET(req(""));
    expect(res.headers.get("location")).toBe(
      "https://promptprinter.app/login?error=auth_callback_failed"
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
