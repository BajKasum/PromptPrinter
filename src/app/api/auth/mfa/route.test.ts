import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getClaims = vi.fn();
const challengeAndVerify = vi.fn();
const enroll = vi.fn();
const unenroll = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, getClaims, mfa: { challengeAndVerify, enroll, unenroll } },
  }),
}));
const deleteFactor = vi.fn();
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { mfa: { deleteFactor } } } }),
}));
const replaceRecoveryCodes = vi.fn();
const redeemRecoveryCode = vi.fn();
const deleteRecoveryCodes = vi.fn();
const countRecoveryCodes = vi.fn();
vi.mock("@/server/security/recovery-codes", () => ({
  replaceRecoveryCodes: (...a: unknown[]) => replaceRecoveryCodes(...a),
  redeemRecoveryCode: (...a: unknown[]) => redeemRecoveryCode(...a),
  deleteRecoveryCodes: (...a: unknown[]) => deleteRecoveryCodes(...a),
  countRecoveryCodes: (...a: unknown[]) => countRecoveryCodes(...a),
}));
const recordSecurityEvent = vi.fn();
vi.mock("@/server/security/security-events", () => ({
  recordSecurityEvent: (...a: unknown[]) => recordSecurityEvent(...a),
}));
const logEvent = vi.fn();
const captureError = vi.fn();
vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()),
  logEvent: (...a: unknown[]) => logEvent(...a),
  captureError: (...a: unknown[]) => captureError(...a),
}));

import { GET, POST } from "./route";

const FACTOR = "11111111-1111-4111-8111-111111111111";
const CODES = ["BCDF-GHJK-LMNP-QRST"];

let counter = 0;
let userId = "";

function signedIn(factors: unknown[] = []) {
  getUser.mockResolvedValue({ data: { user: { id: userId, factors } } });
}
const verified = [{ id: FACTOR, status: "verified", factor_type: "totp" }];

const post = (body: unknown) =>
  new Request("https://promptprinter.app/api/auth/mfa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = () => new Request("https://promptprinter.app/api/auth/mfa");
/** Eine Anfrage von einem bestimmten Anschluss; die Adresse liest clientIp auf Vercel aus diesem Kopf. */
const postFrom = (ip: string, body: unknown) =>
  new Request("https://promptprinter.app/api/auth/mfa", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vercel-forwarded-for": ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  // Ein eigener Nutzer je Test: das Ratenlimit (im Speicher, ohne Upstash) zählt je Nutzer.
  counter += 1;
  userId = `user-${counter}`;
  signedIn();
  getClaims.mockResolvedValue({
    data: { claims: { aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] } },
  });
  challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  enroll.mockResolvedValue({
    data: { id: FACTOR, type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "GEHEIM", uri: "otpauth://x" } },
    error: null,
  });
  unenroll.mockResolvedValue({ data: {}, error: null });
  deleteFactor.mockResolvedValue({ data: {}, error: null });
  replaceRecoveryCodes.mockResolvedValue(CODES);
  redeemRecoveryCode.mockResolvedValue(true);
  deleteRecoveryCodes.mockResolvedValue(undefined);
  countRecoveryCodes.mockResolvedValue(7);
});

describe("ohne Sitzung", () => {
  it("antwortet 401 und tut nichts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(get())).status).toBe(401);
    expect((await POST(post({ action: "enroll" }))).status).toBe(401);
    expect(enroll).not.toHaveBeenCalled();
  });
});

describe("GET", () => {
  it("ohne Faktor: aus, und nichts zu prüfen", async () => {
    expect(await (await GET(get())).json()).toEqual({ enabled: false, needsVerification: false, recoveryCodesLeft: null });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("mit Faktor auf AAL1: die Prüfung steht aus, die Zahl der Codes bleibt verborgen", async () => {
    signedIn(verified);
    expect(await (await GET(get())).json()).toEqual({ enabled: true, needsVerification: true, recoveryCodesLeft: null });
    expect(countRecoveryCodes).not.toHaveBeenCalled();
  });

  it("mit Faktor auf AAL2: nennt die übrigen Codes, ohne Cache", async () => {
    signedIn(verified);
    getClaims.mockResolvedValue({ data: { claims: { aal: "aal2" } } });
    const res = await GET(get());
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ enabled: true, needsVerification: false, recoveryCodesLeft: 7 });
  });
});

