import "server-only";

// Wer das Turnstile-Token der anonymen Auth-Aktionen prüft (app/api/auth/route.ts). Standard: `/api/auth` selbst
// (server/security/turnstile.ts). Mit AUTH_CAPTCHA_VIA_SUPABASE=true reicht die Route das Token als
// `options.captchaToken` an Supabase Auth weiter und prüft es nicht selbst, denn ein Token ist nur einmal
// einlösbar: zwei Prüfer brächen jeden Versuch. Dann gilt das CAPTCHA auch für den direkten Weg zu Supabase Auth
// mit dem Anon-Key, an dem die Route vorbeigeht.
//
// Der Schalter allein schwächt die Prüfung: ohne CAPTCHA im Supabase-Dashboard prüft dann niemand. Deshalb erst das
// Dashboard, dann der Schalter (docs/SETUP.md, "Anmelden: Sperre je Konto").

/** Prüft Supabase Auth das Turnstile-Token statt `/api/auth`? Nur der Wert "true" schaltet um. */
export function captchaViaSupabase(): boolean {
  return process.env.AUTH_CAPTCHA_VIA_SUPABASE === "true";
}

/** Lehnt Supabase Auth die Anfrage wegen des CAPTCHAs ab (Code `captcha_failed`, ältere Versionen nur im Text)? */
export function isSupabaseCaptchaError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}
