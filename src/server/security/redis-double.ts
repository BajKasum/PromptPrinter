import "server-only";

type Fn = (...args: never[]) => unknown;

/**
 * Nur für Tests: legt `multi()` und das Rückgabe-Skript von reserve-counter.ts über einfache Attrappen für
 * `incr`, `expire`, `decr` und `sadd`, damit ein Test die einzelnen Schritte prüfen kann. `exec` scheitert als Ganzes.
 * Jeder Schritt bekommt genau die Argumente des Aufrufs, ein `expire` ohne Modus also zwei.
 */
export function counterRedisDouble<T extends { incr?: unknown; expire?: unknown; decr?: unknown; sadd?: unknown }>(
  double: T
) {
  return {
    ...double,
    multi() {
      const steps: Array<() => unknown> = [];
      const chain = {
        incr(key: string) {
          steps.push(() => (double.incr as (key: string) => unknown)(key));
          return chain;
        },
        expire(key: string, seconds: number, ...mode: string[]) {
          steps.push(() => (double.expire as Fn as (k: string, s: number, ...m: string[]) => unknown)?.(key, seconds, ...mode));
          return chain;
        },
        sadd(key: string, ...members: string[]) {
          steps.push(() => (double.sadd as (key: string, ...members: string[]) => unknown)(key, ...members));
          return chain;
        },
        async exec() {
          const results: unknown[] = [];
          for (const step of steps) results.push(await step());
          return results;
        },
      };
      return chain;
    },
    eval: (_script: string, keys: string[]) => (double.decr as (key: string) => unknown)(keys[0]),
  };
}
