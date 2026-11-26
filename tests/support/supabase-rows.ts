/**
 * Ein Supabase-Client über festen Zeilen, ohne RLS: eine Abfrage liefert jede Zeile, die ihre eigenen Filter
 * durchlassen, wie eine Datenbank, deren Policy zu weit geht. So zeigt ein Test, ob eine Seite selbst nach dem Konto
 * eingrenzt (CLAUDE.md: RLS und zusätzlich `.eq("user_id", …)`), statt sich allein auf die Policy zu verlassen.
 *
 * Nachgebaut ist, was die Seiten damit lesen: `select`, `eq`, `is`, `order` (ohne Wirkung auf die Reihenfolge),
 * `limit`, `maybeSingle` und das `await` auf die Kette. `reads` hält je Abfrage die Tabelle und ihre Filter fest.
 */
export type Row = Record<string, unknown>;
export type Filter = [operator: "eq" | "is", column: string, value: unknown];
export type Read = { table: string; filters: Filter[] };

export function rowsClient(tables: Record<string, Row[]>) {
  const reads: Read[] = [];
  return {
    reads,
    from(table: string) {
      const filters: Filter[] = [];
      let take = Number.POSITIVE_INFINITY;
      reads.push({ table, filters });
      const rows = () =>
        (tables[table] ?? []).filter((row) => filters.every(([, column, value]) => row[column] === value)).slice(0, take);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push(["eq", column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push(["is", column, value]);
          return chain;
        },
        order: () => chain,
        limit: (count: number) => {
          take = count;
          return chain;
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: <T, E = never>(
          resolve: (value: { data: Row[]; error: null }) => T,
          reject?: (reason: unknown) => E
        ) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      };
      return chain;
    },
  };
}
