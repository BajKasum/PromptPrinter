import { describe, expect, it } from "vitest";
import { FRESH_SIGN_IN_WINDOW_MS, signedInRecently } from "./fresh-sign-in";

// Die Schranke vor "Konto loeschen" (#132): getestet wird vor allem, was sie NICHT durchlassen darf. Ein Test, der
// nur zeigt, dass eine frische Anmeldung geht, liesse jede zu grosszuegige Aenderung unbemerkt.

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const sec = (ms: number) => Math.floor(ms / 1000);
const at = (method: string, ageMs: number) => ({ method, timestamp: sec(NOW - ageMs) });

describe("signedInRecently: was durchgelassen wird", () => {
  it.each(["password", "oauth", "otp", "recovery", "magiclink", "totp"])("%s, gerade angemeldet", (method) => {
    expect(signedInRecently([at(method, 0)], NOW)).toBe(true);
    expect(signedInRecently([at(method, 5 * 60 * 1000)], NOW)).toBe(true);
  });

  it("genau an der Grenze gilt noch, eine Sekunde danach nicht mehr", () => {
    expect(signedInRecently([at("password", FRESH_SIGN_IN_WINDOW_MS)], NOW)).toBe(true);
    expect(signedInRecently([at("password", FRESH_SIGN_IN_WINDOW_MS + 1000)], NOW)).toBe(false);
  });

  it("leicht vorgehende Uhr (Zeitabweichung zwischen GoTrue und Server)", () => {
    expect(signedInRecently([at("password", -30_000)], NOW)).toBe(true);
  });

  it("ein frischer Eintrag genuegt, auch neben einem alten", () => {
    expect(signedInRecently([at("password", 3 * 24 * 3600 * 1000), at("oauth", 60_000)], NOW)).toBe(true);
  });
});

describe("signedInRecently: was NICHT durchgelassen wird", () => {
  it("eine Sitzung von gestern, nur erneuert: das ausgelesene Cookie vom offenen Rechner", () => {
    expect(signedInRecently([at("password", 24 * 3600 * 1000)], NOW)).toBe(false);
    expect(signedInRecently([at("password", 60 * 60 * 1000)], NOW)).toBe(false);
  });

  it("token_refresh zaehlt nicht, auch wenn er gerade erst eingetragen wurde", () => {
    expect(signedInRecently([at("password", 24 * 3600 * 1000), at("token_refresh", 0)], NOW)).toBe(false);
    expect(signedInRecently([at("token_refresh", 0)], NOW)).toBe(false);
  });

  it("ein Zeitpunkt weit in der Zukunft (manipuliert oder kaputte Uhr)", () => {
    expect(signedInRecently([at("password", -10 * 60 * 1000)], NOW)).toBe(false);
  });

  it("ohne Zeitpunkt, oder mit etwas, das keine Zahl ist: Alter nicht belegbar", () => {
    expect(signedInRecently([{ method: "password" }], NOW)).toBe(false);
    expect(signedInRecently([{ method: "password", timestamp: String(sec(NOW)) }], NOW)).toBe(false);
    expect(signedInRecently([{ method: "password", timestamp: Number.NaN }], NOW)).toBe(false);
  });

  it("ohne Methode", () => {
    expect(signedInRecently([{ timestamp: sec(NOW) }], NOW)).toBe(false);
  });

  it("die Textform der Liste (RFC 8176) kennt keinen Zeitpunkt", () => {
    expect(signedInRecently(["password"], NOW)).toBe(false);
  });

  it("keine Liste: nichts, null, ein Objekt, ein Text", () => {
    for (const amr of [undefined, null, {}, "password", 42, []]) expect(signedInRecently(amr, NOW)).toBe(false);
  });

  it("Eintraege, die keine Objekte sind", () => {
    expect(signedInRecently([null, 1, undefined], NOW)).toBe(false);
  });
});
