import "server-only";

import { logWarning } from "@/shared/lib/observability";
import { redis } from "@/server/security/redis-client";

// Die Tagesbudgets des Servers (Serverschlüssel und Ausweich-Anbieter), aus rate-limit.ts ausgelagert
// (Dateigröße, Betriebs-Audit Folgesitzung 2026-10-07). Unverändert verschoben; rate-limit.ts reicht die drei
// Funktionen weiter, die Aufrufer importieren wie bisher von dort.

// ─── Global daily budget for the server's own provider key ──────────────────

/**
 * Default ceiling on calls per UTC day that run on the SERVER's provider key.
 *
 * Roughly $0.012 per call at the observed worst case (24k input + 6144 output
 * tokens on glm-4.5-air), so 1000 bounds a bad day at about $12 rather than at
 * "whatever the internet felt like".
 *
 * Re-modelled 2026-07-30: Free has zero allowance on the server's key (plans.ts,
 * pricing.ts) — a Free account without a BYOK key can't reach chatCompleteStream
 * at all, and one WITH a key never calls this either, since BYOK bypasses it
 * (the whole point of bringing your own key). So this budget's only possible
 * spenders, structurally, are Pro/Team accounts that haven't configured a key
 * of their own: 1000/day is roughly 2-3 fully-maxed Pro accounts (400/month
 * each) hammering it on the same day, comfortably generous for how few paying
 * accounts this project has today, and no longer exposed to Free at any volume
 * — the population this backstop has to survive shrank on its own.
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

/**
 * Eigenes Tagesbudget fuer Zuege, die wegen eines Ausfalls von Z.ai auf Gemini
 * laufen (Betriebs-Audit M3, llm-failover.ts).
 *
 * Eigene Zahl statt derselben wie oben, weil Gemini je Zug deutlich mehr kostet
 * als glm-4.5-air (grob das Achtfache, Stand 03.09.2026: $1,50/$9,00 gegen
 * $0,20/$1,10 je Mio. Tokens). Wuerde ein Ausfall die ganzen 1000 Zuege des
 * normalen Budgets auf Gemini schieben, kaeme die Rechnung etwa auf das
 * Achtfache. Mit 200 Zuegen (rund $4,50 im Beobachtungsfall von 6k rein, 1,5k
 * raus) bleibt der Ausfall eine begrenzte Ausgabe, und der Zug zaehlt ausserdem
 * weiter gegen das normale Budget (er hat dort schon seinen Platz reserviert).
 *
 * Ist es aufgebraucht, laeuft kein Zug mehr auf Gemini, und der Nutzer bekommt
 * die ehrliche Fehlermeldung des Ausfalls: das ist die gewollte Obergrenze, kein
 * Fehler. Anpassbar ueber LLM_FAILOVER_DAILY_CALLS.
 */
const DEFAULT_DAILY_FAILOVER_CALLS = 200;

function dailyFailoverBudget(): number {
  const raw = Number(process.env.LLM_FAILOVER_DAILY_CALLS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_FAILOVER_CALLS;
}

let warnedFailoverBudgetExhausted = false;

/**
 * Reserviert einen Failover-Zug fuer heute (UTC). Gleiche Form wie
 * reserveServerKeyCall: `null` ohne Redis oder bei einem Redis-Fehler (dann gilt
 * keine Obergrenze, ein Zug auf dem Ausweich-Anbieter ist besser als keiner), und
 * `release()` gibt den Platz zurueck, wenn auch Gemini scheitert.
 */
export async function reserveFailoverCall(): Promise<{
  allowed: boolean;
  release: () => Promise<void>;
} | null> {
  if (!redis) return null;

  const day = new Date().toISOString().slice(0, 10);
  const key = `llm-failover-calls:${day}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 2 * 24 * 60 * 60);
    }
    const budget = dailyFailoverBudget();
    if (count > budget && !warnedFailoverBudgetExhausted) {
      warnedFailoverBudgetExhausted = true;
      logWarning("spend_guard.failover_budget_exhausted", {
        day,
        used: count,
        budget,
        note: "Ausweich-Anbieter gesperrt, solange Z.ai ausfaellt antworten Zuege mit einem Fehler. LLM_FAILOVER_DAILY_CALLS pruefen.",
      });
    }
    return {
      allowed: count <= budget,
      release: async () => {
        try {
          await redis!.decr(key);
        } catch {
          // Best effort wie bei reserveServerKeyCall.
        }
      },
    };
  } catch {
    return null;
  }
}
