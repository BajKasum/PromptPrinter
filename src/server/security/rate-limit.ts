import "server-only";

/**
 * Rate limiter. Uses Upstash Redis when UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN are set, durable and shared across serverless
 * instances, the only limiter that's actually global. Falls back to an
 * in-memory map when unconfigured, but that fallback is scoped to one
 * process/instance, fine for local dev (a single process), not a real limit
 * in serverless/multi-instance production (each instance gets its own N
 * requests, multiplying the real ceiling by however many instances are warm).
 * In production without Upstash configured, requests fail closed instead of
 * silently running under a limiter that no longer limits anything global, außer im Einzelbetrieb (server/self-hosted.ts):
 * ein einzelner Prozess, für den die Map im Speicher die ganze Grenze ist.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { logWarning } from "@/shared/lib/observability";
import { logRateLimited } from "@/server/security/security-log";
import { redis } from "@/server/security/redis-client";
import { addressBucket } from "@/server/security/url-safety";
import { isSelfHosted } from "@/server/self-hosted";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Every key that ever hits the fallback gets an entry that only ever
// OVERWRITES on expiry, never deletes (QA finding P-5): a single caller
// cycling through many keys (any IP, and before rateLimitKey's own fix, any
// value a caller could put in x-forwarded-for) grew this map forever. A
// counter that sweeps expired entries out every Nth write bounds it without
// a size-limited cache dependency for what is already only a fallback path
// (Upstash is the real limiter; this only runs when it's unset, or once per
// key in dev). 1000 is arbitrary, just infrequent enough that the sweep
// itself is never the hot path.
let writesSinceSweep = 0;
// Exported so the test can drive exactly this many writes rather than
// hardcoding a copy of the threshold that could silently drift from it.
export const SWEEP_EVERY_N_WRITES = 1000;

function sweepExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Test-only introspection into the fallback map's size, so the sweep can be
 * verified without 1000 real calls per test. Not used by any runtime code
 * path — the map itself stays module-private everywhere else.
 */
export function __unsafeFallbackBucketCountForTests(): number {
  return buckets.size;
}

function memoryRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    if (++writesSinceSweep >= SWEEP_EVERY_N_WRITES) {
      writesSinceSweep = 0;
      sweepExpiredBuckets(now);
    }
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

// ─── Upstash (production) ────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === "production";
let warnedMissingRedisInProduction = false;

// One Ratelimit per (limit, windowMs) combo. Several routes call rateLimit()
// with their own limit/window (chat, projects, settings/api-key, account),
// each with a different ceiling, so this memoises per combo rather than
// hardcoding a fixed set, avoiding rebuilding a limiter on every request.
// The ceiling is NOT part of the Redis key, so routes only get separate
// counters through separate keys (see RateLimitScope).
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
      prefix: "promptprinter/rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function rateLimit(key: string, ceiling: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  const result = await checkRateLimit(key, ceiling);
  if (!result.allowed) logRateLimited(key);
  return result;
}

async function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  if (redis) {
    try {
      const { success, remaining, reset } = await getLimiter(limit, windowMs).limit(key);
      return { allowed: success, remaining, resetAt: reset };
    } catch (err) {
      // Redis unreachable, degrade to the in-memory limiter instead of failing
      // the request outright. Limiting stays on, but only per-instance now: N
      // warm serverless instances each enforce this independently, so the real
      // ceiling across the deployment is N times higher than `limit` says.
      // Feeding the same `limit` through here would silently multiply the
      // configured ceiling for as long as the outage lasts — precisely the
      // moment an actual attack is most likely underway (QA finding P-7),
      // rather than degrading. A tenth of the real limit per instance is a
      // deliberately blunt compromise: still lets legitimate traffic through
      // during a brief hiccup, without handing out N times the real ceiling.
      logWarning("rate_limit.redis_call_failed", {
        error: err instanceof Error ? err.message : String(err),
        degradedLimit: Math.max(1, Math.ceil(limit / 10)),
        originalLimit: limit,
      });
      return memoryRateLimit(key, { limit: Math.max(1, Math.ceil(limit / 10)), windowMs });
    }
  }

  if (isProduction && !isSelfHosted()) {
    // Upstash was never configured at all, not a transient outage, a missing
    // setup step. Refuse instead of quietly enforcing a per-instance limit
    // that isn't a real ceiling anymore (see the module comment above).
    if (!warnedMissingRedisInProduction) {
      warnedMissingRedisInProduction = true;
      logWarning("rate_limit.redis_missing_in_production", {
        note:
          "UPSTASH_REDIS_REST_URL/_TOKEN fehlen, Requests werden abgelehnt statt auf einen " +
          "Per-Instanz-Limiter zurueckzufallen, der nichts mehr begrenzt.",
      });
    }
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
  }

  return memoryRateLimit(key, { limit, windowMs });
}

// Das Tagesbudget des Servers liegt in daily-budget.ts (Dateigröße), bleibt von hier aus erreichbar.
export {
  readDailyServerKeyUsage,
  reserveFailoverCall,
  reserveServerKeyCall,
} from "@/server/security/daily-budget";

/**
 * Ein Zähler je Aktion. Upstash bildet den Redis-Schlüssel aus Präfix, Kennung
 * und Zeitfenster, die Obergrenze gehört nicht dazu: zwei Routen mit demselben
 * Schlüssel und demselben Fenster erhöhen denselben Zähler und vergleichen ihn
 * nur mit ihrer eigenen Grenze. Fünf Chat-Antworten sperrten so den Datenexport
 * (Grenze 5). Darum hat jede Route einen eigenen Namen, und `rateLimitKey`
 * verlangt ihn. Jeder Eintrag darf genau einmal vorkommen
 * (tests/guards/rate-limit-scopes.test.ts).
 */
