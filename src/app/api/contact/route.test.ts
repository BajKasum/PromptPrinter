import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Die Eigenschaft, die hier zählt: keine Mail geht raus, bevor Ratenlimit,
// Schema, Köderfeld und Mensch-Prüfung durch sind, und das Tageslimit schützt
// den gemeinsamen Resend-Zugang (die Auth-Mails hängen daran).

const rateLimit = vi.fn();
const verifyTurnstileToken = vi.fn();
const sendMail = vi.fn();
const mailConfigured = vi.fn();
const logWarning = vi.fn();

vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "ip:203.0.113.7",
  clientIp: () => "203.0.113.7",
}));

vi.mock("@/server/security/turnstile", () => ({
  verifyTurnstileToken: (...a: unknown[]) => verifyTurnstileToken(...a),
  MAX_TURNSTILE_TOKEN_CHARS: 4096,
}));

vi.mock("@/server/mail/resend", () => ({
  mailConfigured: () => mailConfigured(),
  sendMail: (...a: unknown[]) => sendMail(...a),
}));

vi.mock("@/shared/lib/observability", () => ({
  logWarning: (...a: unknown[]) => logWarning(...a),
  captureError: vi.fn(),
}));

function req(body: unknown) {
  return new Request("https://promptprinter.app/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Mira",
  email: "mira@example.com",
  topic: "fehler",
  message: "Beim Senden bleibt die Antwort hängen, seit gestern Abend.",
  turnstileToken: "token-abc",
};

const open = { allowed: true, remaining: 4, resetAt: Date.now() + 1000 };

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue(open);
    verifyTurnstileToken.mockResolvedValue({ ok: true, skipped: false });
    mailConfigured.mockReturnValue(true);
    sendMail.mockResolvedValue({ ok: true });
  });

  it("sendet die Nachricht an den Betreiber und antwortet ok", async () => {
    const res = await POST(req(valid));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0] as { to: string; replyTo: string; subject: string; text: string };
    expect(mail.to).toBe("kasumbajrami7@gmail.com");
    expect(mail.replyTo).toBe("mira@example.com");
    expect(mail.subject).toBe("Kontakt: Etwas ist kaputt");
    expect(mail.text).toContain("Mira <mira@example.com>");
    expect(mail.text).toContain("Beim Senden bleibt die Antwort hängen");
  });

  it("reicht dem Prüfdienst Token und Adresse des Absenders", async () => {
    await POST(req(valid));
    expect(verifyTurnstileToken).toHaveBeenCalledWith("token-abc", "203.0.113.7");
  });

  it("schreibt weder die Adresse noch den Text ins Log, wenn die Prüfung scheitert", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "timeout-or-duplicate" });
    await POST(req(valid));
    const logged = JSON.stringify(logWarning.mock.calls);
    expect(logged).not.toContain("mira@example.com");
    expect(logged).not.toContain("Beim Senden");
  });

  describe("was vor dem Versand durch sein muss", () => {
    it("Mensch-Prüfung fehlgeschlagen: 403, keine Mail", async () => {
      verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "invalid-input-response" });
      const res = await POST(req(valid));
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("captcha");
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("Ratenlimit pro Adresse erreicht: 429, nichts wird gelesen, keine Mail", async () => {
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 });
      const res = await POST(req(valid));
      expect(res.status).toBe(429);
      expect(verifyTurnstileToken).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("Tageslimit erreicht: 503 mit der Adresse als Ausweg, keine Mail", async () => {
      rateLimit.mockImplementation(async (key: string) =>
        key === "contact:all" ? { allowed: false, remaining: 0, resetAt: Date.now() + 5000 } : open
      );
      const res = await POST(req(valid));
      expect(res.status).toBe(503);
      expect((await res.json()).detail).toContain("kasumbajrami7@gmail.com");
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("Tageslimit und Adress-Limit sind getrennte Zähler", async () => {
      await POST(req(valid));
      const keys = rateLimit.mock.calls.map((c) => c[0]);
      expect(keys).toEqual(["contact:ip:203.0.113.7", "contact:all"]);
    });

    it("kein Resend-Schlüssel gesetzt: 503, keine Mail, kein stiller Erfolg", async () => {
      mailConfigured.mockReturnValue(false);
      const res = await POST(req(valid));
      expect(res.status).toBe(503);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("Köderfeld gefüllt: antwortet wie ein Erfolg, sendet aber nichts und fragt den Prüfdienst nicht", async () => {
      const res = await POST(req({ ...valid, website: "https://spam.example" }));
      expect(res.status).toBe(200);
      expect(sendMail).not.toHaveBeenCalled();
      expect(verifyTurnstileToken).not.toHaveBeenCalled();
    });
  });

  describe("Eingabe", () => {
    it.each([
      ["ungültige E-Mail", { ...valid, email: "keine-adresse" }],
      ["zu kurze Nachricht", { ...valid, message: "Hi" }],
      ["zu lange Nachricht", { ...valid, message: "x".repeat(4001) }],
      ["unbekanntes Thema", { ...valid, topic: "werbung" }],
      ["fehlende Nachricht", { email: valid.email, topic: "frage" }],
    ])("%s: 400, keine Mail", async (_label, body) => {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("kein JSON: 400", async () => {
      const res = await POST(req("{kaputt"));
      expect(res.status).toBe(400);
    });

    it("zu grosser Körper: 413", async () => {
      const res = await POST(req(JSON.stringify({ ...valid, message: "x".repeat(40_000) })));
      expect(res.status).toBe(413);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("ohne Namen steht nur die Adresse als Absender in der Mail", async () => {
      await POST(req({ ...valid, name: "" }));
      const mail = sendMail.mock.calls[0][0] as { text: string };
      expect(mail.text).toContain("Von: mira@example.com\n");
    });
  });

  it("Versand abgelehnt oder nicht erreichbar: 502 mit der Adresse als Ausweg", async () => {
    sendMail.mockResolvedValue({ ok: false, reason: "rejected" });
    const res = await POST(req(valid));
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toContain("kasumbajrami7@gmail.com");
  });
});
