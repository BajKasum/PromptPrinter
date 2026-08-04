import "server-only";

import { normalizeCheckoutUrl } from "@/shared/lib/lemon-squeezy";

// Startup validation of the environment (QA finding S-2).
//
// Several variables are not "recommended" but load-bearing: without them the
// app comes up, serves its public pages, and then fails at the first thing a
// signed-in user does — with an error that points nowhere near the cause. The
// worst of those is Upstash: rate-limit.ts deliberately fails CLOSED in
// production when it isn't configured, so every API route answers 429 and the
// app looks rate-limited rather than misconfigured.
//
// This turns all of that into one loud message at boot, listing exactly what is
// missing, instead of a diagnosis session per variable.

type EnvRequirement = {
  name: string;
  why: string;
};

const REQUIRED_IN_PRODUCTION: EnvRequirement[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    why: "Ohne Supabase gibt es keine Anmeldung und keine Daten.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    why: "Ohne Supabase gibt es keine Anmeldung und keine Daten.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    why: "Kontolöschung (/api/account) braucht Admin-Rechte.",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    why:
      "Bestätigungs- und Passwort-Reset-Mails verlinken sonst auf " +
      "http://localhost:3000 (siehe siteUrl in lib/site-url.ts).",
  },
  {
    name: "API_KEY_ENCRYPTION_SECRET",
    why: "BYOK wirft beim Speichern eines eigenen Keys (lib/crypto.ts).",
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    why:
      "rate-limit.ts scheitert in Produktion bewusst geschlossen: OHNE Upstash " +
      "antworten ALLE API-Routen mit 429, die App ist funktional tot.",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    why: "Siehe UPSTASH_REDIS_REST_URL.",
  },
];

// Deliberately a plain record rather than NodeJS.ProcessEnv: Next augments that
// type with a required NODE_ENV, which makes every partial fixture in a test a
// type error for no benefit here. These functions only ever read string keys.
type EnvLike = Record<string, string | undefined>;

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * Requirements that only apply given some other part of the configuration.
 *
 * TURNSTILE_SECRET is the one case: unconditionally requiring it would force
 * Cloudflare setup on every deployment, including ones that deliberately run
 * without a captcha (site key unset → the widget renders nothing). Requiring it
 * only alongside the site key targets the state that actually matters — the
 * widget visible to visitors while nothing on the server redeems what it
 * produces. That combination is not a degraded captcha, it is a decorative one,
 * and it is precisely what shipped unnoticed until 2026-08-02.
 */
