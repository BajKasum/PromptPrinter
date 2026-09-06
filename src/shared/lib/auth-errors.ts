import { PASSWORD_RULE_HINT } from "@/shared/lib/password";

// M-10 (Audit 06.09.2026): GoTrue drosselt Mail-Versand pro Adresse (60s
// zwischen zwei Anfragen) und meldet das NICHT mit dem Wort "rate limit",
// sondern als eigene, unbenannte Fehlerform: "For security purposes, you can
// only request this after 51 seconds." Das lief bisher unerkannt durch
// translateAuthError und leakte roh auf Englisch — in einer sonst
// durchgängig deutschen App.
const MAIL_COOLDOWN_PATTERN = /only request this after (\d+) seconds?/i;

/** True für GoTrues Mail-Versand-Drosselung, in jeder ihrer beiden Formen. */
export function isMailCooldownError(message: string): boolean {
  return message.toLowerCase().includes("rate limit") || MAIL_COOLDOWN_PATTERN.test(message);
}

/**
 * Übersetzt GoTrues Cooldown-Meldung, mit der genannten Wartezeit, wenn sie
 * sich extrahieren lässt (die Sekundenzahl steckt nur im "only request this
 * after N seconds"-Satz, nicht in der reinen "rate limit"-Form).
 */
export function mailCooldownMessage(message: string): string {
  const match = message.match(MAIL_COOLDOWN_PATTERN);
  const seconds = match ? Number(match[1]) : null;
  return seconds
    ? `Bitte warte noch ${seconds} Sekunden, bevor du eine weitere Mail anforderst.`
    : "Zu viele Versuche, bitte kurz warten.";
}

// Maps raw Supabase auth error messages to friendly German copy. Shared by the
// styled login experience and the signup form so the wording stays consistent.
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email oder Passwort falsch";
  if (m.includes("email not confirmed"))
    return "Email wurde noch nicht bestätigt, bitte Posteingang prüfen";
  if (m.includes("user already registered"))
    return "Diese Email ist bereits registriert, bitte einloggen";
  if (m.includes("email address") && m.includes("invalid"))
    return "Diese Email-Adresse wird nicht akzeptiert";
  if (m.includes("password should be")) return `Passwort zu schwach (${PASSWORD_RULE_HINT.toLowerCase()})`;
  if (isMailCooldownError(message)) return mailCooldownMessage(message);
  return message;
}
