// Der Nutzer-Code der Geräte-Anmeldung (Terminal-App): acht Zeichen, die jemand vom Bildschirm des
// Terminals in den Browser abtippt. Server (Erzeugen, Prüfen) und Bestätigungsseite (Eingabemaske)
// brauchen dieselbe Definition, deshalb liegt sie hier und nicht in einer der beiden Schichten.
//
// Ohne Vokale (es entstehen keine Wörter) und ohne alles, was man verwechselt (kein 0, 1, I, O): 20
// Konsonanten und die Ziffern 2 bis 9 sind 28 Zeichen, bei acht Stellen rund 38 Bit. Das hält zehn
// Minuten Gültigkeit und das Ratenlimit der Freigabe (rund zehn Versuche je Minute und Nutzer) aus.
// Die Migration 0050 prüft dieselbe Menge (cli_device_requests_user_code_format).

export const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ23456789";
export const USER_CODE_LENGTH = 8;

/**
 * Bringt eine Eingabe in die Form, in der der Code gespeichert ist: ohne Leerzeichen und Bindestrich,
 * in Großbuchstaben. `null`, wenn sie danach kein gültiger Code ist (falsche Länge, ein Zeichen, das
 * nie vorkommt).
 */
export function normalizeUserCode(input: string): string | null {
  const code = input.replace(/[\s-]+/g, "").toUpperCase();
  if (code.length !== USER_CODE_LENGTH) return null;
  for (const char of code) if (!USER_CODE_ALPHABET.includes(char)) return null;
  return code;
}

/** `BCDFGHJK` wird `BCDF-GHJK`, so liest man acht Zeichen am besten ab. */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
