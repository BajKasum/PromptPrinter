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
