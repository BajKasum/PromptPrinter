import "server-only";

import { redis } from "@/server/security/redis-client";
import { reserveCounter, type CounterReservation } from "@/server/security/reserve-counter";
import { clientIp } from "@/server/security/rate-limit";
import { logWarning } from "@/shared/lib/observability";
import { FREE_TRIAL } from "@/shared/lib/plans";

// Der Gratis-Rahmen: ein Free-Konto ohne eigenen Key bekommt FREE_TRIAL.prompts fertige Prompts über den
// Server-Key, höchstens FREE_TRIAL.turns Züge (Rückfragen zählen nicht als Prompt, aber als Zug). Konten lassen
// sich ohne Mailbestätigung beliebig anlegen, deshalb hängen drei Grenzen davor, die nicht am Konto hängen: Züge
// je IP und Tag, ein eigenes Tagesbudget des Rahmens und dahinter das allgemeine Tagesbudget des Server-Keys
// (model-call.ts). Alles in Redis, ohne Migration.
//
// Ohne Redis gibt es in Produktion keinen Gratis-Rahmen (fail closed): anders als Kontingent und Tagesbudget, die
// zahlenden Konten gelten und offen ausfallen, ist der Rahmen ein Geschenk, und ohne Zähler wäre er unbegrenzt.
// In der Entwicklung zählt eine Map im Prozess, damit der Ablauf lokal ohne Upstash prüfbar bleibt.

const ACCOUNT_TTL_SECONDS = 400 * 24 * 60 * 60;
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;

/** Züge je IP und Tag: zwei volle Rahmen, danach hilft ein weiteres Konto vom selben Anschluss nichts mehr. */
export const FREE_TRIAL_TURNS_PER_IP_DAY = 2 * FREE_TRIAL.turns;

/**
 * Züge des Gratis-Rahmens je UTC-Tag, über alle Konten. 200 Züge kosten auf glm-4.5-air im ungünstigsten Fall
 * (24k Token rein, 6k raus) rund 2,40 $ am Tag, im Mittel deutlich weniger. Über FREE_TRIAL_DAILY_CALLS änderbar.
 */
const DEFAULT_DAILY_CALLS = 200;

