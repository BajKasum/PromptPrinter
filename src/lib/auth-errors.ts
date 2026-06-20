// Maps raw Supabase auth error messages to friendly German copy. Shared by the
// styled login experience and the signup form so the wording stays consistent.
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email oder Passwort falsch";
  if (m.includes("email not confirmed"))
    return "Email wurde noch nicht bestätigt — bitte Posteingang prüfen";
  if (m.includes("user already registered"))
    return "Diese Email ist bereits registriert — bitte einloggen";
  if (m.includes("email address") && m.includes("invalid"))
    return "Diese Email-Adresse wird nicht akzeptiert";
  if (m.includes("password should be")) return "Passwort zu schwach (mindestens 8 Zeichen)";
  if (m.includes("rate limit")) return "Zu viele Versuche — bitte kurz warten";
  return message;
}
