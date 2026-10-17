import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useVoiceConsent, VOICE_CONSENT_VERSION } from "./use-voice-consent";

const KEY = "pp-voice-consent";

describe("useVoiceConsent", () => {
  beforeEach(() => window.localStorage.removeItem(KEY));
  afterEach(() => {
    window.localStorage.removeItem(KEY);
    vi.restoreAllMocks();
  });

  it("fragt am Anfang nach: ohne gespeicherten Wert ist nichts erteilt", () => {
    const { result } = renderHook(() => useVoiceConsent());
    expect(result.current.granted).toBe(false);
  });

  it("liest eine gespeicherte Zustimmung zur aktuellen Fassung beim Einhängen", () => {
    window.localStorage.setItem(KEY, VOICE_CONSENT_VERSION);
    const { result } = renderHook(() => useVoiceConsent());
    expect(result.current.granted).toBe(true);
  });

  it("zählt die Zustimmung zu einer älteren Fassung nicht", () => {
    window.localStorage.setItem(KEY, "2020-01-01");
    const { result } = renderHook(() => useVoiceConsent());
    expect(result.current.granted).toBe(false);
  });

  it("grant speichert die Fassung und setzt den Zustand, revoke löscht beides", () => {
    const { result } = renderHook(() => useVoiceConsent());

    act(() => result.current.grant());
    expect(result.current.granted).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe(VOICE_CONSENT_VERSION);

    act(() => result.current.revoke());
    expect(result.current.granted).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("bleibt bei gesperrtem Speicher benutzbar: das Ja gilt dann für diese Sitzung", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("gesperrt", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("gesperrt", "SecurityError");
    });
    const { result } = renderHook(() => useVoiceConsent());
    expect(result.current.granted).toBe(false);

    act(() => result.current.grant());
    expect(result.current.granted).toBe(true);
  });
});
