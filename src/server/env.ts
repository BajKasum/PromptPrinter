import "server-only";

import { hasSelfHostedOnVercel, isSelfHosted } from "@/server/self-hosted";

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
      "http://localhost:3000 (siehe siteUrl in shared/lib/site-url.ts).",
  },
  {
    name: "API_KEY_ENCRYPTION_SECRET",
    why: "BYOK wirft beim Speichern eines eigenen Keys (server/security/crypto.ts).",
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

/** 32 Zeichen Zufall tragen als Hex 128 Bit, als Base64 192 Bit: genug, dass Raten gegen einen Datenbank-Abzug nichts bringt. */
export const MIN_ENCRYPTION_SECRET_LENGTH = 32;

// Teile von Platzhaltern aus Vorlagen. Lang genug, dass ein echter Zufallswert sie nicht zufällig enthält: diese
// Prüfung darf eine laufende Produktion nie aus Pech anhalten. Bewusst nicht "secret" oder "test" allein.
const PLACEHOLDER_MARKERS = [
  "placeholder",
  "changeme",
  "change-me",
  "change_me",
  "replaceme",
  "replace-me",
  "replace_me",
  "your-secret",
  "your_secret",
  "yoursecret",
  "do-not-use",
  "insecure",
  "example",
];

/** So wenige verschiedene Zeichen hat kein Zufallswert dieser Länge, auch nicht in Hex ("aaaa…", "abcabc…"). */
const MIN_DISTINCT_SECRET_CHARS = 8;

/**
 * Was gegen diesen Wert von API_KEY_ENCRYPTION_SECRET spricht, sonst null. Er wird direkt zu Schlüsselmaterial
 * (server/security/crypto.ts), deshalb muss er selbst langer Zufall sein. Gilt nicht für den alten Wert einer
 * Rotation: von einem schwachen Secret soll man weg können. Der Wert selbst steht nie in einer Meldung.
 */
export function encryptionSecretProblem(secret: string): "too_short" | "placeholder" | null {
  if (secret.length < MIN_ENCRYPTION_SECRET_LENGTH) return "too_short";
  const lower = secret.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker))) return "placeholder";
  if (new Set(secret).size < MIN_DISTINCT_SECRET_CHARS) return "placeholder";
  return null;
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
        "Mensch-Prüfung — ohne das Secret verifiziert sie niemand (siehe server/security/turnstile.ts).",
    },
  ];
}

/** Im Einzelbetrieb (server/self-hosted.ts) zählt das Ratenlimit im Speicher des einen Prozesses: Upstash ist dort keine Pflicht. */
const OPTIONAL_WHEN_SELF_HOSTED = new Set(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]);

/** Missing required variables for the given environment, in declaration order. */
export function missingProductionEnv(
  env: EnvLike = process.env
): EnvRequirement[] {
  const selfHosted = isSelfHosted(env);
  return [...REQUIRED_IN_PRODUCTION, ...conditionalRequirements(env)].filter(
    (requirement) =>
      isBlank(env[requirement.name]) && !(selfHosted && OPTIONAL_WHEN_SELF_HOSTED.has(requirement.name))
  );
}

/**
 * True für eine eigene Installation, die keinem Weiterleitungs-Kopf glaubt: alle anonymen Anfragen
 * teilen sich dann einen Ratenlimit-Zähler (server/security/rate-limit.ts, clientIp). Sicher, aber bei
 * Besuchern hinter einem Proxy zu eng, daher eine Warnung und kein Abbruch.
 */
export function hasNoTrustedClientIp(env: EnvLike = process.env): boolean {
  return env.NODE_ENV === "production" && isBlank(env.VERCEL) && isBlank(env.TRUSTED_PROXY_HOPS);
}

/** True when no server-side model provider is configured (stub mode). Der eigene Endpunkt braucht Adresse UND Modell. */
export function hasNoModelProvider(env: EnvLike = process.env): boolean {
  return isBlank(env.ZAI_API_KEY) && isBlank(env.GEMINI_API_KEY) && !hasModelEndpoint(env);
}

function hasModelEndpoint(env: EnvLike): boolean {
  return !isBlank(env.LLM_BASE_URL) && !isBlank(env.LLM_MODEL);
}

