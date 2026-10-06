import { describe, expect, it } from "vitest";
import { FRESH_OTP_WINDOW_MS, isRecoverySession } from "./recovery-session";

// Die Schranke der Seite "Neues Passwort" (Audit M-7): getestet wird vor allem,
// was sie NICHT durchlassen darf. Ein Test, der nur zeigt, dass der Reset-Link
// funktioniert, ließe jede zu großzügige Änderung unbemerkt.

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const sec = (ms: number) => Math.floor(ms / 1000);
const otpAt = (ageMs: number) => [{ method: "otp", timestamp: sec(NOW - ageMs) }];

describe("isRecoverySession: was durchgelassen wird", () => {
  it("recovery (PKCE-Weg), in beiden Formen der AMR-Liste", () => {
    expect(isRecoverySession([{ method: "recovery", timestamp: 1 }], NOW)).toBe(true);
    expect(isRecoverySession(["recovery"], NOW)).toBe(true);
  });

  it("recovery gilt ohne Alter (wie bisher)", () => {
    expect(isRecoverySession([{ method: "recovery", timestamp: sec(NOW) - 86_400 * 30 }], NOW)).toBe(true);
  });

  it("otp, frisch: genau das erzeugt der token_hash-Link der Vorlage", () => {
    expect(isRecoverySession(otpAt(0), NOW)).toBe(true);
    expect(isRecoverySession(otpAt(5 * 60 * 1000), NOW)).toBe(true);
  });

  it("otp genau an der Grenze gilt noch, eine Sekunde danach nicht mehr", () => {
    expect(isRecoverySession(otpAt(FRESH_OTP_WINDOW_MS), NOW)).toBe(true);
    expect(isRecoverySession(otpAt(FRESH_OTP_WINDOW_MS + 1000), NOW)).toBe(false);
  });

  it("otp mit leicht vorgehender Uhr gilt (Zeitabweichung zwischen GoTrue und Server)", () => {
    expect(isRecoverySession(otpAt(-30_000), NOW)).toBe(true);
  });
});

describe("isRecoverySession: was NICHT durchgelassen wird", () => {
  it("otp, alt: ein gestohlenes Cookie einer vor Stunden per Mail-Link entstandenen Sitzung", () => {
    expect(isRecoverySession(otpAt(60 * 60 * 1000), NOW)).toBe(false);
    expect(isRecoverySession(otpAt(24 * 60 * 60 * 1000), NOW)).toBe(false);
  });

  it("otp mit einem Zeitpunkt weit in der Zukunft (manipuliert oder kaputte Uhr)", () => {
    expect(isRecoverySession(otpAt(-10 * 60 * 1000), NOW)).toBe(false);
  });

  it("otp ohne Zeitpunkt, oder mit etwas, das keine Zahl ist: Alter nicht belegbar", () => {
    expect(isRecoverySession([{ method: "otp" }], NOW)).toBe(false);
    // Als Text, aber frisch: nur die Typprüfung darf das abweisen, nicht das Alter.
    expect(isRecoverySession([{ method: "otp", timestamp: String(sec(NOW)) }], NOW)).toBe(false);
    expect(isRecoverySession([{ method: "otp", timestamp: Number.NaN }], NOW)).toBe(false);
    expect(isRecoverySession([{ method: "otp", timestamp: null }], NOW)).toBe(false);
  });

  it("otp als bloßer Text (RFC-8176-Form): kein Alter, also nicht belegbar", () => {
    expect(isRecoverySession(["otp"], NOW)).toBe(false);
  });

  it("die gewöhnlichen Anmeldungen der App: Passwort und OAuth", () => {
    expect(isRecoverySession([{ method: "password", timestamp: sec(NOW) }], NOW)).toBe(false);
    expect(isRecoverySession([{ method: "oauth", timestamp: sec(NOW) }], NOW)).toBe(false);
    expect(isRecoverySession(["pwd"], NOW)).toBe(false);
  });

  it("andere Mail-Methoden zählen nicht, auch wenn sie frisch sind", () => {
    for (const method of ["magiclink", "invite", "email_change", "email/signup", "token_refresh"]) {
      expect(isRecoverySession([{ method, timestamp: sec(NOW) }], NOW), method).toBe(false);
    }
  });

  it("kein oder kaputter amr-Claim", () => {
    for (const bad of [undefined, null, "recovery", {}, 42, [], [null], [undefined], [42], [{}], [{ method: 1 }]]) {
      expect(isRecoverySession(bad, NOW), JSON.stringify(bad)).toBe(false);
    }
  });

  it("eine Passwort-Sitzung wird durch einen alten otp-Eintrag daneben nicht zur Reset-Sitzung", () => {
    const amr = [
      { method: "password", timestamp: sec(NOW) },
      { method: "otp", timestamp: sec(NOW - 3 * 60 * 60 * 1000) },
    ];
    expect(isRecoverySession(amr, NOW)).toBe(false);
  });
});
