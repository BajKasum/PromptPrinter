import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const isSignInThrottled = vi.fn();
const recordFailedSignIn = vi.fn();
const logEvent = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      resend: (...a: unknown[]) => resend(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
    },
  }),
}));

vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "ip:203.0.113.7",
  clientIp: () => "203.0.113.7",
}));

vi.mock("@/server/security/sign-in-throttle", () => ({
  isSignInThrottled: (...a: unknown[]) => isSignInThrottled(...a),
  recordFailedSignIn: (...a: unknown[]) => recordFailedSignIn(...a),
}));

vi.mock("@/server/security/turnstile", () => ({
  verifyTurnstileToken: (...a: unknown[]) => verifyTurnstileToken(...a),
  MAX_TURNSTILE_TOKEN_CHARS: 4096,
}));

vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()),
  logWarning: (...a: unknown[]) => logWarning(...a),
  logEvent: (...a: unknown[]) => logEvent(...a),
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
    isSignInThrottled.mockResolvedValue(false);
  });

  describe("Sicherheitsprotokoll", () => {
    const events = () => logEvent.mock.calls.map(([event, context]) => ({ event, ...context }));

    it("Anmeldung gelungen: mit der Kennung des Kontos, ohne Adresse", async () => {
      signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
      expect((await POST(req(signIn))).status).toBe(200);
      expect(events()).toEqual([{ event: "auth.sign_in_succeeded", userId: "user-1" }]);
    });

    it("falsches Passwort: ein Eintrag mit Grund, ohne Adresse und ohne Passwort", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
      expect((await POST(req(signIn))).status).toBe(400);
      expect(events()).toEqual([{ event: "auth.sign_in_failed", reason: "invalid_credentials" }]);
      expect(JSON.stringify(logEvent.mock.calls)).not.toContain("du@example.com");
      expect(JSON.stringify(logEvent.mock.calls)).not.toContain("hunter2");
    });

    it("anderer Fehler beim Anmelden: eigener Grund", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Database error" } });
      await POST(req(signIn));
      expect(events()).toEqual([{ event: "auth.sign_in_failed", reason: "other" }]);
    });

    it("gesperrt wegen zu vieler Versuche: eigener Grund", async () => {
      isSignInThrottled.mockResolvedValue(true);
      expect((await POST(req(signIn))).status).toBe(429);
      expect(events()).toEqual([{ event: "auth.sign_in_failed", reason: "throttled" }]);
    });

    it("Registrierung gelungen, abgewiesen und mit schwachem Passwort", async () => {
      const signUpBody = { action: "sign-up", email: "du@example.com", password: "Kiefer-Wolke-Ozean-84!" };

      signUp.mockResolvedValue({ data: { user: { id: "user-2" }, session: null }, error: null });
      await POST(req(signUpBody));
      expect(events().at(-1)).toEqual({ event: "auth.sign_up_succeeded", userId: "user-2", session: false });

      signUp.mockResolvedValue({ data: {}, error: { message: "User already registered" } });
      await POST(req(signUpBody));
      expect(events().at(-1)).toEqual({ event: "auth.sign_up_failed", reason: "rejected" });

      await POST(req({ ...signUpBody, password: "password1234" }));
      expect(events().at(-1)).toEqual({ event: "auth.sign_up_failed", reason: "weak_password" });
      expect(JSON.stringify(logEvent.mock.calls)).not.toContain("du@example.com");
    });

    it("Reset und erneute Bestätigung: Eintrag ohne Adresse", async () => {
      await POST(req({ action: "reset-password", email: "du@example.com" }));
      await POST(req({ action: "resend", email: "du@example.com" }));
      expect(events().map((e) => e.event)).toEqual(["auth.password_reset_requested", "auth.confirmation_resent"]);
      expect(JSON.stringify(logEvent.mock.calls)).not.toContain("du@example.com");
    });
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

    // Die Passwortprüfung gilt für NEUE Passwörter. Wer sich vor ihr mit einem
    // inzwischen als bekannt geltenden Passwort registriert hat, muss sich
    // weiter anmelden können, sonst sperrt eine Sicherheitsmassnahme Nutzer aus.
    it("lässt ein Passwort der Liste beim Anmelden durch", async () => {
      const res = await POST(req({ ...signIn, password: "Password123456" }));
      expect(res.status).toBe(200);
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "du@example.com",
        password: "Password123456",
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

    // Betriebs-Audit 04.10.2026: Supabases Prüfung gegen geleakte Passwörter ist
    // auf dem Free-Tarif aus. Diese Route ist die Schranke, das Formular nur der
    // Rat: wer sie direkt aufruft, kommt an der Prüfung nicht vorbei.
    it.each(["Password123456", "P@ssw0rd2024!", "1234567890", "qwertyuiop"])(
      "weist das bekannte Passwort %s ab, ohne Supabase zu fragen",
      async (password) => {
        const res = await POST(req({ ...body, password }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.kind).toBe("weak-password");
        expect(json.reason).toBe("common");
        expect(json.detail).toMatch(/bekannt/);
        expect(signUp).not.toHaveBeenCalled();
      }
    );

    it("weist ein Passwort ab, das die eigene Adresse enthält", async () => {
      const res = await POST(
        req({ ...body, email: "kasumbajrami7@example.com", password: "xx-kasumbajrami-xx-9" })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe("personal");
      expect(signUp).not.toHaveBeenCalled();
    });

    it("lässt ein gutes Passwort durch", async () => {
      const res = await POST(req({ ...body, password: "Fensterbank-77x-Basel" }));
      expect(res.status).toBe(200);
      expect(signUp).toHaveBeenCalledTimes(1);
    });

    it("prüft erst NACH dem Captcha: ein Aufruf ohne gültigen Token erfährt nichts über die Liste", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "invalid-input-response" });
      const res = await POST(req({ ...body, password: "Password123456" }));
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("captcha");
    });
  });

  describe("sign-in: Sperre je Konto", () => {
    it("fragt Supabase bei einer Sperre nicht und nennt das Konto nicht", async () => {
      isSignInThrottled.mockResolvedValue(true);
      const res = await POST(req(signIn));
      expect(res.status).toBe(429);
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect((await res.json()).detail).not.toMatch(/passwort|konto|email/i);
    });

    it("prüft die Sperre erst hinter dem Captcha", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "invalid-input-response" });
      await POST(req(signIn));
      expect(isSignInThrottled).not.toHaveBeenCalled();
    });

    it("zählt falsche Zugangsdaten gegen die Adresse, auch eine unbekannte", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      const res = await POST(req(signIn));
      expect(res.status).toBe(400);
      expect(recordFailedSignIn).toHaveBeenCalledWith("du@example.com");
    });

    it("zählt einen Ausfall des Anbieters nicht als Fehlversuch", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "Database error" } });
      await POST(req(signIn));
      expect(recordFailedSignIn).not.toHaveBeenCalled();
    });

    it("eine erfolgreiche Anmeldung setzt einen laufenden Zähler nicht zurück", async () => {
      signInWithPassword.mockResolvedValue({ error: null });
      const res = await POST(req(signIn));
      expect(res.status).toBe(200);
      expect(recordFailedSignIn).not.toHaveBeenCalled();
      // Die Sperre kennt gar keinen Weg zurück: das Modul exportiert nur Prüfen und Zählen.
      const throttle = await vi.importActual<Record<string, unknown>>("@/server/security/sign-in-throttle");
      expect(Object.keys(throttle).sort()).toEqual(["isSignInThrottled", "recordFailedSignIn"]);
    });
  });

  describe("Mail-Aktionen verraten kein Konto", () => {
    const reset = { action: "reset-password", email: "du@example.com", turnstileToken: "token-abc" };
    const resendBody = { action: "resend", email: "du@example.com", turnstileToken: "token-abc" };
    const cooldown = { message: "For security purposes, you can only request this after 51 seconds." };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function answer(body: unknown) {
      const pending = POST(req(body));
      await vi.advanceTimersByTimeAsync(1500);
      const res = await pending;
      return { status: res.status, body: await res.json() };
    }

    it.each([
      ["bekanntes Konto, Mail gesendet", { error: null }],
      ["unbekannte Adresse", { error: { message: "User not found" } }],
      ["Mail-Cooldown", { error: cooldown }],
      ["Mail-Limit", { error: { message: "Email rate limit exceeded" } }],
    ])("reset-password antwortet gleich: %s", async (_name, result) => {
      resetPasswordForEmail.mockResolvedValue(result);
      expect(await answer(reset)).toEqual({ status: 200, body: { ok: true } });
    });

    it("resend antwortet im Cooldown wie beim Erfolg", async () => {
      resend.mockResolvedValue({ error: cooldown });
      expect(await answer(resendBody)).toEqual({ status: 200, body: { ok: true } });
    });

    it("resend meldet andere Fehler weiter", async () => {
      resend.mockResolvedValue({ error: { message: "Email address is invalid" } });
      expect((await answer(resendBody)).status).toBe(400);
    });

    it.each([reset, resendBody])("wartet mindestens die Mindestdauer: %j", async (body) => {
      let done = false;
      const pending = POST(req(body)).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(1499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(done).toBe(true);
    });
  });

  describe("unbekannte Fehler des Anbieters", () => {
    it("gibt den Wortlaut nicht weiter und schreibt ihn ins Log", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "connection to db-3.internal refused" } });
      const res = await POST(req(signIn));
      expect(res.status).toBe(400);
      expect((await res.json()).detail).not.toContain("db-3");
      expect(logWarning).toHaveBeenCalledWith("auth.unknown_error", {
        action: "sign-in",
        message: "connection to db-3.internal refused",
      });
    });

    it("schreibt keine Mailadresse aus der Meldung ins Log", async () => {
      signInWithPassword.mockResolvedValue({
        error: { message: 'Email address "kaeufer@example.test" cannot be used as it is not authorized' },
      });
      await POST(req(signIn));
      expect(logWarning).toHaveBeenCalledWith("auth.unknown_error", {
        action: "sign-in",
        message: 'Email address [adresse] cannot be used as it is not authorized',
      });
      expect(JSON.stringify(logWarning.mock.calls)).not.toContain("kaeufer@example.test");
    });

    it("schreibt bekannte Fehler nicht ins Log", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      await POST(req(signIn));
      expect(logWarning).not.toHaveBeenCalled();
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
