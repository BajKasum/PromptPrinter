import { describe, expect, it } from "vitest";
import { isMailCooldownError, mailCooldownMessage, translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("translates known Supabase error strings", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("Email oder Passwort falsch");
    expect(translateAuthError("Email not confirmed")).toContain("noch nicht bestätigt");
    expect(translateAuthError("User already registered")).toContain("bereits registriert");
  });

  it("passes through an unrecognized message unchanged", () => {
    expect(translateAuthError("Something odd happened")).toBe("Something odd happened");
  });

  // M-10 (Audit 06.09.2026): GoTrues Mail-Cooldown meldet sich als "For
  // security purposes, you can only request this after N seconds." — eine
  // Form, die weder das Wort "rate limit" enthaelt noch vorher erkannt wurde
  // und deshalb roh auf Englisch durchgereicht wurde.
  describe("GoTrues Mail-Cooldown (M-10)", () => {
    it("erkennt die benannte rate-limit-Form", () => {
      expect(isMailCooldownError("Email rate limit exceeded")).toBe(true);
    });

    it("erkennt die unbenannte Cooldown-Form ohne das Wort 'rate limit'", () => {
      expect(
        isMailCooldownError("For security purposes, you can only request this after 51 seconds.")
      ).toBe(true);
    });

    it("haelt eine unverwandte Meldung nicht faelschlich fuer einen Cooldown", () => {
      expect(isMailCooldownError("Invalid login credentials")).toBe(false);
    });

    it("uebersetzt die Cooldown-Meldung ins Deutsche, mit der genannten Wartezeit", () => {
      expect(translateAuthError("For security purposes, you can only request this after 51 seconds.")).toBe(
        "Bitte warte noch 51 Sekunden, bevor du eine weitere Mail anforderst."
      );
    });

    it("faellt auf eine generische Meldung zurueck, wenn keine Sekundenzahl steckt", () => {
      expect(mailCooldownMessage("Email rate limit exceeded")).toBe(
        "Zu viele Versuche, bitte kurz warten."
      );
    });
  });
});
