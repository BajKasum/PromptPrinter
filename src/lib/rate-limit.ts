/**
 * Rate limiter. Uses Upstash Redis when UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN are set, durable and shared across serverless
 * instances, the only limiter that's actually global. Falls back to an
 * in-memory map when unconfigured, but that fallback is scoped to one
 * process/instance, fine for local dev (a single process), not a real limit
 * in serverless/multi-instance production (each instance gets its own N
 * requests, multiplying the real ceiling by however many instances are warm).
 * In production without Upstash configured, requests fail closed instead of
 * silently running under a limiter that no longer limits anything global.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

// ─── Upstash (production) ────────────────────────────────────────────────────
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const isProduction = process.env.NODE_ENV === "production";
let warnedMissingRedisInProduction = false;

// One Ratelimit per (limit, windowMs) combo, the route uses two (5/h anonymous,
// 30/h authed), memoised so we don't rebuild a limiter on every request.
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

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  if (redis) {
    try {
      const { success, remaining, reset } = await getLimiter(limit, windowMs).limit(key);
      return { allowed: success, remaining, resetAt: reset };
    } catch {
      // Redis unreachable, degrade to the in-memory limiter instead of failing
      // the request outright. Limiting stays on (per-instance) during an outage.
      return memoryRateLimit(key, { limit, windowMs });
    }
  }

  if (isProduction) {
    // Upstash was never configured at all, not a transient outage, a missing
    // setup step. Refuse instead of quietly enforcing a per-instance limit
    // that isn't a real ceiling anymore (see the module comment above).
    if (!warnedMissingRedisInProduction) {
      warnedMissingRedisInProduction = true;
      console.error(
        "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN missing in production, " +
          "refusing requests instead of silently falling back to a per-instance limiter."
      );
    }
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
  }

  return memoryRateLimit(key, { limit, windowMs });
}

export function rateLimitKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  return `ip:${fwd}`;
}
