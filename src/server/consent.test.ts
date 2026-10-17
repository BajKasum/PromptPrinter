import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasZaiConsent, setZaiConsent, zaiConsentOf, ZAI_CONSENT_VERSION } from "./consent";

const updateUserById = vi.fn();
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { updateUserById: (...a: unknown[]) => updateUserById(...a) } } }),
}));

const current = { zai_consent: { version: ZAI_CONSENT_VERSION, at: "2026-10-17T10:00:00.000Z" } };

describe("zaiConsentOf / hasZaiConsent", () => {
  it("erkennt eine Zustimmung zur aktuellen Fassung", () => {
    expect(zaiConsentOf(current)).toEqual({ version: ZAI_CONSENT_VERSION, at: "2026-10-17T10:00:00.000Z" });
    expect(hasZaiConsent(current)).toBe(true);
  });

  it.each([
    ["kein app_metadata", null],
    ["leeres app_metadata", {}],
    ["Zustimmung gelöscht (null)", { zai_consent: null }],
    ["ältere Fassung", { zai_consent: { version: "2020-01-01", at: "2020-01-01T00:00:00.000Z" } }],
    ["ohne Zeitpunkt", { zai_consent: { version: ZAI_CONSENT_VERSION } }],
    ["Zeitpunkt kein Text", { zai_consent: { version: ZAI_CONSENT_VERSION, at: 5 } }],
    ["Wahrheitswert statt Eintrag", { zai_consent: true }],
  ])("zählt nicht: %s", (_label, appMetadata) => {
    expect(hasZaiConsent(appMetadata)).toBe(false);
  });
});

describe("setZaiConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserById.mockResolvedValue({ error: null });
  });

  it("schreibt Fassung und Zeitpunkt in app_metadata des Kontos", async () => {
    await setZaiConsent("user-1", true);

    expect(updateUserById).toHaveBeenCalledTimes(1);
    const [id, attrs] = updateUserById.mock.calls[0] as [
      string,
      { app_metadata: { zai_consent: { version: string; at: string } } },
    ];
    expect(id).toBe("user-1");
    expect(attrs.app_metadata.zai_consent.version).toBe(ZAI_CONSENT_VERSION);
    expect(Number.isNaN(Date.parse(attrs.app_metadata.zai_consent.at))).toBe(false);
  });

  it("widerruft mit null, damit der Schlüssel verschwindet und andere Felder bleiben", async () => {
    await setZaiConsent("user-1", false);

    expect(updateUserById).toHaveBeenCalledWith("user-1", { app_metadata: { zai_consent: null } });
  });

  it("wirft, wenn Supabase einen Fehler meldet, statt still zu scheitern", async () => {
    updateUserById.mockResolvedValue({ error: new Error("auth down") });

    await expect(setZaiConsent("user-1", true)).rejects.toThrow("auth down");
  });
});
