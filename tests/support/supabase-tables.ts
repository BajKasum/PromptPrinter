/**
 * Ein Supabase-Client über festen Zeilen, ohne RLS, mit dem Teil der Abfragesprache, den die Seiten und die
 * Server-Module lesen: `select` (auch `{ count: "exact", head: true }`), `eq`, `is`, `gte`, `order`, `limit`,
 * `range`, `maybeSingle`, `rpc` und das `await` auf die Kette. Er filtert, sortiert, kappt und zählt wie PostgREST, `count` zählt
 * also alle passenden Zeilen, unabhängig von `limit` und `range`. Weil keine Policy mitspielt, zeigt ein Test, ob eine
 * Abfrage selbst nach dem Konto eingrenzt. `errors` lässt eine Tabelle oder Funktion mit einem Fehler antworten, wie
 * supabase-js: `data` und `count` sind null, geworfen wird nichts. `reads` hält je Abfrage fest, was gefragt wurde.
 *
 * Wer nur einfache Zeilenabfragen braucht, nimmt supabase-rows.ts.
 */
export type Row = Record<string, unknown>;
export type Filter = [operator: "eq" | "is" | "gte", column: string, value: unknown];

const matches = (row: Row, [operator, column, value]: Filter) =>
  operator === "gte" ? String(row[column]) >= String(value) : row[column] === value;
export type Read = {
  table: string;
  columns: string;
  filters: Filter[];
  head: boolean;
  range?: [number, number];
  limit?: number;
};

type Result = { data: Row[] | null; count: number | null; error: { message: string } | null };

export type TablesClientOptions = {
  tables?: Record<string, Row[]>;
  /** Antwort je Funktionsname von `rpc`. */
  rpc?: Record<string, Row[]>;
  /** Meldung je Tabelle oder Funktionsname: die Abfrage liefert dann diesen Fehler. */
  errors?: Record<string, string>;
};

export function tablesClient({ tables = {}, rpc = {}, errors = {} }: TablesClientOptions = {}) {
  const reads: Read[] = [];
  const rpcCalls: string[] = [];

  function failure(name: string): Result | null {
    return Object.hasOwn(errors, name) ? { data: null, count: null, error: { message: errors[name] } } : null;
  }

  function from(table: string) {
    const read: Read = { table, columns: "", filters: [], head: false };
    reads.push(read);
    const order: { column: string; ascending: boolean }[] = [];
    let counted = false;

    const matching = () => {
      const rows = (tables[table] ?? []).filter((row) => read.filters.every((filter) => matches(row, filter)));
      // Die erste `order` entscheidet, spätere nur bei Gleichstand.
      return [...rows].sort((a, b) => {
        for (const { column, ascending } of order) {
          const left = String(a[column]);
          const right = String(b[column]);
          if (left !== right) return left.localeCompare(right) * (ascending ? 1 : -1);
        }
        return 0;
      });
    };
    const run = (): Result => {
      const failed = failure(table);
      if (failed) return failed;
      const all = matching();
      let rows = all;
      if (read.range) rows = rows.slice(read.range[0], read.range[1] + 1);
      if (read.limit !== undefined) rows = rows.slice(0, read.limit);
      return { data: read.head ? null : rows, count: counted ? all.length : null, error: null };
    };

    const chain = {
      select: (columns = "*", options?: { count?: string; head?: boolean }) => {
        read.columns = columns;
        counted = options?.count === "exact";
        read.head = options?.head === true;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        read.filters.push(["eq", column, value]);
        return chain;
      },
      is: (column: string, value: unknown) => {
        read.filters.push(["is", column, value]);
        return chain;
      },
      gte: (column: string, value: unknown) => {
        read.filters.push(["gte", column, value]);
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        order.push({ column, ascending: options?.ascending ?? true });
        return chain;
      },
      limit: (count: number) => {
        read.limit = count;
        return chain;
      },
      range: (first: number, last: number) => {
        read.range = [first, last];
        return chain;
      },
      maybeSingle: async () => {
        const result = run();
        return { ...result, data: result.data?.[0] ?? null };
      },
      then: <T, E = never>(resolve: (value: Result) => T, reject?: (reason: unknown) => E) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return chain;
  }

  return {
    reads,
    rpcCalls,
    from,
    rpc: async (name: string): Promise<Result> => {
      rpcCalls.push(name);
      return failure(name) ?? { data: rpc[name] ?? [], count: null, error: null };
    },
  };
}
