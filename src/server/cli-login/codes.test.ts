import { describe, expect, it } from "vitest";
import { USER_CODE_ALPHABET, USER_CODE_LENGTH, normalizeUserCode } from "@/shared/lib/cli-user-code";
import {
  DEVICE_CODE_PATTERN,
  cleanClientName,
  hashDeviceCode,
  newDeviceCode,
  newUserCode,
} from "@/server/cli-login/codes";

describe("Codes der Geräte-Anmeldung", () => {
  it("der Geräte-Code hat 32 Byte Zufall, ist nie derselbe und passt zu seinem Muster", () => {
    const codes = new Set(Array.from({ length: 200 }, newDeviceCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(DEVICE_CODE_PATTERN);
  });

  it("gespeichert wird nur der SHA-256, 64 Hex-Zeichen, ohne den Code zu verraten", () => {
    const code = newDeviceCode();
    const hash = hashDeviceCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashDeviceCode(code));
    expect(hash).not.toContain(code);
    expect(hashDeviceCode(code + "x")).not.toBe(hash);
    // Bekannter Wert (SHA-256 von "abc"): die Hash-Funktion ist wirklich SHA-256.
    expect(hashDeviceCode("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("der Nutzer-Code besteht aus acht Zeichen des Alphabets und übersteht normalizeUserCode", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = newUserCode();
      expect(code).toHaveLength(USER_CODE_LENGTH);
      for (const char of code) expect(USER_CODE_ALPHABET).toContain(char);
      expect(normalizeUserCode(code)).toBe(code);
    }
  });

  it("die Zeichen des Nutzer-Codes sind ungefähr gleich verteilt", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      for (const char of newUserCode()) counts.set(char, (counts.get(char) ?? 0) + 1);
    }
    expect(counts.size).toBe(USER_CODE_ALPHABET.length);
    const expected = (4000 * USER_CODE_LENGTH) / USER_CODE_ALPHABET.length; // rund 1143
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });

  it("der Gerätename verliert Steuerzeichen, Zeilenumbrüche und alles über 60 Zeichen", () => {
    expect(cleanClientName(undefined)).toBe("");
    expect(cleanClientName("  pp   cli \n\t auf Laptop ")).toBe("pp cli auf Laptop");
    // Steuerzeichen, Leserichtung umschalten (U+202E) und unsichtbare Zeichen (U+200B) sind weg.
    const messy = String.fromCharCode(97, 0, 98, 0x202e, 99, 0x200b, 100);
    expect(cleanClientName(messy)).toBe("a b c d");
    expect(cleanClientName("x".repeat(100))).toHaveLength(60);
  });
});
