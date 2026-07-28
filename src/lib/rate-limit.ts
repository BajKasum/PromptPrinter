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
import { logWarning } from "@/lib/observability";

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

  if (isProduction) {
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
 *
 * The DB-count fallback this leaves callers to is soft in a way this reservation
 * isn't (QA finding F-9): it counts a user's own `messages` rows, which the
 * user can delete (conversations cascade), so the counter measures a
 * *deletable* balance rather than a *monotonic* one — deleting old chats
 * resets it. That is a real gap in principle, but Upstash is a hard
 * requirement in production (src/lib/env.ts's boot check refuses to start
 * without it, see QA finding S-2), so the DB-count path only ever runs in
 * dev/self-hosting, where it is an accepted, documented soft spot rather than
 * something worth a new `usage_counters` table and its own RLS/grants for.
 * Revisit if self-hosting without Redis ever becomes a real deployment target.
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
// ─── Global daily budget for the server's own provider key ──────────────────

/**
 * Default ceiling on calls per UTC day that run on the SERVER's provider key.
 *
 * Roughly $0.012 per call at the observed worst case (24k input + 6144 output
 * tokens on glm-4.5-air), so 1000 bounds a bad day at about $12 rather than at
 * "whatever the internet felt like". Generous against real use: Free allows 200
 * messages a month, so this is ~150 fully-exhausted free accounts per day.
 *
 * Override with LLM_DAILY_CALL_BUDGET once real traffic says otherwise — that
 * is a business decision, not a code change.
 */
const DEFAULT_DAILY_SERVER_KEY_CALLS = 1000;

function dailyServerKeyBudget(): number {
  const raw = Number(process.env.LLM_DAILY_CALL_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_SERVER_KEY_CALLS;
}

/**
 * Today's server-key call count and its ceiling, without consuming a slot.
 * Feeds the admin ops view (QA finding C-7) — the counter is the one number
 * that would have made the anonymous-chat hole visible while it was open, so
 * it needs to be readable somewhere other than a log line.
 */
export async function readDailyServerKeyUsage(): Promise<{
  used: number;
  budget: number;
} | null> {
  const budget = dailyServerKeyBudget();
  if (!redis) return null;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const used = await redis.get<number>(`llm-daily-calls:${day}`);
    return { used: Number(used ?? 0), budget };
  } catch {
    return null;
  }
}

let warnedBudgetExhausted = false;

/**
 * The circuit breaker behind QA finding S-1's per-route fixes: a global ceiling
 * on how much the server's own key can be spent in one day, regardless of who
 * is calling or through which route.
 *
 * The per-user quotas and the hourly limit both assume the attacker is a user.
 * This one does not — it is the backstop for the *next* leak, the one nobody
 * has found yet, and it is the only control that would have bounded the damage
 * of the anonymous-chat hole while it was open.
 *
 * Deliberately NOT exempt for admins: this is a spend ceiling on one shared
 * resource (the operator's own provider account), not a fairness quota, so
 * "who is asking" is the wrong axis. BYOK calls never reach here at all — they
 * run on the user's own key and cost the operator nothing, which is also what
 * makes tripping this survivable: a BYOK user keeps working.
 *
 * Fails OPEN when Redis is unavailable, matching reserveMonthlyQuota: a hiccup
 * must not take chat down for everyone, and the hourly limit still applies.
 */
export async function reserveServerKeyCall(): Promise<{
  allowed: boolean;
  release: () => Promise<void>;
} | null> {
  if (!redis) return null;

  const day = new Date().toISOString().slice(0, 10); // UTC, YYYY-MM-DD
  const key = `llm-daily-calls:${day}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 2 * 24 * 60 * 60);
    }
    const budget = dailyServerKeyBudget();
    if (count > budget && !warnedBudgetExhausted) {
      warnedBudgetExhausted = true;
      logWarning("spend_guard.budget_exhausted", {
        day,
        used: count,
        budget,
        note: "Server-Key gesperrt, BYOK laeuft weiter. LLM_DAILY_CALL_BUDGET pruefen.",
      });
    }
    return {
      allowed: count <= budget,
      release: async () => {
        try {
          await redis!.decr(key);
        } catch {
          // Best-effort, same as reserveMonthlyQuota: a missed release only
          // holds one slot for the rest of the day, never over-grants.
        }
      },
    };
  } catch {
    return null;
  }
}

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
