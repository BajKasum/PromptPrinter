import "server-only";

import { redis } from "@/server/security/redis-client";

export type CounterReservation = { allowed: boolean; release: () => Promise<void> };

// `decr` auf einen abgelaufenen Schlüssel legte den Wert -1 an, ohne Ablauf. Das Skript zieht nur ab, was noch da ist.
const RELEASE_SCRIPT = `if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('DECR', KEYS[1]) end return 0`;

/**
 * Die eine Regel hinter den Kostenbremsen (Monatskontingent, Tagesbudgets): atomar hochzählen, Platz
 * reservieren, `release()` gibt ihn zurück, wenn der Aufruf nicht stattfand.
 *
 * Zählen und Ablauf laufen in einer Transaktion: ein Schlüssel ohne Ablauf bliebe für immer liegen, und ein
 * Fehler zwischen zwei Einzelbefehlen hätte den Platz verbraucht, ohne dass jemand ihn zurückgibt. `NX` lässt
 * den Ablauf des ersten Aufrufs stehen.
 *
 * `null` ohne Redis oder bei einem Redis-Fehler: die Aufrufer laufen dann ohne diese Grenze weiter (fail open),
 * ein Aussetzer soll den Chat nicht für alle abschalten, und das Stundenlimit gilt weiter. `onExhausted` läuft
 * bei jeder Überschreitung, mit dem Stand.
 */
export async function reserveCounter({
  key,
  limit,
  ttlSeconds,
  onExhausted,
}: {
  key: string;
  limit: number;
  ttlSeconds: number;
  onExhausted?: (count: number) => void;
}): Promise<CounterReservation | null> {
  if (!redis) return null;
  try {
    const [count] = await redis.multi().incr(key).expire(key, ttlSeconds, "NX").exec<[number, 0 | 1]>();
    if (count > limit) onExhausted?.(count);
    return {
      allowed: count <= limit,
      release: async () => {
        try {
          await redis!.eval(RELEASE_SCRIPT, [key], []);
        } catch {
          // Best effort: eine verpasste Rückgabe hält den Platz bis zum Ablauf, sie gewährt nie zu viel.
        }
      },
    };
  } catch {
    return null;
  }
}
