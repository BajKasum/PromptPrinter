import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_COMMON_MESSAGE,
  PASSWORD_PERSONAL_MESSAGE,
  PASSWORD_RULE_HINT,
  PASSWORD_TOO_SHORT_MESSAGE,
  isPasswordLongEnough,
  weakPasswordMessage,
  weakPasswordReason,
} from "./password";
import { COMMON_BASE_WORDS, COMMON_PASSWORDS } from "./common-passwords";

// Security-Audit finding M-5. The rule used to be the literal 8 copied into
// four files; these lock the single source of truth in place and keep the two
// user-facing sentences derived from it rather than retyped.
describe("password rule", () => {
  it("requires at least 10 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it("rejects anything shorter", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it("accepts exactly the minimum", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it("accepts longer", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH + 20))).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(isPasswordLongEnough("")).toBe(false);
  });

  // Both strings are shown to users; deriving them means raising the constant
  // can't leave a form telling people the old number.
  it("derives both user-facing sentences from the constant", () => {
    expect(PASSWORD_RULE_HINT).toContain(String(MIN_PASSWORD_LENGTH));
    expect(PASSWORD_TOO_SHORT_MESSAGE).toContain(String(MIN_PASSWORD_LENGTH));
  });
});

// Betriebs-Audit 04.10.2026: Supabases Prüfung gegen geleakte Passwörter ist aus
// (bezahlter Tarif), und zehn Zeichen halten "password123" nicht auf — das sind
// elf. Die lokale Prüfung ist die zweite Hürde ohne Drittdienst.
describe("weakPasswordReason", () => {
  it.each([
    "1234567890",
    "qwertyuiop",
    "1q2w3e4r5t",
    "QWERTYUIOP", // Gross-/Kleinschreibung ändert nichts
    "passwordpassword",
  ])("weist das bekannte Passwort %s ab", (password) => {
    expect(weakPasswordReason(password)).toBe("common");
  });

  it.each([
    "Password123",
    "password1234567",
    "Password2024!",
    "Passwort12345",
    "Welcome2024!!",
    "iloveyou2020",
    "Qwerty1234567",
    "PromptPrinter2026",
    "123password456",
    "Summer2024!!",
  ])("weist ein bekanntes Wort mit Ziffern an den Rändern ab: %s", (password) => {
    expect(weakPasswordReason(password)).toBe("common");
  });

  it.each([
    "P@ssw0rd!!",
    "P@ssw0rd2024",
    "Pa$$w0rd123!",
    "W3lc0me2024!",
    "$ecret12345",
    "@dmin123456",
    "l3tm31n2024",
  ])("löst Leetspeak auf: %s", (password) => {
    expect(weakPasswordReason(password)).toBe("common");
  });

  it.each([
    ["aaaaaaaaaaaa", "ein Zeichen wiederholt"],
    ["abcdefghijkl", "eine aufsteigende Folge"],
    ["lkjihgfedcba", "eine absteigende Folge"],
    ["mnopqrstuvwx", "eine Folge mitten im Alphabet"],
    ["abababababab", "ein wiederholter Block"],
    ["xyzxyzxyzxyz", "ein wiederholter längerer Block"],
  ])("erkennt das Muster %s (%s)", (password) => {
    expect(weakPasswordReason(password)).toBe("common");
  });

  it("weist ein Passwort ab, das die eigene E-Mail-Adresse enthält", () => {
    expect(weakPasswordReason("xx-kasumbajrami-xx", "kasumbajrami7@gmail.com")).toBe("personal");
    expect(weakPasswordReason("Kasum.Bajrami!2024", "kasum.bajrami@example.com")).toBe("personal");
  });

  it("prüft die E-Mail nur, wenn eine gegeben ist, und erst ab vier Zeichen im Namensteil", () => {
    expect(weakPasswordReason("xx-kasumbajrami-xx")).toBeNull();
    // "ab" ist kurz genug, um zufällig in jedem zweiten Passwort zu stecken.
    expect(weakPasswordReason("kab-ist-eine-gute-idee", "ab@example.com")).toBeNull();
  });

  it("nimmt den Teil VOR dem @, nicht die Domain", () => {
    expect(weakPasswordReason("meinegmailadresse-ist-geheim-x", "kasum@gmail.com")).toBeNull();
  });

  // Die Kehrseite zählt genauso: eine Prüfung, die gute Passwörter abweist,
  // treibt Leute zu schlechten. Das hier sind gewöhnliche, gute Eingaben.
  it.each([
    "correct horse battery staple",
    "Tr0ub4dor&3-xyz-Basel",
    "k9#Lm2$vQ8wZp",
    "mein-hund-heisst-bello-1987",
    "Sommer in Basel 2024", // enthält ein Basiswort, ist aber mehr als das Wort
    "Der Hund Bellt Nachts",
    "7Dkq-xP2m-Lw9z",
    "passwordmanagerrocks", // Basiswort als Teilstring, nicht als Kern
    "adminpanelfuermich1",
  ])("lässt %s durch", (password) => {
    expect(weakPasswordReason(password, "du@example.com")).toBeNull();
  });

  it("verändert das Passwort nicht und liefert bei leerem Wert null statt zu werfen", () => {
    expect(weakPasswordReason("")).toBeNull();
    expect(() => weakPasswordReason("   ")).not.toThrow();
  });

  it("liefert zu jedem Grund einen Satz, der den Grund auch nennt", () => {
    expect(weakPasswordMessage("common")).toBe(PASSWORD_COMMON_MESSAGE);
    expect(weakPasswordMessage("personal")).toBe(PASSWORD_PERSONAL_MESSAGE);
    expect(PASSWORD_PERSONAL_MESSAGE).toMatch(/E-Mail/);
  });
});

describe("die Passwortlisten selbst", () => {
  it("führen nur kleingeschriebene, bereinigte Einträge", () => {
    for (const entry of [...COMMON_PASSWORDS, ...COMMON_BASE_WORDS]) {
      expect(entry, entry).toBe(entry.trim().toLowerCase());
    }
  });

  it("führen in COMMON_PASSWORDS nur Werte, die die Längenregel überhaupt durchlässt", () => {
    // Alles Kürzere weist isPasswordLongEnough ohnehin ab: ein solcher Eintrag
    // wäre toter Text, der nur die Liste verlängert.
    for (const entry of COMMON_PASSWORDS) {
      expect(entry.length, entry).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    }
  });

  it("führen in COMMON_BASE_WORDS nur Buchstaben, denn verglichen wird der Kern ohne Ziffern", () => {
    for (const entry of COMMON_BASE_WORDS) {
      expect(entry, entry).toMatch(/^[a-z]+$/);
    }
  });

  it("sind so klein, dass sie kein Gewicht ins Bundle bringen", () => {
    // Eine lange Liste im Client-Bundle kostet jeden Besucher Bytes für eine
    // Seite, die er selten braucht (Begründung in common-passwords.ts). Wer sie
    // wirklich ausbauen will, schaltet stattdessen die Supabase-Prüfung ein.
    expect(COMMON_PASSWORDS.size + COMMON_BASE_WORDS.size).toBeLessThan(400);
  });
});