/**
 * Was am eigenen Modell-Endpunkt (LLM_BASE_URL, server/llm/config.ts) nicht stimmt, sonst null. Alles davon startet,
 * der Chat antwortet dann aber nicht über diesen Endpunkt: deshalb eine Warnung mit dem Grund.
 *
 * - `no_model`: Adresse ohne LLM_MODEL. Ein Modellname ist Pflicht, einen Standard gibt es für fremde Server nicht.
 * - `shadowed`: ZAI_API_KEY oder GEMINI_API_KEY ist auch gesetzt und kommt zuerst.
 * - `needs_self_hosted`: eine http-Adresse ohne SELF_HOSTED=1. Der Aufruf scheitert dann an derselben Prüfung wie ein
 *   Endpunkt, den ein Nutzer einträgt (server/security/url-safety.ts); die prüft auch https-Ziele im eigenen Netz,
 *   aber erst beim Aufruf, weil sie den Namen auflösen muss.
 */
export function modelEndpointProblem(env: EnvLike = process.env): "no_model" | "shadowed" | "needs_self_hosted" | null {
  if (isBlank(env.LLM_BASE_URL)) return null;
  if (isBlank(env.LLM_MODEL)) return "no_model";
  if (!isBlank(env.ZAI_API_KEY) || !isBlank(env.GEMINI_API_KEY)) return "shadowed";
  if (isSelfHosted(env)) return null;
  return env.LLM_BASE_URL!.trim().toLowerCase().startsWith("https://") ? null : "needs_self_hosted";
}

/**
 * True when a PRODUCTION deployment carries a non-https NEXT_PUBLIC_APP_URL.
 *
 * Being merely *set* is not enough for this one, which is why the presence
 * check above cannot catch it: the value is load-bearing twice over, and a
 * plausible-but-wrong value (a leftover http://localhost:3000, say) boots
 * perfectly and then breaks both silently.
 *
 * 1. secureCookieOptions (server/supabase/cookie-options.ts) decides whether the
 *    session cookie gets the `Secure` flag by asking whether siteUrl() is
 *    https. Non-https here means production session cookies are written
 *    WITHOUT Secure, i.e. a browser will send them over plaintext http.
 * 2. siteUrl() builds the absolute links in confirmation and password-reset
 *    mails, so every new signup would be mailed a link into localhost.
 *
 * Deshalb bricht der Start ab. Wer das Image nur lokal über http ausprobiert, sagt es ausdrücklich:
 * ALLOW_INSECURE_APP_URL=1 macht daraus eine Warnung (docs/DOCKER.md). Hinter einem Proxy, der TLS beendet,
 * gehört hier die öffentliche https-Adresse hin.
 */
export function hasInsecureAppUrl(env: EnvLike = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  const url = env.NEXT_PUBLIC_APP_URL;
  if (isBlank(url)) return false; // already covered as a missing requirement
  return !url!.trim().toLowerCase().startsWith("https://");
}

/**
 * True while a secret rotation is open: a previous encryption secret is set and
 * differs from the current one (Betriebs-Audit 04.10.2026).
 *
 * Not an error, it is the intended state DURING a rotation. It is a warning
 * because the state is meant to be temporary: with the previous secret still
 * set, the old secret stays valid for every row that was not re-encrypted yet,
 * which defeats the point of rotating if it is left there. Without a reminder at
 * boot, "temporary" tends to become permanent.
 */