describe("enroll", () => {
  it("legt einen Faktor an und gibt QR-Code und Schlüssel einmal aus, ohne Cache", async () => {
    const res = await POST(post({ action: "enroll" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ factorId: FACTOR, qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "GEHEIM" });
    expect(enroll).toHaveBeenCalledWith({ factorType: "totp", issuer: "PromptPrinter", friendlyName: "PromptPrinter" });
  });

  it("verlangt eine frische Anmeldung: ein gestohlenes Cookie richtet keinen fremden Faktor ein", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 }] } },
    });
    const res = await POST(post({ action: "enroll" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("reauth_required");
    expect(enroll).not.toHaveBeenCalled();
  });

  it("räumt einen abgebrochenen Versuch vorher weg", async () => {
    signedIn([{ id: "alt", status: "unverified", factor_type: "totp" }]);
    await POST(post({ action: "enroll" }));
    expect(unenroll).toHaveBeenCalledWith({ factorId: "alt" });
    expect(enroll).toHaveBeenCalledTimes(1);
  });

  it("lehnt ab, wenn schon ein Faktor aktiv ist", async () => {
    signedIn(verified);
    const res = await POST(post({ action: "enroll" }));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("already_enabled");
    expect(enroll).not.toHaveBeenCalled();
  });

  it("ein Fehler von Supabase ist 503, und der Schlüssel taucht nirgends auf", async () => {
    enroll.mockResolvedValue({ data: null, error: { message: "mfa disabled" } });
    expect((await POST(post({ action: "enroll" }))).status).toBe(503);
  });
});

describe("activate", () => {
  it("prüft den Code, hält es fest und gibt die Codes einmal aus", async () => {
    const res = await POST(post({ action: "activate", factorId: FACTOR, code: "123456" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ recoveryCodes: CODES });
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR, code: "123456" });
    expect(recordSecurityEvent).toHaveBeenCalledWith("mfa.enabled", userId);
    expect(JSON.stringify(recordSecurityEvent.mock.calls)).not.toContain(CODES[0]);
  });

  it("ein falscher Code ändert nichts", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422, message: "Invalid TOTP code entered" } });
    const res = await POST(post({ action: "activate", factorId: FACTOR, code: "000000" }));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("invalid_code");
    expect(replaceRecoveryCodes).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("scheitern nur die Codes, sagt die Antwort es: der Faktor ist trotzdem aktiv", async () => {
    replaceRecoveryCodes.mockRejectedValue(new Error("db down"));
    const res = await POST(post({ action: "activate", factorId: FACTOR, code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recoveryCodes: null });
    expect(recordSecurityEvent).toHaveBeenCalledWith("mfa.enabled", userId);
  });

  it.each([{ code: "12345" }, { code: "abcdef" }, { code: "1234567" }])("nimmt nur sechs Ziffern: %j", async (bad) => {
    const res = await POST(post({ action: "activate", factorId: FACTOR, ...bad }));
    expect(res.status).toBe(400);
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });
});

describe("verify", () => {
  beforeEach(() => signedIn(verified));

  it("hebt die Sitzung über den bestätigten Faktor und schreibt einen Logeintrag", async () => {
    expect((await POST(post({ action: "verify", code: "123456" }))).status).toBe(200);
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR, code: "123456" });
    expect(logEvent).toHaveBeenCalledWith("mfa.verified", { userId });
  });

  it("ein falscher Code ergibt 400 und einen Eintrag", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
    const res = await POST(post({ action: "verify", code: "000000" }));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("invalid_code");
    expect(logEvent).toHaveBeenCalledWith("mfa.verify_failed", { userId });
  });

  it("ein Ausfall oder eine Grenze von Supabase ist kein falscher Code", async () => {
    for (const status of [500, 429, undefined]) {
      challengeAndVerify.mockResolvedValue({ data: null, error: { status } });
      expect((await POST(post({ action: "verify", code: "000000" }))).status, String(status)).toBe(503);
    }
  });

  it("ohne Faktor gibt es nichts zu prüfen", async () => {
    signedIn();
    const res = await POST(post({ action: "verify", code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("not_enabled");
  });

  it("begrenzt die Versuche auf zehn in zehn Minuten", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await POST(post({ action: "verify", code: "000000" }))).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(challengeAndVerify).toHaveBeenCalledTimes(10);
  });

  describe("je Anschluss gezählt", () => {
    beforeEach(() => vi.stubEnv("VERCEL", "1"));
    afterEach(() => vi.unstubAllEnvs());

    it("wer nur das Passwort kennt, verbraucht von seinem Anschluss aus nicht die Versuche des Besitzers", async () => {
      challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
      for (let i = 0; i < 10; i += 1) await POST(postFrom("203.0.113.7", { action: "verify", code: "000000" }));
      expect((await POST(postFrom("203.0.113.7", { action: "verify", code: "000000" }))).status).toBe(429);

      challengeAndVerify.mockResolvedValue({ data: {}, error: null });
      expect((await POST(postFrom("198.51.100.4", { action: "verify", code: "123456" }))).status).toBe(200);
    });

    it("auch von vielen Anschlüssen aus sperrt ein Fremder den Besitzer nicht aus", async () => {
      challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
      for (let host = 1; host <= 6; host += 1) {
        for (let i = 0; i < 11; i += 1) await POST(postFrom(`203.0.113.${host}`, { action: "verify", code: "000000" }));
      }

      challengeAndVerify.mockResolvedValue({ data: {}, error: null });
      expect((await POST(postFrom("198.51.100.4", { action: "verify", code: "123456" }))).status).toBe(200);
      const back = await POST(postFrom("198.51.100.4", { action: "recover", recoveryCode: "BCDF-GHJK-LMNP-QRST" }));
      expect(back.status).toBe(200);
    });

    it("zählt IPv6 je /64: neue Adressen im selben Netz bringen keine neuen Versuche", async () => {
      challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
      for (let i = 1; i <= 10; i += 1) await POST(postFrom(`2001:db8:1:1::${i}`, { action: "verify", code: "000000" }));
      expect((await POST(postFrom("2001:db8:1:1::ffff", { action: "verify", code: "000000" }))).status).toBe(429);
      expect((await POST(postFrom("2001:db8:1:2::1", { action: "verify", code: "000000" }))).status).toBe(400);
    });
  });
});