export type RateLimitScope =
  | "chat"
  | "projects"
  | "brain"
  | "brain-status"
  | "consent"
  | "contact"
  | "auth"
  | "api-key-save"
  | "api-key-update"
  | "api-key-delete"
  | "account-delete"
  | "account-export"
  | "cli-device"
  | "cli-approve"
  | "cli-token"
  | "cli-refresh"
  | "cli-logout"
  | "cli-sessions"
  | "cli-session-revoke"
  | "mfa-status"
  | "mfa-enroll"
  | "mfa-code"
  | "mfa-recover"
  | "cli-me"
  | "cli-prompts"
  | "cli-prompt"
  | "prompt-share"
  | "prompt-share-read"
  | "prompt-share-revoke"
  | "share-view"
  | "test-run";

/**
 * Der Zähler, gegen den eine Anfrage zählt, immer innerhalb eines `scope`: das angemeldete Konto, sonst der Anschluss
 * (clientAddressBucket). Der Zweig ohne Konto ist die einzige Bremse der anonymen Routen: auth, contact, cli-device,
 * cli-token, cli-refresh und cli-logout rufen ohne Nutzer auf. Welche Kopfzeile die Adresse liefert und warum nur
 * diese, steht bei clientIp.
 */
export function rateLimitKey(
  req: Request,
  scope: RateLimitScope,
  userId?: string | null
): string {
  if (userId) return `${scope}:u:${userId}`;
  return `${scope}:ip:${clientAddressBucket(req)}`;
}

/**
 * Der Zähler eines Kontos von einem Anschluss aus (clientAddressBucket). Für Grenzen, die jemand mit demselben
 * Konto, etwa mit dem Passwort, nicht für den Besitzer aufbrauchen soll. Das Protokoll (logRateLimited) liest davon nur
 * Bereich und Konto, nie die Adresse.
 */
export function rateLimitKeyPerAddress(req: Request, scope: RateLimitScope, userId: string): string {
  return `${scope}:u:${userId}:ip:${clientAddressBucket(req)}`;
}

/**
 * Der Anschluss einer Anfrage als Kennung eines Zählers: die Adresse aus clientIp, IPv6 als ihr /64 (addressBucket).
 * Ein Anschluss bekommt meist ein ganzes /64, mit der einzelnen Adresse bekäme jede darin einen frischen Zähler. Jeder
 * Zähler je IP nimmt diese Kennung: rateLimitKey ohne Konto, rateLimitKeyPerAddress und die Tagesgrenze des
 * Gratis-Rahmens (server/free-trial.ts). Turnstile bekommt weiter die genaue Adresse aus clientIp.
 */
export function clientAddressBucket(req: Request): string {
  return addressBucket(clientIp(req));
}

/**
 * Die genaue Adresse des Aufrufers, wie der Rand sie meldet, etwa für `remoteip` bei Turnstile; ein Zähler nimmt
 * clientAddressBucket. Es gibt nur diese eine Ableitung der Adresse: eine zweite an anderer Stelle liesse leicht wieder
 * einen Kopf gelten, den der Aufrufer selbst wählt, und jeder neue Wert darin wäre ein frischer Zähler.
 *
 * Auf Vercel gelten nur die Köpfe, die der Rand laut Dokumentation selbst setzt
 * (https://vercel.com/docs/headers/request-headers): x-vercel-forwarded-for zuerst, denn ein Proxy, den ein Kunde
 * vor Vercel stellt, kann es nicht überschreiben, dann x-forwarded-for und x-real-ip mit demselben Wert.
 * cf-connecting-ip setzt Vercel nie, den könnte jeder selbst schicken. x-forwarded-for ist eine Kette: jeder Proxy
 * hängt an, was er gesehen hat, der Wert des Aufrufers steht also vorn und der vom Rand beobachtete hinten. Vercel
 * überschreibt den Kopf mit einem einzelnen Wert; der letzte Eintrag zählt trotzdem, für den Fall eines Trusted Proxy
 * vor Vercel, mit dem er wieder eine Kette wäre.
 *
 * Weiterleitungs-Köpfe sagen nur dann die Wahrheit, wenn ein Rand sie setzt. Auf
 * Vercel (VERCEL ist dort immer gesetzt) ist das so. Eine eigene Installation
 * nennt in TRUSTED_PROXY_HOPS, wie viele Proxys vor ihr stehen; ohne die Angabe
 * schickt der Client den Kopf selbst und jeder Wert wäre ein frischer Zähler, also
 * gilt "unknown": alle anonymen Anfragen teilen sich einen Zähler (docs/DOCKER.md).
 */
export function clientIp(req: Request): string {
  if (!process.env.VERCEL) return selfHostedClientIp(req);

  // x-vercel-forwarded-for first: identical to x-forwarded-for, but immune to
  // being overwritten by a proxy the customer places in front of Vercel.
  for (const header of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const chain = req.headers.get(header);
    if (chain) {
      // Last entry only: everything before it was supplied by the caller.
      // Vercel itself sends a single value (it overwrites, not appends), so
      // this is a no-op there — it only matters for a Trusted Proxy chain.
      const last = chain.split(",").at(-1)?.trim();
      if (last) return last;
    }
  }

  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  return "unknown";
}

/**
 * Jeder Proxy hängt an, was er gesehen hat. Bei n vertrauten Proxys steht der Client also an der n-ten
 * Stelle von hinten, alles davor hat er selbst geschickt. Eine kürzere Kette ist nicht durch diese
 * Proxys gelaufen und zählt nicht.
 */
function selfHostedClientIp(req: Request): string {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 1) return "unknown";
  const chain = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  return chain.at(-hops)?.trim() || "unknown";
}
