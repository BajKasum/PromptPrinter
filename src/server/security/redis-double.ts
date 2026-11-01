import "server-only";

type Fn = (...args: never[]) => unknown;

/**
 * Nur für Tests: legt `multi()` und das Rückgabe-Skript von reserve-counter.ts über einfache Attrappen für
 * `incr`, `expire` und `decr`, damit ein Test die einzelnen Schritte prüfen kann. `exec` scheitert als Ganzes.
 */
export function counterRedisDouble<T extends { incr?: unknown; expire?: unknown; decr?: unknown }>(double: T) {
  return {
    ...double,
    multi() {
      const steps: Array<() => unknown> = [];
      const chain = {
        incr(key: string) {
          steps.push(() => (double.incr as (key: string) => unknown)(key));
          return chain;
        },
        expire(key: string, seconds: number, mode: string) {
          steps.push(() => (double.expire as Fn as (k: string, s: number, m: string) => unknown)?.(key, seconds, mode));
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