function dailyCalls(): number {
  const raw = Number(process.env.FREE_TRIAL_DAILY_CALLS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_CALLS;
}

const promptsKey = (userId: string) => `free-trial:prompts:${userId}`;
const turnsKey = (userId: string) => `free-trial:turns:${userId}`;
const ipKey = (ip: string, day: string) => `free-trial:ip:${ip}:${day}`;
const dayKey = (day: string) => `free-trial:day:${day}`;
const utcDay = () => new Date().toISOString().slice(0, 10);

// ─── Zähler: Redis, in der Entwicklung ohne Redis eine Map ─────────────────────

const memory = new Map<string, number>();
const memoryAllowed = () => !redis && process.env.NODE_ENV !== "production";

/** Nur für Tests. */
export function __resetFreeTrialMemoryForTests(): void {
  memory.clear();
}

async function readCount(key: string): Promise<number | null> {
  if (memoryAllowed()) return memory.get(key) ?? 0;
  if (!redis) return null;
  try {
    const raw = Number((await redis.get<number>(key)) ?? 0);
    return Number.isFinite(raw) ? Math.max(0, raw) : null;
  } catch {
    return null;
  }
}

async function reserve(key: string, limit: number, ttlSeconds: number): Promise<CounterReservation | null> {
  if (memoryAllowed()) {
    const count = (memory.get(key) ?? 0) + 1;
    memory.set(key, count);
    return {
      allowed: count <= limit,
      release: async () => {
        memory.set(key, Math.max(0, (memory.get(key) ?? 1) - 1));
      },
    };
  }
  return reserveCounter({ key, limit, ttlSeconds });
}

/** Zählt ohne Grenze hoch und gibt den neuen Stand zurück; null bei einem Redis-Fehler. */
async function increment(key: string): Promise<number | null> {
  if (memoryAllowed()) {
    const count = (memory.get(key) ?? 0) + 1;
    memory.set(key, count);
    return count;
  }
  if (!redis) return null;
  try {
    const [count] = await redis.multi().incr(key).expire(key, ACCOUNT_TTL_SECONDS, "NX").exec<[number, 0 | 1]>();
    return count;
  } catch {
    return null;
  }
}

// ─── Lesen ────────────────────────────────────────────────────────────────────

/** Wie viele Gratis-Prompts das Konto noch hat; null, wenn der Rahmen gerade nicht zählbar ist (kein Redis). */
export async function freePromptsLeft(userId: string): Promise<number | null> {
  const [prompts, turns] = await Promise.all([readCount(promptsKey(userId)), readCount(turnsKey(userId))]);
  if (prompts === null || turns === null) return null;
  if (turns >= FREE_TRIAL.turns) return 0;
  return Math.max(0, FREE_TRIAL.prompts - prompts);
}

// ─── Reservieren ──────────────────────────────────────────────────────────────

export type FreeTrialSlot = {
  /** Gibt Zug, IP-Platz und Tagesplatz zurück, wenn der Zug nichts gekostet hat. */
  release: () => Promise<void>;
  /** Der Zug hat einen fertigen Prompt geliefert: zählt ihn und gibt zurück, wie viele noch bleiben. */
  promptDelivered: () => Promise<number>;
  /** Der Zug war eine Rückfrage: wie viele Prompts bleiben (unverändert, aber die Zuggrenze kann erreicht sein). */
  promptsLeft: () => Promise<number>;
};

export type FreeTrialRefusal = "exhausted" | "budget" | "unavailable";

type Step<R extends string> = { key: string; limit: number; ttl: number; refusal: R };

/**
 * Reserviert die Schritte der Reihe nach. Scheitert einer, gehen alle bis dahin zurück, und die Antwort ist seine
 * Ablehnung (ohne Redis "unavailable"); sonst die Rückgabe aller Plätze.
 */
async function reserveAll<R extends string>(
  steps: Step<R>[]
): Promise<{ release: () => Promise<void> } | R | "unavailable"> {
  const held: CounterReservation[] = [];
  const release = async () => {
    for (const r of held.splice(0)) await r.release();
  };
  for (const step of steps) {
    const r = await reserve(step.key, step.limit, step.ttl);
    if (!r) {
      await release();
      return "unavailable";
    }
    if (!r.allowed) {
      await r.release();
      await release();
      return step.refusal;
    }
    held.push(r);
  }
  return { release };
}

/** Grenze je IP und Tag und das Tagesbudget: gelten für alles, was im Gratis-Rahmen auf dem Server-Key läuft. */
function sharedSteps(req: Request): Step<"budget">[] {
  const day = utcDay();
  return [
    { key: ipKey(clientIp(req), day), limit: FREE_TRIAL_TURNS_PER_IP_DAY, ttl: DAY_TTL_SECONDS, refusal: "budget" },
    { key: dayKey(day), limit: dailyCalls(), ttl: DAY_TTL_SECONDS, refusal: "budget" },
  ];
}

function logBudgetRefusal(refusal: string): void {
  if (refusal === "budget") logWarning("free_trial.refused", { reason: refusal, day: utcDay() });
}

/**
 * Reserviert einen Zug im Gratis-Rahmen. Reihenfolge: Prompts (nur gelesen), Züge des Kontos, Züge der IP, Budget
 * des Tages. Jede Ablehnung gibt zurück, was bis dahin reserviert war.
 */
export async function reserveFreeTrialTurn(req: Request, userId: string): Promise<FreeTrialSlot | FreeTrialRefusal> {
  const prompts = await readCount(promptsKey(userId));
  if (prompts === null) return "unavailable";
  if (prompts >= FREE_TRIAL.prompts) return "exhausted";

  const held = await reserveAll<FreeTrialRefusal>([
    { key: turnsKey(userId), limit: FREE_TRIAL.turns, ttl: ACCOUNT_TTL_SECONDS, refusal: "exhausted" },
    ...sharedSteps(req),
  ]);
  if (typeof held === "string") {
    logBudgetRefusal(held);
    return held;
  }

  return {
    release: held.release,
    promptsLeft: async () => (await freePromptsLeft(userId)) ?? 0,
    promptDelivered: async () => {
      // Kein Limit beim Hochzählen: die Prüfung steht vor dem Zug. Laufen zwei Züge gleichzeitig, kann ein vierter
      // Prompt durchgehen; die Grenze an Zügen hält auch das klein.
      const used = await increment(promptsKey(userId));
      return used === null ? 0 : Math.max(0, FREE_TRIAL.prompts - used);
    },
  };
}

// ─── Probelauf (api/test-run) ─────────────────────────────────────────────────

const testRunKey = (userId: string, promptHash: string) => `free-trial:test-run:${userId}:${promptHash}`;
const testRunsKey = (userId: string) => `free-trial:test-runs:${userId}`;

/** `used`: dieser Prompt hatte schon seinen Probelauf, oder das Konto hat so viele wie Gratis-Prompts. */
export type FreeTrialTestRunRefusal = "used" | "budget" | "unavailable";

/**
 * Ein Probelauf im Gratis-Rahmen: höchstens einer je Prompt (Schlüssel aus dem Hash des Prompts) und höchstens so
 * viele wie Gratis-Prompts. Er zählt weder als Gratis-Prompt noch als Zug, aber gegen die Grenze je IP und das
 * Tagesbudget des Rahmens, denn auch er läuft auf dem Server-Key.
 */
export async function reserveFreeTrialTestRun(
  req: Request,
  userId: string,
  promptHash: string
): Promise<FreeTrialSlot | FreeTrialTestRunRefusal> {
  const held = await reserveAll<FreeTrialTestRunRefusal>([
    { key: testRunKey(userId, promptHash), limit: 1, ttl: ACCOUNT_TTL_SECONDS, refusal: "used" },
    { key: testRunsKey(userId), limit: FREE_TRIAL.prompts, ttl: ACCOUNT_TTL_SECONDS, refusal: "used" },
    ...sharedSteps(req),
  ]);
  if (typeof held === "string") {
    logBudgetRefusal(held);
    return held;
  }
  const left = async () => (await freePromptsLeft(userId)) ?? 0;
  return { release: held.release, promptsLeft: left, promptDelivered: left };
}