describe("recover: der Rückweg bei Verlust des Geräts", () => {
  beforeEach(() => signedIn(verified));

  it("entfernt den Faktor mit einem gültigen Code, löscht die übrigen und hält es fest", async () => {
    const res = await POST(post({ action: "recover", recoveryCode: "BCDF-GHJK-LMNP-QRST" }));
    expect(res.status).toBe(200);
    expect(redeemRecoveryCode).toHaveBeenCalledWith(userId, "BCDF-GHJK-LMNP-QRST");
    expect(deleteFactor).toHaveBeenCalledWith({ id: FACTOR, userId });
    expect(deleteRecoveryCodes).toHaveBeenCalledWith(userId);
    expect(recordSecurityEvent).toHaveBeenCalledWith("mfa.recovery_used", userId);
  });

  it("ein falscher Code entfernt nichts", async () => {
    redeemRecoveryCode.mockResolvedValue(false);
    const res = await POST(post({ action: "recover", recoveryCode: "FALSCH" }));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("invalid_recovery_code");
    expect(deleteFactor).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith("mfa.recovery_failed", { userId });
  });

  it("hat einen eigenen Zähler: zehn Versuche in zehn Minuten, aufgebrauchte Code-Versuche sperren ihn nicht", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
    for (let i = 0; i < 10; i += 1) await POST(post({ action: "verify", code: "000000" }));
    expect((await POST(post({ action: "verify", code: "000000" }))).status).toBe(429);

    redeemRecoveryCode.mockResolvedValue(false);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await POST(post({ action: "recover", recoveryCode: "X" }))).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(redeemRecoveryCode).toHaveBeenCalledTimes(10);
  });

  it("scheitert das Entfernen, meldet es 503 und behält die übrigen Codes", async () => {
    deleteFactor.mockResolvedValue({ data: null, error: { message: "auth down" } });
    expect((await POST(post({ action: "recover", recoveryCode: "BCDF-GHJK-LMNP-QRST" }))).status).toBe(503);
    expect(deleteRecoveryCodes).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("ohne Faktor gibt es nichts wiederherzustellen, und kein Code wird verbraucht", async () => {
    signedIn();
    expect((await POST(post({ action: "recover", recoveryCode: "BCDF-GHJK-LMNP-QRST" }))).status).toBe(400);
    expect(redeemRecoveryCode).not.toHaveBeenCalled();
  });
});

describe("renew-codes und disable", () => {
  beforeEach(() => signedIn(verified));

  it("neue Codes nur mit gültigem Code aus der App", async () => {
    const res = await POST(post({ action: "renew-codes", code: "123456" }));
    expect(await res.json()).toEqual({ recoveryCodes: CODES });
    expect(recordSecurityEvent).toHaveBeenCalledWith("mfa.recovery_codes_renewed", userId);

    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
    replaceRecoveryCodes.mockClear();
    expect((await POST(post({ action: "renew-codes", code: "000000" }))).status).toBe(400);
    expect(replaceRecoveryCodes).not.toHaveBeenCalled();
  });

  it("ausschalten nur mit gültigem Code: ein gestohlenes Cookie reicht nicht", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: { status: 422 } });
    expect((await POST(post({ action: "disable", code: "000000" }))).status).toBe(400);
    expect(unenroll).not.toHaveBeenCalled();
    expect(deleteRecoveryCodes).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("ausschalten entfernt Faktor und Codes und hält es fest", async () => {
    expect((await POST(post({ action: "disable", code: "123456" }))).status).toBe(200);
    expect(unenroll).toHaveBeenCalledWith({ factorId: FACTOR });
    expect(deleteRecoveryCodes).toHaveBeenCalledWith(userId);
    expect(recordSecurityEvent).toHaveBeenCalledWith("mfa.disabled", userId);
  });

  it("scheitert das Entfernen beim Ausschalten, bleiben die Codes", async () => {
    unenroll.mockResolvedValue({ data: null, error: { message: "auth down" } });
    expect((await POST(post({ action: "disable", code: "123456" }))).status).toBe(503);
    expect(deleteRecoveryCodes).not.toHaveBeenCalled();
  });
});
