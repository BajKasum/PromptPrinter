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

// One Ratelimit per (limit, windowMs) combo. Several routes call rateLimit()
// with their own limit/window (chat, projects, settings/api-key, account),
// each with a different ceiling, so this memoises per combo rather than
// hardcoding a fixed set, avoiding rebuilding a limiter on every request.
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

// ─── Monthly quota reservation (atomic, Redis-only) ─────────────────────────

/**
 * Closes a check-then-act race /api/chat's monthly chat-message quota used to
 * have: it read a DB count, compared to the plan limit, then called the LLM,
 * then persisted the turn, all as separate steps with the slow LLM call in
 * between, so concurrent requests could all read the same under-limit count
 * before any of them persisted. Redis INCR is atomic, so the reservation
 * itself can't race even when several requests land at the same instant.
 *
 * `key` should already encode the calendar month (e.g. "chat-quota:{userId}:
 * 2026-07"), a fresh key each month is what makes the count reset, the TTL
 * below is pure cleanup, not the reset mechanism.
 *
 * Returns null when Redis isn't configured or errors, callers should degrade
 * to their previous plain DB-count check in that case, same known limitation
 * as the in-memory rate-limit fallback elsewhere in this file. Deliberately
 * fails OPEN here (unlike rateLimit()'s fail-closed-in-production policy for
 * the hourly ceiling): a transient Redis hiccup briefly leaving the monthly
 * cost quota unenforced is a far smaller risk than breaking chat outright for
 * every free user during that same hiccup, and the hourly rate limit still
 * bounds the damage either way.
 */
export async function reserveMonthlyQuota(
  key: string,
  limit: number
): Promise<{ allowed: boolean; release: () => Promise<void> } | null> {
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 45 * 24 * 60 * 60);
    }
    return {
      allowed: count <= limit,
      release: async () => {
        try {
          await redis!.decr(key);
        } catch {
          // Best-effort: a missed release only leaves this slot reserved for
          // the rest of the month, never an over-grant.
        }
      },
    };
  } catch {
    return null;
  }
}

/**
 * The bucket a request counts against: the signed-in user, or the caller's IP
 * when there is none.
 *
 * The IP branch used to read `x-forwarded-for.split(",")[0]`, which is the one
 * entry in that header a caller can freely choose. XFF is a *chain*, and every
 * proxy in front of us APPENDS what it saw to whatever the client already sent,
 * so the client's own value ends up first and the address the edge actually
 * observed ends up last. Reading the first entry therefore let anyone mint an
 * unlimited number of fresh rate-limit buckets by varying a header — the limit
 * was effectively absent for unauthenticated callers.
 *
 * Order below is by trustworthiness: headers a real edge *overwrites*
 * (cf-connecting-ip, x-real-ip) beat the chain, and the chain is only ever read
 * from its last entry. A caller can of course send any of these headers too —
 * the guarantee comes from the proxy overwriting them, not from the name. So
 * once hosting is settled, narrow this to the single header that deployment's
 * edge is known to set and drop the rest; trying several is a portability
 * compromise, not a security property.
 *
 * Note that every route now requires a session (see /api/chat, /api/projects,
 * /api/settings/api-key, /api/account), so the IP branch is currently
 * unreachable in practice. It stays correct for whatever anonymous endpoint
 * comes next — that is exactly how the old bug survived unnoticed.
 */
export function rateLimitKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  return `ip:${clientIp(req)}`;
}

function clientIp(req: Request): string {
  const cloudflare = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  // Last entry only: everything before it was supplied by the caller.
  const chain = req.headers.get("x-forwarded-for");
  if (chain) {
    const last = chain.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return "unknown";
}
