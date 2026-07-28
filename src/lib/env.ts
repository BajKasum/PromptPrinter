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

/** Missing required variables for the given environment, in declaration order. */
export function missingProductionEnv(
  env: EnvLike = process.env
): EnvRequirement[] {
  return REQUIRED_IN_PRODUCTION.filter((requirement) => isBlank(env[requirement.name]));
}

/** True when neither server-side model provider is configured (stub mode). */
export function hasNoModelProvider(env: EnvLike = process.env): boolean {
  return isBlank(env.ZAI_API_KEY) && isBlank(env.GEMINI_API_KEY);
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