function conditionalRequirements(env: EnvLike): EnvRequirement[] {
  if (isBlank(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) return [];
  return [
    {
      name: "TURNSTILE_SECRET",
      why:
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY ist gesetzt, also sieht jeder Besucher die " +
        "Mensch-Prüfung — ohne das Secret verifiziert sie niemand (siehe lib/turnstile.ts).",
    },
  ];
}

/** Missing required variables for the given environment, in declaration order. */
export function missingProductionEnv(
  env: EnvLike = process.env
): EnvRequirement[] {
  return [...REQUIRED_IN_PRODUCTION, ...conditionalRequirements(env)].filter((requirement) =>
    isBlank(env[requirement.name])
  );
}

/** True when neither server-side model provider is configured (stub mode). */
export function hasNoModelProvider(env: EnvLike = process.env): boolean {
  return isBlank(env.ZAI_API_KEY) && isBlank(env.GEMINI_API_KEY);
}

/**
 * True when a PRODUCTION deployment carries a non-https NEXT_PUBLIC_APP_URL.
 *
 * Being merely *set* is not enough for this one, which is why the presence
 * check above cannot catch it: the value is load-bearing twice over, and a
 * plausible-but-wrong value (a leftover http://localhost:3000, say) boots
 * perfectly and then breaks both silently.
 *
 * 1. secureCookieOptions (lib/supabase/cookie-options.ts) decides whether the
 *    session cookie gets the `Secure` flag by asking whether siteUrl() is
 *    https. Non-https here means production session cookies are written
 *    WITHOUT Secure, i.e. a browser will send them over plaintext http.
 * 2. siteUrl() builds the absolute links in confirmation and password-reset
 *    mails, so every new signup would be mailed a link into localhost.
 *
 * Deliberately a warning rather than a throw: a self-hosted deployment behind
 * a TLS-terminating reverse proxy is a legitimate setup, and refusing to boot
 * would break the Docker path for a value that is a strong smell rather than a
 * certainty. The two consequences are named explicitly so the log line is
 * actionable instead of decorative.
 */
export function hasInsecureAppUrl(env: EnvLike = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  const url = env.NEXT_PUBLIC_APP_URL;
  if (isBlank(url)) return false; // already covered as a missing requirement
  return !url!.trim().toLowerCase().startsWith("https://");
}

/**
 * True when a Lemon Squeezy checkout address is configured but unusable.
 *
 * Same failure shape as hasInsecureAppUrl above, one layer quieter: an empty
 * value is a legitimate deployment ("keine Zahlungen hier"), and the button
 * falls back to its `fallbackHref` either way, so nothing breaks. A value
 * that is *set but wrong* is the state worth naming — a typo, an http link, a
 * copied dashboard URL instead of the checkout link — because the page then
 * looks entirely normal while the one button that earns money quietly points
 * back at the signup form.
 */
export function hasInvalidCheckoutUrl(env: EnvLike = process.env): boolean {
  const raw = env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
  if (isBlank(raw)) return false;
  return normalizeCheckoutUrl(raw) === null;
}

/**
 * Checks the environment once at server startup (wired up in
 * src/instrumentation.ts).
 *
 * Throws in production: a deployment that cannot serve a signed-in user should
 * fail visibly at boot rather than come up green and break on first use. Only
 * warns everywhere else — a dev machine without Upstash is normal and
 * supported (the in-memory limiter covers it).
 */
export function assertEnv(env: EnvLike = process.env): void {
  const isProduction = env.NODE_ENV === "production";
  const missing = missingProductionEnv(env);

  if (hasNoModelProvider(env)) {
    // Not fatal: stub mode is a deliberate feature so the whole flow stays
    // testable without a key. It is a real problem in production though, where
    // it silently serves a placeholder answer instead of a real one.
    console.warn(
      "[env] Kein Modell-Provider konfiguriert (ZAI_API_KEY / GEMINI_API_KEY). " +
        "Der Chat antwortet im Stub-Modus mit einer Demo-Antwort."
    );
  }

  if (hasInsecureAppUrl(env)) {
    console.warn(
      "[env] NEXT_PUBLIC_APP_URL ist in Produktion nicht https " +
        `(${env.NEXT_PUBLIC_APP_URL}). Folgen: Session-Cookies werden OHNE das ` +
        "Secure-Flag gesetzt (lib/supabase/cookie-options.ts), und Bestätigungs- " +
        "sowie Passwort-Reset-Mails verlinken auf diese Adresse. Auf die öffentliche " +
        "https-Adresse der Deployment setzen."
    );
  }

  if (hasInvalidCheckoutUrl(env)) {
    console.warn(
      "[env] NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL ist gesetzt, aber unbrauchbar " +
        `(${env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL}). Erwartet wird eine https-Adresse ` +
        "auf einem *.lemonsqueezy.com-Host. Folge: Der Pro-Knopf führt auf die " +
        "Registrierung statt in den Checkout, es kann niemand kaufen."
    );
  }

  if (missing.length === 0) return;

  const detail = missing.map((m) => `  - ${m.name}: ${m.why}`).join("\n");
  const summary = `${missing.length} erforderliche Umgebungsvariable(n) fehlen:\n${detail}`;

  if (isProduction) {
    throw new Error(
      `[env] ${summary}\nSiehe .env.example. Der Start wird abgebrochen, ` +
        "weil die App damit nicht bedienbar wäre."
    );
  }

  console.warn(`[env] ${summary}\n(In der Entwicklung nur ein Hinweis, in Produktion ein Fehler.)`);
}
