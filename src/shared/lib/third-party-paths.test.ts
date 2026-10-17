import { describe, expect, it } from "vitest";
import { needsFreshDocument, thirdPartiesFor } from "./third-party-paths";

describe("needsFreshDocument", () => {
  // Die Wege, die Kasum am 2026-10-17 als "Mensch-Prüfung konnte nicht geladen werden" erlebt hat.
  it.each([
    ["/", "/login", "Startseite → Login"],
    ["/", "/signup", "Startseite → Registrieren"],
    ["/chats/new", "/login", "Abmelden aus der App → Login"],
    ["/chats/abc", "/plans", "Chat → Pläne (Checkout)"],
    ["/settings", "/billing", "Einstellungen → Abrechnung (Checkout)"],
    ["/", "/pricing", "Startseite → Preise (Checkout)"],
    ["/pricing", "/login", "Preise → Login (anderer Drittanbieter)"],
    ["/login", "/pricing", "Login → Preise (anderer Drittanbieter)"],
    ["/docs", "/kontakt", "Hilfe → Kontakt (Captcha im Formular)"],
    ["/", "/reset-password", "Startseite → Passwort vergessen"],
  ])("verlangt ein neues Dokument: %s → %s (%s)", (from, to) => {
    expect(needsFreshDocument(from, to)).toBe(true);
  });

  it.each([
    ["/login", "/signup", "beide mit Turnstile"],
    ["/login", "/reset-password", "beide mit Turnstile"],
    ["/signup", "/kontakt", "beide mit Turnstile"],
    ["/billing", "/plans", "beide mit Lemon Squeezy"],
    ["/pricing", "/billing", "beide mit Lemon Squeezy"],
    ["/login", "/", "Ziel braucht nichts"],
    ["/", "/agb", "beide brauchen nichts"],
    ["/chats/new", "/settings", "beide brauchen nichts"],
    ["/pricing", "/docs", "Ziel braucht nichts"],
    ["/login", "/login", "derselbe Pfad"],
  ])("lässt es bei %s → %s (%s)", (from, to) => {
    expect(needsFreshDocument(from, to)).toBe(false);
  });

  it("ignoriert einen abschliessenden Schrägstrich", () => {
    expect(needsFreshDocument("/", "/login/")).toBe(true);
    expect(needsFreshDocument("/login/", "/signup")).toBe(false);
  });

  it("hält /reset-password/update draussen: die Seite bindet Turnstile nicht ein", () => {
    expect(needsFreshDocument("/", "/reset-password/update")).toBe(false);
    expect(thirdPartiesFor("/reset-password/update")).toEqual({ turnstile: false, lemonSqueezy: false });
  });
});
