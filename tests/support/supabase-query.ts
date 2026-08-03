import { vi } from "vitest";

/**
 * Nachbau eines Supabase-Query-Builders für Tests.
 *
 * Der echte Builder ist zugleich *chainbar* und *thenable*: jedes `.eq()` gibt
 * den Builder zurück, und erst das `await` führt die Query aus. Ein Mock, der
 * `.eq()` direkt auf ein Ergebnis auflöst, hält deshalb nur so lange, wie der
 * Produktivcode genau ein `.eq()` anhängt — das zweite wirft dann
 * "eq is not a function".
 *
 * Genau das passierte, als die Mutationen neben `.eq("id", …)` zusätzlich
 * `.eq("user_id", …)` bekamen (CLAUDE.mds Defense-in-depth-Standard). Der
 * Helfer bildet die Kette beliebig tief ab, damit ein weiteres Filterglied
 * kein Mock-Update in fünf Dateien mehr erzwingt.
 *
 * `calls` sammelt die Filter, sodass ein Test prüfen kann, dass tatsächlich
 * nach Besitzer eingegrenzt wurde — nicht nur, dass der Aufruf nicht crasht.
 */
export type QueryChain<T> = {
  eq: ReturnType<typeof vi.fn>;
  /** Alle `.eq()`-Aufrufe dieser Kette, in Reihenfolge: `[spalte, wert]`. */
  calls: [string, unknown][];
  then: (resolve: (value: T) => unknown) => Promise<unknown>;
};

export function queryChain<T>(result: T): QueryChain<T> {
  const calls: [string, unknown][] = [];
  const chain: QueryChain<T> = {
    eq: vi.fn((column: string, value: unknown) => {
      calls.push([column, value]);
      return chain;
    }),
    calls,
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

/** Kurzform für die häufigste Erwartung: Schreiben ging durch. */
export const okWrite = () => queryChain({ error: null });

/** Kurzform für den Fehlerpfad. */
export const failedWrite = (message = "fail") => queryChain({ error: { message } });
