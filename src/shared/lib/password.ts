import { COMMON_BASE_WORDS, COMMON_PASSWORDS } from "@/shared/lib/common-passwords";

// The one place the password rule lives (Security-Audit finding M-5).
//
// It used to be the literal 8 repeated in four places — the signup zod schema,
// the signup input's minLength, the reset form's inline length check, and the
// German text in auth-errors.ts. Four copies of a security parameter, none of
// which knew about the others, so raising it meant finding all four.
//
// WHY 10 AND NOT 8: NIST SP 800-63B is explicit that length beats composition
// rules (no forced symbols/digits here, deliberately) and allows a minimum of
// 8 — but only when it is paired with a check against known-breached passwords.
// That check is Supabase's "Leaked Password Protection" (HaveIBeenPwned), and
// the audit found it DISABLED on this project. Until it is switched on in the
// Supabase dashboard, 10 is the compensating control: it is the cheapest
// meaningful raise that does not push users toward writing passwords down.
//
// This is enforced in the app's own forms. Supabase's server-side
// `password_min_length` is a separate dashboard setting and is the only thing
// binding on a caller who talks to the auth API directly — so this constant
// hardens the product's real signup/reset paths, it is not a substitute for
// that setting or for the breach check.
export const MIN_PASSWORD_LENGTH = 10;

/** The rule as a sentence, so every surface phrases it identically. */
export const PASSWORD_RULE_HINT = `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`;

/**
 * The rule as a full error sentence, for the forms that report failure inline
 * rather than under the field.
 */
export const PASSWORD_TOO_SHORT_MESSAGE = `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

// ─── Bekannte und naheliegende Passwörter ──────────────────────────────────
// (Betriebs-Audit 04.10.2026)
//
// Der Abschnitt oben nennt MIN_PASSWORD_LENGTH = 10 als Ausgleich dafür, dass
// Supabases Prüfung gegen geleakte Passwörter aus ist. Mit der Zeit ist daraus
// ein Dauerzustand geworden: der Schalter gehört zu einem bezahlten Tarif
// (Free hier), und eine eigene Abfrage bei HaveIBeenPwned hätte einen
// Drittdienst in den Anmeldeweg gehängt, der in der Datenschutzerklärung stehen
// müsste. Zehn Zeichen halten "password123" aber nicht auf: das sind elf.
//
// Deshalb eine zweite, lokale Hürde, ohne Drittdienst: ein Passwort verlässt das
// Haus dabei nie. Sie fängt die offensichtlichen Fälle, nicht alle (dafür bräuchte
// es die echte Prüfung, Supabase Pro). Was sie fängt:
//   - bekannte ganze Werte und Zahlenreihen (common-passwords.ts),
//   - ein bekanntes Wort mit Ziffern/Zeichen an den Rändern, auch als Leetspeak
//     ("Password2024!", "P@ssw0rd!!"),
//   - Muster: ein Zeichen wiederholt, eine Folge (abcdef…, 3456789…), ein
//     wiederholter Block,
//   - das Passwort enthält die eigene E-Mail-Adresse.
//
// Durchgesetzt wird sie serverseitig bei der Registrierung (api/auth/route.ts),
// als Sofort-Rückmeldung in den Formularen, damit der einmalig gültige
// Captcha-Token nicht verbrennt. Beim Zurücksetzen läuft die Prüfung im Browser
// (die Eingabe geht dort direkt an Supabase), bindet also nur die App, nicht
// jemanden, der die Supabase-API selbst aufruft; dasselbe gilt schon für die
// Mindestlänge.

export type WeakPasswordReason = "common" | "personal";

export const PASSWORD_COMMON_MESSAGE =
  "Dieses Passwort ist zu bekannt und leicht zu erraten. Bitte wähle ein anderes.";
export const PASSWORD_PERSONAL_MESSAGE =
  "Das Passwort enthält deine E-Mail-Adresse. Bitte wähle ein anderes.";

export function weakPasswordMessage(reason: WeakPasswordReason): string {
  return reason === "personal" ? PASSWORD_PERSONAL_MESSAGE : PASSWORD_COMMON_MESSAGE;
}

// Die gängigen Ersetzungen von Buchstaben durch Ziffern und Zeichen.
const LEET: Record<string, string> = {
  "@": "a",
  "4": "a",
  "0": "o",
  "3": "e",
  $: "s",
  "5": "s",
  "7": "t",
  "1": "i",
  "!": "i",
  "|": "l",
};

function undoLeet(text: string): string {
  return [...text].map((char) => LEET[char] ?? char).join("");
}

/** Eine Folge, in der jedes Zeichen das nächste (oder vorige) im Alphabet/Zahlenstrahl ist. */
function isSequence(text: string): boolean {
  if (text.length < 6) return false;
  const steps = new Set<number>();
  for (let i = 1; i < text.length; i++) steps.add(text.charCodeAt(i) - text.charCodeAt(i - 1));
  return steps.size === 1 && (steps.has(1) || steps.has(-1));
}

function isRepetition(text: string): boolean {
  // Ein Zeichen (aaaaaaaaaa) oder ein kurzer Block, der sich wiederholt (abcabcabc).
  return /^(.{1,6})\1+$/.test(text);
}

/**
 * Der Namensteil der Adresse, ohne Satzzeichen, und zusätzlich ohne angehängte
 * Ziffern: bei "kasumbajrami7@…" ist die 7 fast immer nur der Zähler, den der
 * Anbieter vergeben hat ("kasumbajrami" war schon weg), und das Passwort enthält
 * den Namen, nicht den Zähler.
 */
function emailNameParts(email: string | undefined): string[] {
  const local = ((email ?? "").split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return [...new Set([local, local.replace(/[0-9]+$/, "")])];
}

/**
 * Warum dieses Passwort zu schwach ist, oder null, wenn es die lokale Prüfung
 * besteht. Die Länge prüft isPasswordLongEnough getrennt.
 */
export function weakPasswordReason(password: string, email?: string): WeakPasswordReason | null {
  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) return "common";
  if (isRepetition(lower) || isSequence(lower)) return "common";

  // Kern des Passworts, zwei Lesarten:
  //  - ohne Ziffern und Zeichen an den Rändern: "Password2024!" und
  //    "123password" werden "password";
  //  - erst den Anhang hinten abschneiden, dann Leetspeak auflösen: "P@ssw0rd!!"
  //    und auch "$ecret1" werden "password" bzw. "secret". Die Reihenfolge ist
  //    Absicht: hinten angehängte Ziffern sind fast immer Anhang, nicht
  //    Buchstabe (aus "Password1" soll nicht "passwordi" werden), vorn und in der
  //    Mitte stehen sie dagegen oft für einen Buchstaben.
  const strip = (text: string) => text.replace(/^[^a-z]+|[^a-z]+$/g, "");
  const cores = [strip(lower), strip(undoLeet(lower.replace(/[^a-z]+$/, "")))];
  if (cores.some((core) => core !== "" && COMMON_BASE_WORDS.has(core))) return "common";

  // Die eigene Adresse im Passwort. Erst ab vier Zeichen im Namensteil, sonst
  // träfe "ab@…" jedes Passwort, das "ab" enthält.
  const alnum = lower.replace(/[^a-z0-9]/g, "");
  if (emailNameParts(email).some((name) => name.length >= 4 && alnum.includes(name))) {
    return "personal";
  }

  return null;
}