export function hasOpenEncryptionRotation(env: EnvLike = process.env): boolean {
  const previous = env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
  if (isBlank(previous)) return false;
  return previous !== env.API_KEY_ENCRYPTION_SECRET;
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

  if (hasSelfHostedOnVercel(env)) {
    throw new Error(
      "[env] SELF_HOSTED=1 gilt nur für eine Installation in einem Prozess (npm start, Docker). Auf Vercel " +
        "laufen viele Instanzen, ein Ratenlimit im Speicher begrenzt dort nichts. Die Variable entfernen."
    );
  }

  if (hasNoModelProvider(env)) {
    // Not fatal: stub mode is a deliberate feature so the whole flow stays
    // testable without a key. It is a real problem in production though, where
    // it silently serves a placeholder answer instead of a real one.
    console.warn(
      "[env] Kein Modell-Provider konfiguriert (ZAI_API_KEY / GEMINI_API_KEY / LLM_BASE_URL mit LLM_MODEL). " +
        "Der Chat antwortet im Stub-Modus mit einer Demo-Antwort."
    );
  }

  const endpointProblem = modelEndpointProblem(env);
  if (endpointProblem) {
    console.warn(
      "[env] LLM_BASE_URL ist gesetzt, wird aber nicht genutzt: " +
        {
          no_model: "LLM_MODEL fehlt (der Name des Modells auf diesem Server, etwa qwen3).",
          shadowed: "ZAI_API_KEY oder GEMINI_API_KEY ist auch gesetzt und kommt zuerst. Für den eigenen Endpunkt beide leeren.",
          needs_self_hosted:
            "die Adresse ist http. Das ist nur mit SELF_HOSTED=1 erlaubt (docs/SETUP.md, \"Selbst betreiben\").",
        }[endpointProblem]
    );
  }

  if (hasInsecureAppUrl(env)) {
    const detail =
      "[env] NEXT_PUBLIC_APP_URL ist in Produktion nicht https " +
      `(${env.NEXT_PUBLIC_APP_URL}). Folgen: Session-Cookies werden OHNE das ` +
      "Secure-Flag gesetzt (server/supabase/cookie-options.ts), und Bestätigungs- " +
      "sowie Passwort-Reset-Mails verlinken auf diese Adresse. Auf die öffentliche " +
      "https-Adresse der Deployment setzen";
    if (env.ALLOW_INSECURE_APP_URL !== "1") {
      throw new Error(`${detail}, oder für einen lokalen Versuch ALLOW_INSECURE_APP_URL=1 (docs/DOCKER.md).`);
    }
    console.warn(`${detail}. Läuft nur wegen ALLOW_INSECURE_APP_URL=1.`);
  }

  if (hasNoTrustedClientIp(env)) {
    console.warn(
      "[env] TRUSTED_PROXY_HOPS ist nicht gesetzt. Folge: Weiterleitungs-Köpfe zählen nicht, alle " +
        "anonymen Anfragen (Anmeldung, Kontaktformular, Terminal-Anmeldung) teilen sich einen " +
        "Ratenlimit-Zähler. Hinter einem Reverse Proxy die Zahl der Proxys eintragen (docs/DOCKER.md)."
    );
  }

  if (hasOpenEncryptionRotation(env)) {
    console.warn(
      "[env] API_KEY_ENCRYPTION_SECRET_PREVIOUS ist gesetzt: eine Rotation des " +
        "BYOK-Secrets ist offen. Die App liest damit noch Keys, die unter dem alten " +
        "Secret liegen, und das alte Secret bleibt gültig, bis es entfernt ist. " +
        "Mit scripts/rotate-byok-secret.mjs umschlüsseln, dann die Variable löschen " +
        "(Ablauf im Kopfkommentar des Skripts)."
    );
  }

  const secret = env.API_KEY_ENCRYPTION_SECRET;
  const secretProblem = isBlank(secret) ? null : encryptionSecretProblem(secret!);
  if (secretProblem) {
    const detail =
      "[env] API_KEY_ENCRYPTION_SECRET ist " +
      (secretProblem === "too_short"
        ? `kürzer als ${MIN_ENCRYPTION_SECRET_LENGTH} Zeichen`
        : "ein Platzhalter oder kein Zufall") +
      ". Einen neuen Wert erzeugen (.env.example); gibt es schon gespeicherte Keys, über die Rotation " +
      "(docs/SETUP.md, \"BYOK-Secret rotieren\").";
    if (isProduction) throw new Error(detail);
    console.warn(`${detail} (In der Entwicklung nur ein Hinweis, in Produktion ein Fehler.)`);
  }

  if (missing.length === 0) return;

  const detail =missing.map((m) => `  - ${m.name}: ${m.why}`).join("\n");
  const summary = `${missing.length} erforderliche Umgebungsvariable(n) fehlen:\n${detail}`;

  if (isProduction) {
    throw new Error(
      `[env] ${summary}\nSiehe .env.example. Der Start wird abgebrochen, ` +
        "weil die App damit nicht bedienbar wäre."
    );
  }

  console.warn(`[env] ${summary}\n(In der Entwicklung nur ein Hinweis, in Produktion ein Fehler.)`);
}
