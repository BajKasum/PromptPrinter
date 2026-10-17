import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAIL_FROM, mailConfigured, sendMail } from "./resend";

const logWarning = vi.fn();
const captureError = vi.fn();

vi.mock("@/shared/lib/observability", () => ({
  logWarning: (...a: unknown[]) => logWarning(...a),
  captureError: (...a: unknown[]) => captureError(...a),
}));

const mail = { to: "ich@example.com", replyTo: "sie@example.com", subject: "Kontakt: Frage", text: "Hallo" };

describe("mailConfigured", () => {
  it("ist an, sobald ein Schlüssel gesetzt ist", () => {
    expect(mailConfigured({ RESEND_API_KEY: "re_abc" })).toBe(true);
  });

  it.each([undefined, "", "   "])("ist aus bei %j", (value) => {
    expect(mailConfigured({ RESEND_API_KEY: value })).toBe(false);
  });
});

describe("sendMail", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sendet ohne Schlüssel nichts und meldet es", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendMail(mail);
    expect(result).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("schickt Absender, Empfänger, Antwortadresse und Schlüssel an Resend", async () => {
    const result = await sendMail(mail);

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: MAIL_FROM,
      to: ["ich@example.com"],
      reply_to: "sie@example.com",
      subject: "Kontakt: Frage",
      text: "Hallo",
    });
  });

  it("entfernt Zeilenumbrüche aus dem Betreff", async () => {
    await sendMail({ ...mail, subject: "Kontakt\r\nBcc: fremd@example.com" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.subject).toBe("Kontakt Bcc: fremd@example.com");
    expect(body.subject).not.toMatch(/[\r\n]/);
  });

  it("meldet eine Ablehnung und loggt nur den Status, nicht den Antworttext", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid to address sie@example.com" }), { status: 422 })
    );
    const result = await sendMail(mail);
    expect(result).toEqual({ ok: false, reason: "rejected" });
    expect(logWarning).toHaveBeenCalledWith("mail.rejected", { status: 422 });
    expect(JSON.stringify(logWarning.mock.calls)).not.toContain("example.com");
  });

  it("meldet einen Netzfehler als nicht erreichbar", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const result = await sendMail(mail);
    expect(result).toEqual({ ok: false, reason: "unreachable" });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("setzt eine Zeitgrenze für die Verbindung", async () => {
    await sendMail(mail);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
