import { describe, expect, it } from "vitest";
import {
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  formatUserCode,
  normalizeUserCode,
} from "@/shared/lib/cli-user-code";

describe("Nutzer-Code der Geräte-Anmeldung", () => {
  it("das Alphabet hat keine Vokale und nichts Verwechselbares", () => {
    expect(USER_CODE_ALPHABET).not.toMatch(/[AEIOUY01]/);
    expect(new Set(USER_CODE_ALPHABET).size).toBe(USER_CODE_ALPHABET.length);
    expect(USER_CODE_ALPHABET).toHaveLength(28);
  });

  it("nimmt Eingaben mit Bindestrich, Leerzeichen und Kleinbuchstaben an", () => {
    expect(normalizeUserCode("bcdf-ghjk")).toBe("BCDFGHJK");
    expect(normalizeUserCode("  BCDF GHJK ")).toBe("BCDFGHJK");
    expect(normalizeUserCode("BCDFGHJK")).toBe("BCDFGHJK");
  });

  it("weist falsche Längen und Zeichen ab", () => {
    expect(normalizeUserCode("")).toBeNull();
    expect(normalizeUserCode("BCDFGHJ")).toBeNull();
    expect(normalizeUserCode("BCDFGHJKL")).toBeNull();
    expect(normalizeUserCode("BCDFGHJA")).toBeNull(); // Vokal
    expect(normalizeUserCode("BCDFGHJ0")).toBeNull(); // Null
    expect(normalizeUserCode("BCDFGHJ-")).toBeNull();
  });

  it("formatiert in zwei Vierergruppen, und normalize macht es rückgängig", () => {
    const code = "23456789";
    expect(code).toHaveLength(USER_CODE_LENGTH);
    expect(formatUserCode(code)).toBe("2345-6789");
    expect(normalizeUserCode(formatUserCode(code))).toBe(code);
  });
});
