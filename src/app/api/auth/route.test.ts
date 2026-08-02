import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// The property worth defending here is ordering: no auth action may run before
// the Turnstile token has been redeemed. Everything else in this file exists to
// keep that assertion honest.

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resend = vi.fn();
const resetPasswordForEmail = vi.fn();
const rateLimit = vi.fn();
const verifyTurnstileToken = vi.fn();
const logWarning = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      resend: (...a: unknown[]) => resend(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
    },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "ip:203.0.113.7",
  clientIp: () => "203.0.113.7",
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...a: unknown[]) => verifyTurnstileToken(...a),
  MAX_TURNSTILE_TOKEN_CHARS: 4096,
}));

vi.mock("@/lib/observability", () => ({
  logWarning: (...a: unknown[]) => logWarning(...a),
  captureError: vi.fn(),
}));

function req(body: unknown) {
  return new Request("https://promptprinter.app/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const signIn = {
  action: "sign-in",
  email: "du@example.com",
  password: "hunter2hunter2",
  turnstileToken: "token-abc",
};

describe("POST /api/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
    verifyTurnstileToken.mockResolvedValue({ ok: true, skipped: false });
    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    resend.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  describe("the captcha gate", () => {
    it("refuses every action when the token does not verify", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "timeout-or-duplicate" });

      for (const body of [
        signIn,
        { action: "sign-up", email: "du@example.com", password: "hunter2hunter2" },
        { action: "resend", email: "du@example.com" },
        { action: "reset-password", email: "du@example.com" },
      ]) {
        const res = await POST(req(body));
        expect(res.status).toBe(403);
        expect((await res.json()).kind).toBe("captcha");
      }

      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(signUp).not.toHaveBeenCalled();
      expect(resend).not.toHaveBeenCalled();
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("hands siteverify the submitted token and the caller's address", async () => {
      await POST(req(signIn));
      expect(verifyTurnstileToken).toHaveBeenCalledWith("token-abc", "203.0.113.7");
    });

    it("refuses when no token was submitted at all", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "missing-input-response" });
      const res = await POST(
        req({ action: "sign-in", email: signIn.email, password: signIn.password })
      );
      expect(res.status).toBe(403);
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("logs a rejection without recording who was trying to sign in", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "invalid-input-response" });
      await POST(req(signIn));
      expect(logWarning).toHaveBeenCalledWith("turnstile.rejected", {
        action: "sign-in",
        reason: "invalid-input-response",
      });
      expect(JSON.stringify(logWarning.mock.calls)).not.toContain("du@example.com");
    });
  });

  describe("sign-in", () => {
    it("signs in and reports success", async () => {
      const res = await POST(req(signIn));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "du@example.com",
        password: "hunter2hunter2",
      });
    });

    it("translates Supabase's message instead of passing it through raw", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      const res = await POST(req(signIn));
      expect(res.status).toBe(400);
      expect((await res.json()).detail).toBe("Email oder Passwort falsch");
    });
  });

  describe("sign-up", () => {
    const body = {
      action: "sign-up",
      email: "du@example.com",
      password: "hunter2hunter2",
      turnstileToken: "token-abc",
    };

    it("reports whether a session came back, so the form knows to await confirmation", async () => {
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      const res = await POST(req(body));
      expect(await res.json()).toEqual({ ok: true, session: false });
    });

    it("keeps a client-supplied next path inside the app", async () => {
      await POST(req({ ...body, next: "https://evil.example/steal" }));
      const options = signUp.mock.calls[0][0].options as { emailRedirectTo: string };
      expect(options.emailRedirectTo).toContain(encodeURIComponent("/chats/new"));
      expect(options.emailRedirectTo).not.toContain("evil.example");
    });

    it("rejects a password below the shared minimum", async () => {
      const res = await POST(req({ ...body, password: "kurz" }));
      expect(res.status).toBe(400);
      expect(signUp).not.toHaveBeenCalled();
    });
  });

  describe("reset-password", () => {
    const body = { action: "reset-password", email: "du@example.com", turnstileToken: "token-abc" };

    it("answers ok even when Supabase errors, so it never reveals whether the address exists", async () => {
      resetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
      const res = await POST(req(body));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("does surface throttling, which reveals nothing about the account", async () => {
      resetPasswordForEmail.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
      const res = await POST(req(body));
      expect(res.status).toBe(429);
    });
  });

  describe("guards around the gate", () => {
    it("rate-limits before reading the body", async () => {
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
      const res = await POST(req(signIn));
      expect(res.status).toBe(429);
      expect(verifyTurnstileToken).not.toHaveBeenCalled();
    });

    it("rejects a malformed body", async () => {
      const res = await POST(req("not json"));
      expect(res.status).toBe(400);
      expect(verifyTurnstileToken).not.toHaveBeenCalled();
    });

    it("rejects an unknown action", async () => {
      const res = await POST(req({ action: "delete-everything", email: "du@example.com" }));
      expect(res.status).toBe(400);
    });
  });
});
